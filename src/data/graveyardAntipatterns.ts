export interface GraveyardPrecedent {
  id: string;
  companyName: string;
  burnedCapitalUsd: string;
  lifespan: string;
  sector: string;
  productType: string;
  antipattern:
    | "UNIT_ECONOMICS_REVERSE_LOGISTICS"
    | "COMMODITIZATION_BY_PLATFORM"
    | "MARKETPLACE_DISINTERMEDIATION_CHURN"
    | "BRITTLE_AI_HUMAN_BACKOFFICE"
    | "HARDWARE_CAPEX_MAINTENANCE_TRAP"
    | "UNVALIDATED_DIAGNOSTIC_CLAIMS"
    | "SUBSCRIPTION_PAYWALL_VS_FREE_CONTENT"
    | "BROKER_MARGIN_COMPRESSION";
  fatalFlaw: string;
  triggerKeywords: string[];
  takeaway: string;
  sourceUrl: string;
}

/**
 * Curated failure post-mortems from the Startup Graveyard & Loot Drop intelligence base
 * (representing 1,600+ autopsy case studies and over $500B in burned capital).
 * https://www.loot-drop.io/why-they-fail
 */
export const GRAVEYARD_PRECEDENTS: GraveyardPrecedent[] = [
  {
    id: "GRAVE-01",
    companyName: "MoveLoot",
    burnedCapitalUsd: "$22.0M",
    lifespan: "2013–2017 (4 years)",
    sector: "Consumer Marketplace / E-commerce",
    productType: "Used Furniture Resale Marketplace with White-Glove Logistics",
    antipattern: "UNIT_ECONOMICS_REVERSE_LOGISTICS",
    fatalFlaw: "Logistics-heavy reverse supply chain: warehousing, cleaning, and moving bulky low-margin used items generated negative unit margins on every fulfilled order.",
    triggerKeywords: ["furniture", "used goods", "resale", "moving", "reverse logistics", "bulky", "secondhand marketplace"],
    takeaway: "Asset-heavy logistics kills resale marketplaces. Either stay asset-light (pure peer-to-peer delivery) or mandate high minimum basket values ($500+) to absorb freight costs.",
    sourceUrl: "https://www.loot-drop.io/startup/356-moveloot"
  },
  {
    id: "GRAVE-02",
    companyName: "Fast",
    burnedCapitalUsd: "$124.0M",
    lifespan: "2019–2022 (3 years)",
    sector: "FinTech & Payments",
    productType: "Universal One-Click Checkout Button for Independent E-Commerce",
    antipattern: "COMMODITIZATION_BY_PLATFORM",
    fatalFlaw: "High customer acquisition cost ($10M+ ARR burn for $600k revenue) trying to build a standalone checkout utility easily cloned by Apple Pay, Google Pay, and Shopify Shop Pay.",
    triggerKeywords: ["one-click", "checkout", "fast checkout", "payment button", "e-commerce checkout", "cart abandonment"],
    takeaway: "Single-button checkout is a feature, not a company. Platform gatekeepers (Apple, Google, Shopify) offer checkout natively with zero merchant fee premium.",
    sourceUrl: "https://www.loot-drop.io/why-they-fail"
  },
  {
    id: "GRAVE-03",
    companyName: "Convoy",
    burnedCapitalUsd: "$900.0M",
    lifespan: "2015–2023 (8 years)",
    sector: "Freight & Supply Chain",
    productType: "Digital Freight Brokerage Network",
    antipattern: "BROKER_MARGIN_COMPRESSION",
    fatalFlaw: "Heavy tech overhead and venture debt burdened an asset-broker model that operates on razor-thin 10–14% gross margins during a prolonged freight rate recession.",
    triggerKeywords: ["freight", "trucking", "brokerage", "logistics marketplace", "hauler", "carrier network", "shipper"],
    takeaway: "In cyclical, commoditized commodity broker markets, software efficiency cannot overcome macro rate collapses when carrying high tech headcounts.",
    sourceUrl: "https://www.loot-drop.io/why-they-fail"
  },
  {
    id: "GRAVE-04",
    companyName: "Homejoy",
    burnedCapitalUsd: "$40.0M",
    lifespan: "2012–2015 (3 years)",
    sector: "Consumer Services",
    productType: "On-Demand Home Cleaning Marketplace ($19 intro offers)",
    antipattern: "MARKETPLACE_DISINTERMEDIATION_CHURN",
    fatalFlaw: "75% customer churn within 30 days: once a homeowner found a trusted cleaner, both parties cut out the platform to avoid the marketplace commission.",
    triggerKeywords: ["cleaning", "home services", "maid", "on-demand services", "handyman", "local service marketplace"],
    takeaway: "High-frequency in-home services suffer extreme disintermediation. Platforms must provide continuous value (insurance, scheduling, supplies) to keep both sides locked.",
    sourceUrl: "https://www.loot-drop.io/why-they-fail"
  },
  {
    id: "GRAVE-05",
    companyName: "ScaleFactor",
    burnedCapitalUsd: "$100.0M",
    lifespan: "2014–2020 (6 years)",
    sector: "B2B SaaS / FinTech",
    productType: "Automated AI Bookkeeping & Tax Accounting",
    antipattern: "BRITTLE_AI_HUMAN_BACKOFFICE",
    fatalFlaw: "Marketed automated machine learning bookkeeping, but brittle OCR forced an army of manual accountants in the Philippines to fix errors, driving negative gross margins.",
    triggerKeywords: ["bookkeeping", "automated accounting", "ai accountant", "tax preparation", "financial reconciliation"],
    takeaway: "Never sell deterministic financial/tax guarantees on top of probabilistic AI models without an explicit, unit-profitable human-in-the-loop cost model.",
    sourceUrl: "https://www.loot-drop.io/why-they-fail"
  },
  {
    id: "GRAVE-06",
    companyName: "Quibi",
    burnedCapitalUsd: "$1.75B",
    lifespan: "2018–2020 (2 years)",
    sector: "Media & Consumer Entertainment",
    productType: "Premium Short-Form Mobile Video Streaming",
    antipattern: "SUBSCRIPTION_PAYWALL_VS_FREE_CONTENT",
    fatalFlaw: "Charged $5-8/month for 10-minute Hollywood video episodes while locking screenshots and sharing, competing against billions of free hours on TikTok, YouTube, and Instagram.",
    triggerKeywords: ["short-form video", "mobile video", "streaming subscription", "episodes", "micro-entertainment"],
    takeaway: "In mobile short-form media, distribution and viral shareability beat bespoke Hollywood production budgets every time.",
    sourceUrl: "https://www.loot-drop.io/why-they-fail"
  },
  {
    id: "GRAVE-07",
    companyName: "Zume Pizza",
    burnedCapitalUsd: "$445.0M",
    lifespan: "2015–2020 (5 years)",
    sector: "FoodTech & Robotics",
    productType: "Robotic Pizza Baking Inside Delivery Trucks",
    antipattern: "HARDWARE_CAPEX_MAINTENANCE_TRAP",
    fatalFlaw: "Baking pizzas inside moving trucks caused road vibration mechanical breakdowns, exorbitant maintenance costs, and food consistency failures.",
    triggerKeywords: ["robotics", "foodtech", "cooking robot", "automated delivery truck", "mobile kitchen"],
    takeaway: "Moving parts in moving vehicles multiply failure rates by 10x. Automate stationary central commissaries, not mobile delivery fleets.",
    sourceUrl: "https://www.loot-drop.io/why-they-fail"
  },
  {
    id: "GRAVE-08",
    companyName: "uBiome",
    burnedCapitalUsd: "$110.0M",
    lifespan: "2012–2019 (7 years)",
    sector: "HealthTech / Diagnostics",
    productType: "DTC & Clinical Microbiome Sequencing Kits",
    antipattern: "UNVALIDATED_DIAGNOSTIC_CLAIMS",
    fatalFlaw: "Failed to establish clinical utility for gut sequencing, relying on predatory insurance billing practices that led to FBI raids and bankruptcy.",
    triggerKeywords: ["microbiome", "gut health", "genetic sequencing", "dtc health test", "clinical diagnostics", "wellness kit"],
    takeaway: "Diagnostic tools must establish rigorous, double-blind clinical utility and FDA/CLIA compliance before scaling commercial billing.",
    sourceUrl: "https://www.loot-drop.io/why-they-fail"
  }
];

/**
 * Searches the Graveyard catalog for matching failure patterns against an idea.
 */
export function findMatchingGraveyardPrecedents(queryText: string): GraveyardPrecedent[] {
  const text = queryText.toLowerCase();
  const matched: Array<{ precedent: GraveyardPrecedent; score: number }> = [];

  for (const g of GRAVEYARD_PRECEDENTS) {
    let score = 0;
    for (const kw of g.triggerKeywords) {
      if (text.includes(kw.toLowerCase())) {
        score += 3;
      }
    }
    // Check company or product type
    if (text.includes(g.companyName.toLowerCase())) score += 10;

    if (score >= 3) {
      matched.push({ precedent: g, score });
    }
  }

  matched.sort((a, b) => b.score - a.score);
  return matched.slice(0, 2).map((m) => m.precedent);
}
