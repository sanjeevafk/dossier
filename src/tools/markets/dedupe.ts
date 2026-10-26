import { UnifiedMarketSignal, MarketConsensusGroup, MarketSource } from "./types.js";

const TITLE_STOP_WORDS = new Set([
  "will", "the", "a", "an", "in", "on", "at", "by", "of", "for", "to", "be", "is",
  "are", "before", "or", "and", "this", "that", "it", "with", "from", "any", "reach",
  "hit", "end", "year", "first", "next"
]);

function tokenizeTitle(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !TITLE_STOP_WORDS.has(w));
  return new Set(words);
}

function calculateJaccardSimilarity(s1: Set<string>, s2: Set<string>): number {
  if (s1.size === 0 || s2.size === 0) return 0;
  let intersection = 0;
  for (const token of s1) {
    if (s2.has(token)) intersection++;
  }
  const union = s1.size + s2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Clusters market signals from multiple providers into deduplicated consensus groups.
 * Computes volume-weighted consensus probability and spread (divergence across platforms).
 */
export function deduplicateAndClusterMarkets(
  signals: UnifiedMarketSignal[],
  similarityThreshold = 0.35
): MarketConsensusGroup[] {
  if (signals.length === 0) return [];

  const tokenSets = signals.map((s) => tokenizeTitle(s.title));
  const visited = new Set<number>();
  const groups: MarketConsensusGroup[] = [];

  for (let i = 0; i < signals.length; i++) {
    if (visited.has(i)) continue;

    const clusterIndices: number[] = [i];
    visited.add(i);

    for (let j = i + 1; j < signals.length; j++) {
      if (visited.has(j)) continue;

      const sim = calculateJaccardSimilarity(tokenSets[i], tokenSets[j]);
      if (sim >= similarityThreshold) {
        clusterIndices.push(j);
        visited.add(j);
      }
    }

    const clusterSignals = clusterIndices.map((idx) => signals[idx]);

    // Choose canonical question: signal with highest volume or longest title
    const canonicalSignal = [...clusterSignals].sort(
      (a, b) => (b.volumeUsd - a.volumeUsd) || (b.title.length - a.title.length)
    )[0];

    const sources: MarketSource[] = Array.from(new Set(clusterSignals.map((s) => s.source)));

    // Calculate volume-weighted consensus probability
    let totalWeight = 0;
    let weightedSum = 0;
    const probs: number[] = [];

    for (const sig of clusterSignals) {
      const weight = Math.max(sig.volumeUsd, 100);
      weightedSum += sig.probabilityYesPercent * weight;
      totalWeight += weight;
      probs.push(sig.probabilityYesPercent);
    }

    const consensusProb = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : clusterSignals[0].probabilityYesPercent;
    const minProb = Math.min(...probs);
    const maxProb = Math.max(...probs);
    const spread = maxProb - minProb;
    const totalVolume = clusterSignals.reduce((acc, s) => acc + s.volumeUsd, 0);

    groups.push({
      canonicalQuestion: canonicalSignal.title,
      consensusProbabilityPercent: consensusProb,
      spreadPercent: spread,
      sources,
      signals: clusterSignals,
      totalVolumeUsd: totalVolume
    });
  }

  // Sort groups by total volume descending
  return groups.sort((a, b) => b.totalVolumeUsd - a.totalVolumeUsd);
}
