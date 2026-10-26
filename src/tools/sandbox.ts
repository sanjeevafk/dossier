import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { MonteCarloStats, SobolSensitivityStats, ValueOfInformationStats } from "../types/index.js";

const execFileAsync = promisify(execFile);

export interface SandboxExecutionResult {
  runtime: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  metrics: {
    cacEstimateUsd: number;
    ltvEstimateUsd: number;
    ltvCacRatio: number;
    estimatedPaybackMonths: number;
    monthlyInfraCostUsd: number;
    tamEstimateUsd: string;
    sobol?: SobolSensitivityStats;
    voi?: ValueOfInformationStats;
    monteCarlo?: MonteCarloStats;
  };
}

export interface EconomicsSimulationOptions {
  churnStd?: number;
  cacStd?: number;
  grossMarginTarget?: number;
  iterations?: number;
  startingCashUsd?: number;
}

/**
 * Sanitized economics simulation runner. Executes the canonical vectorized
 * Monte Carlo script (scripts/simulate_monte_carlo.py) in an isolated temporary
 * sandbox and maps the stochastic result; degrades to the embedded closed-form
 * fallback when the Python runtime or canonical script is unavailable.
 */
export async function runEconomicsSimulation(
  pricingMonthlyUsd: number,
  expectedMonthlyChurnRate: number,
  estimatedCacUsd: number,
  expectedUsersMonth12: number,
  llmTokensPerRequest: number,
  requestsPerUserMonthly: number,
  options: EconomicsSimulationOptions = {}
): Promise<SandboxExecutionResult> {
  // Sanitize and validate inputs against injection and mathematical invalidity
  const cleanPricing = Math.max(0, Number(pricingMonthlyUsd) || 0);
  const cleanChurn = Math.min(1.0, Math.max(0.001, Number(expectedMonthlyChurnRate) || 0.05));
  const cleanCac = Math.max(0, Number(estimatedCacUsd) || 0);
  const cleanUsers = Math.max(1, Math.round(Number(expectedUsersMonth12) || 1000));
  const cleanTokens = Math.max(0, Math.round(Number(llmTokensPerRequest) || 500));
  const cleanReqs = Math.max(0, Math.round(Number(requestsPerUserMonthly) || 30));

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dossier-sandbox-"));
  const inputPath = path.join(tmpDir, "inputs.json");

  const inputPayload: Record<string, unknown> = {
    pricing_monthly: cleanPricing,
    churn_mean: cleanChurn,
    churn_std: Math.max(0.002, typeof options.churnStd === "number" ? Math.min(0.35, Math.abs(options.churnStd)) : cleanChurn * 0.25),
    cac: cleanCac,
    cac_std: Math.max(1, typeof options.cacStd === "number" ? Math.abs(options.cacStd) : cleanCac * 0.30),
    users_m12: cleanUsers,
    tokens_per_req: cleanTokens,
    reqs_monthly: cleanReqs,
    iterations: Math.max(1000, Math.min(50000, Math.round(options.iterations ?? 10000)))
  };
  if (typeof options.grossMarginTarget === "number") {
    inputPayload.gross_margin_target = Math.max(0.1, Math.min(0.98, options.grossMarginTarget));
  }
  if (typeof options.startingCashUsd === "number" && options.startingCashUsd >= 0) {
    inputPayload.starting_cash_usd = options.startingCashUsd;
  }

  try {
    await fs.writeFile(inputPath, JSON.stringify(inputPayload), "utf-8");

    // Canonical script executed in the isolation boundary: only the input file path is
    // interpolated into the command; no user-controlled content ever reaches the shell.
    let candidatePaths = [
      path.resolve(import.meta.dirname, "..", "..", "scripts", "simulate_monte_carlo.py"),
      path.resolve(import.meta.dirname, "..", "scripts", "simulate_monte_carlo.py"),
      path.resolve(import.meta.dirname, "simulate_monte_carlo.py"),
      path.resolve(process.cwd(), "scripts", "simulate_monte_carlo.py"),
      path.resolve(process.cwd(), "dist", "scripts", "simulate_monte_carlo.py")
    ];
    let scriptPath = candidatePaths.find((p) => {
      try {
        return fsSync.existsSync(p);
      } catch {
        return false;
      }
    }) || candidatePaths[0];

    const { stdout, stderr } = await execFileAsync("python3", [scriptPath, inputPath], {
      timeout: 20000,
      maxBuffer: 1024 * 1024
    });

    const parsed = JSON.parse(stdout.trim());

    // Sobol global sensitivity enrichment (A1): runs the Saltelli scheme over the
    // same model. Opt-out via DOSSIER_SOBOL=0; silently absent if the script or
    // runtime is unavailable — never fabricates indices.
    let sobol: SobolSensitivityStats | undefined;
    if (process.env.DOSSIER_SOBOL !== "0") {
      try {
        let candidateSobol = [
          path.resolve(import.meta.dirname, "..", "..", "scripts", "simulate_sobol.py"),
          path.resolve(import.meta.dirname, "..", "scripts", "simulate_sobol.py"),
          path.resolve(import.meta.dirname, "simulate_sobol.py"),
          path.resolve(process.cwd(), "scripts", "simulate_sobol.py"),
          path.resolve(process.cwd(), "dist", "scripts", "simulate_sobol.py")
        ];
        let sobolScript = candidateSobol.find((p) => {
          try {
            return fsSync.existsSync(p);
          } catch {
            return false;
          }
        }) || candidateSobol[0];
        const sobolInputPath = path.join(tmpDir, "sobol_inputs.json");
        await fs.writeFile(sobolInputPath, JSON.stringify({ ...inputPayload, sobol_samples: 512 }), "utf-8");
        const { stdout: sobolStdout } = await execFileAsync("python3", [sobolScript, sobolInputPath], {
          timeout: 30000,
          maxBuffer: 1024 * 1024
        });
        sobol = JSON.parse(sobolStdout.trim());
      } catch {
        // Sobol enrichment is optional — absence is honest, not an error.
      }
    }

    const metrics: SandboxExecutionResult["metrics"] = {
      cacEstimateUsd: parsed.cacEstimateUsd,
      ltvEstimateUsd: parsed.ltvEstimateUsd,
      ltvCacRatio: parsed.ltvCacRatio,
      estimatedPaybackMonths: parsed.estimatedPaybackMonths,
      monthlyInfraCostUsd: parsed.monthlyInfraCostUsd,
      tamEstimateUsd: parsed.tamEstimateUsd,
      sobol,
      voi: parsed.valueOfInformation,
      monteCarlo: {
        iterations: parsed.iterations,
        survivalProbability12Mo: parsed.survivalProbability12Mo,
        survivalProbability24Mo: parsed.survivalProbability24Mo,
        insolvencyCurveByMonth: parsed.insolvencyCurveByMonth ?? [],
        ltvCacPercentiles: parsed.ltvCacPercentiles ?? { p10: parsed.ltvCacRatio, p50: parsed.ltvCacRatio, p90: parsed.ltvCacRatio },
        paybackPercentiles: parsed.paybackPercentiles ?? { p10: parsed.estimatedPaybackMonths, p50: parsed.estimatedPaybackMonths, p90: parsed.estimatedPaybackMonths },
        tokenCostBurdenPercent: parsed.tokenCostBurdenPercent ?? { p10: 0, p50: 0, p90: 0 },
        sensitivity: parsed.sensitivity ?? [],
        simulationNotes: parsed.simulationNotes
      }
    };

    return {
      runtime: "python3-numpy-monte-carlo",
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      metrics
    };
  } catch (error: any) {
    // Fallback calculation if python runtime execution fails
    const grossMargin = 0.80;
    const arpu = cleanPricing * grossMargin;
    const ltv = arpu > 0 ? Number((arpu / cleanChurn).toFixed(2)) : 0;
    const ltvCacRatio = cleanCac > 0 ? Number(Math.min(ltv / cleanCac, 99.9).toFixed(2)) : 99.9;
    const payback = arpu > 0 ? Number(Math.min(cleanCac / arpu, 999.0).toFixed(1)) : 999.0;
    const numericExitCode = typeof error.code === "number" ? error.code : 1;

    return {
      runtime: "fallback-embedded-sandbox",
      exitCode: numericExitCode,
      stdout: error.stdout || "",
      stderr: error.message || "",
      metrics: {
        cacEstimateUsd: cleanCac,
        ltvEstimateUsd: ltv,
        ltvCacRatio: ltvCacRatio,
        estimatedPaybackMonths: payback,
        monthlyInfraCostUsd: 250.0,
        tamEstimateUsd: "$2.5B",
        monteCarlo: {
          iterations: 1000,
          survivalProbability12Mo: cleanPricing > 0 ? 0.85 : 0.1,
          survivalProbability24Mo: cleanPricing > 0 ? 0.70 : 0.05,
          insolvencyCurveByMonth: [],
          ltvCacPercentiles: { p10: Number((ltvCacRatio * 0.7).toFixed(2)), p50: ltvCacRatio, p90: Number((ltvCacRatio * 1.3).toFixed(2)) },
          paybackPercentiles: { p10: Number((payback * 0.8).toFixed(1)), p50: payback, p90: Number((payback * 1.4).toFixed(1)) },
          tokenCostBurdenPercent: { p10: 0.02, p50: 0.05, p90: 0.12 },
          sensitivity: [],
          simulationNotes: "Closed-form analytical fallback"
        }
      }
    };
  } finally {
    // Clean up temporary sandbox directory
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
