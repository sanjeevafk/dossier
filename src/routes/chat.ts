import type { RouteContext } from "./context.js";
import { classifyIdeaDomain } from "../core/classifier.js";
import { generateAgentTurn, streamAgentTurn, getLLMStatus } from "../services/llm.js";
import { parseBody, chatSchema } from "../validation.js";
import { readJsonBody, sendJson } from "../http/respond.js";
import { checkAuth } from "../http/auth.js";
import { chatLimiter } from "../http/limits.js";
import { buildChatTurn, generateHeuristicChatReply } from "../http/chatReply.js";

/** Returns true if this group handled the request. */
export async function handleChat(ctx: RouteContext): Promise<boolean> {
  const { req, res, method, pathname } = ctx;
  let handled = true;
  // Each route block ends with `return` once it has responded; falling through means "not mine".
  await (async (): Promise<void> => {
    // 13. Interactive Playground / Swarm Chat endpoint
    if (method === "POST" && pathname === "/api/chat") {
      if (!chatLimiter(req, res)) return;
      if (!checkAuth(req, res)) return;

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (err: unknown) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid JSON" });
        return;
      }

      const parsedChat = parseBody(chatSchema, body);
      if (!parsedChat.ok) {
        sendJson(res, 400, { error: parsedChat.error });
        return;
      }
      const { message, role, ideaContext } = parsedChat.data;

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
      } catch (error: unknown) {
        sendJson(res, 500, { success: false, error: error instanceof Error ? error.message : "Playground chat failed" });
      }
      return;
    }

    // 14. Streaming playground chat (SSE)
    if (method === "POST" && pathname === "/api/chat/stream") {
      if (!chatLimiter(req, res)) return;
      if (!checkAuth(req, res)) return;

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch (err: unknown) {
        sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid JSON" });
        return;
      }

      const parsedChat = parseBody(chatSchema, body);
      if (!parsedChat.ok) {
        sendJson(res, 400, { error: parsedChat.error });
        return;
      }
      const { message, role, ideaContext } = parsedChat.data;

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

      const send = (event: string, data: unknown) => {
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
      } catch (error: unknown) {
        send("error", { error: error instanceof Error ? error.message : "Chat stream failed" });
        res.end();
      }
      return;
    }
    handled = false;
  })();
  return handled;
}
