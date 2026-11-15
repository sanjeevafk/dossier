import { EVAL_CASES, type EvalCase } from "./cases.js";
import { EXTRA_CASES } from "./cases_extra.js";
import { LOOTDROP_CASES } from "./cases_lootdrop.js";
import { YC_CASES } from "./cases_yc.js";

export type Split = "dev" | "val" | "test";

/** The first 16 cases carry hindsight cues in their text, so they are kept out of the frozen test split. */
/**
 * Loot Drop cases are real shut-down startups, but "the company died" does not always mean "this idea should have been
 * killed at the start", so REFINE is also accepted for them. They measure how often the tool waves a dead startup
 * through as BUILD_IF_VALIDATED or BUILD, and add real, sourced failures to the AUROC.
 */
const LOOTDROP: EvalCase[] = LOOTDROP_CASES.map((c) => ({ ...c, expected: ["KILL", "REFINE"] }));

export const ALL_CASES: EvalCase[] = [
  ...EVAL_CASES.map((c) => ({ ...c, leaky: true })),
  ...EXTRA_CASES,
  ...LOOTDROP,
  ...YC_CASES
];

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 10;
}

/** Deterministic 40/30/30 split by case id: tune on dev, set thresholds on val, report test once at release. */
export function splitOf(c: EvalCase): Split {
  const h = hash(c.id);
  const split: Split = h < 4 ? "dev" : h < 7 ? "val" : "test";
  return c.leaky && split === "test" ? "val" : split;
}

export function casesFor(split: Split | "all"): EvalCase[] {
  return split === "all" ? ALL_CASES : ALL_CASES.filter((c) => splitOf(c) === split);
}
