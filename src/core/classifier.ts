import { DomainClassification, IdeaDomainArchetype, IdeaInput } from "../types/index.js";

/**
 * Classifies an incoming concept into a domain archetype with tailored specialist agent mandates,
 * regulatory contexts, and realistic procurement/economics models.
 */
export function classifyIdeaDomain(idea: IdeaInput): DomainClassification {
  const text = `${idea.title} ${idea.summary} ${idea.targetAudience} ${idea.monetization} ${idea.techStack || ""}`.toLowerCase();

  let archetype: IdeaDomainArchetype = "general_startup";

  if (
    text.includes("health") ||
    text.includes("clinical") ||
    text.includes("triage") ||
    text.includes("doctor") ||
    text.includes("patient") ||
    text.includes("asha") ||
    text.includes("imci") ||
    text.includes("hospital") ||
    text.includes("medical")
  ) {
    archetype = "healthcare_clinical";
  } else if (
    text.includes("drone") ||
    text.includes("robot") ||
    text.includes("hardware") ||
    text.includes("sensor") ||
    text.includes("lidar") ||
    text.includes("uav") ||
    text.includes("slam") ||
    text.includes("patrol") ||
    text.includes("wildfire") ||
    text.includes("disaster") ||
    text.includes("ndrf")
  ) {
    archetype = "hardware_robotics";
  } else if (
    text.includes("government") ||
    text.includes("b2g") ||
    text.includes("ministry") ||
    text.includes("district") ||
    text.includes("tender") ||
    text.includes("sih") ||
    text.includes("state health") ||
    text.includes("nhm") ||
    text.includes("public sector")
  ) {
    archetype = "b2g_govtech";
  } else if (
    text.includes("b2b") ||
    text.includes("enterprise") ||
    text.includes("saas") ||
    text.includes("soc2") ||
    text.includes("crm") ||
    text.includes("security") ||
    text.includes("compliance") ||
    text.includes("invoice")
  ) {
    archetype = "b2b_saas";
  } else if (
    text.includes("web3") ||
    text.includes("defi") ||
    text.includes("crypto") ||
    text.includes("smart contract") ||
    text.includes("solidity") ||
    text.includes("escrow") ||
    text.includes("token")
  ) {
    archetype = "web3_defi";
  } else if (
    text.includes("consumer") ||
    text.includes("social") ||
    text.includes("chat") ||
    text.includes("extension") ||
    text.includes("meeting notes") ||
    text.includes("freemium")
  ) {
    archetype = "consumer_social";
  } else if (
    text.includes("research") ||
    text.includes("paper") ||
    text.includes("formal verification") ||
    text.includes("deeptech") ||
    text.includes("algorithm")
  ) {
    archetype = "deeptech_research";
  }

  switch (archetype) {
    case "healthcare_clinical":
      return {
        archetype,
        archetypeLabel: "Healthcare & Clinical Systems",
        primaryCustomer: "Frontline Health Workers, Primary Health Centres & Clinical Authorities",
        procurementCycle: "State Health Mission / NGO Grant Pilot (6–12 Months)",
        regulatoryEnvironment: "WHO Clinical Guidelines, ABDM/ABHA, HIPAA / ISO 27799",
        unitEconomicsModel: "District Public Subsidy & DPG Grant ($1,200/yr/district)",
        specialistRoleLabels: {
          analyst: { number: "01", title: "HEALTH SYSTEM ANALYST", mandate: "Public health epidemiology, PHC density & state funding allocations." },
          customer: { number: "02", title: "CLINICIAN & CHW ADVOCATE", mandate: "ASHA worker cognitive load, patient literacy, spoken dialect fidelity." },
          architect: { number: "03", title: "CLINICAL ARCHITECT", mandate: "Zero-hallucination deterministic triage, offline IndexedDB & FHIR data standards." },
          investor: { number: "04", title: "PUBLIC HEALTH ECONOMIST", mandate: "Grant longevity, government co-funding, long-term societal ROI." },
          redteam: { number: "05", title: "RED TEAM CLINICAL ADVERSARY", mandate: "Misdiagnosis liability, offline sync race conditions, field app fatigue." },
          expert: { number: "06", title: "WHO / AYUSH REGULATORY LEAD", mandate: "IMCI protocol compliance, ABHA ID linkage, district health registry interoperability." }
        }
      };

    case "hardware_robotics":
      return {
        archetype,
        archetypeLabel: "Hardware, Robotics & Autonomous Systems",
        primaryCustomer: "Emergency Responders (NDRF/SDRF), Forest Depts & Incident Commanders",
        procurementCycle: "Emergency Defense/Gov RFP & Public Tender (8–14 Months)",
        regulatoryEnvironment: "DGCA Drone Rules 2021, BVLOS Clearances, WPC Radio Frequency Approval",
        unitEconomicsModel: "Drone-as-a-Service (DaaS) Hardware Lease + Maintenance ($1,500/mo/reserve)",
        specialistRoleLabels: {
          analyst: { number: "01", title: "INCIDENT RESPONSE ANALYST", mandate: "Disaster management budgets, responder coverage metrics, terrain risk profiles." },
          customer: { number: "02", title: "FIELD RESPONDER ADVOCATE", mandate: "Incident commander triage speed, operator ease-of-use, field battery swapping." },
          architect: { number: "03", title: "EDGE ROBOTICS ARCHITECT", mandate: "On-device YOLOv8 inference latency, optical SLAM in GPS-denied zones, sensor fusion." },
          investor: { number: "04", title: "FLEET & HARDWARE ECONOMIST", mandate: "Bill of Materials (BoM), drone MTBF, replacement cycle economics, Capex amortization." },
          redteam: { number: "05", title: "RED TEAM FIELD ADVERSARY", mandate: "Battery failure in extreme heat/rain, radio jamming, mechanical crash liability." },
          expert: { number: "06", title: "DGCA & AIRSPACE SPECIALIST", mandate: "Autonomous BVLOS certification, thermal calibration standards, emergency air corridors." }
        }
      };

    case "b2g_govtech":
      return {
        archetype,
        archetypeLabel: "Government Technology & Civic Systems (B2G)",
        primaryCustomer: "State Departments, Municipal Corporations & Public Authorities",
        procurementCycle: "Government GeM Tender & State Mission RFP (9–15 Months)",
        regulatoryEnvironment: "National Data Governance, MeitY Guidelines, Open Standards Policy",
        unitEconomicsModel: "Multi-Year Municipal/State IT Contract ($50k–$200k/yr)",
        specialistRoleLabels: {
          analyst: { number: "01", title: "CIVIC POLICY ANALYST", mandate: "Mission budget lines, department KPIs, administrative alignment." },
          customer: { number: "02", title: "BUREAUCRATIC STAKEHOLDER ADVOCATE", mandate: "Officer workflow compliance, audit trail integrity, departmental sign-offs." },
          architect: { number: "03", title: "PUBLIC IT ARCHITECT", mandate: "NIC cloud compatibility, multi-lingual support, air-gapped security." },
          investor: { number: "04", title: "B2G CONTRACT ECONOMIST", mandate: "L1 tender bidding margins, milestone-based payout risk, working capital requirements." },
          redteam: { number: "05", title: "RED TEAM TENDER ADVERSARY", mandate: "Tender disqualification traps, political administration turnover risk, payment delays." },
          expert: { number: "06", title: "CIVIC DOMAIN SPECIALIST", mandate: "State-specific innovation council mandates, grievance redressal compliance." }
        }
      };

    case "b2b_saas":
      return {
        archetype,
        archetypeLabel: "B2B Enterprise & Vertical SaaS",
        primaryCustomer: "CTOs, Security Directors, VP Operations & Enterprise Buyers",
        procurementCycle: "Enterprise Proof-of-Concept & Security Review (1–3 Months)",
        regulatoryEnvironment: "SOC2 Type II, ISO 27001, GDPR / CCPA",
        unitEconomicsModel: "Annual Recurring Subscription ($500–$2,500/mo/seat or org)",
        specialistRoleLabels: {
          analyst: { number: "01", title: "ENTERPRISE MARKET ANALYST", mandate: "TAM/SAM sizing, competitive replacement dynamics, category positioning." },
          customer: { number: "02", title: "BUYER WORKFLOW ADVOCATE", mandate: "Time-to-value, operational friction, seat expansion dynamics, user delight." },
          architect: { number: "03", title: "CLOUD SYSTEMS ARCHITECT", mandate: "API latency, inference token cost vs subscription pricing, sandbox isolation." },
          investor: { number: "04", title: "VENTURE CAPITALIST", mandate: "Gross margins, CAC payback period, net revenue retention (NRR), defensibility." },
          redteam: { number: "05", title: "RED TEAM CHURN ADVERSARY", mandate: "Incumbent feature commoditization, pilot abandonment, procurement vetoes." },
          expert: { number: "06", title: "ENTERPRISE SECURITY SPECIALIST", mandate: "Data isolation, audit logging, zero-trust RBAC, vendor risk assessments." }
        }
      };

    case "web3_defi":
      return {
        archetype,
        archetypeLabel: "Web3 & Decentralized Infrastructure",
        primaryCustomer: "DeFi Protocols, DAO Treasuries & Crypto Freelancers",
        procurementCycle: "Smart Contract Audit & Community Launch (1–2 Months)",
        regulatoryEnvironment: "Smart Contract Formal Verification, SEC/MiCA Guidance",
        unitEconomicsModel: "Protocol Fee / Transaction Take-Rate (0.5%–2%)",
        specialistRoleLabels: {
          analyst: { number: "01", title: "DEFI PROTOCOL ANALYST", mandate: "Total Value Locked (TVL) potential, fee capture mechanics, liquidity dynamics." },
          customer: { number: "02", title: "CRYPTO USER ADVOCATE", mandate: "Gas efficiency, wallet UX, transaction speed, dispute fairness." },
          architect: { number: "03", title: "SMART CONTRACT ARCHITECT", mandate: "Solidity gas optimization, reentrancy guards, multi-sig escrow boundaries." },
          investor: { number: "04", title: "TOKENOMICS INVESTOR", mandate: "Treasury runway, transaction velocity, liquidity bootstrapping defensibility." },
          redteam: { number: "05", title: "RED TEAM EXPLOIT ADVERSARY", mandate: "Flash loan vectors, oracle front-running, governance capture, regulatory enforcement." },
          expert: { number: "06", title: "SMART CONTRACT AUDITOR", mandate: "Formal verification invariants, bytecode analysis, upgradeability risks." }
        }
      };

    case "consumer_social":
      return {
        archetype,
        archetypeLabel: "Consumer & Social Applications",
        primaryCustomer: "Individual End Consumers, Creators & Remote Knowledge Workers",
        procurementCycle: "Instant Self-Serve / Viral Adoption (0 Days)",
        regulatoryEnvironment: "Consumer Privacy, App Store Guidelines",
        unitEconomicsModel: "Freemium Subscription + In-App Upgrades ($5–$20/mo)",
        specialistRoleLabels: {
          analyst: { number: "01", title: "VIRAL GROWTH ANALYST", mandate: "K-factor viral loops, organic search traffic, influencer acquisition channels." },
          customer: { number: "02", title: "CONSUMER PSYCHOLOGY ADVOCATE", mandate: "Dopamine feedback loops, onboarding drop-off, habitual day-7 retention." },
          architect: { number: "03", title: "CLIENT & MOBILE ARCHITECT", mandate: "Sub-second client rendering, offline sync, low memory footprint." },
          investor: { number: "04", title: "CONSUMER ANGEL INVESTOR", mandate: "LTV vs blended organic CAC, freemium conversion rate, monetization ceiling." },
          redteam: { number: "05", title: "RED TEAM CHURN ADVERSARY", mandate: "High 30-day churn (>90%), zero switching cost, platform risk from Google/Apple." },
          expert: { number: "06", title: "PRODUCT DESIGN SPECIALIST", mandate: "Micro-interactions, zero-friction sharing, privacy permissions." }
        }
      };

    case "deeptech_research":
      return {
        archetype,
        archetypeLabel: "DeepTech & Formal Research",
        primaryCustomer: "Aerospace, Defense, FinTech & Critical Infrastructure Teams",
        procurementCycle: "Technical Due Diligence & Proof of Efficacy (6–12 Months)",
        regulatoryEnvironment: "Mathematical Invariant Verification, DO-178C, ISO 26262",
        unitEconomicsModel: "High-ACV Enterprise Platform License ($50k–$250k/yr)",
        specialistRoleLabels: {
          analyst: { number: "01", title: "DEEPTECH MARKET ANALYST", mandate: "Mission-critical market sectors, barrier to entry, proprietary IP value." },
          customer: { number: "02", title: "RESEARCH SCIENTIST ADVOCATE", mandate: "Formal precision, reproducibility, integration with existing CI/verification." },
          architect: { number: "03", title: "SYSTEMS & COMPILER ARCHITECT", mandate: "Symbolic execution limits, solver performance, determinism guarantees." },
          investor: { number: "04", title: "DEEPTECH VENTURE INVESTOR", mandate: "Patent defensibility, multi-year R&D moats, extreme pricing power." },
          redteam: { number: "05", title: "RED TEAM RIGOR ADVERSARY", mandate: "Exponential solver complexity, lack of commercial usability, niche buyer pool." },
          expert: { number: "06", title: "FORMAL METHODS SPECIALIST", mandate: "Z3/SMT solver invariants, sound mathematical proofs, safety verification." }
        }
      };

    default:
      return {
        archetype: "general_startup",
        archetypeLabel: "General Commercial Product",
        primaryCustomer: "Target End Users and Commercial Buyers",
        procurementCycle: "Commercial Product Evaluation (1–2 Months)",
        regulatoryEnvironment: "Standard Commercial Privacy & Consumer Protections",
        unitEconomicsModel: "Direct Subscription / Transaction Pricing",
        specialistRoleLabels: {
          analyst: { number: "01", title: "MARKET ANALYST", mandate: "Competition mapping, market size, whitespace, search signals." },
          customer: { number: "02", title: "CUSTOMER ADVOCATE", mandate: "User pain, adoption friction, switching costs, habit inertia." },
          architect: { number: "03", title: "TECHNICAL ARCHITECT", mandate: "Engineering feasibility, compute/API unit economics, sandbox safety." },
          investor: { number: "04", title: "INVESTOR", mandate: "Business model viability, defensibility, pricing power, venture margins." },
          redteam: { number: "05", title: "RED TEAM CHIEF ADVERSARY", mandate: "Uncovers fatal flaws, churn traps, regulatory risks." },
          expert: { number: "06", title: "DOMAIN EXPERT", mandate: "Industry-specific compliance, standards and operational benchmarks." }
        }
      };
  }
}
