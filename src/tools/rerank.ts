/**
 * Local evidence reranker (review §5, workstream C2).
 * MiniLM bi-encoder cosine rerank, lazy singleton, never blocks boot.
 * HF_OFFLINE=1 (tests/CI) or any load failure → null → callers fall back
 * to the existing token-overlap filter with identical behavior.
 */

export interface RerankPassage {
  title: string;
  url: string;
  snippet: string;
}

type Embedder = (text: string) => Promise<{ data: ArrayLike<number> }>;
type ExtractorPipeline = (text: string, opts?: Record<string, unknown>) => Promise<unknown>;

let embedderPromise: Promise<Embedder | null> | null = null;

function offline(): boolean {
  return (
    process.env.HF_OFFLINE === "1" ||
    process.env.NODE_ENV === "test" ||
    process.env.LOW_MEMORY_MODE === "1" ||
    process.env.RENDER === "true" ||
    Boolean(process.env.RENDER)
  );
}

async function loadEmbedder(): Promise<Embedder | null> {
  if (offline()) return null;
  try {
    // @ts-ignore
    const { pipeline } = await import("@xenova/transformers");
    const pipe = (await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true
    })) as ExtractorPipeline;
    return async (text: string) => {
      const out = (await pipe(text.slice(0, 512), { pooling: "mean", normalize: true })) as {
        data: ArrayLike<number>;
      };
      return { data: out.data };
    };
  } catch {
    return null;
  }
}

export function getEmbedder(): Promise<Embedder | null> {
  if (!embedderPromise) {
    embedderPromise = loadEmbedder().catch(() => null);
    const timeoutMs = 30000;
    embedderPromise = Promise.race([
      embedderPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]).then((result) => {
      if (result === null && !offline()) embedderPromise = null;
      return result;
    });
  }
  return embedderPromise;
}

function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Rerank passages by cosine similarity to the query. Returns the top-k in
 * descending order. Callers must fall back to input order when this returns
 * null (model unavailable) or the input unchanged.
 */
export async function rerank(
  query: string,
  passages: RerankPassage[],
  topK = 6
): Promise<RerankPassage[] | null> {
  if (passages.length === 0) return passages;
  const embed = await getEmbedder();
  if (!embed) return null;
  try {
    const queryVec = (await embed(query)).data;
    const scored = await Promise.all(
      passages.map(async (p) => {
        const vec = (await embed(`${p.title} ${p.snippet}`)).data;
        return { passage: p, score: cosine(queryVec, vec) };
      })
    );
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.max(1, Math.min(topK, scored.length))).map((s) => s.passage);
  } catch {
    return null;
  }
}
