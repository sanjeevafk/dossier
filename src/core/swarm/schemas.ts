export function validateCrossExam(val: unknown): { success: true; data: { crossExam: string; targetClaim?: string } } | { success: false } {
  if (!val || typeof val !== "object") return { success: false };
  const obj = val as Record<string, unknown>;
  if (typeof obj.crossExam !== "string" || !obj.crossExam.trim()) return { success: false };
  return {
    success: true,
    data: {
      crossExam: obj.crossExam,
      targetClaim: typeof obj.targetClaim === "string" ? obj.targetClaim : undefined
    }
  };
}

export function validateCrossfireDefense(val: unknown): { success: true; data: { defense: string; revisedScore: number; concedes: boolean } } | { success: false } {
  if (!val || typeof val !== "object") return { success: false };
  const obj = val as Record<string, unknown>;
  if (typeof obj.defense !== "string" || !obj.defense.trim()) return { success: false };
  if (typeof obj.revisedScore !== "number" || isNaN(obj.revisedScore) || obj.revisedScore < 0 || obj.revisedScore > 100) return { success: false };
  return {
    success: true,
    data: {
      defense: obj.defense,
      revisedScore: obj.revisedScore,
      concedes: Boolean(obj.concedes)
    }
  };
}

// Maps value-of-information parameters to the cheapest experiment that resolves
// them, so EVPI ranking translates directly into a validation plan.
export const VOI_EXPERIMENT_MAP: Record<string, { title: string; description: string }> = {
  churn_mean: {
    title: "Churn Resolution Cohort",
    description:
      "Track a 50-user pilot cohort for 14 days and measure real weekly retention within ±20% — churn uncertainty carries the largest decision value, and resolving it reshapes every downstream economic estimate."
  },
  cac_mean: {
    title: "Live-Channel CAC Test",
    description:
      "Spend $50–100 across one realistic acquisition channel and measure cost per activated user — resolves CAC uncertainty before any build spend scales it."
  },
  token_cost: {
    title: "Inference Load Benchmark",
    description:
      "Benchmark real token burn per core workflow at production prompt sizes — resolves the compute-cost share of gross margin."
  },
  pricing_monthly: {
    title: "Willingness-to-Pay Price Test",
    description:
      "A/B two price points on a smoke-test landing page and measure signed pre-commitment rates — resolves pricing power without building the product."
  }
};

// ---------------------------------------------------------------------------------------------
// v2 agent output: a 1-5 lane rating plus evidenced findings (see verdict.ts for how they decide verdicts).
// ---------------------------------------------------------------------------------------------
import type { Finding, FindingEvidenceType, FindingKind, FindingSeverity } from "../../types/index.js";

export interface AgentOutputV2 {
  rating: 1 | 2 | 3 | 4 | 5;
  findings: Finding[];
  strengths: string[];
  rationale?: string;
}

const SEVERITIES: FindingSeverity[] = ["FATAL", "MAJOR", "MINOR"];
const KINDS: FindingKind[] = ["STRUCTURAL", "VALIDATABLE", "EXECUTION"];
const EVIDENCE: FindingEvidenceType[] = ["STATED_INPUT", "COMPUTATION", "SOURCE", "PRECEDENT", "REASONING"];

type V2Result =
  | { success: true; data: AgentOutputV2 }
  | { success: false; error: { issues: { path: string[]; message: string }[] } };

const fail = (path: string, message: string): V2Result => ({ success: false, error: { issues: [{ path: [path], message }] } });

export function validateAgentOutputV2(val: unknown): V2Result {
  if (!val || typeof val !== "object") return fail("<root>", "Expected object");
  const obj = val as Record<string, unknown>;
  const rating = Number(obj.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return fail("rating", `rating must be 1-5, got ${obj.rating}`);
  if (!Array.isArray(obj.findings)) return fail("findings", "findings must be an array");

  const findings: Finding[] = [];
  for (const [i, raw] of (obj.findings as unknown[]).slice(0, 6).entries()) {
    if (!raw || typeof raw !== "object") return fail(`findings.${i}`, "finding must be an object");
    const f = raw as Record<string, unknown>;
    const claim = typeof f.claim === "string" ? f.claim.trim() : "";
    if (!claim) return fail(`findings.${i}.claim`, "claim is required");
    const severity = String(f.severity).toUpperCase() as FindingSeverity;
    const kind = String(f.kind).toUpperCase() as FindingKind;
    if (!SEVERITIES.includes(severity)) return fail(`findings.${i}.severity`, `invalid severity ${f.severity}`);
    if (!KINDS.includes(kind)) return fail(`findings.${i}.kind`, `invalid kind ${f.kind}`);
    const ev = (f.evidence && typeof f.evidence === "object" ? f.evidence : {}) as Record<string, unknown>;
    const evType = String(ev.type).toUpperCase() as FindingEvidenceType;
    findings.push({
      claim,
      severity,
      kind,
      // Missing or unknown evidence downgrades to REASONING: it can inform, never kill.
      evidence: { type: EVIDENCE.includes(evType) ? evType : "REASONING", ref: typeof ev.ref === "string" ? ev.ref.trim() : "" },
      cheapestTest: typeof f.cheapestTest === "string" && f.cheapestTest.trim() ? f.cheapestTest.trim() : undefined,
      killCriterion: typeof f.killCriterion === "string" && f.killCriterion.trim() ? f.killCriterion.trim() : undefined
    });
  }

  const strengths = Array.isArray(obj.strengths) ? (obj.strengths as unknown[]).map(String).slice(0, 5) : [];
  return {
    success: true,
    data: {
      rating: Math.round(rating) as AgentOutputV2["rating"],
      findings,
      strengths,
      rationale: typeof obj.rationale === "string" ? obj.rationale : undefined
    }
  };
}
