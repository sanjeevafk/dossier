import { test } from "node:test";
import assert from "node:assert/strict";
import { getBaseRate, shrinkTowardBaseRate } from "../dist/core/baseRates.js";
import { brierScore, expectedCalibrationError, summarizeCalibration } from "../dist/services/calibration.js";

test("Base rates shrink heuristic scores toward the reference class", () => {
  const base = getBaseRate("b2b_saas");
  assert.equal(base.baseRate, 0.62);
  assert.ok(base.source.length > 0);
  const shrunk = shrinkTowardBaseRate(90, "consumer_social");
  assert.ok(shrunk < 90, "high score shrinks toward low consumer base rate");
  assert.ok(shrunk > 28, "shrink is partial, not a full override");
});

test("Brier score matches the textbook definition", () => {
  assert.equal(brierScore([1, 0, 0.5], [1, 0, 1]), 0.0833);
  assert.equal(brierScore([], []), null);
  assert.equal(brierScore([0.5], [1, 0]), null);
});

test("Calibration summary is n/a below 20 resolved outcomes", () => {
  const thin = summarizeCalibration([{ score: 80, outcome: null }]);
  assert.equal(thin.n, 0);
  assert.equal(thin.brier, null);
  assert.equal(thin.ece, null);
  const rich = summarizeCalibration(Array(20).fill({ score: 80, outcome: "built" }));
  assert.equal(rich.n, 20);
  assert.equal(rich.brier, 0.04);
  assert.ok(typeof rich.ece === "number");
});

test("ECE is zero for perfectly binned forecasts", () => {
  const ece = expectedCalibrationError([0.0, 0.0, 1.0, 1.0], [0, 0, 1, 1], 10);
  assert.equal(ece, 0);
});
