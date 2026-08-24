import test from "node:test";
import assert from "node:assert/strict";
import { queryPolymarketMarkets } from "../dist/tools/polymarket.js";

test("Polymarket Prediction Market Oracle queries live probability signals", async () => {
  const result = await queryPolymarketMarkets("AI Agent");
  assert.ok(result.query, "Query must be preserved");
  assert.ok(result.source, "Source must be identified");
  assert.ok(Array.isArray(result.marketsFound), "Markets found must be an array");
  assert.ok(result.marketsFound.length > 0, "Must return at least one prediction market signal");
  assert.ok(typeof result.marketsFound[0].probabilityYesPercent === "number", "Probability must be numeric");
  assert.ok(["BULLISH", "NEUTRAL", "BEARISH"].includes(result.macroSentiment), "Sentiment must be valid");
});
