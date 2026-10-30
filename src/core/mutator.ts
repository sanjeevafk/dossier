import {
  DomainClassification,
  IdeaInput,
  MutationProposal
} from "../types/index.js";

export interface MutationContext {
  killScore: number;
  fatalFlaw: string;
  pricing: number;
  churn: number;
  cac: number;
  survival24Mo?: number;
  ltvCacRatio?: number;
  graveyardPrecedent?: {
    companyName: string;
    burnedCapitalUsd: string;
    fatalFlaw: string;
    takeaway: string;
  };
}

const STOP_WORDS = new Set([
  "and", "the", "for", "with", "that", "this", "from", "into", "over", "under",
  "your", "their", "our", "are", "was", "were", "will", "can", "who", "what",
  "where", "when", "why", "how", "all", "any", "both", "each", "few", "more",
  "most", "other", "some", "such", "than", "too", "very", "via", "using", "uses",
  "wraps", "builds", "creates", "makes", "helps", "allows", "enables", "provides",
  "sends", "records", "outputs", "general", "target"
]);

function titleCase(words: string[]): string {
  return words
    .map((w) => w.replace(/[^a-zA-Z0-9-]/g, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * The Idea Autopsy & Mutation Engine (plan 3.3).
 * When the resilience score collapses below 55, invert the fatal flaws into three
 * algorithmic strategic pivots: the Wedge Pivot, the Business Model Inversion, and
 * the Trojan Distribution. Deterministic by design — mutations must reproduce across
 * runs, and pivots are validated by a fresh dossier evaluation rather than eloquence.
 */
export function buildMutationProposals(
  idea: IdeaInput,
  domain: DomainClassification,
  context: MutationContext
): MutationProposal[] {
  const essenceWords = titleCase((idea.title || idea.summary).split(/[\s:,&/]+/));
  const seedTitle = essenceWords || "Core Workflow Tool";
  const baseTitle = seedTitle.replace(/^\d+\s*/, "").trim() || "Core Workflow Tool";
  const wedgeAudience = `${idea.targetAudience} → single most urgent sub-segment (top ~20% by paid-tool density)`;
  const failureCurve = context.ltvCacRatio !== undefined
    ? `P50 LTV/CAC ${context.ltvCacRatio.toFixed(2)}x${context.survival24Mo !== undefined ? `, 24-mo survival ${(context.survival24Mo * 100).toFixed(0)}%` : ""}`
    : "collapsed unit economics";

  const graveNote = context.graveyardPrecedent
    ? `[Graveyard Avoidance (${context.graveyardPrecedent.companyName} burned ${context.graveyardPrecedent.burnedCapitalUsd})]: ${context.graveyardPrecedent.takeaway} `
    : "";

  const wedge: MutationProposal = {
    id: "MUT-01",
    strategy: "WEDGE_PIVOT",
    label: "The Wedge Pivot",
    rationale: `${graveNote}Kill the broad go-to-market that produced ${failureCurve}. ${context.fatalFlaw} Narrow the audience by ~80% to one vertical with dense budget and zero committee friction, where a 6-8 seat pilot closes in days, then expand horizontally with proven proof.`,
    mutatedIdea: {
      title: `${baseTitle} Wedge — ${titleCase(idea.targetAudience.split(/[,&]/)[0].split(" "))} edition`,
      summary: `Focused single-vertical master of ONE workflow from "${idea.summary.slice(0, 80)}..." for ${wedgeAudience}. The wedge deliberately avoids the failure mode that collapsed the original: ${context.fatalFlaw} Deepens on-boarding to under 2 minutes and prices against the incumbent spreadsheet cost, generating reference-able proof before any expansion.`,
      targetAudience: wedgeAudience.replace(" → ", " → "),
      monetization: `$${Math.max(29, Math.round(context.pricing * 1.4))}/mo per team, annual prepay with ${
        context.churn > 0.1 ? "outcome-linked renewal" : "14-day paid pilot → annual"
      }`
    }
  };

  const inversion: MutationProposal = {
    id: "MUT-02",
    strategy: "MODEL_INVERSION",
    label: "The Business Model Inversion",
    rationale: `${context.fatalFlaw} High-churn seat-based ${domain.unitEconomicsModel} invites novelty churn and price objections. Invert to B2B annual contracts or usage/outcome-based pricing billed against a value metric the buyer already tracks, converting churn risk into expansion economics under ${domain.regulatoryEnvironment}.`,
    mutatedIdea: {
      title: `${baseTitle} Enterprise — outcome-priced ${titleCase(idea.summary.split(/\s+/))} platform`,
      summary: `Same core capability "${idea.summary.slice(0, 90)}..." re-sold to ${domain.primaryCustomer} as an annual, usage-priced contract: billing keys to the ${domain.unitEconomicsModel} value metric, with staged rollout, audit trails, and dual-key spend controls. Sales cycle embraced rather than avoided — every deployment ships a signed success metric.`,
      targetAudience: `${domain.primaryCustomer} — budget holders evaluated on ${domain.regulatoryEnvironment} compliance, not end-consumer seats`,
      monetization: `Annual contract at $${Math.round(context.pricing * 12 * 0.9)}/seat-year (one month free) + usage overage priced on settled outcomes; net-15 invoicing beats churn by its very structure`
    }
  };

  const trojan: MutationProposal = {
    id: "MUT-03",
    strategy: "TROJAN_DISTRIBUTION",
    label: "The Trojan Distribution",
    rationale: `The stated channel assumed demand discovery that a paid-ads CAC of $${Math.round(context.cac)} cannot buy back. ${context.fatalFlaw} Enter through open-core / free developer surface, programmatic SEO on job-to-be-done queries, or a public API that incumbents embed — the product installs itself inside the buyer's existing workflow before they are asked to pay.`,
    mutatedIdea: {
      title: `${baseTitle} Open-Core — ${titleCase(idea.targetAudience.split(/[,&]/)[0].split(" "))} acquisition engine`,
      summary: `Open-source core of "${idea.summary.slice(0, 90)}..." with a free single-user tier whose data model already matches enterprise expectations, plus programmatic SEO pages targeting 200+ long-tail queries for ${domain.primaryCustomer}. Paid surface is the hosted multi-seat control plane, audit logging, and ${domain.regulatoryEnvironment} compliance pack.`,
      targetAudience: `${domain.primaryCustomer} reached via search, open-source adoption, and API integrations (zero paid CAC)`,
      monetization: `Open-core: free solo tier → $${Math.max(59, Math.round(context.pricing * 1.2))}/mo/multi-seat hosted control plane; compliance & audit pack sold to ${domain.primaryCustomer}`
    }
  };

  return [wedge, inversion, trojan];
}
