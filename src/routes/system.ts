import path from "node:path";
import fs from "node:fs";
import { debug } from "../utils/log.js";
import type { RouteContext } from "./context.js";
import { getLLMStatus, listProviderModels } from "../services/llm.js";
import { checkAuth } from "../http/auth.js";
import { dossierStorage } from "../services/storage.js";
import { summarizeCalibration } from "../services/calibration.js";
import { sendJson } from "../http/respond.js";
import { MAX_CONCURRENT_EVALS, getActiveEvaluations } from "../http/limits.js";

function getRevision(): string {
  if (process.env.DEPLOYED_REVISION) return process.env.DEPLOYED_REVISION;
  if (process.env.GIT_COMMIT) return process.env.GIT_COMMIT;
  try {
    const versionPath = path.resolve(import.meta.dirname, "..", ".version");
    if (fs.existsSync(versionPath)) return fs.readFileSync(versionPath, "utf-8").trim();
  } catch (err) {
    debug("could not read .version", err);
  }
  return "main";
}

/** Returns true if this group handled the request. */
export async function handleSystem(ctx: RouteContext): Promise<boolean> {
  const { req, res, method, pathname } = ctx;
  let handled = true;
  // Each route block ends with `return` once it has responded; falling through means "not mine".
  await (async (): Promise<void> => {
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
          activeEvaluations: getActiveEvaluations(),
          maxConcurrent: MAX_CONCURRENT_EVALS
        },
        sandbox: { provider: process.env.SANDBOX_PROVIDER || "local", runtime: "python3-subprocess" }
      });
      return;
    }

    // 2. Which models can each configured provider key actually use? (read-only diagnostic:
    // a 404 model_not_found does not tell you whether the model is missing or access is.)
    if (method === "GET" && pathname === "/api/llm/models") {
      if (!checkAuth(req, res)) return;
      try {
        const providers = await listProviderModels();
        sendJson(res, 200, {
          success: true,
          note: "Read-only: lists the models each configured key can use. Keys are never returned.",
          providers
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "model listing failed";
        sendJson(res, 500, { success: false, error: message });
      }
      return;
    }

    // 3. Calibration & Monitor Metrics
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
    handled = false;
  })();
  return handled;
}
