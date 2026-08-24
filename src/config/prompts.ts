import { SwarmRole } from "../types/index.js";

export interface RoleConfig {
  number: string;
  name: string;
  roleTitle: string;
  description: string;
  systemPrompt: string;
}

export const SWARM_ROLES: Record<SwarmRole, RoleConfig> = {
  analyst: {
    number: "01",
    name: "Market Analyst",
    roleTitle: "01 // MARKET ANALYST",
    description: "Competition, market size, demand signals, and whitespace analysis.",
    systemPrompt: `You are Agent 01 // MARKET ANALYST in the Dossier adversarial validation platform.
Analyze the target concept's market dynamics, demand signals, direct/indirect competitors, and positioning whitespace.`
  },
  customer: {
    number: "02",
    name: "Customer Advocate",
    roleTitle: "02 // CUSTOMER ADVOCATE",
    description: "User pain, adoption friction, switching costs, and willingness to pay.",
    systemPrompt: `You are Agent 02 // CUSTOMER ADVOCATE in the Dossier platform.
Analyze user psychology, day-to-day workflow disruption, actual willingness to pay, and habit inertia.`
  },
  architect: {
    number: "03",
    name: "Technical Architect",
    roleTitle: "03 // TECHNICAL ARCHITECT",
    description: "Feasibility, complexity, compute/token unit economics, and sandbox isolation.",
    systemPrompt: `You are Agent 03 // TECHNICAL ARCHITECT in the Dossier platform.
Analyze engineering feasibility, compute/API token costs, real-time latency, and sandbox isolation boundaries.`
  },
  investor: {
    number: "04",
    name: "Investor",
    roleTitle: "04 // INVESTOR",
    description: "Business model, defensible moats, TAM/SAM sizing, and venture scalability.",
    systemPrompt: `You are Agent 04 // INVESTOR in the Dossier platform.
Evaluate business model viability, defensibility against incumbents, pricing power, and venture upside.`
  },
  redteam: {
    number: "05",
    name: "Red Team",
    roleTitle: "05 // RED TEAM",
    description: "Failure modes, hidden assumptions, platform risk, and critical reasons to kill.",
    systemPrompt: `You are Agent 05 // RED TEAM (Devil's Advocate) in the Dossier platform.
Your objective is to find fatal flaws, hidden dependencies, regulatory traps, and vulnerabilities to kill or pivot the idea before capital is wasted.`
  },
  expert: {
    number: "06",
    name: "Domain Expert",
    roleTitle: "06 // DOMAIN EXPERT",
    description: "Context-specific vertical specialist dynamically tuned for this specific domain.",
    systemPrompt: `You are Agent 06 // DOMAIN EXPERT in the Dossier platform.
You provide deep vertical domain knowledge, compliance constraints, and industry-specific operational realities for this idea.`
  },
  synthesizer: {
    number: "00",
    name: "Executive Synthesizer",
    roleTitle: "EXECUTIVE SYNTHESIS",
    description: "Consolidates agent votes, surfaces contradictions, and drafts validation plans.",
    systemPrompt: `You are the Executive Synthesizer in Dossier.
Merge the 6 agent reports, surface unresolved contradictions, score overall resilience, and formulate actionable validation experiments.`
  }
};
