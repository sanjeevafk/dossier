export interface AgentOutputData {
  verdict: "STRONG_KILL" | "LEAN_KILL" | "PIVOT_REQUIRED" | "VIABLE_WITH_RISK" | "STRONG_PURSUE";
  score: number;
  fatalFlaws?: string[];
  keyAssumptions?: string[];
  competitiveRisks?: string[];
  mustTestBeforeBuilding?: string[];
  rationale?: string;
}

export const VALID_VERDICTS = new Set(["STRONG_KILL", "LEAN_KILL", "PIVOT_REQUIRED", "VIABLE_WITH_RISK", "STRONG_PURSUE"]);

export function validateAgentOutput(val: unknown): { success: true; data: AgentOutputData } | { success: false; error: { issues: { path: string[]; message: string }[] } } {
  if (!val || typeof val !== "object") {
    return { success: false, error: { issues: [{ path: ["<root>"], message: "Expected object" }] } };
  }
  const obj = val as Record<string, unknown>;
  if (!VALID_VERDICTS.has(obj.verdict as string)) {
    return { success: false, error: { issues: [{ path: ["verdict"], message: `Invalid verdict: ${obj.verdict}` }] } };
  }
  if (typeof obj.score !== "number" || isNaN(obj.score) || obj.score < 0 || obj.score > 100) {
    return { success: false, error: { issues: [{ path: ["score"], message: `Score must be 0-100, got ${obj.score}` }] } };
  }
  const toStrArr = (arr: unknown): string[] | undefined => {
    if (!Array.isArray(arr)) return undefined;
    return arr.map(String);
  };
  return {
    success: true,
    data: {
      verdict: obj.verdict as AgentOutputData["verdict"],
      score: obj.score,
      fatalFlaws: toStrArr(obj.fatalFlaws),
      keyAssumptions: toStrArr(obj.keyAssumptions),
      competitiveRisks: toStrArr(obj.competitiveRisks),
      mustTestBeforeBuilding: toStrArr(obj.mustTestBeforeBuilding),
      rationale: typeof obj.rationale === "string" ? obj.rationale : undefined
    }
  };
}

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
