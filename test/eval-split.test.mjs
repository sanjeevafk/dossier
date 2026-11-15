import test from "node:test";
import assert from "node:assert/strict";
import { ALL_CASES, casesFor, splitOf } from "../src/evaluation/index.ts";
import { classifyIdeaDomain } from "../src/core/classifier.ts";

test("the extended set is large, unique and balanced across outcomes", () => {
  assert.ok(ALL_CASES.length >= 80, `only ${ALL_CASES.length} cases`);
  assert.equal(new Set(ALL_CASES.map((c) => c.id)).size, ALL_CASES.length);
  const n = (o) => ALL_CASES.filter((c) => c.outcome === o).length;
  assert.ok(n("failure") >= 30 && n("success") >= 30, `failures ${n("failure")}, successes ${n("success")}`);
  for (const c of ALL_CASES.filter((x) => x.outcome === "success")) assert.ok(!c.expected.includes("KILL"), c.id);
});

test("splits are deterministic, disjoint, cover everything, and keep hindsight-leaky cases out of test", () => {
  const dev = casesFor("dev"), val = casesFor("val"), test_ = casesFor("test");
  assert.equal(dev.length + val.length + test_.length, ALL_CASES.length);
  const ids = new Set([...dev, ...val, ...test_].map((c) => c.id));
  assert.equal(ids.size, ALL_CASES.length);
  assert.ok(test_.length >= 15, `test split too small: ${test_.length}`);
  for (const c of test_) assert.ok(!c.leaky, `${c.id} is leaky but in test`);
  assert.equal(splitOf(ALL_CASES[20]), splitOf(ALL_CASES[20]));
});

test("new pitches carry no hindsight words", () => {
  const banned = /\b(failed|shut down|bankrupt|collapsed|went under|never took off|flopped)\b/i;
  for (const c of ALL_CASES.filter((x) => !x.leaky)) {
    assert.ok(!banned.test(`${c.idea.summary} ${c.idea.monetization}`), `${c.id} has a hindsight cue`);
  }
});

test("classification stays sensible on the new cases (no crash, a valid archetype)", () => {
  for (const c of ALL_CASES) assert.ok(classifyIdeaDomain(c.idea).archetype);
});
