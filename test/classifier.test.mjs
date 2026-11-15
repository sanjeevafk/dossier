import test from "node:test";
import assert from "node:assert/strict";
import { classifyIdeaDomain, explainClassification } from "../src/core/classifier.ts";

const idea = (title, summary, targetAudience = "", monetization = "") => ({ title, summary, targetAudience, monetization });

test("kirana invoicing is SMB commerce, not enterprise SaaS (regression: 'invoice' alone must not decide)", () => {
  const r = classifyIdeaDomain(idea(
    "ReconcilePay",
    "An automated WhatsApp billing assistant for Indian Kirana retailers that reconciles distributor invoices via OCR, generates UPI collection links, and charges $15/month per store.",
    "Indian Kirana retailers", "$15/month per store"
  ));
  assert.equal(r.archetype, "smb_commerce");
  assert.ok(!r.primaryCustomer.includes("CTO"));
});

test("a lone weak keyword does not leave the generic bucket", () => {
  assert.equal(classifyIdeaDomain(idea("Tool", "Helps teams send an invoice faster")).archetype, "general_startup");
});

test("explicit enterprise compliance still routes to b2b_saas", () => {
  assert.equal(classifyIdeaDomain(idea("AutoSOC2", "Continuous SOC2 compliance auditor for Kubernetes clusters, sold to CISOs as enterprise SaaS")).archetype, "b2b_saas");
});

test("other domains keep their routing", () => {
  assert.equal(classifyIdeaDomain(idea("Triage", "Offline clinical triage for ASHA workers and doctors at district hospitals")).archetype, "healthcare_clinical");
  assert.equal(classifyIdeaDomain(idea("Patrol", "Autonomous drone with lidar for wildfire detection")).archetype, "hardware_robotics");
  assert.equal(classifyIdeaDomain(idea("Escrow", "Smart contract escrow on Solidity for crypto freelancers")).archetype, "web3_defi");
  assert.equal(classifyIdeaDomain(idea("Match", "A dating and matchmaking social app")).archetype, "consumer_social");
});

test("'consumer' inside another word no longer forces consumer_social", () => {
  const r = explainClassification(idea("Compliance", "Bank-grade consumerism research for enterprise SaaS compliance teams"));
  assert.notEqual(r.archetype, "consumer_social");
});

test("explainClassification exposes the score table", () => {
  const r = explainClassification(idea("X", "kirana retailer upi"));
  assert.ok(r.scores.smb_commerce >= 9);
});

test("two weak signals are enough: a freemium browser extension is a consumer product", () => {
  const r = classifyIdeaDomain(idea("TubeDigest", "A Chrome extension that summarizes YouTube lectures into study notes for college students", "College students", "$5/month freemium"));
  assert.equal(r.archetype, "consumer_social");
});
