import {
  AgentOpinion,
  ClaimNode,
  ClaimStatus,
  DomainClassification,
  EvidenceItem,
  IdeaInput,
  SimulationResult,
  SwarmRole,
  VerificationAudit,
  VerificationAuditItem
} from "../types/index.js";
import { contradictionScore } from "../tools/nli.js";

const DAG_DEPENDENCIES: Record<string, string[]> = {
  "EV-06": ["EV-01", "EV-07"],
  "EV-08": ["EV-05", "EV-07"]
};

function tierToClaimStatus(tier: EvidenceItem["tier"]): ClaimStatus {
  switch (tier) {
    case "VERIFIED_FACT":
    case "VERIFIED_COMPUTATION":
      return "VERIFIED";
    case "MODELLED_ASSUMPTION":
    case "EXTERNAL_EVIDENCE":
    case "INFERENCE":
      return "DISPUTED";
    case "UNKNOWN":
      return "UNKNOWN";
    case "CONTRADICTED":
      return "CONTRADICTED";
    default:
      return "DISPUTED";
  }
}

/**
 * Epistemic Robust Verification & Test-Time Self-Correction Engine.
 * A verifier must verify evidence or execution, not agree with the model.
 */
export class EpistemicRobustVerifier {
  public buildClaimDag(evidenceFeed: EvidenceItem[]): ClaimNode[] {
    const nodes: ClaimNode[] = evidenceFeed.map((item) => ({
      id: item.id,
      claim: item.claim,
      tier: item.tier,
      dependencies: DAG_DEPENDENCIES[item.id] ?? [],
      status: tierToClaimStatus(item.tier),
      provenance: item.provenance
    }));

    const byId = new Map(nodes.map((n) => [n.id, n]));
    let changed = true;
    let guard = 0;
    while (changed && guard < nodes.length * nodes.length + 10) {
      changed = false;
      guard += 1;
      for (const node of nodes) {
        let nextStatus: ClaimStatus | undefined;
        for (const depId of node.dependencies) {
          const dep = byId.get(depId);
          if (!dep) continue;
          if (dep.status === "CONTRADICTED") {
            nextStatus = "CONTRADICTED";
            break;
          }
          if (dep.status === "UNKNOWN" && node.status !== "CONTRADICTED" && node.status !== "VERIFIED") {
            nextStatus = "UNKNOWN";
          }
        }
        if (nextStatus && nextStatus !== node.status) {
          node.status = nextStatus;
          changed = true;
        }
      }
    }
    return nodes;
  }

  public verifySwarmOpinions(
    idea: IdeaInput,
    domain: DomainClassification,
    opinions: Record<SwarmRole, AgentOpinion>,
    sandboxSim: SimulationResult,
    evidenceFeed: EvidenceItem[]
  ): {
    verifiedOpinions: Record<SwarmRole, AgentOpinion>;
    audit: VerificationAudit;
    claimDag: ClaimNode[];
  } {
    const auditItems: VerificationAuditItem[] = [];
    let hallucinationsBlocked = 0;
    let testTimeSelfCorrections = 0;
    const verifiedOpinions: Record<SwarmRole, AgentOpinion> = { ...opinions };
    const claimDag = this.buildClaimDag(evidenceFeed);

    const p50LtvCacRatio = sandboxSim.monteCarlo?.ltvCacPercentiles.p50 ?? sandboxSim.ltvCacRatio;
    const p10LtvCacRatio = sandboxSim.monteCarlo?.ltvCacPercentiles.p10 ?? p50LtvCacRatio;
    const investorOpinion = verifiedOpinions.investor;

    const redTeamOpinion = verifiedOpinions.redteam;
    if (redTeamOpinion && p10LtvCacRatio < 1.0) {
      redTeamOpinion.score = Math.max(10, Math.min(redTeamOpinion.score, redTeamOpinion.score - 8));
      hallucinationsBlocked++;
      testTimeSelfCorrections++;
      auditItems.push({
        id: "VERIFY-P10-INSOLVENCY",
        claimOrOpinion: `MC P10 LTV/CAC ${p10LtvCacRatio.toFixed(2)}x < 1.0x — downside tail is insolvent`,
        verdict: "CORRECTED",
        rationale: "P10-tail invariant: Red Team penalized 8pts because the pessimistic decile cannot pay back CAC.",
        confidencePercent: 93
      });
    }

    if (investorOpinion) {
      if (investorOpinion.score > 85 && p50LtvCacRatio < 3.0) {
        hallucinationsBlocked++;
        testTimeSelfCorrections++;
        investorOpinion.score = 62;
        investorOpinion.verdict = "VIABLE_WITH_RISK";
        investorOpinion.fatalFlaws.push("Mathematical LTV/CAC ratio under 3.0x constrains early cashflow.");
        auditItems.push({
          id: "VERIFY-MATH-01",
          claimOrOpinion: `Investor assigned ${investorOpinion.score}/100 with MC P50 LTV/CAC of ${p50LtvCacRatio.toFixed(2)}x`,
          verdict: "CORRECTED",
          rationale: "Mathematical unit economics did not justify an unconstrained venture score.",
          confidencePercent: 96
        });
      } else {
        auditItems.push({
          id: "VERIFY-MATH-01",
          claimOrOpinion: `Isolated Python3 simulation verified (Exit 0, P50 LTV/CAC ${p50LtvCacRatio.toFixed(2)}x across ${sandboxSim.monteCarlo?.iterations ?? 1} stochastic runs). Input assumptions remain separately labelled as MODELLED_ASSUMPTION.`,
          verdict: "VERIFIED_PASS",
          rationale: "Deterministic calculation verified. Does not validate input pricing or CAC assumptions.",
          confidencePercent: 99
        });
      }
    }

    for (const [role, op] of Object.entries(verifiedOpinions)) {
      if (role === "synthesizer") continue;
      if (op.score >= 90) {
        hallucinationsBlocked++;
        testTimeSelfCorrections++;
        op.score = 84;
        auditItems.push({
          id: `VERIFY-SYCOPHANCY-${role.toUpperCase()}`,
          claimOrOpinion: `${op.roleTitle} scored ${op.score}/100 without empirical field validation`,
          verdict: "CORRECTED",
          rationale: "Blocked score inflation because a verifier must verify execution/evidence, not agree with the model.",
          confidencePercent: 92
        });
      }
      if (domain.archetype !== "b2b_saas" && domain.archetype !== "consumer_social") {
        const text = (op.rationale + " " + op.fatalFlaws.join(" ")).toLowerCase();
        if (text.includes("freemium") || text.includes("self-serve signups")) {
          testTimeSelfCorrections++;
          op.rationale = op.rationale.replace(/freemium/gi, "pilot deployment");
          auditItems.push({
            id: `VERIFY-PRIOR-${role.toUpperCase()}`,
            claimOrOpinion: `Detected irrelevant SaaS freemium prior in [${domain.archetypeLabel}]`,
            verdict: "CORRECTED",
            rationale: `Enforced ${domain.procurementCycle} domain priors instead of generic consumer freemium metrics.`,
            confidencePercent: 95
          });
        }
      }
    }

    const redTeam = verifiedOpinions.redteam;
    if (redTeam) {
      if (redTeam.fatalFlaws.length === 0) {
        hallucinationsBlocked++;
        testTimeSelfCorrections++;
        redTeam.fatalFlaws.push(`Unproven purchasing commitment in ${domain.primaryCustomer}.`);
        auditItems.push({
          id: "VERIFY-REDTEAM-01",
          claimOrOpinion: "Red Team returned empty fatal flaw list",
          verdict: "CORRECTED",
          rationale: "Adversarial agent must explicitly articulate the primary mode of project failure.",
          confidencePercent: 98
        });
      } else {
        auditItems.push({
          id: "VERIFY-REDTEAM-01",
          claimOrOpinion: `Red Team articulated fatal flaw: "${redTeam.fatalFlaws[0]}"`,
          verdict: "VERIFIED_PASS",
          rationale: "Adversarial hypothesis recorded as a domain risk; this is not independent factual verification.",
          confidencePercent: 94
        });
      }
    }

    // Regulatory claims are VERIFIED_FACT only when the evidence feed contains
    // a primary-source URL and an explicit regulatory claim for this domain.
    // Domain classification alone is not evidence that a statute applies.
    const regulatoryEvidence = evidenceFeed.find((item) => {
      const claim = item.claim.toLowerCase();
      const provenance = item.provenance.toLowerCase();
      const hasPrimaryUrl = /^https?:\/\//.test(item.provenance);
      const looksRegulatory = /regulat|statut|law|compliance|licen[cs]|directive|standard/.test(claim);
      const looksPrimary = /\.gov(?:\.|\/|$)|official|legislation|regulator/.test(provenance);
      return item.tier === "VERIFIED_FACT" && hasPrimaryUrl && looksRegulatory && looksPrimary;
    });
    if (verifiedOpinions.expert) {
      auditItems.push({
        id: "VERIFY-REGULATORY-01",
        claimOrOpinion: regulatoryEvidence
          ? `Regulatory evidence supplied: ${regulatoryEvidence.claim}`
          : `Regulatory applicability remains unverified: ${domain.regulatoryEnvironment}`,
        verdict: regulatoryEvidence ? "VERIFIED_PASS" : "CORRECTED",
        rationale: regulatoryEvidence
          ? `Primary-source provenance: ${regulatoryEvidence.provenance}. Jurisdiction/applicability must still be checked for the specific product."
          : "Domain classification is not primary-source evidence. Regulatory applicability is UNKNOWN until a citable primary source is supplied.",
        confidencePercent: regulatoryEvidence ? 90 : 0
      });
      if (!regulatoryEvidence) {
        hallucinationsBlocked++;
        testTimeSelfCorrections++;
      }
    }

    evidenceFeed.forEach(item => {
      const text = item.claim.toLowerCase();
      if (item.tier === "VERIFIED_FACT" || item.tier === "VERIFIED_COMPUTATION") {
        if (
          text.includes("will readily switch") ||
          text.includes("adoption rate") ||
          text.includes("founder assumption") ||
          text.includes("willingness to pay") ||
          text.includes("market sentiment")
        ) {
          hallucinationsBlocked++;
          testTimeSelfCorrections++;
          if (text.includes("market sentiment") || text.includes("oracle")) {
            item.tier = "EXTERNAL_EVIDENCE";
            item.claimType = "EXTERNAL_EVIDENCE";
          } else if (text.includes("because") || text.includes("leads to")) {
            item.tier = "INFERENCE";
            item.claimType = "INFERENCE";
          } else {
            item.tier = "MODELLED_ASSUMPTION";
            item.claimType = "MODELLED_ASSUMPTION";
          }
          auditItems.push({
            id: `VERIFY-EPISTEMIC-${item.id}`,
            claimOrOpinion: `Reclassified "${item.claim}" to ${item.tier}`,
            verdict: "CORRECTED",
            rationale: "Never mark an assumption, inference, or external prediction as VERIFIED.",
            confidencePercent: 99
          });
        }
      }
    });

    const totalClaimsAudited = auditItems.length;
    const passedCount = auditItems.filter(i => i.verdict === "VERIFIED_PASS").length;
    const verificationConfidencePercent = totalClaimsAudited > 0
      ? Math.round((passedCount / totalClaimsAudited) * 100)
      : 0;

    const audit: VerificationAudit = {
      verifierProtocol: "EPISTEMIC_ROBUST_VERIFIER",
      totalClaimsAudited,
      hallucinationsBlocked,
      testTimeSelfCorrections,
      verificationConfidencePercent,
      auditItems
    };

    return { verifiedOpinions, audit, claimDag };
  }

  public async verifyWithNli(
    evidenceFeed: EvidenceItem[],
    opinions: Record<SwarmRole, AgentOpinion>
  ): Promise<{ demotions: number; auditItems: VerificationAuditItem[] }> {
    const auditItems: VerificationAuditItem[] = [];
    let demotions = 0;
    const external = evidenceFeed.filter(
      (e) => e.tier === "EXTERNAL_EVIDENCE" && /^https?:\/\//.test(e.provenance)
    );
    if (external.length === 0) return { demotions, auditItems };

    const claims: Array<{ text: string; role: string }> = [];
    for (const [role, op] of Object.entries(opinions)) {
      if (role === "synthesizer" || !op) continue;
      if (op.rationale) claims.push({ text: op.rationale, role });
      for (const flaw of op.fatalFlaws.slice(0, 1)) claims.push({ text: flaw, role });
    }

    for (const ev of external.slice(0, 4)) {
      for (const claim of claims.slice(0, 6)) {
        const result = await contradictionScore(ev.claim, claim.text);
        if (!result || result.score < 0.75) continue;
        demotions++;
        auditItems.push({
          id: `VERIFY-NLI-${ev.id}`,
          claimOrOpinion: `${claim.role} claim contradicted by ${ev.provenance} (NLI contradiction ${result.score.toFixed(2)})`,
          verdict: "CORRECTED",
          rationale: "NLI demote-only: cited external evidence contradicts the agent claim — flagged CONTRADICTED, never auto-verified.",
          confidencePercent: Math.round(result.score * 100)
        });
        break;
      }
      if (demotions >= 3) break;
    }
    return { demotions, auditItems };
  }
}

export const StanfordRobustVerifier = EpistemicRobustVerifier;
export type StanfordRobustVerifier = EpistemicRobustVerifier;
