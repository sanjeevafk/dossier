import type { RouteContext } from "./context.js";
import { getLLMStatus } from "../services/llm.js";
import { IdeaSwarmOrchestrator } from "../core/swarm.js";
import { IdeaInput } from "../types/index.js";
import { parseBody, evaluateSchema } from "../validation.js";
import { readJsonBody, sendJson } from "../http/respond.js";
import { checkAuth } from "../http/auth.js";
import { log } from "../http/log.js";
import { evaluateLimiter, releaseEvaluationSlot, tryAcquireEvaluationSlot } from "../http/limits.js";

const orchestrator = new IdeaSwarmOrchestrator();

/** Returns true if this group handled the request. */
export async function handleEvaluate(ctx: RouteContext): Promise<boolean> {
  const { req, res, method, pathname, parsedUrl } = ctx;
  let handled = true;
  // Each route block ends with `return` once it has responded; falling through means "not mine".
  await (async (): Promise<void> => {
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

      const parsedEval = parseBody(evaluateSchema, body);
      if (!parsedEval.ok) {
        sendJson(res, 400, { error: parsedEval.error });
        return;
      }
      const { title, summary, targetAudience, monetization, pricingMonthlyUsd, estimatedCacUsd, useLiveLLM } = parsedEval.data;

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
          pricingMonthlyUsd,
          estimatedCacUsd,
          useLiveLLM: useLiveLLM !== false,
          exaKey,
          tavilyKey
        });

        sendJson(res, 200, {
          success: true,
          dossier,
          llmStatus: getLLMStatus(),
          costUsd: dossier.costUsd ?? null,
          llmUsage: dossier.llmUsage ?? null
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

      const parsedEval = parseBody(evaluateSchema, body);
      if (!parsedEval.ok) {
        sendJson(res, 400, { error: parsedEval.error });
        return;
      }
      const { title, summary, targetAudience, monetization, pricingMonthlyUsd, estimatedCacUsd, useLiveLLM } = parsedEval.data;

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
          pricingMonthlyUsd,
          estimatedCacUsd,
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
    handled = false;
  })();
  return handled;
}
