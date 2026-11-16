import { SWARM_ROLES } from "../config/prompts.js";
import { DomainClassification, SwarmRole } from "../types/index.js";

// Shared chat turn construction for /api/chat and /api/chat/stream.
export function buildChatTurn(
  role: string,
  message: string,
  ideaContext: unknown,
  ideaTitle: string,
  ideaSummary: string,
  domain: DomainClassification
): { systemPrompt: string; agentName: string } {
  const rolePrompt = role === "all"
    ? "Consensus of 6 adversarial agents (Skeptic, Investor, Architect, Market, Customer, Founder)"
    : `Agent ${role.toUpperCase()}`;

  const systemPrompt = `You are part of the Dossier Adversarial Intelligence Swarm.
Role: ${rolePrompt}
Domain Archetype: ${domain.archetypeLabel}
Idea: "${ideaTitle}" — ${ideaSummary}

Give a direct, razor-sharp, analytical response. Challenge unvalidated assumptions, probe unit economics, test distribution friction, and provide actionable next validation moves. Keep it structured and punchy.`;

  const agentName = role === "all"
    ? "Swarm Multi-Agent Debate"
    : (SWARM_ROLES[role as SwarmRole]?.name || "Agent " + role);

  return { systemPrompt, agentName };
}

export function generateHeuristicChatReply(
  message: string,
  role: string,
  ideaTitle: string,
  ideaSummary: string,
  domain: DomainClassification
): { reply: string; agentName: string; epistemicState: string } {
  if (role === "skeptic" || role === "redteam") {
    return {
      agentName: "The Skeptic (Red Team)",
      epistemicState: "CHALLENGE_FLAGGED",
      reply: `**⚠️ Core Vulnerability Identified in "${ideaTitle}":**\n\n1. **Distribution Bottleneck:** You assume organic or low-CAC acquisition, but in the ${domain.archetypeLabel} domain, procurement cycles require high-touch sales or heavy ad spend.\n2. **Habit Inertia Trap:** Users will nod along in interviews, but when asked to enter a credit card, switching friction from existing tools is 3x higher than estimated.\n3. **Kill Condition:** If you cannot convert 5 paying pilot customers within 14 days without manual founder onboarding, the self-serve premise is disproven.`
    };
  }

  if (role === "investor") {
    return {
      agentName: "The Investor (VC Partner)",
      epistemicState: "VERIFIED_COMPUTATION",
      reply: `**📊 Venture Economics Assessment:**\n\n• **LTV/CAC Dynamics:** For ${ideaTitle}, if monthly churn exceeds 4.5%, customer lifetime value collapses below payback bounds within 9 months.\n• **Pricing Defensibility:** You must charge based on value-metric outcomes rather than flat seat licenses to capture margin expansion as users scale.\n• **Moat Verification:** Feature-level AI wrappers are vulnerable to platform replication. What proprietary proprietary data loop protects your margins against OpenAI or incumbents?`
    };
  }

  if (role === "architect") {
    return {
      agentName: "Technical Architect",
      epistemicState: "VERIFIED_COMPUTATION",
      reply: `**⚙️ Systems & Latency Architecture Review:**\n\n• **Inference Cost Ceiling:** Multi-step agentic workflows require 3-5 LLM roundtrips per user task. At scale, API token costs will consume >35% of gross revenue unless you route low-complexity queries to smaller fine-tuned models.\n• **Sandbox Isolation:** All user-triggered executions must run in isolated container runtimes with strict egress filtering.\n• **Failure Budget:** Real-time user perception degrades rapidly if p95 latency exceeds 1.8 seconds.`
    };
  }

  if (role === "market" || role === "analyst") {
    return {
      agentName: "Market Recon Analyst",
      epistemicState: "EXTERNAL_EVIDENCE",
      reply: `**🔍 Competitive Whitespace Recon:**\n\n• **Incumbent Positioning:** Existing players already dominate the enterprise segment with legacy integrations.\n• **Wedge Strategy:** The fastest path to market is focusing exclusively on the underserved sub-segment in ${domain.primaryCustomer}.\n• **Acquisition Channel:** Build a free audit tool or benchmark index as your top-of-funnel lead magnet.`
    };
  }

  if (role === "customer") {
    return {
      agentName: "Customer Persona",
      epistemicState: "MODELLED_ASSUMPTION",
      reply: `**👤 Reality Check & Willingness to Pay:**\n\n"I already have 4 tools open on my screen every day. Unless ${ideaTitle} saves me 2 hours a week from day one with zero training, I'll sign up, test it once, and churn before the trial ends. Make the time-to-first-value under 60 seconds."`
    };
  }

  if (role === "founder" || role === "synthesizer") {
    return {
      agentName: "Founder Synthesizer",
      epistemicState: "VERIFIED_FACT",
      reply: `**🎯 Consensus Synthesis & 7-Day Experiment:**\n\n1. **Synthesized Verdict:** Viable concept, but high execution risk on initial customer onboarding.\n2. **Cheapest Validation Move:** Build a simple 1-page landing page with a pre-order deposit or interactive mock prototype.\n3. **Falsification Metric:** Collect 10 pre-commitments at target pricing before writing backend production code.`
    };
  }

  // Default: Multi-Agent Swarm Debate
  return {
    agentName: "Swarm Multi-Agent Debate",
    epistemicState: "SWARM_CONSENSUS",
    reply: `**💬 Swarm Cross-Examination on "${ideaTitle}":**\n\n**🛡️ The Skeptic:** "The biggest risk is customer churn after week 2. What prevents users from treating this as a one-off novelty?"\n\n**💰 The Investor:** "Agreed. If CAC is higher than $150 in the ${domain.archetypeLabel} space, payback takes over a year. You need annual upfront contracts."\n\n**⚙️ Technical Architect:** "We can keep compute overhead low by caching frequent embedding vectors and executing financial simulations in sandboxed subprocesses."\n\n**🧪 Recommended Action:** Run a 3-day cold email smoke test to 50 target personas before building complex feature trees.`
  };
}
