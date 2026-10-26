import test from "node:test";
import assert from "node:assert/strict";
import { queryKalshiMarkets } from "../dist/tools/markets/kalshi.js";
import { deduplicateAndClusterMarkets } from "../dist/tools/markets/dedupe.js";
import { queryUnifiedPredictionMarkets } from "../dist/tools/markets/router.js";

function fetchMock(payload, ok = true) {
  return async () => ({
    ok,
    json: async () => payload
  });
}

test("Kalshi parses open binary events and nested markets with prices and volume", async () => {
  const payload = {
    events: [
      {
        event_ticker: "KXMARS",
        title: "Will humans land on Mars before 2030?",
        category: "Science and Technology",
        markets: [
          {
            ticker: "KXMARS-30",
            title: "Will humans land on Mars before 2030?",
            market_type: "binary",
            status: "active",
            last_price_dollars: "0.1400",
            volume_fp: "55000.50",
            open_interest_fp: "12000.00",
            rules_primary: "Resolves Yes if humans land on Mars before 2030."
          }
        ]
      },
      {
        event_ticker: "KXOLD",
        title: "Old non-binary market",
        category: "Politics",
        markets: [
          {
            ticker: "KXOLD-1",
            title: "Old non-binary market",
            market_type: "scalar",
            status: "closed"
          }
        ]
      }
    ]
  };

  const signals = await queryKalshiMarkets("Mars exploration", fetchMock(payload));
  assert.equal(signals.length, 1);
  assert.equal(signals[0].source, "kalshi");
  assert.equal(signals[0].id, "KXMARS-30");
  assert.equal(signals[0].probabilityYesPercent, 14);
  assert.equal(signals[0].volumeUsd, 55001);
  assert.equal(signals[0].openInterestUsd, 12000);
  assert.ok(signals[0].url.includes("kalshi.com/markets/KXMARS-30"));
});

test("Kalshi degrades to empty array on network failure", async () => {
  const signals = await queryKalshiMarkets("Mars", async () => {
    throw new Error("offline");
  });
  assert.deepEqual(signals, []);
});

test("Deduplication clusters equivalent markets across Polymarket, Kalshi, and Manifold", () => {
  const signals = [
    {
      source: "kalshi",
      id: "k1",
      title: "Will Elon Musk visit Mars in his lifetime?",
      probabilityYesPercent: 8,
      volumeUsd: 120000,
      status: "open",
      url: "https://kalshi.com/m1"
    },
    {
      source: "polymarket",
      id: "p1",
      title: "Elon Musk visits Mars in his lifetime?",
      probabilityYesPercent: 14,
      volumeUsd: 80000,
      status: "open",
      url: "https://polymarket.com/e1"
    },
    {
      source: "manifold",
      id: "m1",
      title: "Will Bitcoin reach $100k by December?",
      probabilityYesPercent: 75,
      volumeUsd: 15000,
      status: "open",
      url: "https://manifold.markets/b1"
    }
  ];

  const groups = deduplicateAndClusterMarkets(signals);
  assert.equal(groups.length, 2, "Should cluster into 2 distinct topic groups");

  const marsGroup = groups.find((g) => g.canonicalQuestion.includes("Mars"));
  assert.ok(marsGroup);
  assert.equal(marsGroup.signals.length, 2);
  assert.deepEqual(marsGroup.sources.sort(), ["kalshi", "polymarket"]);
  // Volume-weighted probability: (8 * 120000 + 14 * 80000) / 200000 = 10.4% -> 10%
  assert.equal(marsGroup.consensusProbabilityPercent, 10);
  assert.equal(marsGroup.spreadPercent, 6); // 14 - 8 = 6% spread
  assert.equal(marsGroup.totalVolumeUsd, 200000);

  const btcGroup = groups.find((g) => g.canonicalQuestion.includes("Bitcoin"));
  assert.ok(btcGroup);
  assert.equal(btcGroup.signals.length, 1);
  assert.equal(btcGroup.spreadPercent, 0);
});

test("Unified router queries all providers and derives cross-platform takeaway", async () => {
  const polyMock = [
    {
      id: "p-ev",
      title: "AI regulation passes in 2026",
      slug: "ai-reg",
      markets: [{ outcomePrices: "[\"0.60\",\"0.40\"]", volume: "50000" }]
    }
  ];
  const manifoldMock = [
    {
      id: "m-ev",
      question: "AI regulation passes in 2026",
      outcomeType: "BINARY",
      isResolved: false,
      probability: 0.50,
      volume: 10000,
      url: "https://manifold.markets/ai-reg"
    }
  ];
  const kalshiMock = {
    events: [
      {
        title: "Will AI regulation pass before end of 2026?",
        markets: [
          {
            ticker: "KXAIREG",
            title: "Will AI regulation pass before end of 2026?",
            market_type: "binary",
            status: "active",
            last_price_dollars: "0.5500",
            volume_fp: "40000"
          }
        ]
      }
    ]
  };

  const multiMock = async (url) => {
    if (url.includes("gamma-api.polymarket")) return { ok: true, json: async () => polyMock };
    if (url.includes("manifold.markets")) return { ok: true, json: async () => manifoldMock };
    if (url.includes("kalshi.com")) return { ok: true, json: async () => kalshiMock };
    return { ok: false, json: async () => ({}) };
  };

  const result = await queryUnifiedPredictionMarkets("AI regulation", multiMock);
  assert.equal(result.signals.length, 3);
  assert.equal(result.activeSources.length, 3);
  assert.ok(result.consensusGroups.length >= 1);
  assert.ok(result.keyTakeaway.includes("Unified prediction consensus"));
  assert.ok(result.keyTakeaway.includes("Cross-platform spread"));
});
