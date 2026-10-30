import dns from "node:dns";

// Ensure outbound fetches safely prefer IPv4 on systems where IPv6 routing is disabled/broken.
try {
  dns.setDefaultResultOrder?.("ipv4first");
} catch {
  // Best-effort for Node runtime environments
}

export const STOP_WORDS = new Set([
  // Articles & prepositions
  "a", "an", "the", "and", "or", "for", "of", "in", "on", "at", "to", "with", "by", "from",
  // Common tech/packaging fillers
  "ai", "ml", "llm", "gpt", "app", "apps", "tool", "tools", "platform", "platforms",
  "system", "systems", "assistant", "assistants", "copilot", "copilots", "agent", "agents",
  "saas", "software", "solution", "solutions", "pro", "plus", "hub", "bot", "bots",
  "service", "services", "powered", "based", "driven",
  // Generic qualifiers
  "local", "online", "global", "smart", "digital", "automated", "automatic", "intelligent",
  "next", "simple", "easy", "fast", "modern", "best", "free", "new", "auto", "real", "time",
  // Common intent / exploration verbs
  "exploration", "discovery", "review", "reviewer", "analyzing", "management", "helper"
]);

/**
 * Extracts clean, domain-specific semantic tokens from a title or phrase,
 * filtering out boilerplate startup descriptors, stop words, and punctuation.
 */
export function extractDomainTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

/**
 * Builds a prioritized list of search queries:
 * 1. The original clean phrase
 * 2. Multi-word domain-keyword fallback (e.g., "AI Trading Copilot" -> "trading copilot" or "trading")
 *
 * Avoids aggressive single-word fallback dilution for multi-word queries.
 */
export function getSearchQueryCandidates(keyword: string): string[] {
  const clean = keyword.trim().slice(0, 120);
  if (!clean) return [];

  const candidates: string[] = [clean];
  const domainTokens = extractDomainTokens(clean);
  const fallback = domainTokens.join(" ");

  if (fallback && fallback.toLowerCase() !== clean.toLowerCase()) {
    candidates.push(fallback);
  }

  // If there are exactly 2 tokens, do NOT split into single word candidate if original had >= 2 words
  // Only add a single-token candidate if the original query itself was only 1-2 words total
  const rawWords = clean.split(/\s+/).filter(Boolean);
  if (domainTokens.length > 1 && rawWords.length <= 2) {
    const primary = domainTokens[0];
    if (!candidates.includes(primary)) {
      candidates.push(primary);
    }
  }

  return candidates;
}

/**
 * Common noisy/irrelevant non-business category or title keywords for startup/tech ideas.
 */
export const UNRELATED_PREDICTION_KEYWORDS = new Set([
  "nba", "nfl", "nhl", "mlb", "fifa", "premier league", "la liga", "serie a", "uefa",
  "messi", "ronaldo", "lebron", "curry", "quarterback", "touchdown", "ballon d'or",
  "grammy", "oscar", "oscars", "emmy", "box office", "super bowl", "billboard",
  "celebrity", "dating", "pope", "cardinal", "monarch", "royal family"
]);

/**
 * Evaluates whether a prediction market title is sufficiently correlated with the query tokens.
 * Requires:
 * 1. No false positive / sports / celebrity contamination unless the query explicitly asks for it.
 * 2. Minimum token overlap:
 *    - If query has 1 token: token must match whole-word or prominent substring.
 *    - If query has >= 2 tokens: at least 2 tokens (or >= 50% of tokens) must match.
 */
export function isMarketTitleCorrelated(
  marketTitle: string,
  queryTokens: string[],
  category?: string
): boolean {
  const titleLower = marketTitle.toLowerCase();
  const catLower = (category || "").toLowerCase();

  // 1. Category and noise filter
  const isSportsOrCelebrity =
    catLower.includes("sports") ||
    catLower.includes("pop culture") ||
    catLower.includes("entertainment") ||
    catLower.includes("celebrities");

  const queryAsksForSports = queryTokens.some((t) =>
    ["sport", "sports", "game", "nba", "football", "soccer", "music", "movie"].includes(t)
  );

  if (isSportsOrCelebrity && !queryAsksForSports) {
    return false;
  }

  for (const noise of UNRELATED_PREDICTION_KEYWORDS) {
    if (titleLower.includes(noise) && !queryAsksForSports) {
      return false;
    }
  }

  // 2. Token overlap threshold
  if (queryTokens.length === 0) return true;

  const cleanTokens = queryTokens.map((t) => t.replace(/[^a-z0-9]/g, "")).filter((t) => t.length >= 3);
  if (cleanTokens.length === 0) return true;

  const matchedCount = cleanTokens.filter((token) => {
    const regex = new RegExp(`\\b${token}`, "i");
    return regex.test(titleLower);
  }).length;

  if (cleanTokens.length === 1) {
    return matchedCount >= 1;
  }

  // For multi-token queries, require at least 2 tokens (or all tokens if length is 2)
  const minRequired = cleanTokens.length === 2 ? 2 : Math.max(2, Math.floor(cleanTokens.length * 0.5));
  return matchedCount >= minRequired;
}
