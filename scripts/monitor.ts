#!/usr/bin/env tsx
/**
 * Kill-condition monitor (workstream D2).
 * Weekly poll: for each tracked dossier (ledger rows without outcome),
 * re-query Polymarket Gamma + HN Algolia for kill-condition keywords.
 * Appends monitor_alerts rows; UI surfaces them as badges. No email until
 * >100 tracked dossiers (then Resend single API key).
 *
 * Usage: DOSSIER_DATA_DIR=./data tsx scripts/monitor.ts [--limit 20]
 */
import { dossierStorage } from "../src/services/storage.js";
import { queryPolymarketMarkets } from "../src/tools/polymarket.js";

interface Alert {
  dossierId: string;
  source: string;
  url: string;
  summary: string;
  at: string;
}

const alerts: Alert[] = [];

async function hnSearch(query: string): Promise<Array<{ title: string; url: string }>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { hits?: Array<{ title?: string; url?: string; objectID: string }> };
    return (data.hits || [])
      .filter((h) => h?.objectID)
      .map((h) => ({
        title: String(h.title || "HN discussion"),
        url: String(h.url || `https://news.ycombinator.com/item?id=${h.objectID}`)
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, Math.min(100, parseInt(limitArg.split("=")[1], 10) || 20)) : 20;
  const rows = dossierStorage.listLedger() as Array<{
    dossier_id: string; score: number; archetype: string; outcome: string | null; created_at: string;
  }>;
  const tracked = rows.filter((r) => !r.outcome).slice(0, limit);
  console.log(`[monitor] tracking ${tracked.length}/${rows.length} unresolved dossiers`);

  for (const row of tracked) {
    const dossier = await dossierStorage.getDossier(row.dossier_id);
    if (!dossier) continue;
    const keywords = `${dossier.idea.title} ${dossier.weakestAssumption?.fatalRisk ?? ""}`.slice(0, 120);

    try {
      const markets = await queryPolymarketMarkets(keywords);
      for (const m of markets.marketsFound.slice(0, 2)) {
        if (m.probabilityYesPercent >= 60) {
          alerts.push({
            dossierId: dossier.id,
            source: "polymarket",
            url: m.marketUrl,
            summary: `Prediction market "${m.title}" at ${m.probabilityYesPercent}% — may trigger kill-condition review.`,
            at: new Date().toISOString()
          });
        }
      }
    } catch {
      // provider down — skip silently
    }

    const hits = await hnSearch(keywords);
    for (const h of hits.slice(0, 2)) {
      alerts.push({
        dossierId: dossier.id,
        source: "hackernews",
        url: h.url,
        summary: `HN discussion "${h.title}" matches tracked keywords — review for competitor/market shifts.`,
        at: new Date().toISOString()
      });
    }
  }

  dossierStorage.appendMonitorAlerts(alerts);
  console.log(`[monitor] ${alerts.length} alert(s) recorded`);
  for (const a of alerts.slice(0, 10)) {
    console.log(`  - [${a.dossierId}] ${a.source}: ${a.summary} (${a.url})`);
  }
}

main().catch((err) => {
  console.error("[monitor] fatal:", err?.message || err);
  process.exitCode = 1;
});
