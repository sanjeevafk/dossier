/**
 * Report assembly from findings: the merged findings table (near-duplicate cross-lane
 * findings collapsed, ranked fatal-structural first) and the validation checklist
 * (one cheap test per serious finding, plus the value-of-information experiment).
 * Pure and deterministic so the report is testable without an LLM.
 */
import type { CheapestValidationExperiment, Finding, FindingEvidenceType, FindingsTableRow, ValidationChecklistItem } from "../../types/index.js";

const STOP = new Set(
  "the and for with that this from are was were has have had will would could should their its into onto per plus via not but all any can may might more most also such other without within when where what whom which while who how why your you our we they them then than only just very much many over under about between each both because before after being been being some most".split(
    /\s+/
  )
);

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []).filter((t) => !STOP.has(t));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const inter = [...a].filter((t) => b.has(t)).length;
  return inter / (a.size + b.size - inter);
}

export function rankFinding(f: { severity: string; kind: string; evidenceType?: FindingEvidenceType }): number {
  const severity = f.severity === "FATAL" ? 0 : f.severity === "MAJOR" ? 1 : 2;
  const kind = f.kind === "STRUCTURAL" ? 0 : f.kind === "VALIDATABLE" ? 1 : 2;
  const evidence = f.evidenceType === "REASONING" ? 1 : 0;
  return severity * 100 + kind * 10 + evidence;
}

export type LaneFinding = Finding & { lane: string };

/** Merge near-duplicate findings across lanes (token Jaccard >= 0.55) and rank. */
export function buildFindingsTable(findings: LaneFinding[], cap = 12): FindingsTableRow[] {
  const sorted = [...findings].sort((a, b) => rankFinding(a) - rankFinding(b));
  const rows: FindingsTableRow[] = [];
  const rowTokens: Set<string>[] = [];
  for (const f of sorted) {
    const toks = new Set(tokens(f.claim));
    const dupeIndex = rows.findIndex((_, i) => jaccard(rowTokens[i], toks) >= 0.55);
    if (dupeIndex >= 0) {
      const row = rows[dupeIndex];
      if (!row.lanes.includes(f.lane)) row.lanes.push(f.lane);
      if (!row.cheapestTest && f.cheapestTest) row.cheapestTest = f.cheapestTest;
      if (!row.killCriterion && f.killCriterion) row.killCriterion = f.killCriterion;
      continue;
    }
    if (rows.length >= cap) break;
    rows.push({
      claim: f.claim,
      severity: f.severity,
      kind: f.kind,
      evidenceType: f.evidence.type,
      evidenceRef: f.evidence.ref,
      lanes: [f.lane],
      cheapestTest: f.cheapestTest,
      killCriterion: f.killCriterion
    });
    rowTokens.push(toks);
  }
  return rows;
}

/** Ordered to-do list: the VOI experiment first, then one cheap test per serious finding. */
export function buildValidationChecklist(findings: LaneFinding[], experiment?: CheapestValidationExperiment, cap = 8): ValidationChecklistItem[] {
  const items: ValidationChecklistItem[] = [];
  if (experiment?.title) {
    items.push({
      test: experiment.description ? `${experiment.title} — ${experiment.description}` : experiment.title,
      lane: "value-of-information",
      severity: "MAJOR",
      claim: experiment.successMetric || "Resolve the highest-value uncertainty first"
    });
  }
  const withTests = [...findings]
    .filter((f) => f.severity !== "MINOR" && f.cheapestTest)
    .sort((a, b) => rankFinding(a) - rankFinding(b));
  const seenTests: Set<string>[] = [];
  for (const f of withTests) {
    if (items.length >= cap) break;
    const toks = new Set(tokens(f.cheapestTest!));
    if (seenTests.some((s) => jaccard(s, toks) >= 0.5)) continue;
    seenTests.push(toks);
    items.push({
      test: f.cheapestTest!,
      lane: f.lane,
      severity: f.severity,
      claim: f.claim,
      killCriterion: f.killCriterion
    });
  }
  return items;
}
