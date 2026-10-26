/**
 * Reference-class table for the outside view (base-rate anchoring).
 *
 * Each class carries an estimated 24-month survival RANGE — deliberately a range,
 * never a point: these are analyst estimates anchored to public sources (BLS
 * Business Employment Dynamics all-firm survival as the upper bound, tightened
 * per domain severity using the CB Insights startup-failure taxonomy). They are
 * NOT measured frequencies for the class, and the dossier says so.
 *
 * Curated v1 — 2026-10-26. Sources shared by all ranges:
 *  - BLS BED: https://www.bls.gov/bdm/ (all-firm survival: ~0.80 @ 12mo, ~0.70 @ 24mo)
 *  - CB Insights failure taxonomy: https://www.cbinsights.com/research/report/startup-failure-reasons-top
 *  - Failory synthesis: https://www.failory.com/blog/startup-failure-rate
 */

export interface ReferenceClass {
  id: string;
  label: string;
  matchKeywords: string[];
  survival24mo: { low: number; high: number };
  failureCauses: string[];
  /** What this class implies for the Monte Carlo (documentation only in v1 — not yet wired into the sim). */
  priorHints?: { churnMonthly?: string; cacMultipleOfMonthlyPrice?: string };
}

export const REFERENCE_CLASSES: ReferenceClass[] = [
  {
    id: "ai_thin_wrapper",
    label: "AI thin wrapper / single-prompt utility",
    matchKeywords: ["chrome extension", "browser extension", "gpt wrapper", "chat with pdf", "meeting notes", "summariz", "transcriber", "ai copywriter", "tweet composer", "prompt template"],
    survival24mo: { low: 0.10, high: 0.25 },
    failureCauses: ["Platform replication by foundation-model vendors", "Zero switching cost → novelty churn", "No proprietary data or workflow lock-in"],
    priorHints: { churnMonthly: "0.15-0.30", cacMultipleOfMonthlyPrice: "2-4" }
  },
  {
    id: "consumer_freemium_utility",
    label: "Consumer freemium utility",
    matchKeywords: ["freemium", "consumer app", "habit", "productivity app", "self-improvement", "fitness", "journal"],
    survival24mo: { low: 0.15, high: 0.30 },
    failureCauses: ["Novelty churn: >85% month-1 dropoff without habit loops", "Paid-acquisition CAC collapse", "Willingness-to-pay below operating cost"],
    priorHints: { churnMonthly: "0.08-0.15", cacMultipleOfMonthlyPrice: "2-5" }
  },
  {
    id: "consumer_social",
    label: "Consumer social / community app",
    matchKeywords: ["social", "dating", "matchmaking", "matrimony", "community app", "creator", "influencer"],
    survival24mo: { low: 0.15, high: 0.30 },
    failureCauses: ["Cold-start network-effect failure", "Platform risk (app-store / API policy)", "Engagement without monetization"],
    priorHints: { churnMonthly: "0.10-0.20" }
  },
  {
    id: "marketplace_two_sided",
    label: "Two-sided marketplace",
    matchKeywords: ["marketplace", "match buyers", "peer-to-peer", "p2p platform", "rental platform", "gig platform", "take rate"],
    survival24mo: { low: 0.20, high: 0.40 },
    failureCauses: ["Chicken-and-egg liquidity failure", "Disintermediation after first match", "Take rate too thin to cover CAC on both sides"]
  },
  {
    id: "ecommerce_dtc",
    label: "E-commerce / DTC brand",
    matchKeywords: ["ecommerce", "e-commerce", "dtc", "shopify", "dropship", "physical product brand", "subscription box"],
    survival24mo: { low: 0.20, high: 0.40 },
    failureCauses: ["Ad-cost inflation destroying contribution margin", "Inventory/working-capital traps", "Category commoditization"]
  },
  {
    id: "b2b_smb_saas",
    label: "B2B SMB SaaS ($20-$500/mo)",
    matchKeywords: ["smb", "small business", "saas", "invoice", "booking", "crm for", "scheduling software", "$49", "$99", "per seat"],
    survival24mo: { low: 0.35, high: 0.55 },
    failureCauses: ["Underpriced relative to CAC (SMB churn + support load)", "Outcompeted by horizontal incumbents", "Distribution: no repeatable acquisition channel"],
    priorHints: { churnMonthly: "0.03-0.06", cacMultipleOfMonthlyPrice: "3-6" }
  },
  {
    id: "b2b_enterprise_saas",
    label: "B2B enterprise SaaS ($500+/mo ACV)",
    matchKeywords: ["enterprise", "soc2", "compliance", "security", "audit", "governance", "erp", "fortune 500", "procurement", "per organization"],
    survival24mo: { low: 0.40, high: 0.60 },
    failureCauses: ["Enterprise procurement deadlock (4-9 month cycles)", "Incumbents bundling the capability for free", "POC-to-contract conversion failure"],
    priorHints: { churnMonthly: "0.01-0.03", cacMultipleOfMonthlyPrice: "4-8" }
  },
  {
    id: "developer_tools",
    label: "Developer tools / DevInfra",
    matchKeywords: ["developer", "devtools", "ci/cd", "api-first", "sdk", "cli tool", "open-source", "github app", "ide"],
    survival24mo: { low: 0.35, high: 0.55 },
    failureCauses: ["Free-tier economics never convert", "Open-source adoption without commercial pull", "Platform (cloud vendor) feature absorption"]
  },
  {
    id: "fintech_b2b",
    label: "FinTech / payments infrastructure",
    matchKeywords: ["fintech", "payments", "escrow", "dunning", "invoicing", "reconciliation", "billing", "lending", "credit"],
    survival24mo: { low: 0.30, high: 0.50 },
    failureCauses: ["Regulatory/licensing burden under-estimated", "Bank/partner dependency risk", "Fraud & compliance cost load"]
  },
  {
    id: "hardware_robotics",
    label: "Hardware / robotics / IoT",
    matchKeywords: ["hardware", "robot", "drone", "uav", "sensor", "iot", "lidar", "slam", "battery", "device"],
    survival24mo: { low: 0.20, high: 0.40 },
    failureCauses: ["Bill-of-materials margin compression", "Capex + inventory burn before revenue", "Field-failure/return rates beyond plan"]
  },
  {
    id: "deeptech_research",
    label: "DeepTech / research commercialization",
    matchKeywords: ["deeptech", "formal verification", "research paper", "novel algorithm", "solver", "patent-pending", "quantum", "material"],
    survival24mo: { low: 0.15, high: 0.35 },
    failureCauses: ["Lab-to-field distribution shift", "Solver/compute cost walls at production scale", "Niche buyer pool too small for ACV"]
  },
  {
    id: "healthcare_clinical",
    label: "Healthcare / clinical systems",
    matchKeywords: ["health", "clinical", "triage", "doctor", "patient", "hospital", "ehr", "medical", "diagnosis", "imci", "asha"],
    survival24mo: { low: 0.20, high: 0.40 },
    failureCauses: ["EHR gatekeeping and integration walls", "Clinical liability + regulatory approval chasm", "Clinician workflow-fatigue rejection"]
  },
  {
    id: "b2g_govtech",
    label: "GovTech / B2G",
    matchKeywords: ["government", "b2g", "govtech", "ministry", "municipal", "tender", "rfp", "public sector", "district", "sih"],
    survival24mo: { low: 0.15, high: 0.35 },
    failureCauses: ["Multi-year tender cycles outlast runway", "Payment-delay working-capital drought", "Political/administration turnover resets deals"]
  },
  {
    id: "web3_defi",
    label: "Web3 / DeFi",
    matchKeywords: ["web3", "defi", "crypto", "token", "smart contract", "solidity", "nft", "dao", "on-chain"],
    survival24mo: { low: 0.10, high: 0.30 },
    failureCauses: ["Smart-contract exploit / liquidity drain", "Regulatory enforcement (SEC/MiCA)", "Token-economics collapse in bear markets"]
  },
  {
    id: "agency_service",
    label: "Agency / service business (productized)",
    matchKeywords: ["agency", "consulting", "done-for-you", "service business", "freelance", "outsourc"],
    survival24mo: { low: 0.40, high: 0.60 },
    failureCauses: ["Founder-time ceiling (not scalable)", "Margin erosion via discounting", "Key-client concentration risk"]
  },
  {
    id: "general_default",
    label: "General commercial startup",
    matchKeywords: [],
    survival24mo: { low: 0.30, high: 0.50 },
    failureCauses: ["No market need (top cause in CB Insights taxonomy)", "Cash exhaustion before PMF", "Outcompeted by incumbents"]
  }
];

/** Shared provenance for every survival range — surfaced in dossiers alongside matches. */
export const REFERENCE_CLASS_SOURCES = {
  sourceNote: "Survival ranges are analyst estimates: all-firm BLS/BED survival (~0.70 at 24 months) tightened per domain severity using the CB Insights failure taxonomy. Ranges, not measured frequencies.",
  sources: [
    "https://www.bls.gov/bdm/",
    "https://www.cbinsights.com/research/report/startup-failure-reasons-top",
    "https://www.failory.com/blog/startup-failure-rate"
  ]
};
