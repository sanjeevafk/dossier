import { IdeaInput } from "../types/index.js";
import { REFERENCE_CLASSES, REFERENCE_CLASS_SOURCES, ReferenceClass } from "../data/reference-classes.js";

/**
 * Outside view (base-rate anchoring) — the reference-class counterweight to the
 * swarm's inside-view reasoning.
 *
 * The swarm scores an idea from its specifics; this module scores the CLASS of
 * idea against public survival statistics and reports the DELTA. A large
 * positive delta does not overrule the swarm — it quantifies the swarm's
 * optimism premium and forces the dossier to justify it or flag it.
 *
 * Deterministic by design: keyword matching over the idea text, no LLM in the
 * loop, so the panel is reproducible across models (that's the point — base
 * rates don't change when you swap Gemini for Claude).
 */

export interface ClassMatch {
  ref: ReferenceClass;
  matchScore: number;
}

export interface OutsideViewPanel {
  matchedClasses: Array<{
    id: string;
    label: string;
    survival24moLow: number;
    survival24moHigh: number;
    matchScore: number;
  }>;
  /** swarm killScore / 100, treated as the swarm-implied probability the concept thrives. */
  impliedSurvival: number;
  /** Match-weighted midpoint of matched classes' 24-month survival ranges. */
  baseSurvivalMidpoint: number;
  /** impliedSurvival - baseSurvivalMidpoint. Positive = optimism premium vs base rate. */
  optimismDelta: number;
  guidance: string;
  topFailureCauses: string[];
  sourceNote: string;
  sources: string[];
}

/** Keyword-overlap scoring with word-boundary safety; deterministic and cheap. */
function scoreClass(ideaText: string, ref: ReferenceClass): number {
  if (ref.matchKeywords.length === 0) return 0;
  let score = 0;
  for (const keyword of ref.matchKeywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boundary = new RegExp(`(^|[^a-z0-9])${escaped}`, "i");
    if (boundary.test(ideaText)) score += 1;
  }
  return score;
}

/** Match the idea to its top reference classes. Falls back to general_default. */
export function matchReferenceClasses(idea: IdeaInput): ClassMatch[] {
  const text = `${idea.title} ${idea.summary} ${idea.targetAudience} ${idea.monetization} ${idea.techStack || ""}`.toLowerCase();

  const scored = REFERENCE_CLASSES
    .filter((ref) => ref.id !== "general_default")
    .map((ref) => ({ ref, matchScore: scoreClass(text, ref) }))
    .filter((m) => m.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 2);

  if (scored.length === 0) {
    const fallback = REFERENCE_CLASSES.find((ref) => ref.id === "general_default")!;
    return [{ ref: fallback, matchScore: 1 }];
  }
  return scored;
}

function guidanceFor(delta: number, classLabels: string[]): string {
  if (delta > 0.25) {
    return `Swarm sits ${Math.round(delta * 100)}pts ABOVE the ${classLabels.join(" / ")} base rate — a strong optimism premium. The dossier must name the class-atypical advantage (proprietary data, regulatory grip, asymmetric distribution) that justifies it, or the score should be treated as inside-view inflation.`;
  }
  if (delta > 0.10) {
    return `Swarm sits ${Math.round(delta * 100)}pts above the ${classLabels.join(" / ")} base rate — a moderate optimism premium. Plausible if execution evidence exists; otherwise discount toward the base rate.`;
  }
  if (delta >= -0.10) {
    return `Swarm verdict is consistent with the ${classLabels.join(" / ")} base rate — no material optimism premium detected.`;
  }
  return `Swarm sits ${Math.abs(Math.round(delta * 100))}pts BELOW the ${classLabels.join(" / ")} base rate — the swarm is harsher than history for this class. Verify the kill logic is domain-informed, not generic priors.`;
}

/** Build the outside-view panel for a scored idea. */
export function buildOutsideViewPanel(idea: IdeaInput, killScore: number): OutsideViewPanel {
  const matches = matchReferenceClasses(idea);
  const totalWeight = matches.reduce((a, m) => a + m.matchScore, 0) || 1;

  const baseSurvivalMidpoint =
    matches.reduce(
      (acc, m) => acc + ((m.ref.survival24mo.low + m.ref.survival24mo.high) / 2) * (m.matchScore / totalWeight),
      0
    );

  const impliedSurvival = Math.max(0, Math.min(1, killScore / 100));
  const optimismDelta = Math.round((impliedSurvival - baseSurvivalMidpoint) * 100) / 100;

  // Dominant failure causes of the matched classes, deduped, class-ranked.
  const causeCounts = new Map<string, number>();
  for (const m of matches) {
    for (const cause of m.ref.failureCauses) {
      causeCounts.set(cause, (causeCounts.get(cause) ?? 0) + m.matchScore);
    }
  }
  const topFailureCauses = [...causeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cause]) => cause);

  return {
    matchedClasses: matches.map((m) => ({
      id: m.ref.id,
      label: m.ref.label,
      survival24moLow: m.ref.survival24mo.low,
      survival24moHigh: m.ref.survival24mo.high,
      matchScore: m.matchScore
    })),
    impliedSurvival: Math.round(impliedSurvival * 100) / 100,
    baseSurvivalMidpoint: Math.round(baseSurvivalMidpoint * 100) / 100,
    optimismDelta,
    guidance: guidanceFor(optimismDelta, matches.map((m) => m.ref.label)),
    topFailureCauses,
    sourceNote: REFERENCE_CLASS_SOURCES.sourceNote,
    sources: REFERENCE_CLASS_SOURCES.sources
  };
}
