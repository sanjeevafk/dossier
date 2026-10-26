import test from "node:test";
import assert from "node:assert/strict";
import { IdeaSwarmOrchestrator } from "../dist/core/swarm.js";
import { matchReferenceClasses, buildOutsideViewPanel } from "../dist/core/outside-view.js";
import { REFERENCE_CLASSES } from "../dist/data/reference-classes.js";

test("Reference-class table is internally coherent and honestly sourced", () => {
  for (const ref of REFERENCE_CLASSES) {
    assert.ok(ref.survival24mo.low > 0 && ref.survival24mo.high <= 1, `${ref.id}: range must be within (0,1]`);
    assert.ok(ref.survival24mo.low < ref.survival24mo.high, `${ref.id}: low must be below high`);
    assert.ok(ref.failureCauses.length >= 3, `${ref.id}: must carry dominant failure causes`);
  }
  const general = REFERENCE_CLASSES.find((r) => r.id === "general_default");
  assert.ok(general, "general_default fallback class must exist");
});

test("Thin-wrapper ideas match the AI-wrapper class, not enterprise SaaS", () => {
  const idea = {
    title: "ChatNotes: AI Chrome Extension for Meeting Summaries",
    summary: "A Chrome extension that records Google Meet audio and sends transcripts to GPT to output meeting notes.",
    targetAudience: "Remote workers",
    monetization: "Freemium $10/mo"
  };
  const matches = matchReferenceClasses(idea);
  assert.ok(matches.length >= 1 && matches.length <= 2);
  assert.equal(matches[0].ref.id, "ai_thin_wrapper", "Wrapper ideas must anchor to the wrapper class");
});

test("Enterprise ideas match enterprise SaaS; unknown ideas fall back to general_default", () => {
  const enterprise = matchReferenceClasses({
    title: "AutoSOC2: Continuous Security Compliance Auditor",
    summary: "Connects to AWS, GitHub, Okta to generate SOC2 Type II audit evidence for enterprise security teams.",
    targetAudience: "B2B CTOs",
    monetization: "$1,200/mo per organization"
  });
  assert.equal(enterprise[0].ref.id, "b2b_enterprise_saas", "SOC2/compliance/enterprise keywords must match enterprise class");

  const unknown = matchReferenceClasses({
    title: "Zorblax",
    summary: "A mysterious new contraption for an unnamed purpose with no recognizable signals at all.",
    targetAudience: "Someone",
    monetization: "Unclear"
  });
  assert.equal(unknown[0].ref.id, "general_default", "No-keyword ideas must fall back to the general class");
});

test("Outside-view panel computes the optimism delta exactly from killScore vs base midpoint", () => {
  const idea = {
    title: "AutoSOC2: Continuous Security Compliance Auditor",
    summary: "SOC2 audit evidence automation for enterprise security teams.",
    targetAudience: "B2B CTOs",
    monetization: "$1,200/mo per organization"
  };
  const panel = buildOutsideViewPanel(idea, 72);
  const expectedMidpoint =
    panel.matchedClasses.reduce((acc, c) => acc + (c.survival24moLow + c.survival24moHigh) / 2 * c.matchScore, 0) /
    panel.matchedClasses.reduce((acc, c) => acc + c.matchScore, 0);
  assert.equal(panel.baseSurvivalMidpoint, Math.round(expectedMidpoint * 100) / 100, "Base midpoint must be match-weighted");
  assert.equal(panel.impliedSurvival, 0.72);
  assert.equal(panel.optimismDelta, Math.round((0.72 - panel.baseSurvivalMidpoint) * 100) / 100);
  assert.ok(panel.guidance.length > 30, "Guidance must be substantive");
  assert.ok(panel.topFailureCauses.length >= 1 && panel.topFailureCauses.length <= 4);
  assert.ok(panel.sources.length >= 2 && panel.sources.every((s) => s.startsWith("http")), "Panel must cite its sources");
});

test("Guidance escalates with the optimism premium", () => {
  const idea = {
    title: "ChatNotes meeting notes extension",
    summary: "Chrome extension, GPT wrapper for meeting summaries.",
    targetAudience: "Remote workers",
    monetization: "Freemium $10/mo"
  };
  // Wrapper class midpoint ~0.175; a 92 score is an extreme premium.
  const inflated = buildOutsideViewPanel(idea, 92);
  assert.ok(inflated.optimismDelta > 0.25, "92 on a wrapper class must be a large premium");
  assert.ok(inflated.guidance.includes("class-atypical"), "Large premiums must demand justification");

  const deflated = buildOutsideViewPanel(idea, 5);
  assert.ok(deflated.optimismDelta < -0.10, "5 on any class is far below base rate");
  assert.ok(deflated.guidance.includes("harsher than history"), "Below-base verdicts must be flagged for kill-logic review");
});

test("Orchestrator dossiers carry the outside-view panel (heuristic mode)", async () => {
  const orchestrator = new IdeaSwarmOrchestrator();
  const dossier = await orchestrator.evaluateIdea({
    title: "AI Compliance Auditor",
    summary: "Scans cloud infra for SOC2/HIPAA violations and creates remediation PRs.",
    targetAudience: "B2B SaaS CTOs",
    monetization: "$499/mo per company"
  }, { useLiveLLM: false });

  assert.ok(dossier.outsideView, "Dossier must include the outside-view panel");
  const ov = dossier.outsideView;
  assert.equal(ov.impliedSurvival, dossier.killScore / 100, "Implied survival must equal the composite score");
  assert.ok(ov.matchedClasses.length >= 1, "At least one reference class must match");
  assert.equal(
    ov.optimismDelta,
    Math.round((ov.impliedSurvival - ov.baseSurvivalMidpoint) * 100) / 100,
    "Optimism delta must be internally consistent"
  );
});
