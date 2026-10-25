import { IdeaDomainArchetype } from "../types/index.js";

export interface ArchetypeBaseRate {
  p50LtvCac: number;
  churn30d: number;
  cacMedianUsd: number;
  baseRate: number;
  source: string;
}

/**
 * Reference-class base rates per domain archetype (review §4.1).
 * Seeded from public SaaS/postmortem benchmarks; shrinks heuristic scores
 * toward the reference class instead of trusting point estimates.
 * Sources are cited per row; treat as priors, not verdicts.
 */
export const ARCHETYPE_BASE_RATES: Record<IdeaDomainArchetype, ArchetypeBaseRate> = {
  b2b_saas: {
    p50LtvCac: 3.0,
    churn30d: 0.05,
    cacMedianUsd: 1200,
    baseRate: 0.62,
    source: "SaaS LTV/CAC golden ratio + 2026 CAC/churn/NRR medians (revoptima.io, stealthagents.com)"
  },
  consumer_social: {
    p50LtvCac: 0.8,
    churn30d: 0.12,
    cacMedianUsd: 19,
    baseRate: 0.28,
    source: "Consumer AI wrapper reference class: high 30-day churn, low monetization ceiling"
  },
  b2g_govtech: {
    p50LtvCac: 2.2,
    churn30d: 0.02,
    cacMedianUsd: 900,
    baseRate: 0.45,
    source: "B2G tender reference class: 9-15mo cycles, milestone payouts, L1 margin compression"
  },
  healthcare_clinical: {
    p50LtvCac: 2.0,
    churn30d: 0.03,
    cacMedianUsd: 1000,
    baseRate: 0.42,
    source: "Clinical reference class: EHR gatekeeping + liability drag, grant/pilot funding"
  },
  hardware_robotics: {
    p50LtvCac: 1.8,
    churn30d: 0.04,
    cacMedianUsd: 2500,
    baseRate: 0.44,
    source: "Hardware reference class: BoM margin compression, capex amortization"
  },
  deeptech_research: {
    p50LtvCac: 4.0,
    churn30d: 0.02,
    cacMedianUsd: 5000,
    baseRate: 0.55,
    source: "DeepTech reference class: high-ACV platform licenses, long diligence, patent moat"
  },
  web3_defi: {
    p50LtvCac: 1.5,
    churn30d: 0.08,
    cacMedianUsd: 149,
    baseRate: 0.35,
    source: "DeFi reference class: exploit vectors + regulatory overhang, TVL-dependent fees"
  },
  general_startup: {
    p50LtvCac: 2.5,
    churn30d: 0.05,
    cacMedianUsd: 350,
    baseRate: 0.5,
    source: "Blended commercial reference class fallback"
  }
};

export function getBaseRate(archetype: IdeaDomainArchetype): ArchetypeBaseRate {
  return ARCHETYPE_BASE_RATES[archetype] ?? ARCHETYPE_BASE_RATES.general_startup;
}

/**
 * Shrink a raw heuristic score toward the archetype reference class.
 * weight 0.7 raw / 0.3 base keeps domain signal while correcting optimism.
 */
export function shrinkTowardBaseRate(rawScore: number, archetype: IdeaDomainArchetype): number {
  const base = getBaseRate(archetype).baseRate * 100;
  return Math.round(rawScore * 0.7 + base * 0.3);
}
