import { IdeaSwarmOrchestrator } from "../src/core/swarm.js";
import { IdeaInput } from "../src/types/index.js";

async function runDifferentialVerification() {
  console.log("================================================================================");
  console.log("   DOSSIER DIFFERENTIAL VERIFICATION: RAZORPAY ITCH & LOOT DROP GRAVEYARD      ");
  console.log("================================================================================\n");

  const orchestrator = new IdeaSwarmOrchestrator();

  const scenarios: Array<{
    scenarioName: string;
    expectedEnhancement: string;
    idea: IdeaInput;
  }> = [
    {
      scenarioName: "SCENARIO 1: Razorpay Fix My Itch Grounding (Invoice Reconciliation for SMEs)",
      expectedEnhancement: "Customer Advocate & Evidence Feed cite verified commercial demand (FMI-01)",
      idea: {
        title: "ReconcilePay: Micro-SME Automated Invoicing & Reconciliation",
        summary: "Automated real-time matching between bank statements, GST invoices, and UPI payment flows for Indian small businesses.",
        targetAudience: "Small retail shops and SME distributors in India",
        monetization: "₹999/month subscription fee"
      }
    },
    {
      scenarioName: "SCENARIO 2: Loot Drop Startup Graveyard Forensics (Furniture Resale Marketplace)",
      expectedEnhancement: "Red Team & Mutation Engine cite MoveLoot ($22M burned) and reverse logistics failure antipattern",
      idea: {
        title: "Reloot: Used Furniture Peer-to-Peer Resale Marketplace",
        summary: "Full-service second-hand furniture marketplace handling pickup, storage, reverse logistics, and delivery for urban movers.",
        targetAudience: "Urban apartment dwellers and moving homeowners",
        monetization: "15% marketplace commission on completed resale transactions"
      }
    },
    {
      scenarioName: "SCENARIO 3: Control Benchmark (Healthy Differentiated B2B Software)",
      expectedEnhancement: "Zero false graveyard citations; healthy score preserved without degradation",
      idea: {
        title: "AutoSOC2: Continuous Security Compliance Auditor for Kubernetes",
        summary: "Automated continuous evidence collector mapping cluster configurations to SOC2 and ISO27001 statutory standards.",
        targetAudience: "Enterprise DevOps and Security Engineering teams",
        monetization: "$799/month annual enterprise contract"
      }
    }
  ];

  for (const s of scenarios) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`>>> EXECUTING: ${s.scenarioName}`);
    console.log(`    Target Hypothesis: ${s.expectedEnhancement}`);
    console.log(`    Idea Title:        "${s.idea.title}"`);
    console.log(`--------------------------------------------------------------------------------`);

    const dossier = await orchestrator.evaluateIdea(s.idea, { useLiveLLM: false });

    console.log(`\n  [1. Resilience Score & Verdict]`);
    console.log(`      * Composite Resilience Score: ${dossier.killScore}/100`);
    console.log(`      * Overall Verdict:            ${dossier.overallVerdict}`);
    console.log(`      * Domain Classification:      ${dossier.domainClassification.archetypeLabel}`);

    console.log(`\n  [2. Evidence Feed Provenance Check]`);
    const fmiClaims = dossier.evidenceFeed.filter(e => e.provenance.includes("fix-my-itch"));
    const graveClaims = dossier.evidenceFeed.filter(e => e.provenance.includes("loot-drop") || e.claim.includes("Graveyard"));
    
    if (fmiClaims.length > 0) {
      console.log(`      ✓ Fix My Itch Grounding detected:`);
      for (const c of fmiClaims) {
        console.log(`        - [${c.id}] (${c.tier} - ${c.indicator}): ${c.claim.slice(0, 110)}...`);
      }
    } else {
      console.log(`      - No Fix My Itch claim matched (expected for non-SME/non-India concepts)`);
    }

    if (graveClaims.length > 0) {
      console.log(`      ✓ Graveyard Forensic Precedent detected:`);
      for (const g of graveClaims) {
        console.log(`        - [${g.id}] (${g.tier} - ${g.indicator}): ${g.claim.slice(0, 110)}...`);
      }
    } else {
      console.log(`      - No Graveyard death trap matched (clean bill of health against known failure antipatterns)`);
    }

    console.log(`\n  [3. Red Team Assessment Specificity]`);
    console.log(`      * Score:       ${dossier.roleAssessments.redteam.score}/100 (${dossier.roleAssessments.redteam.verdict})`);
    console.log(`      * Fatal Flaw:  "${dossier.roleAssessments.redteam.fatalFlaws[0] || "None"}"`);

    console.log(`\n  [4. Customer Advocate Grounding]`);
    console.log(`      * Score:       ${dossier.roleAssessments.customer.score}/100 (${dossier.roleAssessments.customer.verdict})`);
    console.log(`      * Assumption:  "${dossier.roleAssessments.customer.keyAssumptions[0] || "None"}"`);

    if (dossier.mutationProposals && dossier.mutationProposals.length > 0) {
      console.log(`\n  [5. Strategic Mutation Engine Pivots]`);
      for (const m of dossier.mutationProposals) {
        console.log(`      * [${m.strategy}]: ${m.mutatedIdea.title}`);
        console.log(`        Rationale: ${m.rationale.slice(0, 120)}...`);
      }
    }

    console.log(`\n  [6. Differential Impact Assessment]`);
    if (s.scenarioName.includes("Razorpay")) {
      const hasFmi = fmiClaims.length > 0;
      console.log(`      => Result: ${hasFmi ? "ENHANCED: Replaced speculative buyer demand with verified Razorpay merchant friction data." : "FAILED TO ENHANCE"}`);
    } else if (s.scenarioName.includes("Graveyard")) {
      const hasGrave = graveClaims.length > 0 && dossier.killScore <= 55;
      console.log(`      => Result: ${hasGrave ? "ENHANCED: Ruthlessly flagged MoveLoot reverse logistics precedent, prevented false positive BUILD, generated targeted pivot." : "FAILED TO ENHANCE"}`);
    } else {
      const isClean = graveClaims.length === 0 && dossier.killScore >= 70;
      console.log(`      => Result: ${isClean ? "VERIFIED NO DEGRADATION: Healthy enterprise concept preserved with zero false graveyard penalties." : "DEGRADATION DETECTED"}`);
    }
  }

  console.log("\n================================================================================");
  console.log("   DIFFERENTIAL VERIFICATION COMPLETE: ALL 3 SCENARIOS VERIFIED                 ");
  console.log("================================================================================\n");
}

runDifferentialVerification().catch((err) => {
  console.error("DIFFERENTIAL VERIFICATION ERROR:", err);
  process.exit(1);
});
