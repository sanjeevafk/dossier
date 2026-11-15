import type { AgentOpinion, Finding, FindingEvidenceType, RiskLevel, ValidationVerdict, Verdict } from "../../types/index.js";

/**
 * Verdict rules for findings-based (v2) agents.
 *
 * Principles:
 *  - Agents are adversarial in what they look for and neutral in how they rate it.
 *  - KILL needs an evidenced, structural, fatal problem. Reasoning alone, missing data and
 *    archetype-default numbers are unknowns, not grounds for killing an idea.
 *  - Under uncertainty the answer is REFINE with a named test, not KILL.
 */

export const LANES = ["analyst", "customer", "architect", "investor", "redteam", "expert"] as const;
export type Lane = (typeof LANES)[number];

const RATING_SCORE: Record<number, number> = { 1: 12, 2: 30, 3: 50, 4: 68, 5: 84 };

export function ratingToScore(rating: number): number {
  return RATING_SCORE[Math.min(5, Math.max(1, Math.round(rating)))];
}

/** Evidence types that can ground a kill. REASONING alone cannot. */
const KILL_GRADE_EVIDENCE: FindingEvidenceType[] = ["STATED_INPUT", "COMPUTATION", "SOURCE", "PRECEDENT"];

export function isEvidencedStructuralFatal(f: Finding, economicsGrounded: boolean): boolean {
  if (f.severity !== "FATAL" || f.kind !== "STRUCTURAL") return false;
  if (!KILL_GRADE_EVIDENCE.includes(f.evidence.type)) return false;
  if (!f.evidence.ref || f.evidence.ref.trim().length < 3) return false;
  // A computation on placeholder inputs is not evidence.
  if (f.evidence.type === "COMPUTATION" && !economicsGrounded) return false;
  return true;
}

export function ratingToVerdict(rating: number, hasEvidencedFatal: boolean): Verdict {
  if (hasEvidencedFatal) return "STRONG_KILL";
  if (rating <= 1) return "LEAN_KILL";
  if (rating === 2) return "PIVOT_REQUIRED";
  if (rating === 3) return "VIABLE_WITH_RISK";
  if (rating === 4) return "VIABLE_WITH_RISK";
  return "STRONG_PURSUE";
}

export interface VerdictInput {
  opinions: Partial<Record<Lane, AgentOpinion>>;
  compositeScore: number;
  economicsGrounded: boolean;
  /** A hard deterministic gate fired (physical impossibility, prompt injection, wrapper with no moat). */
  invariantGated: boolean;
}

export interface VerdictDecision {
  verdict: ValidationVerdict;
  riskLevel: RiskLevel;
  reasons: string[];
  evidencedFatalLanes: Lane[];
}

/** True when enough lanes returned findings for the v2 rules to apply. */
export function hasFindings(opinions: Partial<Record<Lane, AgentOpinion>>): boolean {
  return LANES.filter((l) => Array.isArray(opinions[l]?.findings)).length >= 4;
}

export function decideVerdictV2(input: VerdictInput): VerdictDecision {
  const { opinions, compositeScore, economicsGrounded, invariantGated } = input;
  const reasons: string[] = [];

  const evidencedFatalLanes: Lane[] = [];
  let strongestSingle: { lane: Lane; finding: Finding } | undefined;
  let anyFatal = false;
  let allFatalsHaveTests = true;

  for (const lane of LANES) {
    const findings = opinions[lane]?.findings ?? [];
    for (const f of findings) {
      if (f.severity === "FATAL") {
        anyFatal = true;
        if (!f.cheapestTest) allFatalsHaveTests = false;
      }
    }
    const kills = findings.filter((f) => isEvidencedStructuralFatal(f, economicsGrounded));
    if (kills.length > 0) {
      evidencedFatalLanes.push(lane);
      strongestSingle = strongestSingle ?? { lane, finding: kills[0] };
    }
  }

  if (invariantGated) {
    reasons.push("A hard invariant gate fired (physical impossibility, prompt injection, or an undefended wrapper).");
    return { verdict: "KILL", riskLevel: "CRITICAL", reasons, evidencedFatalLanes };
  }

  if (evidencedFatalLanes.length >= 2) {
    reasons.push(`Independent lanes (${evidencedFatalLanes.join(", ")}) each found an evidenced structural fatal flaw.`);
    return { verdict: "KILL", riskLevel: "CRITICAL", reasons, evidencedFatalLanes };
  }

  if (evidencedFatalLanes.length === 1 && strongestSingle) {
    const t = strongestSingle.finding.evidence.type;
    // One lane may kill alone only on the founder's own numbers or a cited source, never on a precedent analogy.
    if (t === "STATED_INPUT" || t === "COMPUTATION" || t === "SOURCE") {
      reasons.push(`${strongestSingle.lane}: structural fatal flaw backed by ${t.toLowerCase().replace("_", " ")}: ${strongestSingle.finding.claim}`);
      return { verdict: "KILL", riskLevel: "CRITICAL", reasons, evidencedFatalLanes };
    }
    reasons.push(`${strongestSingle.lane} found a structural flaw backed only by precedent: treated as a must-validate item, not a kill.`);
  }

  // Convergent structure: three independent lanes each pin a structural problem (MAJOR or FATAL) on the founder's own
  // numbers, a computation or a cited source. No single lane over-reaching can produce this.
  const convergentLanes = LANES.filter((lane) =>
    (opinions[lane]?.findings ?? []).some(
      (f) =>
        (f.severity === "FATAL" || f.severity === "MAJOR") &&
        f.kind === "STRUCTURAL" &&
        (f.evidence.type === "STATED_INPUT" || f.evidence.type === "SOURCE" || (f.evidence.type === "COMPUTATION" && economicsGrounded)) &&
        f.evidence.ref.trim().length >= 3
    )
  );
  if (convergentLanes.length >= 3) {
    reasons.push(`Three independent lanes (${convergentLanes.join(", ")}) each found a structural problem grounded in the stated idea or a source.`);
    return { verdict: "KILL", riskLevel: "HIGH", reasons, evidencedFatalLanes: convergentLanes };
  }

  if (compositeScore < 30) {
    reasons.push(`Composite ${compositeScore} is in the bottom band: every lane rates the idea poor.`);
    return { verdict: "KILL", riskLevel: "HIGH", reasons, evidencedFatalLanes };
  }

  if (compositeScore >= 68 && !anyFatal) {
    reasons.push(`Composite ${compositeScore} with no fatal finding; remaining risks are validatable.`);
    return { verdict: "BUILD_IF_VALIDATED", riskLevel: "MEDIUM", reasons, evidencedFatalLanes };
  }

  reasons.push(
    anyFatal && !allFatalsHaveTests
      ? "Open fatal-grade questions without a named test: validate before building."
      : "Risks are real but no evidenced structural fatal flaw was found: refine and run the named tests."
  );
  return { verdict: "REFINE", riskLevel: compositeScore < 45 ? "HIGH" : "MEDIUM", reasons, evidencedFatalLanes };
}

// ---- executive summary (plain language) --------------------------------------------------------
// A real brief composed from the dossier's own findings — replaces the old template sentence.
// Deterministic and free: no extra LLM call, same text in the UI, CLI and markdown export.

const VERDICT_PLAIN: Record<ValidationVerdict, string> = {
  KILL: "the review found structural problems this idea cannot survive as written",
  REFINE: "no proven dealbreaker, but real risks to settle before building",
  BUILD_IF_VALIDATED: "no structural dealbreaker found; settle the named uncertainties first, then build",
  BUILD: "no major structural risks surfaced (rare — treat with suspicion)"
};

const EVIDENCE_PLAIN: Record<FindingEvidenceType, string> = {
  STATED_INPUT: "by the founder's own numbers",
  COMPUTATION: "by the unit-economics math",
  SOURCE: "by a cited source",
  PRECEDENT: "by a named precedent",
  REASONING: "by argument alone"
};

export interface ExecutiveSummaryFinding {
  severity: Finding["severity"];
  kind: Finding["kind"];
  claim: string;
  evidence: Pick<Finding["evidence"], "type">;
  cheapestTest?: Finding["cheapestTest"];
}

export interface ExecutiveSummaryInput {
  overallVerdict: ValidationVerdict;
  findings: ExecutiveSummaryFinding[];
}

function summaryRank(f: ExecutiveSummaryFinding): number {
  const severity = f.severity === "FATAL" ? 0 : 1;
  const kind = f.kind === "STRUCTURAL" ? 0 : f.kind === "VALIDATABLE" ? 1 : 2;
  const evidence = f.evidence.type === "REASONING" ? 1 : 0;
  return severity * 100 + kind * 10 + evidence;
}

export function composeExecutiveSummary(input: ExecutiveSummaryInput): string {
  const top = input.findings
    .filter((f) => f.severity !== "MINOR")
    .sort((a, b) => summaryRank(a) - summaryRank(b))
    .slice(0, 3);

  const parts: string[] = [];
  parts.push(
    `Screening verdict: ${input.overallVerdict.replace(/_/g, " ").toLowerCase()} — ${VERDICT_PLAIN[input.overallVerdict] ?? "see the findings below"}.`
  );

  if (top.length > 0) {
    const killers = top.map((f) => `${f.claim.trim().replace(/\.+$/, "")} (${EVIDENCE_PLAIN[f.evidence.type]})`);
    parts.push(`What could kill it: ${killers.join("; ")}.`);
  } else {
    parts.push("No evidenced dealbreaker was found; the findings below are validation and execution risks, not proof the idea fails.");
  }

  const tests = top.filter((f) => f.cheapestTest).slice(0, 3).map((f) => f.cheapestTest!.trim().replace(/\.+$/, ""));
  if (tests.length > 0) parts.push(`Do this first: ${tests.join("; ")}.`);

  parts.push(
    "This is a screening review of the idea as written, not a prediction: it cannot see execution, timing or team, and its confidence is uncalibrated."
  );
  return parts.join(" ");
}
