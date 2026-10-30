import http, { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import fs from "node:fs";
import { IdeaSwarmOrchestrator } from "./core/swarm.js";
import { classifyIdeaDomain } from "./core/classifier.js";
import { generateAgentTurn, streamAgentTurn, getLLMStatus } from "./services/llm.js";
import { dossierStorage } from "./services/storage.js";
import { forecastLedger } from "./services/forecastLedger.js";
import { summarizeCalibration } from "./services/calibration.js";
import { SWARM_ROLES } from "./config/prompts.js";
import { IdeaInput, SwarmRole } from "./types/index.js";

const log = {
  info: (msgOrObj: unknown, msg?: string) => {
    if (typeof msgOrObj === "string") {
      console.log(`[${new Date().toISOString()}] INFO: ${msgOrObj}`);
    } else {
      console.log(`[${new Date().toISOString()}] INFO: ${msg || ""} ${JSON.stringify(msgOrObj)}`);
    }
  },
  warn: (msgOrObj: unknown, msg?: string) => {
    if (typeof msgOrObj === "string") {
      console.warn(`[${new Date().toISOString()}] WARN: ${msgOrObj}`);
    } else {
      console.warn(`[${new Date().toISOString()}] WARN: ${msg || ""} ${JSON.stringify(msgOrObj)}`);
    }
  },
  error: (msgOrObj: unknown, msg?: string) => {
    if (typeof msgOrObj === "string") {
      console.error(`[${new Date().toISOString()}] ERROR: ${msgOrObj}`);
    } else {
      console.error(`[${new Date().toISOString()}] ERROR: ${msg || ""} ${JSON.stringify(msgOrObj)}`);
    }
  }
};

const port = process.env.PORT || 3000;
const publicDir = path.join(process.cwd(), "public");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
  : [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "https://dossier-ai.azurewebsites.net",
      "https://dossier.sanjeevkumar.me"
    ];

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function sendText(res: ServerResponse, statusCode: number, text: string, contentType = "text/plain; charset=utf-8"): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", contentType);
  res.end(text);
}

function readJsonBody(req: IncomingMessage, maxBytes = 10 * 1024 * 1024): Promise<any> {
  return new Promise((resolve, reject) => {
    let receivedBytes = 0;
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        req.destroy();
        reject(new Error("Request payload exceeded size limit"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf-8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

function checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
  const secret = process.env.DOSSIER_API_KEY;
  if (!secret) {
    if (process.env.REQUIRE_AUTH === "true") {
      sendJson(res, 503, { error: "Server misconfigured: DOSSIER_API_KEY is required but not set" });
      return false;
    }
    return true;
  }
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers["x-api-key"];
  if (authHeader === `Bearer ${secret}` || apiKeyHeader === secret) {
    return true;
  }
  sendJson(res, 401, { error: "Unauthorized: valid Bearer token or x-api-key required" });
  return false;
}

// Bounded Concurrency Guard (protects single-vCPU/512MB instances from OOM starvation)
let activeEvaluations = 0;
const MAX_CONCURRENT_EVALS = parseInt(process.env.MAX_CONCURRENT_EVALS || "3", 10);

function tryAcquireEvaluationSlot(): boolean {
  if (activeEvaluations >= MAX_CONCURRENT_EVALS) return false;
  activeEvaluations++;
  return true;
}

function releaseEvaluationSlot(): void {
  activeEvaluations = Math.max(0, activeEvaluations - 1);
}

function createRateLimiter(windowMs: number, maxHits: number, message: string) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(ip);
    }
  }, 300_000).unref();

  return (req: IncomingMessage, res: ServerResponse): boolean => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "global";
    const now = Date.now();
    const entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (entry.count >= maxHits) {
      sendJson(res, 429, { error: message });
      return false;
    }
    entry.count++;
    return true;
  };
}

const evaluateLimiter = createRateLimiter(
  60 * 60 * 1000,
  10,
  "Rate limit exceeded: max 10 evaluations per hour per IP"
);

const chatLimiter = createRateLimiter(
  60 * 60 * 1000,
  60,
  "Rate limit exceeded: max 60 chat messages per hour per IP"
);

const orchestrator = new IdeaSwarmOrchestrator();

function getRevision(): string {
  if (process.env.DEPLOYED_REVISION) return process.env.DEPLOYED_REVISION;
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
  try {
    const versionPath = path.resolve(import.meta.dirname, ".version");
    if (fs.existsSync(versionPath)) return fs.readFileSync(versionPath, "utf-8").trim();
  } catch {}
  return "main";
}

function serveStaticFile(pathname: string, req: IncomingMessage, res: ServerResponse): boolean {
  let relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const targetPath = path.resolve(publicDir, relativePath);

  // Guard against directory traversal
  if (!targetPath.startsWith(publicDir)) {
    sendText(res, 403, "Forbidden");
    return true;
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      const indexPath = path.join(targetPath, "index.html");
      if (fs.existsSync(indexPath)) {
        stat = fs.statSync(indexPath);
        return streamFile(indexPath, stat, req, res);
      }
      return false;
    }
  } catch {
    return false;
  }

  return streamFile(targetPath, stat, req, res);
}

function streamFile(filePath: string, stat: fs.Stats, req: IncomingMessage, res: ServerResponse): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", stat.size);

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  fs.createReadStream(filePath).pipe(res);
  return true;
}

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

function generateHeuristicChatReply(
  message: string,
  role: string,
  ideaTitle: string,
  ideaSummary: string,
  domain: any
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

/**
 * Main HTTP Request Listener (replaces Express application)
 */
async function app(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Apply baseline security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("Referrer-Policy", "no-referrer");

  // CORS Policy Handling
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
    if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  } else {
    res.statusCode = 403;
    res.end("Blocked by CORS policy");
    return;
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-API-Key,X-Exa-Key,X-Tavily-Key");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const method = req.method || "GET";

  try {
    // 1. Health check with detailed telemetry & capacity stats
    if (method === "GET" && pathname === "/health") {
      const llmStatus = getLLMStatus();
      sendJson(res, 200, {
        status: "ok",
        service: "dossier-intelligence",
        version: "0.1.0",
        revision: getRevision(),
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        llm: llmStatus,
        concurrency: {
          activeEvaluations,
          maxConcurrent: MAX_CONCURRENT_EVALS
        },
        sandbox: { provider: process.env.SANDBOX_PROVIDER || "local", runtime: "python3-subprocess" }
      });
      return;
    }

    // 2. Calibration & Monitor Metrics
    if (method === "GET" && pathname === "/metrics") {
      try {
        const rows = dossierStorage.listLedger() as Array<{
          dossier_id: string; score: number; archetype: string; outcome: string | null;
        }>;
        const alerts = dossierStorage.listMonitorAlerts(undefined, 10);
        const byArchetype = new Map<string, Array<{ score: number; outcome: string | null }>>();
        for (const r of rows) {
          const key = String(r.archetype || "general_startup");
          if (!byArchetype.has(key)) byArchetype.set(key, []);
          byArchetype.get(key)!.push({ score: Number(r.score ?? 0), outcome: r.outcome });
        }
        const archetypes: Record<string, ReturnType<typeof summarizeCalibration>> = {};
        for (const [key, list] of byArchetype) {
          archetypes[key] = summarizeCalibration(list);
        }
        const overall = summarizeCalibration(rows.map(r => ({ score: Number(r.score ?? 0), outcome: r.outcome })));
        sendJson(res, 200, {
          success: true,
          overall,
          archetypes,
          recentAlerts: alerts,
          note: "Brier/ECE are n/a until >= 20 resolved outcomes per scope"
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "metrics failed";
        sendJson(res, 500, { success: false, error: message });
      }
      return;
    }

    // 3. List recent dossiers
    if (method === "GET" && pathname === "/api/dossiers") {
      try {
        const limitParam = parsedUrl.searchParams.get("limit");
        const limit = limitParam ? parseInt(limitParam, 10) : 20;
        const dossiers = await dossierStorage.listDossiers(limit);
        sendJson(res, 200, { success: true, count: dossiers.length, dossiers });
      } catch (error: any) {
        sendJson(res, 500, { success: false, error: error.message });
      }
      return;
    }

    // 4. Export dossier as Markdown, JSON, or Playwright-rendered PDF
    const exportMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/export$/);
    if (method === "GET" && exportMatch) {
      const id = exportMatch[1];
      try {
        const format = (parsedUrl.searchParams.get("format") || "markdown").toLowerCase();
        const dossier = await dossierStorage.getDossier(id);
        if (!dossier) {
          sendJson(res, 404, { success: false, error: `Dossier '${id}' not found` });
          return;
        }

        if (format === "json") {
          res.statusCode = 200;
          res.setHeader("Content-Disposition", `attachment; filename="dossier_${id}.json"`);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(dossier, null, 2));
          return;
        } else if (format === "pdf") {
          const { execFile } = await import("child_process");
          const scriptPath = path.resolve(process.cwd(), "scripts/export_pdf.py");
          const currentPort = port;

          execFile("python3", [scriptPath, id, String(currentPort)], { maxBuffer: 30 * 1024 * 1024, encoding: "buffer" }, (error, stdout, stderr) => {
            if (error) {
              log.error({ err: error, stderr: stderr.toString() }, "Playwright PDF export failed");
              sendJson(res, 500, { success: false, error: "Failed to generate PDF report via Playwright" });
              return;
            }

            res.statusCode = 200;
            res.setHeader("Content-Disposition", `attachment; filename="dossier_${id}.pdf"`);
            res.setHeader("Content-Type", "application/pdf");
            res.end(stdout);
          });
          return;
        } else {
          const markdown = dossierStorage.exportDossierMarkdown(dossier);
          res.statusCode = 200;
          res.setHeader("Content-Disposition", `attachment; filename="dossier_${id}.md"`);
          res.setHeader("Content-Type", "text/markdown; charset=utf-8");
          res.end(markdown);
          return;
        }
      } catch (error: any) {
        sendJson(res, 500, { success: false, error: error.message });
        return;
      }
    }

    // 5. Retrieve specific dossier by ID or code
    const dossierMatch = pathname.match(/^\/api\/dossiers\/([^/]+)$/);
    if (method === "GET" && dossierMatch) {
      const id = dossierMatch[1];
      try {
        const dossier = await dossierStorage.getDossier(id);
        if (!dossier) {
          sendJson(res, 404, { success: false, error: `Dossier '${id}' not found` });
          return;
        }
        sendJson(res, 200, { success: true, dossier });
      } catch (error: any) {
        sendJson(res, 500, { success: false, error: error.message });
      }
      return;
    }

    // 6. Evaluate endpoint (JSON)
    if (method === "POST" && pathname === "/api/evaluate") {
      if (!evaluateLimiter(req, res)) return;
      if (!checkAuth(req, res)) return;

      let body: any;
      try {
        body = await readJsonBody(req);
      } catch (err: any) {
        sendJson(res, 400, { error: err.message || "Invalid JSON" });
        return;
      }

      const { title, summary, targetAudience, monetization, pricingMonthlyUsd, estimatedCacUsd, useLiveLLM } = body;

      if (!title || !summary) {
        sendJson(res, 400, { error: "Missing required fields: 'title' and 'summary'" });
        return;
      }

      if (!tryAcquireEvaluationSlot()) {
        sendJson(res, 429, {
          success: false,
          error: "Server busy: maximum concurrent evaluations in progress. Please retry in a few moments.",
          retryAfter: 5
        });
        return;
      }

      try {
        const ideaInput: IdeaInput = {
          title,
          summary,
          targetAudience: targetAudience || "General Founders / Businesses",
          monetization: monetization || "$49/month SaaS"
        };

        const exaKey = typeof req.headers["x-exa-key"] === "string" ? req.headers["x-exa-key"] : undefined;
        const tavilyKey = typeof req.headers["x-tavily-key"] === "string" ? req.headers["x-tavily-key"] : undefined;
        const dossier = await orchestrator.evaluateIdea(ideaInput, {
          pricingMonthlyUsd: pricingMonthlyUsd ? parseFloat(pricingMonthlyUsd) : undefined,
          estimatedCacUsd: estimatedCacUsd ? parseFloat(estimatedCacUsd) : undefined,
          useLiveLLM: useLiveLLM !== false,
          exaKey,
          tavilyKey
        });

        sendJson(res, 200, {
          success: true,
          dossier,
          llmStatus: getLLMStatus(),
          costUsd: dossier.evaluationMode === "LIVE_LLM" ? 0.3 : 0.0
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Evaluation failed";
        sendJson(res, 500, { success: false, error: message });
      } finally {
        releaseEvaluationSlot();
      }
      return;
    }

    // 7. Evaluate with Real-Time Server-Sent Events (SSE) Stream
    if (method === "POST" && pathname === "/api/evaluate/stream") {
      if (!evaluateLimiter(req, res)) return;
      if (!checkAuth(req, res)) return;

      let body: any;
      try {
        body = await readJsonBody(req);
      } catch (err: any) {
        sendJson(res, 400, { error: err.message || "Invalid JSON" });
        return;
      }

      const { title, summary, targetAudience, monetization, pricingMonthlyUsd, estimatedCacUsd, useLiveLLM } = body;

      if (!title || !summary) {
        sendJson(res, 400, { error: "Missing required fields: 'title' and 'summary'" });
        return;
      }

      if (!tryAcquireEvaluationSlot()) {
        sendJson(res, 429, {
          error: "Server busy: maximum concurrent evaluations in progress. Please retry in a few moments.",
          retryAfter: 5
        });
        return;
      }

      // Set SSE response headers
      res.statusCode = 200;
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
          exaKey: typeof req.headers["x-exa-key"] === "string" ? req.headers["x-exa-key"] : undefined,
          tavilyKey: typeof req.headers["x-tavily-key"] === "string" ? req.headers["x-tavily-key"] : undefined,
          onProgress: (stage, detail) => {
            sendSSE("progress", { stage, detail, timestamp: new Date().toISOString() });
          },
          onEvent: (event) => {
            sendSSE(event.type, event);
          }
        });

        sendSSE("done", { success: true, dossierId: dossier.id });
        res.end();
      } catch (error: unknown) {
        log.error({ err: error }, "evaluateIdea stream error");
        sendSSE("error", { error: error instanceof Error ? error.message : "Evaluation stream failed" });
        res.end();
      } finally {
        releaseEvaluationSlot();
      }
      return;
    }

    // 8. Ledger outcome ingestion: resolves fatal assumptions for calibration.
    const outcomeMatch = pathname.match(/^\/api\/dossiers\/([^/]+)\/outcome$/);
    if (method === "POST" && outcomeMatch) {
      if (!checkAuth(req, res)) return;
      const id = outcomeMatch[1];
      let body: any;
      try {
        body = await readJsonBody(req);
      } catch (err: any) {
        sendJson(res, 400, { error: err.message || "Invalid JSON" });
        return;
      }
      const { outcome, revenueUsd, pilots } = body;
      if (!["built", "killed", "pivoted"].includes(outcome)) {
        sendJson(res, 400, { error: "outcome must be one of: built | killed | pivoted" });
        return;
      }
      const dossier = await dossierStorage.getDossier(id);
      if (!dossier) {
        sendJson(res, 404, { success: false, error: `Dossier '${id}' not found` });
        return;
      }
      const updated = dossierStorage.updateOutcome(
        dossier.id,
        outcome,
        typeof revenueUsd === "number" ? revenueUsd : undefined,
        typeof pilots === "number" ? pilots : undefined
      );
      sendJson(res, 200, { success: updated, dossierId: dossier.id, outcome });
      return;
    }

    // 10. List forecasts (optionally filter by resolution status and domain archetype).
    if (method === "GET" && pathname === "/api/forecasts") {
      try {
        const statusParam = parsedUrl.searchParams.get("status");
        const status = statusParam === "pending" || statusParam === "resolved" ? statusParam : undefined;
        const archetype = parsedUrl.searchParams.get("archetype") || undefined;
        const forecasts = forecastLedger.listForecasts({ status, archetype });
        sendJson(res, 200, { success: true, count: forecasts.length, forecasts });
      } catch (error: any) {
        sendJson(res, 500, { success: false, error: error.message });
      }
      return;
    }

    // 11. Resolve a forecast with the observed outcome
    const resolveMatch = pathname.match(/^\/api\/forecasts\/([^/]+)\/resolve$/);
    if (method === "POST" && resolveMatch) {
      if (!checkAuth(req, res)) return;
      const id = resolveMatch[1];
      let body: any;
      try {
        body = await readJsonBody(req);
      } catch (err: any) {
        sendJson(res, 400, { error: err.message || "Invalid JSON" });
        return;
      }
      const { outcome, notes, resolvedBy } = body;
      if (typeof outcome !== "boolean") {
        sendJson(res, 400, { error: "Field 'outcome' must be a boolean (did the forecast hold?)" });
        return;
      }
      try {
        const record = forecastLedger.resolveForecast(id, outcome, notes, resolvedBy);
        sendJson(res, 200, { success: true, forecast: record });
      } catch (error: any) {
        sendJson(res, 400, { success: false, error: error.message });
      }
      return;
    }

    // 12. Calibration summary: Brier scores (overall + per domain) and reliability buckets.
    if (method === "GET" && pathname === "/api/calibration") {
      try {
        sendJson(res, 200, { success: true, calibration: forecastLedger.calibrationSummary() });
      } catch (error: any) {
        sendJson(res, 500, { success: false, error: error.message });
      }
      return;
    }

    // 13. Interactive Playground / Swarm Chat endpoint
    if (method === "POST" && pathname === "/api/chat") {
      if (!chatLimiter(req, res)) return;
      if (!checkAuth(req, res)) return;

      let body: any;
      try {
        body = await readJsonBody(req);
      } catch (err: any) {
        sendJson(res, 400, { error: err.message || "Invalid JSON" });
        return;
      }

      const { message, role = "all", ideaContext } = body;
      if (!message) {
        sendJson(res, 400, { error: "Missing required field: 'message'" });
        return;
      }

      try {
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
          } catch {
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

        sendJson(res, 200, {
          success: true,
          reply,
          agentName,
          agentRole: role,
          epistemicState,
          domain: domain.archetypeLabel,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        sendJson(res, 500, { success: false, error: error.message || "Playground chat failed" });
      }
      return;
    }

    // 14. Streaming playground chat (SSE)
    if (method === "POST" && pathname === "/api/chat/stream") {
      let body: any;
      try {
        body = await readJsonBody(req);
      } catch (err: any) {
        sendJson(res, 400, { error: err.message || "Invalid JSON" });
        return;
      }

      const { message, role = "all", ideaContext } = body;
      if (!message) {
        sendJson(res, 400, { error: "Missing required field: 'message'" });
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      let isClientConnected = true;
      res.on("close", () => {
        isClientConnected = false;
      });

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
      return;
    }

    // 15. Static File Serving from /public
    if (method === "GET" || method === "HEAD") {
      const handled = serveStaticFile(pathname, req, res);
      if (handled) return;
    }

    // 16. Fallback 404
    sendJson(res, 404, { error: `Not found: ${method} ${pathname}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    log.error({ err }, "Unhandled server error");
    if (!res.headersSent) {
      sendJson(res, 500, { error: message });
    } else {
      res.end();
    }
  }
}

let server: http.Server | undefined;
if (process.env.NODE_ENV !== "test") {
  server = http.createServer(app);
  server.listen(port, () => {
    log.info(`Dossier Intelligence Server listening on http://localhost:${port}`);
  });

  const shutdown = (signal: string) => {
    log.info(`${signal} received: closing HTTP server gracefully...`);
    if (server) {
      server.close(() => {
        log.info("HTTP server closed cleanly. Exiting process.");
        process.exit(0);
      });
      setTimeout(() => {
        log.warn("Forceful shutdown timeout reached. Terminating process.");
        process.exit(1);
      }, 10000).unref();
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export default app;
export { app, server };
