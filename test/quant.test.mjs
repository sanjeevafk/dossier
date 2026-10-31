import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runEconomicsSimulation } from "../dist/tools/sandbox.js";
import { IdeaSwarmOrchestrator } from "../dist/core/swarm.js";

const execFileAsync = promisify(execFile);

const WORKTREE = process.cwd();

async function runPython(script, payload) {
  // Both sandbox scripts accept an input-file path as argv[1] — same pattern the
  // production sandbox uses (async execFile cannot feed stdin reliably).
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "dossier-quant-test-"));
  const inputPath = path.join(tmpDir, "inputs.json");
  await fs.writeFile(inputPath, JSON.stringify(payload), "utf-8");
  try {
    const { stdout } = await execFileAsync(
      "python3",
      [`${WORKTREE}/scripts/${script}`, inputPath],
      { timeout: 60000, maxBuffer: 4 * 1024 * 1024 }
    );
    return JSON.parse(stdout.trim());
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

test("Sobol script: structural validity and irrelevance of token_cost to LTV/CAC", async () => {
  const d = await runPython("simulate_sobol.py", {
    pricing_monthly: 149,
    churn_mean: 0.04,
    cac: 400,
    sobol_samples: 512
  });

  assert.equal(d.method, "saltelli-sobol-numpy");
  assert.equal(d.params.length, 4);
  assert.ok(d.modelEvaluations > 0);

  const fo = d.outputs.ltv_cac.first_order;
  const to = d.outputs.ltv_cac.total_order;
  for (const k of Object.keys(fo)) {
    assert.ok(fo[k] >= 0 && fo[k] <= 1.05, `first-order ${k} must be a valid share`);
    assert.ok(to[k] >= 0 && to[k] <= 1.05, `total-order ${k} must be a valid share`);
    assert.ok(to[k] >= fo[k] - 0.12, `total-order ${k} must be >= first-order within estimator noise`);
  }
  // token_cost does not enter ltv_cac — its index must be ~0.
  assert.ok(fo.token_cost < 0.15, `token_cost must be ~irrelevant to ltv_cac, got ${fo.token_cost}`);
  // Ranking must be sorted descending by total-order index.
  const ranking = d.ltvCacSensitivityRanking;
  for (let i = 1; i < ranking.length; i++) {
    assert.ok(ranking[i - 1].totalOrderIndex >= ranking[i].totalOrderIndex, "ranking must be sorted");
  }
});

test("Sobol estimator reproduces analytic first-order shares on a linear model", async () => {
  // y = 2*x0 + 1*x1 with x ~ N(0,1): S_0 = 0.8, S_1 = 0.2, no interactions.
  const { stdout } = await execFileAsync(
    "python3",
    [
      "-c",
      `
import importlib.util, json, numpy as np
spec = importlib.util.spec_from_file_location("sob", "${WORKTREE}/scripts/simulate_sobol.py")
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
rng = np.random.default_rng(11)
N = 40000
A = rng.normal(size=(N,2)); B = rng.normal(size=(N,2))
y = lambda X: 2*X[:,0] + X[:,1]
Ay, By = y(A), y(B)
ABs = []
for i in range(2):
    AB = B.copy(); AB[:, i] = A[:, i]
    ABs.append(y(AB))
fo, to, V = m.sobol_indices(Ay, By, ABs)
print(json.dumps({"fo": fo, "to": to}))
`
    ],
    { timeout: 60000, maxBuffer: 1024 * 1024 }
  );
  const { fo } = JSON.parse(stdout);
  assert.ok(Math.abs(fo.pricing_monthly - 0.8) < 0.05, `S_0 must be ~0.8, got ${fo.pricing_monthly}`);
  assert.ok(Math.abs(fo.churn_mean - 0.2) < 0.05, `S_1 must be ~0.2, got ${fo.churn_mean}`);
});

test("Monte Carlo script emits a coherent value-of-information block", async () => {
  const d = await runPython("simulate_monte_carlo.py", {
    pricing_monthly: 29,
    churn_mean: 0.09,
    cac: 150,
    users_m12: 500,
    iterations: 8000
  });

  const voi = d.valueOfInformation;
  assert.ok(voi, "valueOfInformation block must exist");
  assert.ok(typeof voi.evpiPerCustomer === "number" && voi.evpiPerCustomer >= 0);
  assert.ok(
    voi.expectedPayoffWithPerfectInfo >= Math.max(voi.expectedPayoffIfProceeding, 0) - 0.02,
    "perfect info value must dominate the uninformed optimum (within rounding)"
  );
  const shares = voi.partialEvpi.map((e) => e.shareOfEvpi);
  for (const s of shares) assert.ok(s >= 0 && s <= 1.001, "partial EVPI shares must be valid");
  // NOTE: partial-EVPI values need not sum to EVPI — information values are
  // subadditive across parameters, so shares can legitimately sum above 1.
  for (let i = 1; i < voi.partialEvpi.length; i++) {
    assert.ok(
      voi.partialEvpi[i - 1].evpiPerCustomer >= voi.partialEvpi[i].evpiPerCustomer,
      "partial EVPI must be ranked descending"
    );
  }
});

test("Sandbox enriches metrics with Sobol + VOI when python runtime is available", async () => {
  const sim = await runEconomicsSimulation(29.0, 0.09, 150.0, 500, 800, 30);
  assert.equal(sim.exitCode, 0, "python sandbox must succeed");
  assert.ok(sim.metrics.voi, "VOI stats must be present");
  assert.ok(sim.metrics.sobol, "Sobol stats must be present");
  assert.equal(sim.metrics.sobol.method, "saltelli-sobol-numpy");
  assert.ok(sim.metrics.sobol.modelEvaluations > 0);
});

test("Orchestrator dossier carries VOI-ranked validation priority", async () => {
  const orchestrator = new IdeaSwarmOrchestrator();
  const dossier = await orchestrator.evaluateIdea(
    {
      title: "MarginalUnit: thin-margin subscription billing tool",
      summary: "Low-margin subscription billing utility for small SaaS with tight unit economics.",
      targetAudience: "Small SaaS operators",
      monetization: "$29/mo"
    },
    { useLiveLLM: false }
  );

  assert.ok(dossier.simulation.voi, "dossier simulation must carry VOI stats");
  if (dossier.validationPriority && dossier.validationPriority.length > 0) {
    for (let i = 1; i < dossier.validationPriority.length; i++) {
      assert.ok(
        dossier.validationPriority[i - 1].evpiPerCustomer >= dossier.validationPriority[i].evpiPerCustomer,
        "validation priority must be ranked by EVPI"
      );
      assert.ok(dossier.validationPriority[i - 1].experimentTitle, "each item must map to an experiment");
    }
    // Top item must be at least as valuable as the second.
    assert.ok(dossier.validationPriority[0].shareOfEvpi >= dossier.validationPriority[dossier.validationPriority.length - 1].shareOfEvpi);
  }
  // EV-09 evidence item appears exactly when EVPI is positive.
  const ev9 = dossier.evidenceFeed.find((e) => e.id === "EV-09");
  const hasVoi = (dossier.simulation.voi?.evpiPerCustomer ?? 0) > 0;
  assert.equal(Boolean(ev9), hasVoi, "EV-09 must mirror the VOI state");
  if (ev9) {
    assert.equal(ev9.tier, "VERIFIED_COMPUTATION");
    assert.ok(ev9.provenance.includes("Sandbox"));
  }
});

test("Consistent base and stress LTV model: cohort dynamics align without model drift", async () => {
  const sim = await runPython("simulate_monte_carlo.py", {
    pricing_monthly: 99,
    churn_mean: 0.05,
    cac: 300,
    users_m12: 1000,
    iterations: 5000,
    seed: 42
  });

  const baseP50 = sim.ltvCacPercentiles.p50;
  const stress = sim.stressMetrics;

  assert.ok(stress, "Stress metrics must be present");
  assert.equal(stress.churnStressed, true);
  assert.equal(stress.cacStressed, true);

  // Stressed parameters (higher churn, higher CAC, lower pricing) must produce worse LTV/CAC
  assert.ok(
    stress.stressLtvCacRatio < baseP50,
    `Stressed LTV/CAC (${stress.stressLtvCacRatio}) must be strictly lower than base P50 (${baseP50})`
  );

  // Stressed survival must be <= base survival
  assert.ok(
    stress.stressSurvival24Mo <= sim.survivalProbability24Mo,
    `Stressed survival (${stress.stressSurvival24Mo}) must be <= base survival (${sim.survivalProbability24Mo})`
  );

  // Stressed payback months must be >= base payback months
  assert.ok(
    stress.stressPayback50 >= sim.paybackPercentiles.p50,
    `Stressed payback (${stress.stressPayback50}mo) must be >= base payback (${sim.paybackPercentiles.p50}mo)`
  );
});
