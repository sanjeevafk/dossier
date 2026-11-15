import test from "node:test";
import assert from "node:assert/strict";
import { EVAL_CASES } from "../src/evaluation/cases.ts";
import { classifyIdeaDomain } from "../src/core/classifier.ts";
import { parseMonetization } from "../src/core/economics.ts";

test("evaluation set is well formed and balanced", () => {
  assert.ok(EVAL_CASES.length >= 15);
  const ids = new Set(EVAL_CASES.map((c) => c.id));
  assert.equal(ids.size, EVAL_CASES.length, "ids must be unique");
  for (const outcome of ["failure", "success", "ambiguous"]) assert.ok(EVAL_CASES.some((c) => c.outcome === outcome), `missing ${outcome} cases`);
  for (const c of EVAL_CASES) assert.ok(c.expected.length > 0, c.id);
  for (const c of EVAL_CASES.filter((x) => x.outcome === "success")) assert.ok(!c.expected.includes("KILL"), `${c.id}: a success must not accept KILL`);
});

test("deterministic stages hit the labels: classification and monetization parsing", () => {
  const classifyMisses = [];
  const parseMisses = [];
  for (const c of EVAL_CASES) {
    if (c.expectedArchetype) {
      const got = classifyIdeaDomain(c.idea).archetype;
      if (got !== c.expectedArchetype) classifyMisses.push(`${c.id}: expected ${c.expectedArchetype}, got ${got}`);
    }
    const p = parseMonetization(c.idea.monetization);
    if (c.expectedModel && p.model !== c.expectedModel) parseMisses.push(`${c.id}: model expected ${c.expectedModel}, got ${p.model}`);
    if (c.expectedMonthlyUsd !== undefined && (p.monthlyUsd === undefined || Math.abs(p.monthlyUsd - c.expectedMonthlyUsd) > 0.5)) {
      parseMisses.push(`${c.id}: monthly expected ${c.expectedMonthlyUsd}, got ${p.monthlyUsd}`);
    }
  }
  assert.deepEqual(classifyMisses, [], `classification misses:\n${classifyMisses.join("\n")}`);
  assert.deepEqual(parseMisses, [], `monetization misses:\n${parseMisses.join("\n")}`);
});
