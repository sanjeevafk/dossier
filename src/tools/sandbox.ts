import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { MonteCarloStats, SobolSensitivityStats, ValueOfInformationStats, SandboxStressStats } from "../types/index.js";

const execFileAsync = promisify(execFile);

export interface SandboxExecutionResult {
  runtime: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  degraded: boolean;
  status: "available" | "degraded" | "unavailable";
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
    stressMetrics?: SandboxStressStats;
  };
}

export interface EconomicsSimulationOptions {
  churnStd?: number;
  churnDecay?: number;
  cacStd?: number;
  grossMarginTarget?: number;
  iterations?: number;
  startingCashUsd?: number;
  runwayMonths?: number;
  seed?: number;
}

/**
 * Executes the canonical economics simulator. If the simulator cannot run,
 * return an explicitly degraded result with unavailable metrics. A failed
 * numerical computation must never become synthetic evidence.
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
    churn_decay: typeof options.churnDecay === "number" ? Math.max(0.9, Math.min(1.0, options.churnDecay)) : 0.98,
    cac: cleanCac,
    cac_std: Math.max(1, typeof options.cacStd === "number" ? Math.abs(options.cacStd) : cleanCac * 0.30),
    users_m12: cleanUsers,
    tokens_per_req: cleanTokens,
    reqs_monthly: cleanReqs,
    runway_months: typeof options.runwayMonths === "number" ? Math.max(1, Math.min(60, options.runwayMonths)) : 18,
    iterations: Math.max(1000, Math.min(50000, Math.round(options.iterations ?? 10000)))
  };
  if (typeof options.seed === "number") inputPayload.seed = Math.round(Math.abs(options.seed));
  else {
    let hash = 0;
    const key = `${cleanPricing}|${cleanChurn}|${cleanCac}|${cleanUsers}`;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    inputPayload.seed = hash;
  }
  if (typeof options.grossMarginTarget === "number") inputPayload.gross_margin_target = Math.max(0.1, Math.min(0.98, options.grossMarginTarget));
  if (typeof options.startingCashUsd === "number" && options.startingCashUsd >= 0) inputPayload.starting_cash_usd = options.startingCashUsd;

  try {
    await fs.writeFile(inputPath, JSON.stringify(inputPayload), "utf-8");
    const candidatePaths = [
      path.resolve(import.meta.dirname, "..", "..", "scripts", "simulate_monte_carlo.py"),
      path.resolve(import.meta.dirname, "..", "scripts", "simulate_monte_carlo.py"),
      path.resolve(import.meta.dirname, "simulate_monte_carlo.py"),
      path.resolve(process.cwd(), "scripts", "simulate_monte_carlo.py"),
      path.resolve(process.cwd(), "dist", "scripts", "simulate_monte_carlo.py")
    ];
    const scriptPath = candidatePaths.find((p) => {
      try { return fsSync.existsSync(p); } catch { return false; }
    }) || candidatePaths[0];

    const { stdout, stderr } = await execFileAsync("python3", [scriptPath, inputPath], { timeout: 20000, maxBuffer: 1024 * 1024 });
    const parsed = JSON.parse(stdout.trim());

    let sobol: SobolSensitivityStats | undefined;
    if (process.env.DOSSIER_SOBOL !== "0") {
      try {
        const candidateSobol = [
          path.resolve(import.meta.dirname, "..", "..", "scripts", "simulate_sobol.py"),
          path.resolve(import.meta.dirname, "..", "scripts", "simulate_sobol.py"),
          path.resolve(import.meta.dirname, "simulate_sobol.py"),
          path.resolve(process.cwd(), "scripts", "simulate_sobol.py"),
          path.resolve(process.cwd(), "dist", "scripts", "simulate_sobol.py")
        ];
        const sobolScript = candidateSobol.find((p) => {
          try { return fsSync.existsSync(p); } catch { return false; }
        }) || candidateSobol[0];
        const sobolInputPath = path.join(tmpDir, "sobol_inputs.json");
        await fs.writeFile(sobolInputPath, JSON.stringify({ ...inputPayload, sobol_samples: 512 }), "utf-8");
        const { stdout: sobolStdout } = await execFileAsync("python3", [sobolScript, sobolInputPath], { timeout: 30000, maxBuffer: 1024 * 1024 });
        sobol = JSON.parse(sobolStdout.trim());
      } catch {
        // Optional enrichment. Its absence does not invalidate the main simulation.
      }
    }

    return {
      runtime: "python3-numpy-monte-carlo",
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      degraded: false,
      status: "available",
      metrics: {
        cacEstimateUsd: parsed.cacEstimateUsd,
        ltvEstimateUsd: parsed.ltvEstimateUsd,
        ltvCacRatio: parsed.ltvCacRatio,
        estimatedPaybackMonths: parsed.estimatedPaybackMonths,
        monthlyInfraCostUsd: parsed.monthlyInfraCostUsd,
        tamEstimateUsd: parsed.tamEstimateUsd,
        sobol,
        voi: parsed.valueOfInformation,
        stressMetrics: parsed.stressMetrics,
        monteCarlo: {
          iterations: parsed.iterations,
          survivalProbability12Mo: parsed.survivalProbability12Mo,
          survivalProbability24Mo: parsed.survivalProbability24Mo,
          insolvencyCurveByMonth: parsed.insolvencyCurveByMonth ?? [],
          ltvCacPercentiles: parsed.ltvCacPercentiles,
          paybackPercentiles: parsed.paybackPercentiles,
          tokenCostBurdenPercent: parsed.tokenCostBurdenPercent,
          sensitivity: parsed.sensitivity ?? [],
          simulationNotes: parsed.simulationNotes
        }
      }
    };
  } catch (error: unknown) {
    const execErr = error as { code?: unknown; stdout?: string; message?: string };
    const numericExitCode = typeof execErr.code === "number" ? execErr.code : 1;
    return {
      runtime: "unavailable",
      exitCode: numericExitCode,
      stdout: typeof execErr.stdout === "string" ? execErr.stdout : "",
      stderr: execErr.message ?? "Economics simulator failed",
      degraded: true,
      status: "unavailable",
      metrics: {
        cacEstimateUsd: cleanCac,
        ltvEstimateUsd: 0,
        ltvCacRatio: 0,
        estimatedPaybackMonths: 0,
        monthlyInfraCostUsd: 0,
        tamEstimateUsd: "UNKNOWN — simulation unavailable",
        monteCarlo: {
          iterations: 0,
          survivalProbability12Mo: 0,
          survivalProbability24Mo: 0,
          insolvencyCurveByMonth: [],
          ltvCacPercentiles: { p10: 0, p50: 0, p90: 0 },
          paybackPercentiles: { p10: 0, p50: 0, p90: 0 },
          tokenCostBurdenPercent: { p10: 0, p50: 0, p90: 0 },
          sensitivity: [],
          simulationNotes: "Unavailable: canonical economics simulator failed to execute."
        }
      }
    };
  } finally {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
