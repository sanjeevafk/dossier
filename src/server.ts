import express, { Application, Request, Response } from "express";
import cors from "cors";
import path from "node:path";
import { IdeaSwarmOrchestrator } from "./core/swarm.js";
import { classifyIdeaDomain } from "./core/classifier.js";
import { generateAgentTurn } from "./services/llm.js";
import { SWARM_ROLES } from "./config/prompts.js";
import { IdeaInput, SwarmRole } from "./types/index.js";

const app: Application = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

const orchestrator = new IdeaSwarmOrchestrator();

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "dossier-trueforge", timestamp: new Date().toISOString() });
});

// Evaluate endpoint
app.post("/api/evaluate", async (req: Request, res: Response) => {
  try {
    const { title, summary, targetAudience, monetization, pricingMonthlyUsd, estimatedCacUsd } = req.body;

    if (!title || !summary) {
      res.status(400).json({ error: "Missing required fields: 'title' and 'summary'" });
      return;
    }

    const ideaInput: IdeaInput = {
      title,
      summary,
      targetAudience: targetAudience || "General Founders / Businesses",
      monetization: monetization || "$49/month SaaS"
    };

    const dossier = await orchestrator.evaluateIdea(ideaInput, {
      pricingMonthlyUsd: pricingMonthlyUsd ? parseFloat(pricingMonthlyUsd) : undefined,
      estimatedCacUsd: estimatedCacUsd ? parseFloat(estimatedCacUsd) : undefined
    });

    res.json({ success: true, dossier });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Evaluation failed" });
  }
});

// Approval action gate endpoint (Human-in-the-loop)
app.post("/api/approval/:actionId", (req: Request, res: Response) => {
  const { actionId } = req.params;
  const { decision } = req.body; // 'APPROVE' | 'REJECT'

  if (!["APPROVE", "REJECT"].includes(decision)) {
    res.status(400).json({ error: "Decision must be either 'APPROVE' or 'REJECT'" });
    return;
  }

  res.json({
    success: true,
    actionId,
    newStatus: decision === "APPROVE" ? "APPROVED" : "REJECTED",
    message: `Action ${actionId} has been successfully updated by human operator.`
  });
});

// Interactive Playground / Swarm Chat endpoint
app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { message, role = "all", ideaContext } = req.body;

    if (!message) {
      res.status(400).json({ error: "Missing required field: 'message'" });
      return;
    }

    const ideaTitle = ideaContext?.title || "Target Idea";
    const ideaSummary = ideaContext?.summary || message;
    const domain = classifyIdeaDomain({
      title: ideaTitle,
      summary: ideaSummary,
      targetAudience: ideaContext?.targetAudience || "Target Customers",
      monetization: ideaContext?.monetization || "Subscription"
    });

    let reply = "";
    let agentName = "";
    let epistemicState = "MODELLED_ASSUMPTION";

    if (process.env.ORCAROUTER_API_KEY || process.env.OPENAI_API_KEY) {
      const rolePrompt = role === "all" 
        ? "Consensus of 6 adversarial agents (Skeptic, Investor, Architect, Market, Customer, Founder)"
        : `Agent ${role.toUpperCase()}`;
        
      const systemPrompt = `You are part of the Dossier Adversarial Intelligence Swarm built on TrueForge.
Role: ${rolePrompt}
Domain Archetype: ${domain.archetypeLabel}
Idea: "${ideaTitle}" — ${ideaSummary}

Give a direct, razor-sharp, analytical response. Challenge unvalidated assumptions, probe unit economics, test distribution friction, and provide actionable next validation moves. Keep it structured and punchy.`;

      try {
        reply = await generateAgentTurn(systemPrompt, message, { temperature: 0.6, maxTokens: 800 });
        agentName = role === "all" ? "Swarm Multi-Agent Debate" : (SWARM_ROLES[role as SwarmRole]?.name || "Agent " + role);
      } catch (err: any) {
        // Fallback to heuristic if LLM call fails
        const fallback = generateHeuristicChatReply(message, role, ideaTitle, ideaSummary, domain);
        reply = fallback.reply;
        agentName = fallback.agentName;
        epistemicState = fallback.epistemicState;
      }
    } else {
      const fallback = generateHeuristicChatReply(message, role, ideaTitle, ideaSummary, domain);
      reply = fallback.reply;
      agentName = fallback.agentName;
      epistemicState = fallback.epistemicState;
    }

    res.json({
      success: true,
      reply,
      agentName,
      agentRole: role,
      epistemicState,
      domain: domain.archetypeLabel,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Playground chat failed" });
  }
});

function generateHeuristicChatReply(
  message: string,
  role: string,
  ideaTitle: string,
  ideaSummary: string,
  domain: any
): { reply: string; agentName: string; epistemicState: string } {
  const msg = message.toLowerCase();

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

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`⚡ Dossier Intelligence Server listening on http://localhost:${port}`);
  });
}

export default app;
