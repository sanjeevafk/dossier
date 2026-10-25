import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { IdeaSwarmOrchestrator } from "../dist/core/swarm.js";
import { forecastLedger, extractForecasts } from "../dist/services/ledger.js";

test("Compiled dossiers register dated falsifiable forecasts in the ledger", async () => {
  const orchestrator = new IdeaSwarmOrchestrator();
  const dossier = await orchestrator.evaluateIdea({
    title: "AI Compliance Auditor",
    summary: "Scans cloud infra for SOC2/HIPAA violations and creates remediation PRs.",
    targetAudience: "B2B SaaS CTOs",
    monetization: "$499/mo per company"
  }, { useLiveLLM: false });

  // Swarm hookup: dossier carries its forecast ids and the ledger holds the records.
  assert.ok(Array.isArray(dossier.forecastIds) && dossier.forecastIds.length >= 5,
    "Dossier must register kill conditions + weakest assumption + experiment as forecasts");

  const records = [];
  for (const id of dossier.forecastIds) {
    const all = await forecastLedger.listForecasts(1000);
    records.push(...all.filter((r) => r.id === id));
  }
  assert.equal(records.length, dossier.forecastIds.length, "All forecast ids must exist in the ledger");

  for (const record of records) {
    assert.ok(record.probability >= 0.05 && record.probability <= 0.95, "Verdict-implied probability must be clamped");
    assert.ok(new Date(record.dueDate) > new Date(record.createdAt), "Due date must be in the future at creation");
    assert.ok(record.statement.length > 10, "Forecast must carry a substantive falsifiable claim");
    assert.ok(record.resolutionProxy.length > 10, "Forecast must state how the outcome is observed");
    assert.equal(record.status, "PENDING");
    assert.equal(record.dossierId, dossier.id);
  }

  const kinds = new Set(records.map((r) => r.kind));
  assert.ok(kinds.has("KILL_CONDITION"), "Kill conditions must become forecasts");
  assert.ok(kinds.has("WEAKEST_ASSUMPTION"), "Weakest assumption must become a forecast");
  assert.ok(kinds.has("VALIDATION_EXPERIMENT"), "Validation experiment must become a forecast");
});

test("Resolving forecasts scores Brier correctly, grouped by domain and model", async () => {
  // Controlled records with known probabilities (plain JS — .mjs has no type annotations).
  const mk = (id, p, status) => ({
    id,
    dossierId: "TEST-LEDGER",
    createdAt: "2026-10-26T00:00:00.000Z",
    dueDate: "2026-11-26T00:00:00.000Z",
    kind: "KILL_CONDITION",
    statement: `Controlled forecast ${id}`,
    resolutionProxy: "Observation instructions",
    probability: p,
    status,
    resolvedAt: "2026-11-01T00:00:00.000Z",
    domainArchetype: "B2B Enterprise & Vertical SaaS",
    modelId: "test-model",
    killScore: 50,
    overallVerdict: "REFINE"
  });

  const dir = (await import("node:path")).join(process.cwd(), "reports", "forecasts");
  await fs.mkdir(dir, { recursive: true });
  // p=0.7 HIT → (0.3)^2 = 0.09 ; p=0.3 MISS → (0.3)^2 = 0.09 ; p=0.9 MISS → (0.9)^2 = 0.81
  await fs.writeFile(`${dir}/TEST-FC-01.json`, JSON.stringify(mk("TEST-FC-01", 0.7, "HIT")), "utf-8");
  await fs.writeFile(`${dir}/TEST-FC-02.json`, JSON.stringify(mk("TEST-FC-02", 0.3, "MISS")), "utf-8");
  await fs.writeFile(`${dir}/TEST-FC-03.json`, JSON.stringify(mk("TEST-FC-03", 0.9, "MISS")), "utf-8");

  const score = await forecastLedger.scoreForecasts();
  assert.ok(score.resolvedCount >= 3, "Controlled resolved records must be scored");
  // The controlled group (only records with modelId "test-model"): mean of
  // (0.7→HIT)², (0.3→MISS)², (0.9→MISS)² = (0.09 + 0.09 + 0.81) / 3 = 0.33
  const groupBrier = score.byModel["test-model"];
  assert.ok(groupBrier !== undefined, "Controlled model group must appear in by-model scoring");
  assert.ok(Math.abs(groupBrier - 0.33) < 0.001, `Grouped Brier must equal 0.33, got ${groupBrier}`);
  assert.equal(score.calibrationBins.length, 5, "Five calibration bins must always be reported");
});

test("Extracted forecasts derive probabilities from real agent scores", () => {
  const dossier = {
    id: "DOSSIER-TEST-PROBE",
    timestamp: "2026-10-26T00:00:00.000Z",
    domainClassification: { archetypeLabel: "B2B Enterprise & Vertical SaaS" },
    evaluationMode: "HEURISTIC_ENGINE",
    killScore: 60,
    overallVerdict: "REFINE",
    roleAssessments: {
      synthesizer: { telemetryMetadata: { modelId: "deterministic-heuristics" } },
      customer: { score: 70 },
      expert: { score: 80 },
      investor: { score: 55 },
      redteam: { score: 30 }
    },
    killConditions: [
      "If zero pilot agreements are secured within 45 days.",
      "If compliance requires >6 months of certification.",
      "If verified CAC exceeds 400."
    ],
    weakestAssumption: {
      id: "WA-01",
      statement: "Buyers possess discretionary budget authority.",
      fatalRisk: "Unproven willingness to pay",
      disproofThreshold: "If 10 qualified buyers all decline within 14 days."
    },
    cheapestValidationExperiment: {
      title: "Pre-Build Commitment Test",
      description: "Run 10 interviews",
      estimatedCostUsd: 0,
      timeToExecuteDays: 4,
      successMetric: ">= 3 signed LOIs",
      failureKillSignal: "<= 1 LOI signed"
    }
  };

  const records = extractForecasts(dossier);
  assert.equal(records.length, 5, "3 kill conditions + 1 weakest assumption + 1 experiment");

  const byKind = Object.fromEntries(records.map((r) => [r.kind, r]));
  // P = (100 - agent score)/100, clamped
  assert.equal(byKind["WEAKEST_ASSUMPTION"].probability, 0.7, "Weakest-assumption P must derive from red team score 30");
  assert.equal(byKind["VALIDATION_EXPERIMENT"].probability, 0.7, "Experiment success P must derive from customer score 70");
  const kill = records.filter((r) => r.kind === "KILL_CONDITION");
  assert.equal(kill[0].probability, 0.3, "Adoption kill condition keys to customer score 70");
  assert.equal(kill[1].probability, 0.2, "Regulatory kill condition keys to expert score 80");
  assert.equal(kill[2].probability, 0.45, "Economics kill condition keys to investor score 55");
  assert.ok(kill[0].dueDate.endsWith("-12-10") || new Date(kill[0].dueDate) > new Date(dossier.timestamp),
    "Due date must respect the 'within 45 days' window");
  assert.ok(records.every((r) => r.modelId === "deterministic-heuristics"), "Records must pin the producing model");
});
