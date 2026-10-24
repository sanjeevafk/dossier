import { extractDomainTokens } from "../tools/queryTokens.js";

export interface FixMyItchProblem {
  id: string;
  category: string;
  title: string;
  problemStatement: string;
  targetPersona: string;
  unmetNeed: string;
  keywords: string[];
  sourceUrl: string;
}

/**
 * Curated ground-truth commercial problems from Razorpay's "Fix My Itch" database
 * (sourced from 10,000+ verified submissions across 50,000+ merchants and founders in India).
 * https://razorpay.com/m/fix-my-itch/#all-problems
 */
export const FIX_MY_ITCH_PROBLEMS: FixMyItchProblem[] = [
  {
    id: "FMI-01",
    category: "B2B Services & Invoicing",
    title: "Micro-SME Automated Invoicing & Payment Reconciliation",
    problemStatement: "Why do micro-SMEs waste 10+ hours weekly on manual invoice matching and reconciliation?",
    targetPersona: "Small business owners, accounting clerks, Kirana distributors",
    unmetNeed: "Automated real-time reconciliation between bank statements, GST invoices, and UPI receipts with zero manual data entry.",
    keywords: ["invoice", "reconciliation", "accounting", "ledger", "micro-sme", "sme", "billing", "gst"],
    sourceUrl: "https://razorpay.com/m/fix-my-itch/#all-problems"
  },
  {
    id: "FMI-02",
    category: "Retail & Supply Chain",
    title: "Direct Brand Sourcing for Independent Retailers",
    problemStatement: "Why are small retailers forced into high distributor margins without direct brand access?",
    targetPersona: "Kirana store owners, standalone consumer electronics and FMCG retailers",
    unmetNeed: "Direct-to-store procurement platform bypassing 3 tiers of wholesale distributors to reclaim 8-15% retail margins.",
    keywords: ["retailer", "distributor", "kirana", "fmcg", "wholesale", "margin", "sourcing", "brands"],
    sourceUrl: "https://razorpay.com/m/fix-my-itch/#all-problems"
  },
  {
    id: "FMI-03",
    category: "Freelance & Professional Services",
    title: "Milestone-Escrow & Ghosting Prevention for Project Contractors",
    problemStatement: "Why do freelance developers and designers ghost projects after partial payment without accountability systems?",
    targetPersona: "SMB founders hiring tech freelancers, contract designers, agency clients",
    unmetNeed: "Milestone-locked code/design escrow that auto-releases upon verified CI test pass or signed artifact signoff.",
    keywords: ["freelance", "contractor", "escrow", "ghosting", "milestone", "developer", "agency", "payment"],
    sourceUrl: "https://razorpay.com/m/fix-my-itch/#all-problems"
  },
  {
    id: "FMI-04",
    category: "Industrial & Manufacturing",
    title: "On-Demand Certified Factory Machinery Repair Dispatch",
    problemStatement: "Why do industrial factory owners wait days for specialized CNC and mechanical repair technicians?",
    targetPersona: "Tier-2/3 industrial cluster machine shop owners, SME manufacturing plant heads",
    unmetNeed: "Geo-dispatched certified industrial equipment mechanics with guaranteed SLA of <4 hours to stop production line halts.",
    keywords: ["factory", "manufacturing", "machinery", "cnc", "industrial", "repair", "technician", "plant"],
    sourceUrl: "https://razorpay.com/m/fix-my-itch/#all-problems"
  },
  {
    id: "FMI-05",
    category: "Food & Beverage",
    title: "Pooled Wholesale Sourcing for Cloud Kitchens & Small Restaurants",
    problemStatement: "Why can't small restaurants access bulk wholesale ingredient pricing without large minimum orders?",
    targetPersona: "Independent cloud kitchen operators, local restaurant owners",
    unmetNeed: "Micro-geographic bulk buying syndicates that aggregate dairy, poultry, and vegetable orders across 20 neighborhood kitchens.",
    keywords: ["restaurant", "cloud kitchen", "food", "ingredients", "wholesale", "bulk", "procurement"],
    sourceUrl: "https://razorpay.com/m/fix-my-itch/#all-problems"
  },
  {
    id: "FMI-06",
    category: "Logistics & Freight",
    title: "Guaranteed Accountable Pickup for SME Outbound Parcels",
    problemStatement: "Why can't manufacturers in tier-2 industrial clusters rely on guaranteed, accountable pickup logistics for outbound freight?",
    targetPersona: "Small tier-2 goods manufacturers, D2C craft producers",
    unmetNeed: "SLAs with automatic demurrage penalties for missed pickups, integrated with national freight corridors.",
    keywords: ["logistics", "freight", "pickup", "transportation", "parcel", "outbound", "shipping", "tier-2"],
    sourceUrl: "https://razorpay.com/m/fix-my-itch/#all-problems"
  },
  {
    id: "FMI-07",
    category: "FinTech & Working Capital",
    title: "Vendor Background Trade Credit & Payables Underwriting",
    problemStatement: "Why can't SMEs negotiate favorable 60-day payment terms with large buyers due to lack of trade credit scoring?",
    targetPersona: "SME component suppliers, contract manufacturers",
    unmetNeed: "Trade invoice discounting powered by GST e-invoice flow validation and buyer payment history scores.",
    keywords: ["credit", "working capital", "terms", "trade credit", "underwriting", "invoice discounting", "upi", "gst"],
    sourceUrl: "https://razorpay.com/m/fix-my-itch/#all-problems"
  },
  {
    id: "FMI-08",
    category: "Inventory Management",
    title: "Real-Time Upstream Supplier Stock Transparency for Physical Stores",
    problemStatement: "Why can't shops see real-time supplier stock levels before committing customer delivery promises?",
    targetPersona: "Retail shop owners, spare parts dealers, hardware stores",
    unmetNeed: "Live supplier ERP connector exposing warehouse availability directly to point-of-sale terminal.",
    keywords: ["inventory", "supplier", "stock", "pos", "retail", "transparency", "warehouse", "catalog"],
    sourceUrl: "https://razorpay.com/m/fix-my-itch/#all-problems"
  }
];

/**
 * Searches the Fix My Itch problem catalog for matches against an idea title, summary, or audience.
 */
export function findMatchingItchProblems(queryText: string): FixMyItchProblem[] {
  const text = queryText.toLowerCase();
  const domainTokens = extractDomainTokens(text);
  if (domainTokens.length === 0) return [];
  const scored: Array<{ problem: FixMyItchProblem; score: number }> = [];

  for (const p of FIX_MY_ITCH_PROBLEMS) {
    let score = 0;
    // Check keyword hits (must have at least one direct keyword hit)
    let keywordHit = false;
    for (const kw of p.keywords) {
      if (text.includes(kw)) {
        score += 5;
        keywordHit = true;
      }
    }
    // Only proceed if at least one domain keyword matched
    if (!keywordHit) continue;

    // Check domain token overlaps
    for (const t of domainTokens) {
      if (p.problemStatement.toLowerCase().includes(t)) score += 2;
      if (p.unmetNeed.toLowerCase().includes(t)) score += 1;
    }
    if (score >= 6) {
      scored.push({ problem: p, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map((s) => s.problem);
}
