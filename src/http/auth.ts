import http, { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { sendJson } from "./respond.js";

function safeEqual(a: string | undefined, b: string): boolean {
  if (typeof a !== "string") return false;
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkAuth(req: IncomingMessage, res: ServerResponse): boolean {
  const secret = process.env.DOSSIER_API_KEY;
  if (!secret) {
    // Open by default (public/local demo); set REQUIRE_AUTH=true to enforce a key.
    const required = process.env.REQUIRE_AUTH === "true";
    if (required) {
      sendJson(res, 503, { error: "Server misconfigured: DOSSIER_API_KEY is required but not set" });
      return false;
    }
    return true;
  }
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers["x-api-key"];
  if (safeEqual(authHeader, `Bearer ${secret}`) || safeEqual(typeof apiKeyHeader === "string" ? apiKeyHeader : undefined, secret)) {
    return true;
  }
  sendJson(res, 401, { error: "Unauthorized: valid Bearer token or x-api-key required" });
  return false;
}
