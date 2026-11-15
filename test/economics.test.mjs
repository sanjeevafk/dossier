import test from "node:test";
import assert from "node:assert/strict";
import { parseMonetization } from "../src/core/economics.ts";

test("monthly subscription prices", () => {
  assert.equal(parseMonetization("$15/month per store").monthlyUsd, 15);
  assert.equal(parseMonetization("$5/month freemium").monthlyUsd, 5);
  assert.equal(parseMonetization("$49/month SaaS").monthlyUsd, 49);
  assert.equal(parseMonetization("USD 29 per month").monthlyUsd, 29);
});

test("annual prices are converted to monthly", () => {
  assert.equal(parseMonetization("$1,200 per district per year").monthlyUsd, 100);
  assert.equal(parseMonetization("$600/yr").monthlyUsd, 50);
});

test("rupee prices are converted to USD", () => {
  const p = parseMonetization("₹499 per month");
  assert.equal(p.model, "subscription");
  assert.ok(p.monthlyUsd > 5.9 && p.monthlyUsd < 6.1);
});

test("take-rate models are recognised and carry no invented subscription price", () => {
  const p = parseMonetization("12% take rate");
  assert.equal(p.model, "take_rate");
  assert.equal(p.takeRatePct, 12);
  assert.equal(p.monthlyUsd, undefined);
  assert.equal(parseMonetization("10% commission on each booking").takeRatePct, 10);
});

test("one-time and unparseable text are reported, not guessed", () => {
  assert.equal(parseMonetization("$2,000 one-time license").monthlyUsd, undefined);
  assert.equal(parseMonetization("ads and partnerships").model, "unknown");
  assert.equal(parseMonetization("").model, "unknown");
});
