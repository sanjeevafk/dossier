import { getSearchQueryCandidates } from "./queryTokens.js";

export interface FormDFiling {
  company: string;
  cik: string;
  filedDate: string;
  filingUrl: string;
}

export interface EdgarReconResult {
  query: string;
  source: string;
  totalFilings: number;
  filings: FormDFiling[];
  keyTakeaway: string;
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Query SEC EDGAR full-text search (keyless, User-Agent required) for
 * Form D filings matching the concept. Real fundraising evidence for
 * B2B/fintech dossiers — actual raises, not vibes. Honest empty when none.
 */
export async function queryEdgarFormD(
  keyword: string,
  fetchImpl: FetchImpl = fetch
): Promise<EdgarReconResult> {
  const cleanKeyword = keyword.trim().slice(0, 120);

  const empty = (reason: string): EdgarReconResult => ({
    query: cleanKeyword,
    source: "SEC EDGAR Form D (keyless)",
    totalFilings: 0,
    filings: [],
    keyTakeaway: reason
  });

  if (!cleanKeyword) return empty("Empty query — no EDGAR search performed.");

  const candidates = getSearchQueryCandidates(cleanKeyword);
  if (candidates.length === 0) candidates.push(cleanKeyword);

  for (const qTerm of candidates) {
    const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(qTerm)}&forms=D&startdt=2022-01-01&enddt=2026-12-31`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "Dossier research contact@dossier.local" }
      });
      clearTimeout(timeoutId);
      if (!res.ok) continue;

      const data = await res.json();
      const hits = data?.hits?.hits;
      if (!Array.isArray(hits) || hits.length === 0) {
        continue;
      }

      const filings: FormDFiling[] = [];
      const seen = new Set<string>();
      for (const h of hits) {
        const src = (h?._source || {}) as Record<string, unknown>;
        const adsh = String(src.adsh || "");
        if (!adsh || seen.has(adsh)) continue;
        seen.add(adsh);
        const ciks = Array.isArray(src.ciks) ? src.ciks : [];
        const cik = String(ciks[0] || "").replace(/^0+/, "") || "unknown";
        filings.push({
          company: String(src.file_description || src.display_names || "Unknown filer").slice(0, 100),
          cik,
          filedDate: String(src.file_date || "unknown"),
          filingUrl: `https://www.sec.gov/Archives/edgar/data/${ciks[0] || ""}/${adsh.replace(/-/g, "")}/${h?._id || ""}`
        });
        if (filings.length >= 3) break;
      }

      if (filings.length > 0) {
        const total = Number(data?.hits?.total?.value) || filings.length;
        return {
          query: cleanKeyword,
          source: "SEC EDGAR Form D (keyless)",
          totalFilings: total,
          filings,
          keyTakeaway: `${total} Form D filing(s) match "${qTerm}" — real fundraising activity, latest ${filings[0]?.filedDate}.`
        };
      }
    } catch {
      // Continue to next candidate or fall through
    }
  }

  return empty(`No Form D filings match "${cleanKeyword}" — no SEC fundraising evidence.`);
}
