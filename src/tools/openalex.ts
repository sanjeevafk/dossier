export interface CitedPaper {
  title: string;
  year: number | null;
  citations: number;
  authors: string[];
  venue: string;
  openAccessUrl: string | null;
  concepts: string[];
}

export interface OpenAlexReconResult {
  query: string;
  source: string;
  totalWorks: number;
  papers: CitedPaper[];
  keyTakeaway: string;
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Query OpenAlex (250M+ works, no key) for peer-reviewed grounding of
 * deeptech/healthcare claims. Returns top-cited works with authors, venue,
 * and open-access URL — the expert agent's citation backend.
 * Honest empty when nothing is found.
 */
export async function queryOpenAlex(
  keyword: string,
  fetchImpl: FetchImpl = fetch
): Promise<OpenAlexReconResult> {
  const cleanKeyword = keyword.trim().slice(0, 200);
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(cleanKeyword)}&per-page=5&select=id,title,publication_year,cited_by_count,authorships,primary_location,open_access,concepts&mailto=dossier@research.local`;

  const empty = (reason: string): OpenAlexReconResult => ({
    query: cleanKeyword,
    source: "OpenAlex (250M+ works, keyless)",
    totalWorks: 0,
    papers: [],
    keyTakeaway: reason
  });

  if (!cleanKeyword) return empty("Empty query — no academic search performed.");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timeoutId);
    if (!res.ok) return empty(`OpenAlex returned HTTP ${res.status} — no academic evidence retrieved.`);

    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    if (results.length === 0) return empty(`No academic works found for "${cleanKeyword}" in OpenAlex.`);

    const papers: CitedPaper[] = results.slice(0, 5).map((w: Record<string, unknown>) => {
      const authorships = Array.isArray(w.authorships) ? w.authorships : [];
      const authors = authorships
        .slice(0, 3)
        .map((a) => String((a as { author?: { display_name?: string } })?.author?.display_name || ""))
        .filter(Boolean);
      const primary = (w.primary_location || {}) as { source?: { display_name?: string } };
      const oa = (w.open_access || {}) as { oa_url?: string };
      const concepts = Array.isArray(w.concepts) ? w.concepts : [];
      return {
        title: String(w.title || "Untitled"),
        year: typeof w.publication_year === "number" ? w.publication_year : null,
        citations: Number(w.cited_by_count) || 0,
        authors,
        venue: String(primary?.source?.display_name || "Unknown venue"),
        openAccessUrl: typeof oa?.oa_url === "string" ? oa.oa_url : typeof w.id === "string" ? w.id : null,
        concepts: concepts
          .slice(0, 3)
          .map((c) => String((c as { display_name?: string })?.display_name || ""))
          .filter(Boolean)
      };
    });

    const total = Number(data?.meta?.count) || 0;
    return {
      query: cleanKeyword,
      source: "OpenAlex (250M+ works, keyless)",
      totalWorks: total,
      papers,
      keyTakeaway: `${total.toLocaleString()} academic works match "${cleanKeyword}"; top-cited: "${papers[0]?.title.slice(0, 80)}" (${papers[0]?.citations} citations).`
    };
  } catch {
    return empty(`OpenAlex unreachable — no academic evidence retrieved for "${cleanKeyword}".`);
  }
}
