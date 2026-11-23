import { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "./respond.js";

// Bounded Concurrency Guard (protects single-vCPU/512MB instances from OOM starvation)
let activeEvaluations = 0;
export const MAX_CONCURRENT_EVALS = parseInt(process.env.MAX_CONCURRENT_EVALS || "3", 10);

export function tryAcquireEvaluationSlot(): boolean {
  if (activeEvaluations >= MAX_CONCURRENT_EVALS) return false;
  activeEvaluations++;
  return true;
}

export function releaseEvaluationSlot(): void {
  activeEvaluations = Math.max(0, activeEvaluations - 1);
}

function getClientIp(req: IncomingMessage): string {
  if (process.env.TRUST_PROXY === "true" || process.env.TRUST_PROXY === "1") {
    // Cloudflare sets this to the real client IP.
    const cf = req.headers["cf-connecting-ip"];
    if (typeof cf === "string" && cf.trim()) return cf.trim();
    // Otherwise use the right-most entry (appended by our proxy); the left-most is client-controlled.
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      const parts = forwarded.split(",").map((x) => x.trim()).filter(Boolean);
      if (parts.length) return parts[parts.length - 1];
    }
  }
  return req.socket.remoteAddress || "global";
}

function rejectRateLimited(res: ServerResponse, retryAfterMs: number, message: string): false {
  res.setHeader("Retry-After", String(Math.max(1, Math.ceil(retryAfterMs / 1000))));
  sendJson(res, 429, { error: message });
  return false;
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
    const ip = getClientIp(req);
    const now = Date.now();
    let entry = hits.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }
    if (entry.count >= maxHits) return rejectRateLimited(res, entry.resetAt - now, message);
    entry.count++;
    res.setHeader("X-RateLimit-Limit", String(maxHits));
    res.setHeader("X-RateLimit-Remaining", String(maxHits - entry.count));
    return true;
  };
}

// Global ceiling across all clients: protects provider credits from distributed abuse.
const GLOBAL_DAILY_EVAL_CAP = parseInt(process.env.GLOBAL_DAILY_EVAL_CAP || "200", 10);
const globalEval = { count: 0, resetAt: Date.now() + 24 * 60 * 60 * 1000 };

function rollGlobalEvalWindow(now: number): void {
  if (globalEval.resetAt <= now) {
    globalEval.count = 0;
    globalEval.resetAt = now + 24 * 60 * 60 * 1000;
  }
}

/** Read-only check: rejects with 429 when the cap is reached, but spends nothing. */
function checkGlobalEvalCap(res: ServerResponse): boolean {
  const now = Date.now();
  rollGlobalEvalWindow(now);
  if (GLOBAL_DAILY_EVAL_CAP > 0 && globalEval.count >= GLOBAL_DAILY_EVAL_CAP) {
    return rejectRateLimited(res, globalEval.resetAt - now, "Daily evaluation capacity reached. Try again later or self-host.");
  }
  return true;
}

/** Spend one unit of the global daily cap. Call only once an evaluation is actually admitted to run. */
export function commitGlobalEvalSpend(): void {
  rollGlobalEvalWindow(Date.now());
  globalEval.count++;
}

const perIpEvaluateLimiter = createRateLimiter(
  60 * 60 * 1000,
  10,
  "Rate limit exceeded: max 10 evaluations per hour per IP"
);

export const evaluateLimiter = (req: IncomingMessage, res: ServerResponse): boolean =>
  perIpEvaluateLimiter(req, res) && checkGlobalEvalCap(res);

export const chatLimiter = createRateLimiter(
  60 * 60 * 1000,
  60,
  "Rate limit exceeded: max 60 chat messages per hour per IP"
);

export const exportLimiter = createRateLimiter(
  60 * 60 * 1000,
  20,
  "Rate limit exceeded: max 20 exports per hour per IP"
);


export function getActiveEvaluations(): number {
  return activeEvaluations;
}
