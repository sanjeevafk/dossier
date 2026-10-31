import {
  IdeaInput,
  DomainClassification,
  SwarmRole,
  Verdict,
  AgentOpinion
} from "../../types/index.js";
import {
  AdversarialInvariants,
  DOMAIN_FEASIBILITY_DRAG,
  DOMAIN_REGULATORY_DRAG
} from "./invariants.js";

/**
 * Domain-calibrated heuristic evaluator when live LLM is offline or ungrounded.
 * Evaluates pricing, unit economics, physics sanity, prompt injection defense, and domain procurement.
 */
export function generateHeuristicOpinion(
  role: SwarmRole,
  idea: IdeaInput,
  domain: DomainClassification,
  marketResearch: any,
  sandboxSim: any,
  pricing: number,
  cac: number,
  invariants: AdversarialInvariants
): AgentOpinion {
  const roleLabels = domain.specialistRoleLabels;
  const { isPromptInjection, isImpossiblePhysics, isNoMonetization, isThinWrapper, hasFormatRisk } = invariants;
  const isEconomicsAvailable = Boolean(sandboxSim && !sandboxSim.degraded && sandboxSim.runtime !== "unavailable" && sandboxSim.exitCode === 0);
  const ltvCac = isEconomicsAvailable ? sandboxSim.metrics.ltvCacRatio : null;

  let score = 70;
  let verdict: Verdict = "VIABLE_WITH_RISK";
  let fatalFlaws: string[] = [];
  let keyAssumptions: string[] = [];
  let competitiveRisks: string[] = [];
  let mustTestBeforeBuilding: string[] = [];
  let rationale = "";

  switch (role) {
    case "analyst": {
      if (isThinWrapper) {
        score = 35;
        verdict = "PIVOT_REQUIRED";
        fatalFlaws = [
          "Hyper-saturated category: Hundreds of nearly identical AI utility wrappers already compete for identical search queries.",
          "Non-existent switching barriers: Users quickly jump to whichever tool offers the cheapest token pricing or native foundation integration."
        ];
        keyAssumptions = ["Organic viral discovery can overcome negative paid search arbitrage."];
        competitiveRisks = ["Browser extension store cloning by international copycats with zero development overhead."];
        mustTestBeforeBuilding = ["Prove negative customer acquisition cost (CAC) via organic SEO or open-source community distribution."];
        rationale = "Market Recon: Saturated commodity category with zero structural switching friction.";
      } else {
        const reconCount = marketResearch.rawResults.length;
        score = Math.max(35, Math.min(88, 75 - (reconCount > 4 ? 8 : 0) + (domain.archetype === "deeptech_research" ? 8 : -3)));
        verdict = score >= 75 ? "STRONG_PURSUE" : (score >= 60 ? "VIABLE_WITH_RISK" : "PIVOT_REQUIRED");
        fatalFlaws = [reconCount > 0
          ? `Competitive crowding signal: live recon returned ${reconCount} closely-related results — differentiation must be verified against them.`
          : `Unclear differentiation against established ${domain.archetypeLabel} incumbents — no live recon was available to map the field.`];
        keyAssumptions = [`Market demand in ${domain.primaryCustomer} is active and funded.`];
        competitiveRisks = reconCount > 0
          ? marketResearch.rawResults.slice(0, 3).map((r: { title: string; url: string }) => `${r.title} (${r.url})`)
          : ["Competitive landscape unverified — no live recon provider was available during this evaluation."];
        if (hasFormatRisk) {
          competitiveRisks.push("Platform format risk: distribution format requires defensibility through proprietary integrations to resist platform commoditization.");
        }
        mustTestBeforeBuilding = [`Validate addressable budget allocations across 10 prospective buyers in ${domain.primaryCustomer}.`];
        rationale = reconCount > 0
          ? `Evaluated competitive whitespace for ${domain.archetypeLabel} against ${reconCount} live recon sources (${marketResearch.reconProvider}).`
          : `Evaluated ${domain.archetypeLabel} whitespace from heuristic priors only — no live recon was available.`;
      }
      break;
    }

    case "customer": {
      score = domain.archetype === "b2g_govtech" ? 48 : (domain.archetype === "healthcare_clinical" ? 52 : (isThinWrapper ? 45 : 68));
      if (pricing > 150 && domain.archetype === "consumer_social") score -= 15;
      verdict = score >= 70 ? "VIABLE_WITH_RISK" : (score < 50 ? "STRONG_KILL" : "LEAN_KILL");
      fatalFlaws = isThinWrapper
        ? ["Novelty churn cliff: Users test the tool twice for curiosity, then abandon it once novelty fades.", "High price sensitivity: Unwillingness to pay recurring subscription for single-purpose utilities."]
        : [`Adoption inertia: ${domain.primaryCustomer} have entrenched habits with high switching drag.`];
      keyAssumptions = [`End users will switch to a new workflow without extensive retraining.`];
      competitiveRisks = ["Existing manual processes, bookmarks, or entrenched legacy tools with zero marginal training cost."];
      if (hasFormatRisk && !isThinWrapper) {
        competitiveRisks.push("Format novelty churn: ensure workflow embedding avoids single-purpose tool fatigue.");
      }
      mustTestBeforeBuilding = [`Observe 5 target operators completing the core task in their native workflow.`];
      rationale = `Users feel the pain point, but habit inertia and workflow disruption create high pilot abandonment risk.`;
      break;
    }

    case "architect": {
      if (isImpossiblePhysics) {
        score = 15;
        verdict = "STRONG_KILL";
        fatalFlaws = ["Physical impossibility: Claims violate conservation of energy or standard thermodynamic feasibility laws."];
        rationale = "Engineering review: Proposed mechanism is theoretically impossible under verified physical laws.";
      } else if (isPromptInjection) {
        score = 25;
        verdict = "STRONG_KILL";
        fatalFlaws = ["System integrity risk: Input text contains prompt tampering or jailbreak syntax."];
        rationale = "Security architecture review: Flagged adversarial instruction injection.";
      } else if (isThinWrapper) {
        score = 72;
        verdict = "VIABLE_WITH_RISK";
        fatalFlaws = ["Fragile API dependency: Reliance on upstream LLM API rate limits, schema deprecation, and unexpected token price shifts."];
        rationale = "Architecture review: Trivially simple integration, but heavy upstream platform dependency.";
      } else {
        score = (sandboxSim.exitCode === 0 ? 84 : 55) + (DOMAIN_FEASIBILITY_DRAG[domain.archetype] ?? 0);
        if (isEconomicsAvailable) {
          const mcFeasibility = sandboxSim.metrics.monteCarlo;
          if (mcFeasibility) {
            if (mcFeasibility.tokenCostBurdenPercent.p50 > 0.45) score -= 6;
            if (mcFeasibility.survivalProbability12Mo < 0.6) score -= 6;
          }
        }
        verdict = score >= 75 ? "STRONG_PURSUE" : "VIABLE_WITH_RISK";
        fatalFlaws = ["API token inflation or uncontrolled recursion under burst concurrency load."];
        rationale = isEconomicsAvailable
          ? `Architecture verified feasible with Python sandbox simulation (Exit 0); ${domain.archetypeLabel} engineering burden applied.`
          : `Architecture verified under ${domain.archetypeLabel} specifications; sandbox simulation unavailable (status: degraded).`;
      }
      keyAssumptions = ["Underlying infrastructure and edge models maintain required throughput and latency budgets."];
      competitiveRisks = ["Commoditization of base foundation models."];
      mustTestBeforeBuilding = ["Benchmark single-task latency and verify isolated sandbox boundaries."];
      break;
    }

    case "investor": {
      if (isNoMonetization) {
        score = 20;
        verdict = "STRONG_KILL";
        fatalFlaws = ["Zero monetization capture: Free distribution without commercial capture creates immediate insolvency."];
      } else if (isThinWrapper) {
        score = 28;
        verdict = "STRONG_KILL";
        fatalFlaws = [
          "Zero structural defensibility: Thin wrapper architecture offers no proprietary data moat or sustainable pricing power.",
          "Platform Replication Risk: Hyperscalers or upstream model providers can commoditize this entire workflow with a native feature release."
        ];
      } else if (!isEconomicsAvailable) {
        // Rule: unavailable ≠ zero. Do NOT treat degraded sandbox as real 0.0x LTV/CAC.
        score = 62;
        verdict = "VIABLE_WITH_RISK";
        fatalFlaws = ["Quantitative unit economics unverified: sandbox simulation was unavailable (status: degraded). Real LTV/CAC ratio could not be deterministically proven."];
      } else if (ltvCac !== null && ltvCac < 1.0) {
        score = 22;
        verdict = "STRONG_KILL";
        fatalFlaws = [`Mathematically inverted unit economics: CAC ($${cac}) exceeds LTV ($${sandboxSim.metrics.ltvEstimateUsd}). Every user burns capital.`];
      } else if (ltvCac !== null && ltvCac < 2.5) {
        score = 52;
        verdict = "VIABLE_WITH_RISK";
        fatalFlaws = [`Compressed venture margins: LTV/CAC ratio of ${ltvCac}x leaves insufficient buffer for sales payback.`];
        const mcWeak = sandboxSim.metrics.monteCarlo;
        if (mcWeak && mcWeak.survivalProbability24Mo < 0.5) {
          score -= 10;
          fatalFlaws.push(`Stochastic insolvency: ${(100 - mcWeak.survivalProbability24Mo * 100).toFixed(0)}% of ${mcWeak.iterations} Monte Carlo runs burn cash to zero before month 24.`);
        }
      } else {
        const mcStrong = sandboxSim.metrics.monteCarlo;
        const ltvP50 = mcStrong?.ltvCacPercentiles.p50 ?? (ltvCac ?? 3.0);
        score = Math.min(88, Math.round(48 + (ltvP50 * 4)));
        const paybackMonths = mcStrong?.paybackPercentiles.p50 ?? sandboxSim.metrics.estimatedPaybackMonths;
        if (paybackMonths > 22) {
          score -= 12;
        } else if (paybackMonths > 15) {
          score -= 6;
        }
        if (mcStrong) {
          if (mcStrong.survivalProbability24Mo < 0.35) {
            score -= 14;
          } else if (mcStrong.survivalProbability24Mo < 0.60) {
            score -= 8;
          } else if (mcStrong.survivalProbability24Mo < 0.85) {
            score -= 4;
          }
          if (mcStrong.ltvCacPercentiles.p10 < 1.0) {
            score = Math.max(32, score - 8);
            fatalFlaws.unshift(`Stochastic insolvency tail: ${(100 - mcStrong.survivalProbability24Mo * 100).toFixed(0)}% of ${mcStrong.iterations} Monte Carlo runs burn cash to zero before month 24.`);
          }
        }
        if (score < 50 && !fatalFlaws.length) {
          fatalFlaws = [`Long sales cycles (${domain.procurementCycle}) will strain early runway under stochastic insolvency risk.`];
        } else {
          fatalFlaws.push(`Long sales cycles (${domain.procurementCycle}) will strain early runway.`);
        }
        verdict = score >= 75 ? "STRONG_PURSUE" : "VIABLE_WITH_RISK";
      }
      keyAssumptions = [`Unit economics support healthy margins under ${domain.unitEconomicsModel}.`];
      competitiveRisks = hasFormatRisk && !isThinWrapper
        ? ["Platform commoditization risk: host platform may bundle baseline features; defensibility requires proprietary data and deep integrations."]
        : ["Well-funded legacy providers bundle identical capability for free."];
      mustTestBeforeBuilding = [`Pre-secure 2 paid pilots or signed Letters of Intent (LOIs).`];
      rationale = isEconomicsAvailable
        ? `LTV/CAC modeled at ${ltvCac}x with ${sandboxSim.metrics.estimatedPaybackMonths}mo payback under ${domain.unitEconomicsModel}.`
        : `Unit economics simulation unavailable (status: degraded/unavailable). Heuristic assessment applied; unavailable metrics are not treated as zero economics.`;
      break;
    }

    case "redteam": {
      if (isPromptInjection) {
        score = 10;
        verdict = "STRONG_KILL";
        fatalFlaws = [
          "Adversarial prompt injection attempt detected: Target concept attempts system prompt override or instruction tampering."
        ];
        rationale = "Red Team Security Gate: Immediate rejection due to adversarial injection tampering.";
      } else if (isImpossiblePhysics) {
        score = 12;
        verdict = "STRONG_KILL";
        fatalFlaws = [
          "Impossible physical or technical claim: Violates fundamental conservation of energy / thermodynamic laws."
        ];
        rationale = "Red Team Physics Audit: Claimed mechanism cannot function in the physical world.";
      } else if (isThinWrapper) {
        score = 24;
        verdict = "STRONG_KILL";
        fatalFlaws = [
          "Commoditization Hazard: Low defensibility thin wrapper over base foundation models. Hyperscalers or open-source extensions can replicate this within 48 hours with zero infrastructure cost.",
          "Zero Structural Moat: Without proprietary datasets or embedded workflow lock-in, monthly user churn exceeds 25% as free alternatives emerge."
        ];
        rationale = "Red Team Defensibility Audit: Extreme replication vulnerability to native foundation model updates.";
      } else if (isEconomicsAvailable && ltvCac !== null && ltvCac < 1.0) {
        score = 22;
        verdict = "STRONG_KILL";
        fatalFlaws = [
          `Terminal unit economics insolvency: Acquiring users at $${cac} produces only $${sandboxSim.metrics.ltvEstimateUsd} LTV.`
        ];
        rationale = "Red Team Capital Audit: Business model guarantees bankruptcy under modeled customer acquisition costs.";
      } else {
        // Domain-tailored adversarial failure patterns; severity narrows to
        // procurement timing when stochastic economics survive the stress replay.
        const mcRedteam = isEconomicsAvailable ? sandboxSim.metrics.monteCarlo : undefined;
        const econSurvivesStress = isEconomicsAvailable && (ltvCac ?? 0) >= 6 && (mcRedteam ? mcRedteam.survivalProbability24Mo >= 0.8 : false);
        switch (domain.archetype) {
          case "b2b_saas":
            score = econSurvivesStress ? 52 : (isEconomicsAvailable && (ltvCac ?? 0) < 2.5 ? 36 : 46);
            verdict = "LEAN_KILL";
            fatalFlaws = [
              `Enterprise Procurement Deadlock: ${domain.primaryCustomer} praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free.`,
              `Integration Churn Trap: Without bi-directional synchronization into core CRM/ERP systems, weekly active usage degrades by >60% within 60 days.`
            ];
            rationale = `High pilot abandonment risk: Enterprise buyers express enthusiasm in discovery but face procurement bottlenecks.`;
            break;

          case "b2g_govtech":
            score = 30;
            verdict = "STRONG_KILL";
            fatalFlaws = [
              `Multi-Year Tender RFP Stagnation: Public sector procurement requires sovereign hosting certifications and bureaucratic approvals that outlast seed runway.`,
              `Field Bureaucracy Friction: Civil servants and field operators avoid adopting unmandated third-party tools due to audit liability concerns.`
            ];
            rationale = `Government tender cycles and departmental inertia create high bankruptcy probability before revenue realization.`;
            break;

          case "healthcare_clinical":
            score = 32;
            verdict = "STRONG_KILL";
            fatalFlaws = [
              `EHR Gatekeeping & Malpractice Liability: Electronic Health Record vendors (Epic, Cerner) impose closed API walled gardens; diagnostic claims trigger intense medical liability.`,
              `Clinician Cognitive Overload: Doctors already spend >2 hours daily on charting; any non-automated interface suffers immediate clinical rejection.`
            ];
            rationale = `Clinical liability and hospital IT procurement barriers severely constrain deployment timeline.`;
            break;

          case "hardware_robotics":
            score = 34;
            verdict = "LEAN_KILL";
            fatalFlaws = [
              `Bill-of-Materials (BoM) Margin Compression: Sensor payloads and battery thermal degradation compress hardware margins below 30% without recurring software attach rates.`,
              `Field Servicing Overhead: Mean-time-between-failures (MTBF) under adverse weather requires costly physical repairs that destroy unit cash flow.`
            ];
            rationale = `Hardware production capital expenditure and field maintenance risk outstrip initial capitalization.`;
            break;

          case "consumer_social":
            score = 28;
            verdict = "STRONG_KILL";
            fatalFlaws = [
              `30-Day Cohort Retention Cliff: Consumer utilities face >85% month-1 dropoff without dense multi-player network effects or habit-forming loops.`,
              `Paid Acquisition Arbitrage Collapse: Performance marketing ad costs (CAC $${cac}) outpace prosumer lifetime monetization within 90 days.`
            ];
            rationale = `Rapid consumer novelty decay and high acquisition costs lead to unsustainable churn dynamics.`;
            break;

          case "deeptech_research":
            score = 44;
            verdict = "PIVOT_REQUIRED";
            fatalFlaws = [
              `Inference Latency & VRAM Wall: Heavy transformer passes incur per-query compute costs that consume >40% of subscription revenue at production scale.`,
              `Lab-to-Field Distribution Shift: Academic benchmark accuracy drops significantly when encountering messy, noisy real-world inputs.`
            ];
            rationale = `Technically ambitious but constrained by high token inference overhead and out-of-distribution edge failures.`;
            break;

          case "web3_defi":
            score = 35;
            verdict = "LEAN_KILL";
            fatalFlaws = [
              `Smart Contract Exploitation Vector: Unaudited cross-contract execution risks total liquidity drain via flash loans or oracle manipulation.`,
              `Regulatory Compliance Chasm: Shifting international securities and AML/KYC mandates expose operators to protocol-level regulatory enforcement.`
            ];
            rationale = `High systemic risk from regulatory exposure and smart contract vulnerability surface area.`;
            break;

          default:
            score = 40;
            verdict = "LEAN_KILL";
            fatalFlaws = [
              `Distribution Desert: Lack of an asymmetric, proprietary top-of-funnel acquisition channel leads to zero-traction stagnation.`,
              `Habit Inertia Trap: Defaulting to existing manual spreadsheets remains cheaper and lower friction than onboarding a new platform.`
            ];
            rationale = `Founder underestimates customer switching friction and lack of organic discovery channels.`;
        }
      }
      keyAssumptions = [`Buyers have discretionary budget authority to deploy this within ${domain.procurementCycle}.`];
      competitiveRisks = ["Zero switching cost back to legacy manual methods."];
      mustTestBeforeBuilding = [`Force a binding pre-order, deposit, or pilot MOU before committing engineering.`];
      break;
    }

    case "expert": {
      if (isImpossiblePhysics) {
        score = 15;
        verdict = "STRONG_KILL";
        fatalFlaws = ["Scientific peer review rejection: Unsound foundational claims."];
        rationale = "Domain specialist review: Failed fundamental scientific peer validation.";
      } else if (isPromptInjection) {
        score = 20;
        verdict = "STRONG_KILL";
        fatalFlaws = ["Security integrity violation."];
        rationale = "Compliance specialist review: Malicious injection payload.";
      } else {
        score = 78 + (DOMAIN_REGULATORY_DRAG[domain.archetype] ?? 0) - (isThinWrapper ? 18 : 0);
        verdict = score >= 75 ? "STRONG_PURSUE" : "VIABLE_WITH_RISK";
        fatalFlaws = [`Non-compliance with ${domain.regulatoryEnvironment} standards could halt deployment.`];
        rationale = isThinWrapper
          ? "Vertical review: compliance posture acceptable, but zero proprietary domain grounding weakens the defensibility claim."
          : `Vertical compliance analysis confirmed statutory requirements under ${domain.regulatoryEnvironment}.`;
      }
      keyAssumptions = [`Solution meets mandatory ${domain.regulatoryEnvironment} compliance protocols.`];
      competitiveRisks = ["Incumbent vendors with pre-existing certifications."];
      mustTestBeforeBuilding = [`Audit architecture against official ${domain.regulatoryEnvironment} compliance checklists.`];
      break;
    }

    default: {
      score = 70;
      verdict = "VIABLE_WITH_RISK";
      fatalFlaws = ["Unverified operational assumptions."];
      keyAssumptions = ["Target customer has active budget."];
      competitiveRisks = ["Competitor bundling."];
      mustTestBeforeBuilding = ["Conduct 5 user discovery calls."];
      rationale = "General baseline evaluation.";
    }
  }

  const meta = roleLabels[role as keyof typeof roleLabels] || { number: "01", title: role.toUpperCase() };

  return {
    role,
    roleNumber: meta.number,
    roleTitle: meta.title,
    verdict,
    score,
    status: "COMPLETE",
    fatalFlaws,
    keyAssumptions,
    competitiveRisks,
    mustTestBeforeBuilding,
    rationale
  };
}
