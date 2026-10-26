import test from "node:test";
import assert from "node:assert/strict";
import { runDecisionModel } from "../dist/tools/decision-runner.js";

test("Decision Model: ChatNotes trips thin wrapper gate with sub-35ms latency", async () => {
  const result = await runDecisionModel({
    title: "ChatNotes: AI Chrome Extension for Meeting Summaries",
    summary: "A Chrome extension that records Google Meet audio and sends transcripts to OpenAI GPT-4o to output bulleted notes into Google Docs.",
    targetAudience: "General remote workers and college students",
    monetization: "Freemium with $10/mo Pro subscription"
  });

  assert.equal(result.verdict, "KILL", "Thin wrapper must receive KILL verdict");
  assert.ok(result.fatal_flags.some((f) => f.includes("thin wrapper")), "Must flag thin wrapper gate");
  assert.ok(result.answers.moat.probabilities.thin_wrapper >= 0.28, "P(wrapper) must exceed loss-tuned threshold");
  assert.ok(result.runtimeMs < 100, `Execution must be fast (took ${result.runtimeMs}ms)`);
});

test("Decision Model: SwaraSetu trips uninsurable regulatory risk gate", async () => {
  const result = await runDecisionModel({
    title: "SwaraSetu: Offline Indic Clinical Triage (SIH26133)",
    summary: "Offline-first, voice-native clinical triage for 22+ Indic languages via Sarvam AI and deterministic WHO IMCI decision trees across WhatsApp and ASHA tablets.",
    targetAudience: "ASHA Health Workers, Rural Patients, State Health Missions",
    monetization: "B2G / NGO District Licensing ($1,200/yr per district)"
  });

  assert.equal(result.verdict, "KILL", "Healthcare malpractice / WhatsApp PHI must receive KILL verdict");
  assert.ok(result.fatal_flags.some((f) => f.includes("regulatory")), "Must flag regulatory/clinical risk gate");
  assert.ok(result.answers.regulatory_risk.probabilities.regulatory_fatal >= 0.25, "P(regulatory_fatal) must exceed threshold");
});

test("Decision Model: AutoSOC2 clears all fatal gates and receives BUILD", async () => {
  const result = await runDecisionModel({
    title: "AutoSOC2: Continuous AI Security Compliance Auditor",
    summary: "Autonomous agent pipeline that connects to AWS, GitHub, and Okta to continuously generate SOC2 Type II audit evidence and remediation PRs.",
    targetAudience: "B2B SaaS CTOs and Security Engineers (Series A-C)",
    monetization: "Enterprise SaaS ($1,200/mo per organization)"
  });

  assert.equal(result.verdict, "BUILD", "Enterprise compliance platform must clear fatal gates");
  assert.equal(result.fatal_flags.length, 0, "No fatal flags should be triggered");
  assert.ok(result.answers.moat.probabilities.thin_wrapper < 0.28, "P(wrapper) must remain below 0.28");
  assert.ok(result.answers.regulatory_risk.probabilities.regulatory_fatal < 0.25, "P(regulatory_fatal) must remain below 0.25");
});

test("Decision Model: Asymmetric loss ratio correctly weights false positives", async () => {
  const result = await runDecisionModel({
    title: "Generic Test Concept",
    summary: "Simple test case for checking loss ratio metadata.",
    targetAudience: "Developers",
    monetization: "$50/mo"
  });

  assert.ok(result.loss_ratio >= 70, `Loss ratio should reflect $150k/$2k (~75x), got ${result.loss_ratio}`);
});
