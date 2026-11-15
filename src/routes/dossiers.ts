import type { RouteContext } from "./context.js";
import path from "node:path";
import { dossierStorage } from "../services/storage.js";
import { parseBody, outcomeSchema } from "../validation.js";
import { readJsonBody, sendJson } from "../http/respond.js";
import { checkAuth } from "../http/auth.js";
import { log } from "../http/log.js";
import { exportLimiter } from "../http/limits.js";
import { port } from "../http/config.js";

/** Returns true if this group handled the request. */
export async function handleDossiers(ctx: RouteContext): Promise<boolean> {
  const { req, res, method, pathname, parsedUrl } = ctx;
  let handled = true;
  // Each route block ends with `return` once it has responded; falling through means "not mine".
  await (async (): Promise<void> => {
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
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        sendJson(res, 400, { success: false, error: "Invalid dossier ID format" });
        return;
      }
      try {
        const format = (parsedUrl.searchParams.get("format") || "markdown").toLowerCase();
        const dossier = await dossierStorage.getDossier(id);
        if (!dossier) {
          sendJson(res, 404, { success: false, error: `Dossier '${id}' not found` });
          return;
        }

        if (format === "json") {
          res.statusCode = 200;
          res.setHeader("Content-Disposition", `attachment; filename="dossier_${dossier.id}.json"`);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(dossier, null, 2));
          return;
        } else if (format === "pdf") {
          if (!exportLimiter(req, res)) return;
          const { execFile } = await import("child_process");
          const scriptPath = path.resolve(process.cwd(), "scripts/export_pdf.py");
          const currentPort = port;

          execFile("python3", [scriptPath, dossier.id, String(currentPort)], { maxBuffer: 30 * 1024 * 1024, encoding: "buffer", timeout: 30000 }, (error, stdout, stderr) => {
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
      const parsedOutcome = parseBody(outcomeSchema, body);
      if (!parsedOutcome.ok) {
        sendJson(res, 400, { error: parsedOutcome.error });
        return;
      }
      const { outcome, revenueUsd, pilots } = parsedOutcome.data;
      const dossier = await dossierStorage.getDossier(id);
      if (!dossier) {
        sendJson(res, 404, { success: false, error: `Dossier '${id}' not found` });
        return;
      }
      const updated = dossierStorage.updateOutcome(
        dossier.id,
        outcome,
        revenueUsd,
        pilots
      );
      sendJson(res, 200, { success: updated, dossierId: dossier.id, outcome });
      return;
    }
    handled = false;
  })();
  return handled;
}
