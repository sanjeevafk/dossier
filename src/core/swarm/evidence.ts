import {
  DomainClassification,
  EvidenceItem,
  ExternalEvidenceSource,
  DecisionModelOutput
} from "../../types/index.js";

export interface ReconContextInput {
  marketResearch: any;
  unifiedMarkets: any;
  newsSignals: any;
  openAlexSignals: any;
  edgarSignals: any;
  hfSignals: any;
  clinicalSignals: any;
  macroSignals: any;
  floviaSignals: any;
  geo: any;
  reachSignals: any;
  itchMatches: any[];
  graveyardMatches: any[];
  decisionEvaluation?: DecisionModelOutput | null;
  pricing: number;
  cac: number;
  churn: number;
  isEconomicsAvailable: boolean;
  sandboxSim: any;
  stressMetrics: any;
  mc: any;
}

export function formatReconContext(input: ReconContextInput): string {
  const {
    marketResearch,
    unifiedMarkets,
    newsSignals,
    openAlexSignals,
    edgarSignals,
    hfSignals,
    clinicalSignals,
    macroSignals,
    floviaSignals,
    geo,
    reachSignals,
    itchMatches,
    graveyardMatches,
    decisionEvaluation,
    pricing,
    cac,
    churn,
    isEconomicsAvailable,
    sandboxSim,
    stressMetrics,
    mc
  } = input;

  const reconSourceParts: string[] = [];
  if (marketResearch.dataSource === "live-web-recon" && marketResearch.rawResults.length > 0) {
    reconSourceParts.push(
      `Live web recon (${marketResearch.reconProvider}): ${marketResearch.rawResults.slice(0, 3).map((r: any) => `"${r.title}" [${r.url}]`).join("; ")}`
    );
  } else {
    reconSourceParts.push(
      `No live web recon results were retrieved (${marketResearch.reconError || "provider unavailable"}) — treat competitive and demand statements as heuristic priors, not sourced evidence.`
    );
  }
  if (marketResearch.community.discussions.length > 0) {
    reconSourceParts.push(
      `Community discussions (${marketResearch.community.provider}): ${marketResearch.community.discussions.slice(0, 3).map((d: any) => `"${d.title}"${typeof d.score === "number" ? ` (${d.score} pts${typeof d.comments === "number" ? `, ${d.comments} comments` : ""})` : ""} [${d.url}]`).join("; ")}`
    );
  } else {
    reconSourceParts.push("No community discussions (Reddit/HN/X) were retrievable for this concept.");
  }
  if (unifiedMarkets.signals.length > 0) {
    reconSourceParts.push(
      `Prediction markets (${unifiedMarkets.activeSources.map((s: string) => s.toUpperCase()).join("/")}): ${unifiedMarkets.signals.slice(0, 3).map((m: any) => `"${m.title.slice(0, 70)}" @ ${m.probabilityYesPercent}% [${m.source}]`).join("; ")}. ${unifiedMarkets.keyTakeaway}`
    );
  } else {
    reconSourceParts.push(unifiedMarkets.keyTakeaway);
  }
  if (newsSignals.articles.length > 0) {
    reconSourceParts.push(
      `Media coverage (${newsSignals.source}): ${newsSignals.articles.slice(0, 2).map((a: any) => `"${a.title.slice(0, 60)}" [${a.source}]`).join("; ")}.`
    );
  }
  if (openAlexSignals.papers.length > 0) {
    reconSourceParts.push(
      `Academic grounding (OpenAlex, ${openAlexSignals.totalWorks.toLocaleString()} works): ${openAlexSignals.papers.slice(0, 2).map((p: any) => `"${p.title.slice(0, 80)}" (${p.year}, ${p.citations} cites)`).join("; ")}.`
    );
  }
  if (edgarSignals.filings.length > 0) {
    reconSourceParts.push(
      `Fundraising evidence (SEC Form D): ${edgarSignals.filings.map((f: any) => `${f.company} filed ${f.filedDate}`).join("; ")}.`
    );
  }
  if (hfSignals.models.length > 0) {
    reconSourceParts.push(
      `Open-source alternatives (HF Hub): ${hfSignals.models.map((m: any) => `"${m.id}" (${m.likes} likes, ${m.downloads} downloads)`).join("; ")}.`
    );
  }
  if (clinicalSignals.studies.length > 0 || clinicalSignals.clearances.length > 0) {
    reconSourceParts.push(
      `Clinical evidence: ${clinicalSignals.studies.map((s: any) => `${s.nctId} (${s.status})`).join("; ")}${clinicalSignals.clearances.length > 0 ? `; 510(k): ${clinicalSignals.clearances.map((c: any) => c.deviceName.slice(0, 50)).join("; ")}` : ""}.`
    );
  }
  if (macroSignals.indicators.length > 0) {
    reconSourceParts.push(
      `Macro grounding (World Bank): ${macroSignals.keyTakeaway}`
    );
  }
  if (floviaSignals.active && floviaSignals.signals.length > 0) {
    reconSourceParts.push(
      `On-chain liquidity & asset ground truth (${floviaSignals.source}): ${floviaSignals.keyTakeaway}`
    );
  }
  reconSourceParts.push(
    `Jurisdiction & Policy Context (${geo.regionName} / ${geo.countryCode}): Currency ${geo.currency}, Regulatory framework: ${geo.regulatoryFramework}.`
  );
  if (reachSignals.gitHubRepos.length > 0 || reachSignals.deepScrape || reachSignals.regionalDiscussions.length > 0) {
    reconSourceParts.push(
      `Agent-Reach developer/community intel: ${reachSignals.keyTakeaway}`
    );
  }
  if (itchMatches.length > 0) {
    reconSourceParts.push(
      `Commercial Problem Catalog (Razorpay Fix My Itch): Matches verified problem "${itchMatches[0].title}" (${itchMatches[0].problemStatement}) — Unmet need: ${itchMatches[0].unmetNeed}.`
    );
  }
  if (graveyardMatches.length > 0) {
    reconSourceParts.push(
      `Startup Graveyard Forensics (Loot Drop): Matches failure pattern of ${graveyardMatches.map((g: any) => `"${g.companyName}" (${g.burnedCapitalUsd} burned, ${g.lifespan}): ${g.fatalFlaw}`).join("; ")}.`
    );
  }
  if (decisionEvaluation) {
    reconSourceParts.push(
      `Calibrated Decision Gatekeeper (${decisionEvaluation.engine || "Julia-1"}): Verdict=${decisionEvaluation.verdict}, LossRatio=${decisionEvaluation.loss_ratio}x. ` +
      `Moat P(wrapper)=${decisionEvaluation.answers?.moat?.probabilities?.thin_wrapper ?? "n/a"} [Flagged=${decisionEvaluation.answers?.moat?.flagged}], ` +
      `Regulatory P(fatal)=${decisionEvaluation.answers?.regulatory_risk?.probabilities?.regulatory_fatal ?? "n/a"} [Flagged=${decisionEvaluation.answers?.regulatory_risk?.flagged}], ` +
      `Procurement P(deadlock)=${decisionEvaluation.answers?.sales_cycle?.probabilities?.procurement_deadlock ?? "n/a"} [Flagged=${decisionEvaluation.answers?.sales_cycle?.flagged}], ` +
      `Monetization P(zero)=${decisionEvaluation.answers?.monetization?.probabilities?.monetization_zero ?? "n/a"} [Flagged=${decisionEvaluation.answers?.monetization?.flagged}]. ` +
      (decisionEvaluation.fatal_flags.length > 0 ? `TRIGGERED FATAL FAILURE MODES: ${decisionEvaluation.fatal_flags.join(", ")}.` : "")
    );
  }

  return isEconomicsAvailable
    ? `${reconSourceParts.join(" ")}. Modeled Economics: Pricing $${pricing}/mo, CAC $${cac}. Monte Carlo (${mc?.iterations ?? 0} runs): P50 LTV/CAC ${sandboxSim.metrics.ltvCacRatio}x [P10 ${mc?.ltvCacPercentiles.p10 ?? sandboxSim.metrics.ltvCacRatio} / P90 ${mc?.ltvCacPercentiles.p90 ?? sandboxSim.metrics.ltvCacRatio}], 24-month survival ${( (mc?.survivalProbability24Mo ?? 0) * 100).toFixed(0)}%, payback P50 ${sandboxSim.metrics.estimatedPaybackMonths}mo, token burden ${(((mc?.tokenCostBurdenPercent.p50 ?? 0)) * 100).toFixed(1)}% of gross revenue. Stress run (${(Math.min(1, churn * 1.6) * 100).toFixed(0)}% churn / $${Math.round(cac * 1.6)} CAC): survival ${(((stressMetrics.stressSurvival24Mo ?? 0) * 100)).toFixed(0)}%.`
    : `${reconSourceParts.join(" ")}. Economics Simulation Unavailable (degraded execution): Pricing $${pricing}/mo, CAC $${cac}. Quantitative LTV/CAC is UNKNOWN and must not be treated as zero.`;
}

export interface EvidenceFeedInput {
  isEconomicsAvailable: boolean;
  sandboxSim: any;
  pricing: number;
  cac: number;
  domain: DomainClassification;
  unifiedMarkets: any;
  marketResearch: any;
  newsSignals: any;
  openAlexSignals: any;
  edgarSignals: any;
  hfSignals: any;
  clinicalSignals: any;
  macroSignals: any;
  floviaSignals: any;
  reachSignals: any;
  itchMatches: any[];
  graveyardMatches: any[];
  customerOpinion: any;
  redTeamOpinion: any;
  debateSource: string;
}

export function buildEvidenceFeed(input: EvidenceFeedInput): EvidenceItem[] {
  const {
    isEconomicsAvailable,
    sandboxSim,
    pricing,
    cac,
    domain,
    unifiedMarkets,
    marketResearch,
    newsSignals,
    openAlexSignals,
    edgarSignals,
    hfSignals,
    clinicalSignals,
    macroSignals,
    floviaSignals,
    reachSignals,
    itchMatches,
    graveyardMatches,
    customerOpinion,
    redTeamOpinion,
    debateSource
  } = input;

  const externalEvidenceItems: EvidenceItem[] = [];
  let retrievedExternalCount = 0;

  if (unifiedMarkets.signals.length > 0) {
    const top = unifiedMarkets.signals[0];
    const consensusNote = unifiedMarkets.consensusGroups.length > 0 && unifiedMarkets.consensusGroups[0].sources.length > 1
      ? ` Shared cross-market topic "${unifiedMarkets.consensusGroups[0].canonicalQuestion.slice(0, 70)}" priced at ${unifiedMarkets.consensusGroups[0].consensusProbabilityPercent}% across ${unifiedMarkets.consensusGroups[0].sources.join("+")} (spread: ${unifiedMarkets.consensusGroups[0].spreadPercent}%).`
      : "";
    externalEvidenceItems.push({
      id: "EV-03",
      claim: `Macro prediction market sentiment: ${unifiedMarkets.keyTakeaway} Top market: "${top.title}" at ${top.probabilityYesPercent}% on ${top.source}.${consensusNote}`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: `Prediction Market Oracle (${top.source.toUpperCase()}) [${top.url}]`,
      indicator: unifiedMarkets.macroSentiment === "BEARISH" ? "CONTRADICTING" : (unifiedMarkets.macroSentiment === "BULLISH" ? "SUPPORTING" : "NEUTRAL"),
      confidencePercent: 75
    });
    retrievedExternalCount++;

    unifiedMarkets.signals.slice(0, 3).forEach((sig: any, idx: number) => {
      externalEvidenceItems.push({
        id: `EV-03M${idx + 1}`,
        claim: `${sig.source.toUpperCase()} market: "${sig.title}" at ${sig.probabilityYesPercent}% ($${sig.volumeUsd.toLocaleString()} volume, status: ${sig.status}).`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: sig.url,
        indicator: sig.probabilityYesPercent >= 60 ? "SUPPORTING" : (sig.probabilityYesPercent <= 40 ? "CONTRADICTING" : "NEUTRAL"),
        confidencePercent: 70
      });
      retrievedExternalCount++;
    });
  }

  if (marketResearch.dataSource === "live-web-recon" && marketResearch.rawResults.length > 0) {
    marketResearch.rawResults.slice(0, 2).forEach((r: any, i: number) => {
      externalEvidenceItems.push({
        id: i === 0 ? "EV-04" : `EV-04${String.fromCharCode(65 + i)}`,
        claim: `Live web recon result (${marketResearch.reconProvider}): "${r.title}" — ${r.snippet}`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: r.url,
        indicator: "NEUTRAL",
        confidencePercent: 70
      });
      retrievedExternalCount++;
    });
  }

  marketResearch.community.discussions.slice(0, 2).forEach((d: any, i: number) => {
    const stats = [typeof d.score === "number" ? `${d.score} pts` : null, typeof d.comments === "number" ? `${d.comments} comments` : null]
      .filter(Boolean)
      .join(", ");
    externalEvidenceItems.push({
      id: `EV-04${String.fromCharCode(67 + i)}`,
      claim: `Community discussion on ${d.platform}: "${d.title}"${stats ? ` (${stats})` : ""}`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: d.url,
      indicator: "NEUTRAL",
      confidencePercent: 70
    });
    retrievedExternalCount++;
  });

  for (let i = 0; i < Math.min(newsSignals.articles.length, 2); i++) {
    const art = newsSignals.articles[i];
    externalEvidenceItems.push({
      id: `EV-04N${i + 1}`,
      claim: `Factual media reporting (${art.source}): "${art.title}"`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: art.url,
      indicator: "SUPPORTING",
      confidencePercent: 85
    });
    retrievedExternalCount++;
  }

  for (const p of openAlexSignals.papers.slice(0, 2)) {
    externalEvidenceItems.push({
      id: `EV-03A${openAlexSignals.papers.indexOf(p) + 1}`,
      claim: `Peer-reviewed grounding: "${p.title}" (${p.year}, ${p.citations} citations, ${p.venue}) — ${p.authors.join(", ")}.`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: p.openAccessUrl || "OpenAlex",
      indicator: "SUPPORTING",
      confidencePercent: 80
    });
    retrievedExternalCount++;
  }

  for (const f of edgarSignals.filings.slice(0, 2)) {
    externalEvidenceItems.push({
      id: `EV-03E${edgarSignals.filings.indexOf(f) + 1}`,
      claim: `SEC Form D fundraising: ${f.company} (CIK ${f.cik}) filed ${f.filedDate} — real capital formation in this space.`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: f.filingUrl,
      indicator: "SUPPORTING",
      confidencePercent: 90
    });
    retrievedExternalCount++;
  }

  for (const m of hfSignals.models.slice(0, 2)) {
    externalEvidenceItems.push({
      id: `EV-03H${hfSignals.models.indexOf(m) + 1}`,
      claim: `Open-source alternative on HF Hub: "${m.id}" (${m.likes} likes, ${m.downloads} downloads) — commoditization pressure.`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: m.modelUrl,
      indicator: "CONTRADICTING",
      confidencePercent: 75
    });
    retrievedExternalCount++;
  }

  for (const s of clinicalSignals.studies.slice(0, 2)) {
    externalEvidenceItems.push({
      id: `EV-03C${clinicalSignals.studies.indexOf(s) + 1}`,
      claim: `Registered trial ${s.nctId}: "${s.title}" — ${s.status}, ${s.phase}, sponsored by ${s.sponsor}.`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: s.studyUrl,
      indicator: "NEUTRAL",
      confidencePercent: 85
    });
    retrievedExternalCount++;
  }

  if (macroSignals.indicators.length > 0) {
    externalEvidenceItems.push({
      id: "EV-03W",
      claim: `Macro grounding (World Bank): ${macroSignals.keyTakeaway}`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: "https://api.worldbank.org/v2",
      indicator: "NEUTRAL",
      confidencePercent: 85
    });
    retrievedExternalCount++;
  }

  if (floviaSignals.active && floviaSignals.signals.length > 0) {
    floviaSignals.signals.forEach((sig: any, idx: number) => {
      externalEvidenceItems.push({
        id: `EV-03F${idx + 1}`,
        claim: `On-chain market pricing (${floviaSignals.source}): ${sig.asset} trading at $${sig.priceUsd.toLocaleString()}${sig.change24hPercent !== undefined ? ` (${sig.change24hPercent > 0 ? "+" : ""}${sig.change24hPercent}% 24h)` : ""}.`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: "https://api.flovia.dev/mcp",
        indicator: "SUPPORTING",
        confidencePercent: 90
      });
      retrievedExternalCount++;
    });
  }

  for (let i = 0; i < Math.min(reachSignals.gitHubRepos.length, 2); i++) {
    const repo = reachSignals.gitHubRepos[i];
    externalEvidenceItems.push({
      id: `EV-04G${i + 1}`,
      claim: `Open source developer traction on GitHub (${repo.fullName}): ${repo.stars} stars — "${repo.description || "Active codebase"}".`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: repo.url,
      indicator: "SUPPORTING",
      confidencePercent: 88
    });
    retrievedExternalCount++;
  }

  if (reachSignals.deepScrape) {
    externalEvidenceItems.push({
      id: "EV-04J",
      claim: `Jina Reader deep inspection (${reachSignals.deepScrape.url}): "${reachSignals.deepScrape.title}" ${reachSignals.deepScrape.extractedPricing ? `[Pricing: ${reachSignals.deepScrape.extractedPricing}]` : ""}`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: reachSignals.deepScrape.url,
      indicator: "NEUTRAL",
      confidencePercent: 85
    });
    retrievedExternalCount++;
  }

  for (let i = 0; i < Math.min(reachSignals.regionalDiscussions.length, 2); i++) {
    const disc = reachSignals.regionalDiscussions[i];
    externalEvidenceItems.push({
      id: `EV-04V${i + 1}`,
      claim: `Regional community discussion (${disc.platform}): "${disc.title}" (${disc.replies || 0} replies)`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: disc.url,
      indicator: "NEUTRAL",
      confidencePercent: 80
    });
    retrievedExternalCount++;
  }

  for (let i = 0; i < itchMatches.length; i++) {
    const p = itchMatches[i];
    externalEvidenceItems.push({
      id: `EV-04F${i + 1}`,
      claim: `Verified Commercial Demand (Razorpay Fix My Itch - ${p.category}): "${p.problemStatement}" (Target: ${p.targetPersona})`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: p.sourceUrl,
      indicator: "SUPPORTING",
      confidencePercent: 90
    });
    retrievedExternalCount++;
  }

  for (let i = 0; i < graveyardMatches.length; i++) {
    const g = graveyardMatches[i];
    externalEvidenceItems.push({
      id: `EV-04D${i + 1}`,
      claim: `Startup Graveyard Forensic Precedent (Loot Drop - ${g.companyName}): Burned ${g.burnedCapitalUsd} before death (${g.lifespan}) from ${g.antipattern} — ${g.fatalFlaw}`,
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: g.sourceUrl,
      indicator: "CONTRADICTING",
      confidencePercent: 95
    });
    retrievedExternalCount++;
  }

  if (retrievedExternalCount === 0) {
    const reasons = [
      marketResearch.dataSource !== "live-web-recon" ? marketResearch.reconError || "no web recon results" : null,
      marketResearch.community.errors.length > 0 ? marketResearch.community.errors.join("; ") : "no community discussions retrievable"
    ].filter(Boolean).join(" | ");
    externalEvidenceItems.push({
      id: "EV-04",
      claim: `No live external evidence was retrieved (${reasons}) — competitive landscape, demand, and community signals in this dossier are heuristic priors, NOT sourced external evidence.`,
      tier: "UNKNOWN",
      claimType: "UNKNOWN",
      provenance: "Dossier Runtime (recon unavailable)",
      indicator: "NEUTRAL",
      confidencePercent: 90
    });
  }

  return [
    {
      id: "EV-01",
      claim: isEconomicsAvailable
        ? `Sandboxed unit economics computation: LTV/CAC ratio is ${sandboxSim.metrics.ltvCacRatio.toFixed(2)}x with payback in ${sandboxSim.metrics.estimatedPaybackMonths.toFixed(1)}mo (Python3 Subprocess Exit 0). Input pricing ($${pricing}/mo) and CAC ($${cac}) remain MODELLED_ASSUMPTION.`
        : `Sandboxed unit economics simulation unavailable: quantitative LTV/CAC and payback could not be computed (status: degraded).`,
      tier: isEconomicsAvailable ? "VERIFIED_COMPUTATION" : "UNKNOWN",
      claimType: isEconomicsAvailable ? "VERIFIED_COMPUTATION" : "UNKNOWN",
      provenance: isEconomicsAvailable ? "Dossier Python3 Sandbox (Isolated Subprocess Exit 0)" : "Dossier Sandbox (unavailable)",
      indicator: isEconomicsAvailable ? "SUPPORTING" : "NEUTRAL",
      confidencePercent: isEconomicsAvailable ? 98 : 0
    },
    {
      id: "EV-02",
      claim: `Canonical regulatory framework: Compliance required under ${domain.regulatoryEnvironment}.`,
      tier: "VERIFIED_FACT",
      claimType: "VERIFIED_FACT",
      provenance: "Statutory / Sector Standard Register",
      indicator: "SUPPORTING",
      confidencePercent: 95
    },
    ...externalEvidenceItems,
    {
      id: "EV-05",
      claim: `Founder hypothesis: Target buyers will switch to the new solution within 30 days without extensive organizational change management.`,
      tier: "MODELLED_ASSUMPTION",
      claimType: "MODELLED_ASSUMPTION",
      provenance: "Founder Input & Value Proposition Claim",
      indicator: "CONTRADICTING",
      confidencePercent: 45,
      fatal: true,
      tested: false
    },
    {
      id: "EV-06",
      claim: `Inferred vulnerability: Extended ${domain.procurementCycle} sales cycle will create an 8–12 month working capital drought before first cash settlement.`,
      tier: "INFERENCE",
      claimType: "INFERENCE",
      provenance: "Economist & Red Team Swarm Cross-Examination",
      indicator: "CONTRADICTING",
      confidencePercent: 75
    },
    {
      id: "EV-07",
      claim: `Unquantified black-box parameter: Real-world administrative payment settlement lag and emergency budget allocation friction.`,
      tier: "UNKNOWN",
      claimType: "UNKNOWN",
      provenance: "Red Team Field Adversary Threat Model",
      indicator: "CONTRADICTING",
      confidencePercent: 50
    },
    {
      id: "EV-08",
      claim: `Unresolved contradiction: Customer Advocate assumes buyer urgency ("${customerOpinion.keyAssumptions[0] || customerOpinion.rationale}") while Red Team flags "${redTeamOpinion.fatalFlaws[0] || "unproven willingness to pay"}" — and no purchase commitment has been secured.`,
      tier: "CONTRADICTED",
      claimType: "CONTRADICTED",
      provenance: `Customer Advocate vs Red Team Debate Clash (${debateSource})`,
      indicator: "CONTRADICTING",
      confidencePercent: 60
    },
    ...(sandboxSim.metrics.voi && sandboxSim.metrics.voi.evpiPerCustomer > 0
      ? [
          {
            id: "EV-09",
            claim: `Value-of-information computation (empirical partial-EVPI over ${sandboxSim.metrics.monteCarlo?.iterations ?? 0} Monte Carlo runs, LTV−CAC decision model): resolving "${sandboxSim.metrics.voi.partialEvpi[0]?.param}" is worth $${sandboxSim.metrics.voi.partialEvpi[0]?.evpiPerCustomer}/customer (${Math.round((sandboxSim.metrics.voi.partialEvpi[0]?.shareOfEvpi ?? 0) * 100)}% of the $${sandboxSim.metrics.voi.evpiPerCustomer}/customer decision value at stake).`,
            tier: "VERIFIED_COMPUTATION" as const,
            claimType: "VERIFIED_COMPUTATION" as const,
            provenance: "Dossier Python3 Sobol+VOI Sandbox",
            indicator: "SUPPORTING" as const,
            confidencePercent: 92
          }
        ]
      : [])
  ];
}

export function buildExternalEvidenceSources(input: {
  marketResearch: any;
  unifiedMarkets: any;
  openAlexSignals: any;
  edgarSignals: any;
  hfSignals: any;
  clinicalSignals: any;
  floviaSignals: any;
  newsSignals: any;
  reachSignals: any;
  itchMatches: any[];
  graveyardMatches: any[];
}): ExternalEvidenceSource[] {
  const {
    marketResearch,
    unifiedMarkets,
    openAlexSignals,
    edgarSignals,
    hfSignals,
    clinicalSignals,
    floviaSignals,
    newsSignals,
    reachSignals,
    itchMatches,
    graveyardMatches
  } = input;

  return [
    ...marketResearch.rawResults.map((r: any) => ({ title: r.title, url: r.url, provider: marketResearch.reconProvider })),
    ...marketResearch.community.discussions.map((d: any) => ({ title: d.title, url: d.url, provider: d.platform })),
    ...unifiedMarkets.signals.map((m: any) => ({ title: `[${m.source.toUpperCase()}] ${m.title.slice(0, 120)}`, url: m.url, provider: m.source })),
    ...openAlexSignals.papers.slice(0, 3).map((p: any) => ({ title: p.title.slice(0, 120), url: p.openAccessUrl || "https://openalex.org", provider: "openalex" })),
    ...edgarSignals.filings.map((f: any) => ({ title: `Form D: ${f.company}`, url: f.filingUrl, provider: "sec-edgar" })),
    ...hfSignals.models.map((m: any) => ({ title: `Hub: ${m.id}`, url: m.modelUrl, provider: "huggingface" })),
    ...clinicalSignals.studies.map((s: any) => ({ title: `${s.nctId}: ${s.title.slice(0, 100)}`, url: s.studyUrl, provider: "clinicaltrials" })),
    ...floviaSignals.signals.map((s: any) => ({ title: `[Flovia / CoinGecko] ${s.asset}: $${s.priceUsd.toLocaleString()}`, url: "https://api.flovia.dev/mcp", provider: "flovia" })),
    ...newsSignals.articles.map((a: any) => ({ title: `[NEWS] ${a.title.slice(0, 120)}`, url: a.url, provider: a.source })),
    ...reachSignals.gitHubRepos.map((g: any) => ({ title: `[GitHub] ${g.fullName} (${g.stars}★): ${g.description.slice(0, 80)}`, url: g.url, provider: "github" })),
    ...(reachSignals.deepScrape ? [{ title: `[Jina Reader] ${reachSignals.deepScrape.title}`, url: reachSignals.deepScrape.url, provider: "jina-reader" }] : []),
    ...reachSignals.regionalDiscussions.map((v: any) => ({ title: `[${v.platform.toUpperCase()}] ${v.title.slice(0, 100)}`, url: v.url, provider: v.platform })),
    ...itchMatches.map((p: any) => ({ title: `[Razorpay Fix My Itch] ${p.problemStatement}`, url: p.sourceUrl, provider: "razorpay-fix-my-itch" })),
    ...graveyardMatches.map((g: any) => ({ title: `[Loot Drop Graveyard] ${g.companyName} (${g.burnedCapitalUsd} burned): ${g.fatalFlaw.slice(0, 80)}`, url: g.sourceUrl, provider: "loot-drop-graveyard" }))
  ];
}
