import type { RouteContext } from "./context.js";
import { forecastLedger } from "../services/forecastLedger.js";
import { parseBody, resolveSchema } from "../validation.js";
import { readJsonBody, sendJson } from "../http/respond.js";
import { checkAuth } from "../http/auth.js";

/** Returns true if this group handled the request. */
export async function handleForecasts(ctx: RouteContext): Promise<boolean> {
  const { req, res, method, pathname, parsedUrl } = ctx;
  let handled = true;
  // Each route block ends with `return` once it has responded; falling through means "not mine".
  await (async (): Promise<void> => {
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
      const parsedResolve = parseBody(resolveSchema, body);
      if (!parsedResolve.ok) {
        sendJson(res, 400, { error: parsedResolve.error });
        return;
      }
      const { outcome, notes, resolvedBy } = parsedResolve.data;
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
    handled = false;
  })();
  return handled;
}
