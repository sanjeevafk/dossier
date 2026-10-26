export type MarketSource = "polymarket" | "kalshi" | "manifold";

export interface UnifiedMarketSignal {
  source: MarketSource;
  id: string;
  title: string;
  category?: string;
  description?: string;
  url: string;
  probabilityYesPercent: number; // 0 - 100
  volumeUsd: number;
  liquidityUsd?: number;
  openInterestUsd?: number;
  status: "open" | "closed" | "resolved";
  createdAt?: string;
  closeTime?: string;
  raw?: unknown;
}

export interface MarketConsensusGroup {
  canonicalQuestion: string;
  consensusProbabilityPercent: number; // volume-weighted average
  spreadPercent: number;               // max - min probability divergence across sources
  sources: MarketSource[];
  signals: UnifiedMarketSignal[];
  totalVolumeUsd: number;
}

export interface UnifiedMarketResult {
  query: string;
  sourcesQueried: MarketSource[];
  activeSources: MarketSource[];
  signals: UnifiedMarketSignal[];
  consensusGroups: MarketConsensusGroup[];
  averageProbabilityPercent: number | null;
  totalVolumeUsd: number;
  macroSentiment: "BULLISH" | "NEUTRAL" | "BEARISH";
  keyTakeaway: string;
}

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;
