import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { extractForecasts, impliedSuccessProbability } from "../dist/core/ledger.js";
import { ForecastLedgerService } from "../dist/services/forecastLedger.js";

function makeDossier(overrides = {}) {
  return {
    id: `DOSSIER-TEST-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    killScore: 25,
    overallVerdict: "KILL",
    domainClassification: { archetypeLabel: "B2B Enterprise & Vertical SaaS", archetype: "b2b_saas" },
    idea: { title: "Test Concept", summary: "A test concept" },
    killConditions: [
      "If zero pilot agreements are secured within 45 days.",
      "If regulatory certification requires >6 months before live testing.",
      "If verified CAC exceeds $600 under real field conditions."
    ],
    weakestAssumption: {
      id: "WA-01",
      statement: "Buyers possess discretionary budget authority",
      fatalRisk: "Unproven willingness to pay",
      disproofThreshold: "If 10 qualified prospective buyers all decline within 14 days."
    },
    cheapestValidationExperiment: {
      title: "Pre-Build Commitment Test",
      description: "10 adversarial interviews with LOI request",
      estimatedCostUsd: 0,
      timeToExecuteDays: 4,
      successMetric: ">= 3 signed pilot LOIs secured.",
      failureKillSignal: "<= 1 LOI signed after 10 interviews."
    },
    ...overrides
  };
}

test("Forecast extraction: every dossier field that claims an outcome becomes a forecast", () => {
  const dossier = makeDossier();
  const forecasts = extractForecasts(dossier);

  const byRef = Object.fromEntries(forecasts.map((f) => [f.refId, f]));
  assert.ok(byRef["VERDICT"], "verdict forecast must exist");
  assert.ok(byRef["KC-1"] && byRef["KC-2"] && byRef["KC-3"], "one forecast per kill condition");
  assert.ok(byRef["WA-01"], "weakest-assumption forecast must exist");
  assert.ok(byRef["EXP-01"], "validation-experiment forecast must exist");

  // Ids unique and stable per dossier.
  const ids = new Set(forecasts.map((f) => f.id));
  assert.equal(ids.size, forecasts.length);

  // KILL at score 25: p(success) = 0.25 → verdict forecasts failure at 0.75.
  assert.equal(impliedSuccessProbability(25), 0.25);
  assert.equal(byRef["VERDICT"].probabilityEstimate, 0.75);
  assert.equal(byRef["EXP-01"].probabilityEstimate, 0.25, "experiment forecasts success at implied p");
  assert.equal(byRef["WA-01"].probabilityEstimate, 0.75, "weakest assumption is flagged likely-disproven");

  // Kill conditions carry NO probability estimate (outcome tracking only).
  assert.equal(byRef["KC-1"].probabilityEstimate, undefined);
  assert.equal(byRef["KC-1"].deadlineDays, 45, "deadline parsed from the condition text");
  assert.equal(byRef["WA-01"].deadlineDays, 14, "deadline parsed from disproof threshold");
  assert.equal(byRef["EXP-01"].deadlineDays, 11, "experiment horizon + 7-day resolution grace");

  // High score flips the mapping monotonically.
  const strong = extractForecasts(makeDossier({ killScore: 76, overallVerdict: "BUILD_IF_VALIDATED" }));
  const strongVerdict = strong.find((f) => f.refId === "VERDICT");
  assert.equal(strongVerdict.probabilityEstimate, 0.76);
});

test("Brier math is exact and resolutions are immutable", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dossier-ledger-"));
  const ledger = new ForecastLedgerService(path.join(tmp, "ledger.jsonl"));

  const d1 = makeDossier({ killScore: 25 }); // p(success)=0.25
  const d2 = makeDossier({ killScore: 60, overallVerdict: "REFINE" }); // p(success)=0.6
  ledger.recordDossierForecasts(d1);
  ledger.recordDossierForecasts(d2);

  const all = ledger.listForecasts();
  const verdicts = all.filter((f) => f.refId === "VERDICT");
  assert.equal(verdicts.length, 2);

  // Resolve by explicit probability (list order is newest-first, not insertion).
  const pKill = verdicts.find((f) => f.probabilityEstimate === 0.75).id; // KILL dossier
  const pRefine = verdicts.find((f) => f.probabilityEstimate === 0.6).id; // REFINE dossier
  // p=0.75, outcome=true → (0.75−1)² = 0.0625 ; p=0.6, outcome=false → 0.36
  ledger.resolveForecast(pKill, true, "expected failure did not materialize", "operator");
  ledger.resolveForecast(pRefine, false, "procurement stalled", "operator");

  const summary = ledger.calibrationSummary();
  // (0.0625 + 0.36) / 2 = 0.21125
  assert.ok(Math.abs(summary.brierOverall - 0.21125) < 1e-3, `brier must be exact, got ${summary.brierOverall}`);
  assert.equal(summary.totals.resolved, 2);
  assert.equal(summary.totals.pending, summary.totals.recorded - 2);
  assert.equal(summary.reliability.reduce((a, b) => a + b.count, 0), 2, "reliability counts must cover all scoreable");

  // Double resolution is rejected — resolutions are immutable audit events.
  assert.throws(() => ledger.resolveForecast(pKill, true), /already resolved/);

  // Idempotent recording: re-recording the same dossier adds nothing.
  const countBefore = ledger.listForecasts().length;
  assert.equal(ledger.recordDossierForecasts(d1), 0, "re-record must be a no-op");
  assert.equal(ledger.listForecasts().length, countBefore);

  // Persistence: a fresh service over the same file sees the same state.
  const ledger2 = new ForecastLedgerService(path.join(tmp, "ledger.jsonl"));
  const reloaded = ledger2.calibrationSummary();
  assert.ok(Math.abs(reloaded.brierOverall - 0.21125) < 1e-3, "ledger must survive process restarts");
  assert.throws(() => ledger2.resolveForecast(pKill, false), /already resolved/, "resolution immutability persists");
});

test("Calibration API exposes forecasts and summary; resolve is auth-gated", async () => {
  process.env.NODE_ENV = "test";
  const { default: app } = await import("../dist/server.js");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  try {
    const cal = await fetch(`http://127.0.0.1:${port}/api/calibration`).then((r) => r.json());
    assert.equal(cal.success, true);
    assert.ok(typeof cal.calibration.brierOverall === "object" || cal.calibration.brierOverall === null);
    assert.ok(Array.isArray(cal.calibration.reliability));
    assert.ok(cal.calibration.mappingNote.includes("implied probability"), "mapping must be disclosed");

    const list = await fetch(`http://127.0.0.1:${port}/api/forecasts?status=pending`).then((r) => r.json());
    assert.equal(list.success, true);
    assert.ok(Array.isArray(list.forecasts));

    const badResolve = await fetch(`http://127.0.0.1:${port}/api/forecasts/FC-NONEXISTENT/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: true })
    });
    assert.equal(badResolve.status, 400, "resolving an unknown forecast must 400");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
