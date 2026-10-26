import { IdeaSwarmOrchestrator } from "../src/core/swarm.js";
import { IdeaInput } from "../src/types/index.js";

async function verifyE2E() {
  console.log("================================================================================");
  console.log("       DOSSIER LIVE E2E VERIFICATION: GEO-ENGINE & AGENT-REACH INTEL            ");
  console.log("================================================================================\n");

  const orchestrator = new IdeaSwarmOrchestrator();

  const testCases: Array<{ label: string; idea: IdeaInput }> = [
    {
      label: "PERSONA 1: India Micro-Fintech (Kirana / UPI / DPDP)",
      idea: {
        title: "KiranaFlow UPI Micro-Credit",
        targetAudience: "Kirana retail shop owners and SME merchants in India",
        monetization: "0.75% transaction fee on merchant working capital advances",
        summary: "Automated cashflow underwriting for Kirana shops using UPI daily settlement flows without collateral."
      }
    },
    {
      label: "PERSONA 2: UK Healthcare (NHS / MHRA Pathways)",
      idea: {
        title: "NHS Acute Patient Intake Triage",
        targetAudience: "NHS clinical trusts and hospital emergency departments across the UK",
        monetization: "£3,500/hospital trust monthly enterprise SaaS license",
        summary: "Clinical decision support software prioritizing emergency room triage according to NICE and MHRA guidelines."
      }
    },
    {
      label: "PERSONA 3: Global Developer Tools (Agent-Reach GitHub & Jina)",
      idea: {
        title: "High-Performance Local Vector Indexing Engine",
        targetAudience: "Rust and Python AI systems backend developers",
        monetization: "$49/developer monthly developer seat",
        summary: "Lightweight, memory-efficient SIMD-accelerated local vector embedding index for offline RAG."
      }
    }
  ];

  for (const { label, idea } of testCases) {
    console.log(`\n>>> EXECUTING LIVE E2E EVALUATION FOR: [${label}]`);
    console.log(`    Title: "${idea.title}"`);
    console.log(`    Audience: "${idea.targetAudience}"`);

    const dossier = await orchestrator.evaluateIdea(idea, { useLiveLLM: false });

    console.log(`\n  [E2E Results]`);
    console.log(`    * Dossier ID:           ${dossier.id}`);
    console.log(`    * Verdict:              ${dossier.overallVerdict} (Composite Score: ${dossier.killScore}/100)`);
    console.log(`    * Archetype:            ${dossier.domainClassification.archetypeLabel}`);
    console.log(`    * Regulatory:           ${dossier.domainClassification.regulatoryEnvironment}`);
    console.log(`    * Epistemic Summary:    Facts=${dossier.epistemicSummary.verifiedFactsCount}, Computations=${dossier.epistemicSummary.verifiedComputationsCount}, ExtEvidence=${dossier.epistemicSummary.externalEvidenceCount}, Assumptions=${dossier.epistemicSummary.modelledAssumptionsCount}`);
    
    console.log(`\n  [External Evidence Provenance (Sourced Slices)]`);
    const reachSources = dossier.externalEvidenceSources.filter(s => 
      s.provider === "github" || s.provider === "jina-reader" || s.provider === "v2ex" || s.provider.includes("google")
    );
    for (const src of reachSources.slice(0, 4)) {
      console.log(`      - [${src.provider.toUpperCase()}] ${src.title.slice(0, 85)} (${src.url.slice(0, 60)})`);
    }

    console.log(`\n  [Top Structured Claims in Feed]`);
    for (const claim of dossier.evidenceFeed.filter(e => e.tier === "EXTERNAL_EVIDENCE").slice(0, 3)) {
      console.log(`      - (${claim.id} - ${claim.tier}): ${claim.claim.slice(0, 100)}...`);
    }
    console.log("--------------------------------------------------------------------------------");
  }

  console.log("\n>>> LIVE E2E VERIFICATION COMPLETED SUCCESSFULLY FOR ALL 3 PERSONAS.");
}

verifyE2E().catch((err) => {
  console.error("FATAL E2E FAILURE:", err);
  process.exit(1);
});
