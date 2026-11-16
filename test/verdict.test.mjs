import test from "node:test";
import assert from "node:assert/strict";
import { decideVerdictV2, isEvidencedStructuralFatal, ratingToScore, ratingToVerdict, hasFindings } from "../src/core/swarm/verdict.ts";

const f = (over = {}) => ({ claim: "c", severity: "MAJOR", kind: "VALIDATABLE", evidence: { type: "REASONING", ref: "reasoning" }, ...over });
const op = (rating, findings = []) => ({ role: "x", rating, findings, score: ratingToScore(rating), verdict: ratingToVerdict(rating, false) });
const lanes = (r, extra = {}) => ({ analyst: op(r), customer: op(r), architect: op(r), investor: op(r), redteam: op(r), expert: op(r), ...extra });
const fatal = (type = "STATED_INPUT", ref = "founder says $4/mo and CAC $40") => f({ severity: "FATAL", kind: "STRUCTURAL", evidence: { type, ref }, cheapestTest: "t" });

test("reasoning-only or placeholder-computation fatals cannot kill", () => {
  assert.equal(isEvidencedStructuralFatal(fatal("REASONING", "because"), true), false);
  assert.equal(isEvidencedStructuralFatal(fatal("COMPUTATION", "ltv/cac 0.3"), false), false);
  assert.equal(isEvidencedStructuralFatal(fatal("COMPUTATION", "ltv/cac 0.3"), true), true);
  assert.equal(isEvidencedStructuralFatal(fatal("SOURCE", ""), true), false, "a source needs a reference");
});

test("mixed ideas with validatable risks land in REFINE, not KILL", () => {
  const op3 = (findings) => op(3, findings);
  const d = decideVerdictV2({
    opinions: lanes(3, { customer: op3([f({ severity: "FATAL", kind: "VALIDATABLE", cheapestTest: "10 interviews" })]) }),
    compositeScore: 50, economicsGrounded: false, invariantGated: false
  });
  assert.equal(d.verdict, "REFINE");
});

test("two independent lanes with evidenced structural fatals kill", () => {
  const d = decideVerdictV2({
    opinions: lanes(2, { investor: op(2, [fatal("STATED_INPUT")]), customer: op(2, [fatal("SOURCE", "https://example.com/pricing")]) }),
    compositeScore: 45, economicsGrounded: false, invariantGated: false
  });
  assert.equal(d.verdict, "KILL");
  assert.deepEqual(d.evidencedFatalLanes.sort(), ["customer", "investor"]);
});

test("one lane kills alone only on stated input, a computation or a source, not on precedent", () => {
  const stated = decideVerdictV2({ opinions: lanes(3, { investor: op(1, [fatal("STATED_INPUT")]) }), compositeScore: 50, economicsGrounded: false, invariantGated: false });
  assert.equal(stated.verdict, "KILL");
  const precedent = decideVerdictV2({ opinions: lanes(3, { investor: op(1, [fatal("PRECEDENT", "Quibi")]) }), compositeScore: 50, economicsGrounded: false, invariantGated: false });
  assert.equal(precedent.verdict, "REFINE");
});

test("invariant gates always kill; strong consensus with no fatals can reach BUILD_IF_VALIDATED", () => {
  assert.equal(decideVerdictV2({ opinions: lanes(4), compositeScore: 80, economicsGrounded: true, invariantGated: true }).verdict, "KILL");
  assert.equal(decideVerdictV2({ opinions: lanes(4), compositeScore: 70, economicsGrounded: true, invariantGated: false }).verdict, "BUILD_IF_VALIDATED");
  assert.equal(decideVerdictV2({ opinions: lanes(4, { customer: op(4, [f({ severity: "FATAL", cheapestTest: "t" })]) }), compositeScore: 70, economicsGrounded: true, invariantGated: false }).verdict, "REFINE");
});

test("a bottom-band composite kills; findings are required for the v2 rules", () => {
  assert.equal(decideVerdictV2({ opinions: lanes(1), compositeScore: 20, economicsGrounded: false, invariantGated: false }).verdict, "KILL");
  assert.equal(hasFindings(lanes(3)), true);
  assert.equal(hasFindings({ analyst: { score: 50 }, customer: { score: 50 } }), false);
});

test("three independent lanes with structural problems grounded in the stated idea kill", () => {
  const sm = () => f({ severity: "MAJOR", kind: "STRUCTURAL", evidence: { type: "STATED_INPUT", ref: "over a billion dollars committed" }, cheapestTest: "t" });
  const d = decideVerdictV2({
    opinions: lanes(2, { customer: op(2, [sm()]), investor: op(2, [sm()]), redteam: op(2, [sm()]) }),
    compositeScore: 45, economicsGrounded: false, invariantGated: false
  });
  assert.equal(d.verdict, "KILL");
  const two = decideVerdictV2({ opinions: lanes(2, { customer: op(2, [sm()]), investor: op(2, [sm()]) }), compositeScore: 45, economicsGrounded: false, invariantGated: false });
  assert.equal(two.verdict, "REFINE");
});

test("executive summary is composed from real findings in plain language", async () => {
  const { composeExecutiveSummary } = await import("../src/core/swarm/verdict.ts");
  const s = composeExecutiveSummary({
    overallVerdict: "KILL",
    findings: [
      { severity: "MINOR", kind: "EXECUTION", claim: "Minor ops risk", evidence: { type: "REASONING" } },
      { severity: "FATAL", kind: "STRUCTURAL", claim: "Unit economics are insolvent at the stated price.", evidence: { type: "STATED_INPUT" }, cheapestTest: "Pre-sell 10 annual plans at the stated price." },
      { severity: "MAJOR", kind: "VALIDATABLE", claim: "Habit inertia is untested", evidence: { type: "REASONING" }, cheapestTest: "Interview 5 target users" }
    ]
  });
  assert.match(s, /Screening verdict: kill/);
  assert.match(s, /founder's own numbers/);
  assert.match(s, /Unit economics are insolvent at the stated price/);
  assert.match(s, /Do this first: Pre-sell 10 annual plans/);
  assert.match(s, /screening review of the idea as written/);
  assert.ok(!s.includes("Swarm consensus"), "old template must be gone");
});

test("executive summary with no serious findings says so plainly", async () => {
  const { composeExecutiveSummary } = await import("../src/core/swarm/verdict.ts");
  const s = composeExecutiveSummary({
    overallVerdict: "REFINE",
    findings: [{ severity: "MINOR", kind: "EXECUTION", claim: "x", evidence: { type: "REASONING" } }]
  });
  assert.match(s, /No evidenced dealbreaker/);
  assert.ok(!s.includes("Do this first"));
});

test("ungrounded or optimistic founder economics block BUILD_IF_VALIDATED", async () => {
  const { auditFounderEconomicsVsBaseRate } = await import("../src/core/baseRates.ts");
  // b2b_saas median CAC is $1200, churn30d is 5%
  const findings = auditFounderEconomicsVsBaseRate("b2b_saas", 100, 0.01, true);
  assert.equal(findings.length, 2);
  assert.equal(findings[0].severity, "MAJOR");
  assert.equal(findings[0].kind, "VALIDATABLE");
  assert.equal(auditFounderEconomicsVsBaseRate("b2b_saas", 100, 0.01, false).length, 0);
  assert.equal(auditFounderEconomicsVsBaseRate("b2b_saas", 1000, 0.05, true).length, 0);

  assert.equal(
    decideVerdictV2({ opinions: lanes(4), compositeScore: 75, economicsGrounded: false, invariantGated: false }).verdict,
    "REFINE"
  );
  assert.equal(
    decideVerdictV2({ opinions: lanes(4), compositeScore: 75, economicsGrounded: true, invariantGated: false, optimisticEconomics: true }).verdict,
    "REFINE"
  );
});

test("insufficientInputs prevents bottom-band KILL without evidenced structural fatals", () => {
  const d = decideVerdictV2({
    opinions: lanes(1),
    compositeScore: 20,
    economicsGrounded: false,
    invariantGated: false,
    insufficientInputs: true
  });
  assert.equal(d.verdict, "REFINE");
});

test("missing-info STATED_INPUT refs cannot trigger KILL", () => {
  assert.equal(isEvidencedStructuralFatal(fatal("STATED_INPUT", "pricing not specified in pitch"), true), false);
  assert.equal(isEvidencedStructuralFatal(fatal("STATED_INPUT", "no buyer stated"), true), false);
  assert.equal(isEvidencedStructuralFatal(fatal("STATED_INPUT", "founder says $4/mo and CAC $40"), true), true);
});

test("sandbox returns breakEven fragility boundaries", async () => {
  const { runEconomicsSimulation } = await import("../src/tools/sandbox.ts");
  const sim = await runEconomicsSimulation(99, 0.05, 200, 500, 1500, 30);
  assert.equal(sim.exitCode, 0);
  assert.ok(sim.metrics.breakEven, "breakEven must be present");
  assert.ok(sim.metrics.breakEven.maxSurvivableCacUsd > 200);
  assert.ok(sim.metrics.breakEven.cacHeadroomRatio > 1.0);
  assert.ok(sim.metrics.breakEven.maxSurvivableMonthlyChurn > 0.05);
});
