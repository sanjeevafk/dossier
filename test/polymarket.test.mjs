import test from "node:test";
import assert from "node:assert/strict";
import { queryPolymarketMarkets } from "../dist/tools/polymarket.js";

function fetchMock(payload, ok = true) {
  return async () => ({
    ok,
    json: async () => payload
  });
}

const IRRELEVANT_EVENTS = [
  {
    id: "evt-1",
    title: "Kraken IPO by 2025?",
    slug: "kraken-ipo-in-2025",
    markets: [{ id: "m1", outcomePrices: "[\"0.12\",\"0.88\"]", volume: "1000", liquidity: "500" }]
  },
  {
    id: "evt-2",
    title: "Macron out by 2025?",
    slug: "macron-out-in-2025",
    markets: [{ id: "m2", outcomePrices: "[\"0.3\",\"0.7\"]", volume: "2000", liquidity: "800" }]
  }
];

const RELEVANT_EVENT = {
  id: "evt-ai",
  title: "AI agent adoption exceeds 50M workflows in 2026",
  slug: "ai-agent-adoption",
  markets: [{ id: "m3", outcomePrices: "[\"0.78\",\"0.22\"]", volume: "1420000", liquidity: "450000" }]
};

test("Polymarket returns NO fabricated markets when the API fails", async () => {
  const result = await queryPolymarketMarkets("PawSitter pet marketplace", async () => {
    throw new Error("network unreachable");
  });
  assert.equal(result.marketsFound.length, 0, "Offline state must yield zero markets, never synthetic ones");
  assert.ok(result.keyTakeaway.includes("No active Polymarket markets"), "Takeaway must state the absence honestly");
  assert.equal(result.macroSentiment, "NEUTRAL");
});

test("Polymarket filters out title-irrelevant fuzzy matches", async () => {
  const result = await queryPolymarketMarkets("PawSitter pet marketplace", fetchMock(IRRELEVANT_EVENTS));
  assert.equal(result.marketsFound.length, 0, "Unrelated markets must not pass as correlated evidence");
});

test("Polymarket parses genuinely correlated live odds", async () => {
  const result = await queryPolymarketMarkets("AI agent adoption", fetchMock([RELEVANT_EVENT]));
  assert.equal(result.marketsFound.length, 1);
  assert.equal(result.marketsFound[0].probabilityYesPercent, 78);
  assert.equal(result.macroSentiment, "BULLISH");
  assert.ok(result.marketsFound[0].marketUrl.includes("polymarket.com/event/"));
});

test("Polymarket skips markets with unparseable odds instead of defaulting to 50%", async () => {
  const noOdds = [{ id: "evt-x", title: "AI agent adoption market", slug: "ai-x", markets: [{ id: "m9" }] }];
  const result = await queryPolymarketMarkets("AI agent adoption", fetchMock(noOdds));
  assert.equal(result.marketsFound.length, 0, "Markets without parseable odds must be excluded");
});
