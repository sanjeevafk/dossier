import http, { IncomingMessage, ServerResponse } from "node:http";
import { log } from "./http/log.js";
import { sendJson } from "./http/respond.js";
import { port, allowedOrigins } from "./http/config.js";
import { serveStaticFile } from "./http/static.js";
import type { RouteContext } from "./routes/context.js";
import { handleSystem } from "./routes/system.js";
import { handleDossiers } from "./routes/dossiers.js";
import { handleEvaluate } from "./routes/evaluate.js";
import { handleForecasts } from "./routes/forecasts.js";
import { handleChat } from "./routes/chat.js";

const ROUTE_GROUPS: Array<(ctx: RouteContext) => Promise<boolean>> = [
  handleSystem,
  handleDossiers,
  handleEvaluate,
  handleForecasts,
  handleChat
];

/**
 * Main HTTP request listener: security headers, CORS, then route groups, static files, 404.
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
  const devMode = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  if (!origin || allowedOrigins.includes(origin) || devMode) {
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
  const ctx: RouteContext = { req, res, method, pathname, parsedUrl };

  try {
    for (const handle of ROUTE_GROUPS) {
      if (await handle(ctx)) return;
    }

    if ((method === "GET" || method === "HEAD") && serveStaticFile(pathname, req, res)) return;

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
