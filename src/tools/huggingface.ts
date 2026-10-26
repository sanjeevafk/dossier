import { getSearchQueryCandidates, extractDomainTokens } from "./queryTokens.js";

export interface OpenModel {
  id: string;
  likes: number;
  downloads: number;
  trending: number | null;
  modelUrl: string;
}

export interface HfReconResult {
  query: string;
  source: string;
  totalModels: number;
  models: OpenModel[];
  keyTakeaway: string;
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Query the Hugging Face Hub (keyless model search) for open-source
 * alternatives to the concept. For AI-wrapper ideas this is the kill shot:
 * "N open models with M downloads already do this." Honest empty when none.
 */
export async function queryHuggingFace(
  keyword: string,
  fetchImpl: FetchImpl = fetch
): Promise<HfReconResult> {
  const cleanKeyword = keyword.trim().slice(0, 120);

  const empty = (reason: string): HfReconResult => ({
    query: cleanKeyword,
    source: "Hugging Face Hub (keyless)",
    totalModels: 0,
    models: [],
    keyTakeaway: reason
  });

  if (!cleanKeyword) return empty("Empty query — no Hub search performed.");

  const domainTokens = extractDomainTokens(cleanKeyword);
  const queryTokens = domainTokens.length > 0
    ? domainTokens
    : cleanKeyword.toLowerCase().split(/\s+/).filter((t) => t.length >= 4);

  const candidates = getSearchQueryCandidates(cleanKeyword);
  if (candidates.length === 0) candidates.push(cleanKeyword);

  for (const qTerm of candidates) {
    const url = `https://huggingface.co/api/models?search=${encodeURIComponent(qTerm)}&limit=10&sort=likes&direction=-1`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      clearTimeout(timeoutId);
      if (!res.ok) continue;

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        continue;
      }

      const matchTokens = domainTokens.length > 0 ? domainTokens : queryTokens;
      const models: OpenModel[] = [];
      for (const m of data) {
        const id = String(m?.id || "");
        if (!id) continue;
        if (matchTokens.length > 0 && !matchTokens.some((t) => id.toLowerCase().includes(t))) continue;
        models.push({
          id,
          likes: Number(m?.likes) || 0,
          downloads: Number(m?.downloads) || 0,
          trending: typeof m?.trendingScore === "number" ? m.trendingScore : null,
          modelUrl: `https://huggingface.co/${id}`
        });
        if (models.length >= 3) break;
      }

      if (models.length > 0) {
        const top = models[0];
        return {
          query: cleanKeyword,
          source: "Hugging Face Hub (keyless)",
          totalModels: data.length,
          models,
          keyTakeaway: `${models.length}+ correlated open models on "${qTerm}"; top "${top.id}" (${top.likes} likes, ${top.downloads} downloads) — commoditization risk if downloads are high.`
        };
      }
    } catch {
      // Continue to next candidate or fall through
    }
  }

  return empty(`No token-correlated open-source models for "${cleanKeyword}" on the Hub.`);
}
