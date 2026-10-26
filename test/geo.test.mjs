import test from "node:test";
import assert from "node:assert/strict";
import { detectJurisdiction } from "../dist/tools/geo.js";

test("detectJurisdiction accurately detects India (IN) from Kirana/UPI signals", () => {
  const geo = detectJurisdiction(
    "Kirana retail stores and MSME merchants in tier-2 cities",
    "Digital ledger and micro-credit underwriting over UPI payment flows",
    "KiranaCredit AI"
  );
  assert.equal(geo.countryCode, "IN");
  assert.equal(geo.currency, "INR");
  assert.equal(geo.googleNewsLocale.gl, "IN");
  assert.equal(geo.googleNewsLocale.ceid, "IN:en");
  assert.ok(geo.regulatoryFramework.includes("DPDP"));
  assert.ok(geo.regulatoryFramework.includes("RBI"));
});

test("detectJurisdiction accurately detects United Kingdom (GB) from NHS signals", () => {
  const geo = detectJurisdiction(
    "NHS trusts and clinical emergency rooms",
    "Emergency patient intake triage under NICE and MHRA guidelines",
    "PathwayAI"
  );
  assert.equal(geo.countryCode, "GB");
  assert.equal(geo.currency, "GBP");
  assert.equal(geo.googleNewsLocale.gl, "GB");
  assert.ok(geo.regulatoryFramework.includes("MHRA"));
});

test("detectJurisdiction accurately detects European Union (EU) from GDPR / AI Act signals", () => {
  const geo = detectJurisdiction(
    "Enterprise compliance officers across Germany and France",
    "Automated audit compliance under the EU AI Act and GDPR",
    "EuroGuard AI"
  );
  assert.equal(geo.countryCode, "EU");
  assert.equal(geo.currency, "EUR");
  assert.ok(geo.regulatoryFramework.includes("EU Artificial Intelligence Act"));
});

test("detectJurisdiction accurately detects Brazil (BR) from LGPD/LATAM signals", () => {
  const geo = detectJurisdiction(
    "Fintechs in Sao Paulo and Rio de Janeiro",
    "Open finance credit checks under LGPD and BACEN rules",
    "CreditoLivre"
  );
  assert.equal(geo.countryCode, "BR");
  assert.equal(geo.currency, "BRL");
  assert.equal(geo.googleNewsLocale.gl, "BR");
});

test("detectJurisdiction accurately detects China / APAC and sets V2EX channel", () => {
  const geo = detectJurisdiction(
    "Developers in Beijing and Shenzhen",
    "Developer workflow indexing and WeChat mini-program deployment",
    "DevShenzhen"
  );
  assert.equal(geo.countryCode, "CN");
  assert.ok(geo.preferredCommunityChannels.includes("v2ex"));
});

test("detectJurisdiction defaults to United States (US) for global software", () => {
  const geo = detectJurisdiction(
    "Remote engineering teams globally",
    "Distributed tracing and vector indexing engine",
    "VectorFlow"
  );
  assert.equal(geo.countryCode, "US");
  assert.equal(geo.currency, "USD");
  assert.equal(geo.googleNewsLocale.gl, "US");
});
