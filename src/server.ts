import express, { Application, Request, Response } from "express";
import cors from "cors";
import path from "node:path";
import { IdeaSwarmOrchestrator } from "./core/swarm.js";
import { classifyIdeaDomain } from "./core/classifier.js";
import { generateAgentTurn, streamAgentTurn, getLLMStatus } from "./services/llm.js";
import { dossierStorage } from "./services/storage.js";
import { forecastLedger } from "./services/forecastLedger.js";
import { SWARM_ROLES } from "./config/prompts.js";
import { IdeaInput, SwarmRole } from "./types/index.js";

const app: Application = express();
const port = process.env.PORT || 3000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(new Error("Blocked by CORS policy"));
      }
    },
    credentials: true
  })
);
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

function requireAuth(req: Request, res: Response, next: () => void) {
  const secret = process.env.DOSSIER_API_KEY;
  // Node reports IPv4 loopback as ::ffff:127.0.0.1 when the socket is IPv6 —
  // normalize before the loopback check or dev-machine requests get 401s.
  const ip = (req.ip || "").replace(/^::ffff:/, "");
  const isLoopback = ip === "127.0.0.1" || ip === "::1" || req.hostname === "localhost";
  if (!secret && process.env.NODE_ENV !== "production" && isLoopback) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (secret && authHeader === `Bearer ${secret}`) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized: valid Bearer token required for action gates" });
}

const orchestrator = new IdeaSwarmOrchestrator();

// Health check with detailed telemetry
app.get("/health", (req: Request, res: Response) => {
  const llmStatus = getLLMStatus();
  res.json({
    status: "ok",
    service: "dossier-trueforge",
    timestamp: new Date().toISOString(),
    llm: llmStatus,
    sandbox: { provider: process.env.SANDBOX_PROVIDER || "local", runtime: "python3-subprocess" }
  });
});

// List recent dossiers
app.get("/api/dossiers", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const dossiers = await dossierStorage.listDossiers(limit);
    res.json({ success: true, count: dossiers.length, dossiers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Retrieve specific dossier by ID or code
app.get("/api/dossiers/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const dossier = await dossierStorage.getDossier(id);
    if (!dossier) {
      res.status(404).json({ success: false, error: `Dossier '${id}' not found` });
      return;
    }
    res.json({ success: true, dossier });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export dossier as Markdown or JSON
app.get("/api/dossiers/:id/export", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const format = String(req.query.format || "markdown").toLowerCase();
    const dossier = await dossierStorage.getDossier(id);
    if (!dossier) {
      res.status(404).json({ success: false, error: `Dossier '${id}' not found` });
      return;
    }

    if (format === "json") {
      res.setHeader("Content-Disposition", `attachment; filename="dossier_${id}.json"`);
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify(dossier, null, 2));
    } else {
      const markdown = dossierStorage.exportDossierMarkdown(dossier);
      res.setHeader("Content-Disposition", `attachment; filename="dossier_${id}.md"`);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.send(markdown);
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Evaluate endpoint
app.post("/api/evaluate", async (req: Request, res: Response) => {
  try {
    const { title, summary, targetAudience, monetization, pricingMonthlyUsd, estimatedCacUsd, useLiveLLM } = req.body;

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
      estimatedCacUsd: estimatedCacUsd ? parseFloat(estimatedCacUsd) : undefined,
      useLiveLLM: useLiveLLM !== false
    });

    res.json({ success: true, dossier, llmStatus: getLLMStatus() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Evaluation failed" });
  }
});

// Evaluate with Real-Time Server-Sent Events (SSE) Stream
app.post("/api/evaluate/stream", async (req: Request, res: Response) => {
  const { title, summary, targetAudience, monetization, pricingMonthlyUsd, estimatedCacUsd, useLiveLLM } = req.body;

  if (!title || !summary) {
    res.status(400).json({ error: "Missing required fields: 'title' and 'summary'" });
    return;
  }

  // Set SSE response headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let isClientConnected = true;
  res.on("close", () => {
    isClientConnected = false;
  });

  const sendSSE = (event: string, data: any) => {
    if (!isClientConnected) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as any).flush === "function") {
      (res as any).flush();
    }
  };

  const ideaInput: IdeaInput = {
    title,
    summary,
    targetAudience: targetAudience || "General Founders / Businesses",
    monetization: monetization || "$49/month SaaS"
  };

  try {
    sendSSE("init", { service: "dossier-stream", timestamp: new Date().toISOString() });

    const dossier = await orchestrator.evaluateIdea(ideaInput, {
      pricingMonthlyUsd: pricingMonthlyUsd ? parseFloat(pricingMonthlyUsd) : undefined,
      estimatedCacUsd: estimatedCacUsd ? parseFloat(estimatedCacUsd) : undefined,
      useLiveLLM: useLiveLLM !== false,
      onProgress: (stage, detail) => {
        sendSSE("progress", { stage, detail, timestamp: new Date().toISOString() });
      },
      onEvent: (event) => {
        sendSSE(event.type, event);
      }
    });

    sendSSE("done", { success: true, dossierId: dossier.id });
    res.end();
  } catch (error: any) {
    console.error("evaluateIdea stream error:", error);
    sendSSE("error", { error: error.message || "Evaluation stream failed" });
    res.end();
  }
});

// Approval action gate endpoint (Persistent Human-in-the-loop)
app.post("/api/approval/:actionId", requireAuth, async (req: Request, res: Response) => {
  const actionId = String(req.params.actionId);
  const { decision } = req.body; // 'APPROVE' | 'REJECT'

  if (!["APPROVE", "REJECT"].includes(decision)) {
    res.status(400).json({ error: "Decision must be either 'APPROVE' or 'REJECT'" });
    return;
  }

  const result = await dossierStorage.updateApprovalStatus(
    actionId,
    decision === "APPROVE" ? "APPROVED" : "REJECTED"
  );

  res.json({
    success: true,
    actionId,
    newStatus: decision === "APPROVE" ? "APPROVED" : "REJECTED",
    persisted: result.updated,
    dossierId: result.dossierId,
    message: `Action ${actionId} has been successfully ${decision === "APPROVE" ? "approved" : "rejected"} by human operator.`
  });
});

// ======================= B1 — Calibration ledger endpoints =======================

// List forecasts (optionally filter by resolution status and domain archetype).
app.get("/api/forecasts", (req: Request, res: Response) => {
  try {
    const status = req.query.status === "pending" || req.query.status === "resolved" ? req.query.status : undefined;
    const archetype = req.query.archetype ? String(req.query.archetype) : undefined;
    const forecasts = forecastLedger.listForecasts({ status, archetype });
    res.json({ success: true, count: forecasts.length, forecasts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resolve a forecast with the observed outcome — this is the act that turns the
// ledger into a calibration track record. Resolutions are immutable.
app.post("/api/forecasts/:id/resolve", requireAuth, (req: Request, res: Response) => {
  try {
    const { outcome, notes, resolvedBy } = req.body;
    if (typeof outcome !== "boolean") {
      res.status(400).json({ error: "Field 'outcome' must be a boolean (did the forecast hold?)" });
      return;
    }
    const record = forecastLedger.resolveForecast(String(req.params.id), outcome, notes, resolvedBy);
    res.json({ success: true, forecast: record });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Calibration summary: Brier scores (overall + per domain) and reliability buckets.
app.get("/api/calibration", (req: Request, res: Response) => {
  try {
    res.json({ success: true, calibration: forecastLedger.calibrationSummary() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
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

    const turn = buildChatTurn(role, message, ideaContext, ideaTitle, ideaSummary, domain);

    if (getLLMStatus().hasLiveLLM) {
      try {
        reply = await generateAgentTurn(turn.systemPrompt, message, { temperature: 0.6, maxTokens: 800 });
        agentName = turn.agentName;
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

// Shared chat turn construction for /api/chat and /api/chat/stream.
function buildChatTurn(
  role: string,
  message: string,
  ideaContext: any,
  ideaTitle: string,
  ideaSummary: string,
  domain: any
): { systemPrompt: string; agentName: string } {
  const rolePrompt = role === "all"
    ? "Consensus of 6 adversarial agents (Skeptic, Investor, Architect, Market, Customer, Founder)"
    : `Agent ${role.toUpperCase()}`;

  const systemPrompt = `You are part of the Dossier Adversarial Intelligence Swarm built on TrueForge.
Role: ${rolePrompt}
Domain Archetype: ${domain.archetypeLabel}
Idea: "${ideaTitle}" — ${ideaSummary}

Give a direct, razor-sharp, analytical response. Challenge unvalidated assumptions, probe unit economics, test distribution friction, and provide actionable next validation moves. Keep it structured and punchy.`;

  const agentName = role === "all"
    ? "Swarm Multi-Agent Debate"
    : (SWARM_ROLES[role as SwarmRole]?.name || "Agent " + role);

  return { systemPrompt, agentName };
}

// Streaming playground chat (SSE): chunk events as tokens arrive, then done.
// Falls back to the heuristic reply as a single chunk when no LLM is live or
// streaming fails — the stream never hangs and never fabricates.
app.post("/api/chat/stream", async (req: Request, res: Response) => {
  const { message, role = "all", ideaContext } = req.body;

  if (!message) {
    res.status(400).json({ error: "Missing required field: 'message'" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let isClientConnected = true;
  res.on("close", () => { isClientConnected = false; });
  const send = (event: string, data: any) => {
    if (!isClientConnected) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const ideaTitle = ideaContext?.title || "Target Idea";
    const ideaSummary = ideaContext?.summary || message;
    const domain = classifyIdeaDomain({
      title: ideaTitle,
      summary: ideaSummary,
      targetAudience: ideaContext?.targetAudience || "Target Customers",
      monetization: ideaContext?.monetization || "Subscription"
    });
    const turn = buildChatTurn(role, message, ideaContext, ideaTitle, ideaSummary, domain);

    const finishHeuristic = () => {
      const fallback = generateHeuristicChatReply(message, role, ideaTitle, ideaSummary, domain);
      send("chunk", { text: fallback.reply });
      send("done", { agentName: fallback.agentName, epistemicState: fallback.epistemicState, degraded: true });
      res.end();
    };

    if (!getLLMStatus().hasLiveLLM) {
      finishHeuristic();
      return;
    }

    let streamed = false;
    try {
      await streamAgentTurn(turn.systemPrompt, message, { temperature: 0.6, maxTokens: 800 }, (chunk: string) => {
        streamed = true;
        send("chunk", { text: chunk });
      });
      send("done", {
        agentName: turn.agentName,
        epistemicState: "SWARM_CONSENSUS",
        domain: domain.archetypeLabel
      });
      res.end();
    } catch {
      // Mid-stream provider failure: keep whatever arrived, mark partial.
      // A pre-stream failure falls back to the honest heuristic reply.
      if (streamed) {
        send("done", { agentName: turn.agentName, epistemicState: "SWARM_CONSENSUS", partial: true });
        res.end();
      } else {
        finishHeuristic();
      }
    }
  } catch (error: any) {
    send("error", { error: error.message || "Chat stream failed" });
    res.end();
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
