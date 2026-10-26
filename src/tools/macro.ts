import { detectJurisdiction } from "./geo.js";

export interface MacroIndicator {
  indicator: string;
  country: string;
  year: string;
  value: number;
}

export interface MacroReconResult {
  query: string;
  source: string;
  indicators: MacroIndicator[];
  keyTakeaway: string;
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Query the World Bank API (keyless) for macro grounding of TAM claims:
 * internet penetration, GDP per capita, health expenditure. Replaces the
 * old TAM formula's invented multipliers with cited country data.
 * Honest empty when the API is unreachable.
 */
export async function queryMacroData(
  audience: string,
  fetchImpl: FetchImpl = fetch
): Promise<MacroReconResult> {
  const geo = detectJurisdiction(audience || "");
  const country = geo.worldBankCountry;
  const indicators = [
    { code: "IT.NET.USER.ZS", label: "Internet penetration (% population)" },
    { code: "NY.GDP.PCAP.CD", label: "GDP per capita (US$)" }
  ];

  const found: MacroIndicator[] = [];
  for (const ind of indicators) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const url = `https://api.worldbank.org/v2/country/${country}/indicator/${ind.code}?format=json&per_page=1&date=2022:2023`;
      const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const data = await res.json();
      const row = Array.isArray(data) && Array.isArray(data[1]) ? data[1].find((r) => r?.value != null) : null;
      if (row) {
        found.push({
          indicator: ind.label,
          country,
          year: String(row.date || ""),
          value: Number(row.value)
        });
      }
    } catch {
      continue;
    }
  }

  if (found.length === 0) {
    return {
      query: audience,
      source: "World Bank API (keyless)",
      indicators: [],
      keyTakeaway: `World Bank unreachable for ${country} — macro TAM grounding unavailable.`
    };
  }
  const net = found.find((f) => f.indicator.startsWith("Internet"));
  return {
    query: audience,
    source: "World Bank API (keyless)",
    indicators: found,
    keyTakeaway: `${country}: ${found.map((f) => `${f.indicator} ${f.value} (${f.year})`).join(", ")}. Addressable market is a fraction of ${net ? `${net.value}% online` : "the online population"} — not the whole population.`
  };
}
