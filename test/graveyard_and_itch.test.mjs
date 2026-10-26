import test from "node:test";
import assert from "node:assert/strict";
import { findMatchingItchProblems, FIX_MY_ITCH_PROBLEMS } from "../dist/data/fixMyItchProblems.js";
import { findMatchingGraveyardPrecedents, GRAVEYARD_PRECEDENTS } from "../dist/data/graveyardAntipatterns.js";

test("Fix My Itch catalog contains curated verified problems", () => {
  assert.ok(FIX_MY_ITCH_PROBLEMS.length >= 8);
  for (const p of FIX_MY_ITCH_PROBLEMS) {
    assert.ok(p.id.startsWith("FMI-"));
    assert.ok(p.problemStatement.length > 20);
    assert.ok(p.keywords.length >= 4);
    assert.ok(p.sourceUrl.includes("fix-my-itch"));
  }
});

test("findMatchingItchProblems matches invoice reconciliation query", () => {
  const matches = findMatchingItchProblems("Micro-SME automated invoice reconciliation and billing for Indian retailers");
  assert.ok(matches.length > 0);
  assert.equal(matches[0].id, "FMI-01");
  assert.ok(matches[0].problemStatement.includes("invoice"));
});

test("findMatchingItchProblems matches direct brand sourcing for Kirana stores", () => {
  const matches = findMatchingItchProblems("Kirana direct wholesale brand sourcing platform bypassing distributors");
  assert.ok(matches.length > 0);
  assert.equal(matches[0].id, "FMI-02");
});

test("findMatchingItchProblems returns empty for unrelated query", () => {
  const matches = findMatchingItchProblems("Deep space quantum laser spectrometer for asteroid mining");
  assert.equal(matches.length, 0);
});

test("Startup Graveyard catalog contains curated failure case studies", () => {
  assert.ok(GRAVEYARD_PRECEDENTS.length >= 8);
  for (const g of GRAVEYARD_PRECEDENTS) {
    assert.ok(g.id.startsWith("GRAVE-"));
    assert.ok(g.companyName.length > 0);
    assert.ok(g.burnedCapitalUsd.includes("$"));
    assert.ok(g.fatalFlaw.length > 20);
    assert.ok(g.takeaway.length > 20);
  }
});

test("findMatchingGraveyardPrecedents flags MoveLoot for furniture resale logistics", () => {
  const matches = findMatchingGraveyardPrecedents("Used furniture resale marketplace with white-glove pickup and reverse logistics");
  assert.ok(matches.length > 0);
  assert.equal(matches[0].companyName, "MoveLoot");
  assert.equal(matches[0].antipattern, "UNIT_ECONOMICS_REVERSE_LOGISTICS");
});

test("findMatchingGraveyardPrecedents flags Fast for one-click checkout", () => {
  const matches = findMatchingGraveyardPrecedents("Universal one-click checkout payment button for Shopify stores");
  assert.ok(matches.length > 0);
  assert.equal(matches[0].companyName, "Fast");
  assert.equal(matches[0].antipattern, "COMMODITIZATION_BY_PLATFORM");
});

test("findMatchingGraveyardPrecedents returns empty for differentiated B2B compliance software", () => {
  const matches = findMatchingGraveyardPrecedents("SOC2 automated continuous compliance auditor for enterprise Kubernetes clusters");
  assert.equal(matches.length, 0);
});
