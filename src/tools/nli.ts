/**
 * Local NLI contradiction scorer (review §5, workstream C3).
 * DeBERTa-v3-small MNLI via transformers.js, lazy singleton, demote-only:
 * a claim is only ever demoted to CONTRADICTED/DISPUTED when contradiction
 * >= 0.75 AND a cited URL backs the counter-evidence. It NEVER promotes to
 * VERIFIED_FACT. HF_OFFLINE=1 / NODE_ENV=test / load failure → null.
 */

export interface NliScores {
  entailment: number;
  neutral: number;
  contradiction: number;
}

type NliPipeline = (input: string | string[], opts?: Record<string, unknown>) => Promise<unknown>;

let nliPromise: Promise<NliPipeline | null> | null = null;

function offline(): boolean {
  return (
    process.env.HF_OFFLINE === "1" ||
    process.env.NODE_ENV === "test" ||
    process.env.LOW_MEMORY_MODE === "1"
  );
}

async function loadNli(): Promise<NliPipeline | null> {
  if (offline()) return null;
  try {
    const { pipeline } = await import("@xenova/transformers");
    const pipe = (await pipeline("text-classification", "Xenova/nli-deberta-v3-small", {
      quantized: true
    })) as NliPipeline;
    return pipe;
  } catch {
    return null;
  }
}

export function getNli(): Promise<NliPipeline | null> {
  if (!nliPromise) {
    nliPromise = loadNli().catch(() => null);
    const timeoutMs = 30000;
    nliPromise = Promise.race([
      nliPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]).then((result) => {
      if (result === null && !offline()) nliPromise = null;
      return result;
    });
  }
  return nliPromise;
}

/**
 * Score (premise=evidence, hypothesis=claim) as a text pair. Returns null
 * when the model is unavailable or times out — callers must leave the claim
 * tier unchanged. 5s per-call cap so one slow pair never stalls evaluation.
 */
export async function contradictionScore(
  evidence: string,
  claim: string
): Promise<{ label: string; score: number } | null> {
  const pipe = await getNli();
  if (!pipe) return null;
  try {
    const result = (await Promise.race([
      pipe([evidence.slice(0, 512), claim.slice(0, 512)], { top_k: 3 }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
    ])) as Array<{ label: string; score: number }> | null;
    if (!result || !Array.isArray(result) || result.length === 0) return null;
    const contradiction = result.find((r) => /contradiction/i.test(r.label));
    if (!contradiction) return null;
    return { label: contradiction.label, score: contradiction.score };
  } catch {
    return null;
  }
}
