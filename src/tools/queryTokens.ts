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
  "next", "simple", "easy", "fast", "modern", "best", "free", "new", "auto", "real", "time"
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
 * 2. Domain-keyword fallback (e.g., "AI Trading Copilot" -> "trading")
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

  // If there are multiple domain tokens, also include individual significant tokens if helpful
  if (domainTokens.length > 1) {
    const primary = domainTokens[0];
    if (!candidates.includes(primary)) {
      candidates.push(primary);
    }
  }

  return candidates;
}
