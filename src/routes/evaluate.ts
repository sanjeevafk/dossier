import type { RouteContext } from "./context.js";
import { getLLMStatus } from "../services/llm.js";
import { IdeaSwarmOrchestrator } from "../core/swarm.js";
import { IdeaInput } from "../types/index.js";
import { parseBody, evaluateSchema } from "../validation.js";
import { readJsonBody, sendJson } from "../http/respond.js";
import { checkAuth } from "../http/auth.js";
import { log } from "../http/log.js";
import { commitGlobalEvalSpend, evaluateLimiter, releaseEvaluationSlot, tryAcquireEvaluationSlot } from "../http/limits.js";

const orchestrator = new IdeaSwarmOrchestrator();

/** Returns true if this group handled the request. */
export async function handleEvaluate(ctx: RouteContext): Promise<boolean> {
  const { req, res, method, pathname } = ctx;
  let handled = true;
  // Each route block ends with `return` once it has responded; falling through means "not mine".
  await (async (): Promise<void> => {
    // 6. Evaluate endpoint (JSON)
    if (method === "POST" && pathname === "/api/evaluate") {
      if (!evaluateLimiter(req, res)) return;
      if (!checkAuth(req, res)) return;

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (err: unknown) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid JSON" });
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
      commitGlobalEvalSpend();

      // The JSON client has no way to recover a result it never received: stop spending if it leaves.
      const abort = new AbortController();
      res.on("close", () => {
        if (!res.writableFinished) abort.abort();
      });

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
          tavilyKey,
          signal: abort.signal
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

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (err: unknown) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid JSON" });
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
      commitGlobalEvalSpend();

      let isClientConnected = true;
      let finished = false;
      // Cancel on disconnect, except once verdict synthesis has begun: the client's recovery path
      // (recoverDossierAfterStream) loads the saved dossier, and that phase is short and ends in a save.
      const abort = new AbortController();
      let pastPointOfNoReturn = false;
      res.on("close", () => {
        isClientConnected = false;
        if (!finished && !pastPointOfNoReturn) abort.abort();
      });

      const sendSSE = (event: string, data: unknown) => {
        if (!isClientConnected || finished) return;
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // Dossier assembly can go silent for tens of seconds between the last stage event and
      // dossier_complete. Proxies (Cloudflare/Render) drop idle streams, which surfaced as a
      // client-side "network error" with no report rendered. A comment heartbeat keeps it open.
      const heartbeat = setInterval(() => {
        if (!isClientConnected || finished) return;
        res.write(": heartbeat\n\n");
      }, 10_000);
      heartbeat.unref?.();

      const ideaInput: IdeaInput = {
        title,
        summary,
        targetAudience: targetAudience || "General Founders / Businesses",
        monetization: monetization || "$49/month SaaS"
      };

      // Everything that can throw after the slot is taken lives inside this try, so the finally always releases it.
      try {
        // Set SSE response headers
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();

        sendSSE("init", { service: "dossier-stream", timestamp: new Date().toISOString() });

        const dossier = await orchestrator.evaluateIdea(ideaInput, {
          pricingMonthlyUsd,
          estimatedCacUsd,
          useLiveLLM: useLiveLLM !== false,
          exaKey: typeof req.headers["x-exa-key"] === "string" ? req.headers["x-exa-key"] : undefined,
          tavilyKey: typeof req.headers["x-tavily-key"] === "string" ? req.headers["x-tavily-key"] : undefined,
          signal: abort.signal,
          onProgress: (stage, detail) => {
            if (stage.startsWith("07")) pastPointOfNoReturn = true;
            sendSSE("progress", { stage, detail, timestamp: new Date().toISOString() });
          },
          onEvent: (event) => {
            sendSSE(event.type, event);
          }
        });

        // The dossier is already persisted: if the connection dropped mid-stream the client
        // can still fetch it by id, so name it in the done event even when writes were skipped.
        sendSSE("done", { success: true, dossierId: dossier.id });
        finished = true;
        res.end();
      } catch (error: unknown) {
        log.error({ err: error }, "evaluateIdea stream error");
        sendSSE("error", { error: error instanceof Error ? error.message : "Evaluation stream failed" });
        finished = true;
        res.end();
      } finally {
        clearInterval(heartbeat);
        releaseEvaluationSlot();
      }
      return;
    }
    handled = false;
  })();
  return handled;
}
