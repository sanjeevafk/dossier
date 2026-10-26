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

  const url = `https://huggingface.co/api/models?search=${encodeURIComponent(cleanKeyword)}&limit=10&sort=likes&direction=-1`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timeoutId);
    if (!res.ok) return empty(`Hub returned HTTP ${res.status} — no open-source evidence retrieved.`);

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return empty(`No open-source models match "${cleanKeyword}" on the Hub.`);
    }

    const queryTokens = cleanKeyword.toLowerCase().split(/\s+/).filter((t) => t.length >= 4);
    const models: OpenModel[] = [];
    for (const m of data) {
      const id = String(m?.id || "");
      if (!id) continue;
      if (queryTokens.length > 0 && !queryTokens.some((t) => id.toLowerCase().includes(t))) continue;
      models.push({
        id,
        likes: Number(m?.likes) || 0,
        downloads: Number(m?.downloads) || 0,
        trending: typeof m?.trendingScore === "number" ? m.trendingScore : null,
        modelUrl: `https://huggingface.co/${id}`
      });
      if (models.length >= 3) break;
    }

    if (models.length === 0) return empty(`No token-correlated open-source models for "${cleanKeyword}" on the Hub.`);
    const top = models[0];
    return {
      query: cleanKeyword,
      source: "Hugging Face Hub (keyless)",
      totalModels: data.length,
      models,
      keyTakeaway: `${models.length}+ correlated open models; top "${top.id}" (${top.likes} likes, ${top.downloads} downloads) — commoditization risk if downloads are high.`
    };
  } catch {
    return empty(`Hub unreachable — no open-source evidence for "${cleanKeyword}".`);
  }
}
