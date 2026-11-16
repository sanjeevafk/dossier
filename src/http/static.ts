import { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { sendText } from "./respond.js";

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

export function serveStaticFile(pathname: string, req: IncomingMessage, res: ServerResponse): boolean {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
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
        return streamHtmlWithAssetVersions(indexPath, stat, req, res);
      }
      return false;
    }
  } catch {
    return false;
  }

  if (path.extname(targetPath).toLowerCase() === ".html") {
    return streamHtmlWithAssetVersions(targetPath, stat, req, res);
  }
  return streamFile(targetPath, stat, req, res);
}

/**
 * Rewrite `/app.js`, `/dist.css` and `/styles.css` references to `/app.js?v=<content hash>`.
 * CDNs in front of the app (Cloudflare's default Browser Cache TTL) override origin cache
 * headers on static files, so a stale app.js could survive a deploy for hours. index.html is
 * not cached, so versioning the URLs from there is what actually busts the stale copy.
 */
function streamHtmlWithAssetVersions(filePath: string, stat: fs.Stats, req: IncomingMessage, res: ServerResponse): boolean {
  let html: string;
  try {
    html = fs.readFileSync(filePath, "utf8");
  } catch {
    return false;
  }
  const versioned = html.replace(/(src|href)="\/(app\.js|dist\.css|styles\.css)(\?[^"]*)?"/g, (_m, attr: string, file: string) => {
    try {
      const hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(publicDir, file))).digest("hex").slice(0, 10);
      return `${attr}="/${file}?v=${hash}"`;
    } catch {
      return `${attr}="/${file}"`;
    }
  });
  const body = Buffer.from(versioned, "utf8");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Length", body.length);
  res.setHeader("Cache-Control", "no-cache");
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  res.end(body);
  return true;
}

function streamFile(filePath: string, stat: fs.Stats, req: IncomingMessage, res: ServerResponse): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // Revalidate on every load: heuristic browser caching served stale app.js after deploys,
  // which broke the report render until a hard refresh. no-cache = revalidate, 304 when unchanged.
  const lastModified = stat.mtime.toUTCString();
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Last-Modified", lastModified);
  res.setHeader("Cache-Control", "no-cache");

  if (req.method === "HEAD") {
    res.end();
    return true;
  }

  const ifModifiedSince = req.headers["if-modified-since"];
  if (ifModifiedSince && new Date(ifModifiedSince).getTime() >= Math.floor(stat.mtimeMs / 1000) * 1000) {
    res.statusCode = 304;
    res.removeHeader("Content-Length");
    res.end();
    return true;
  }

  fs.createReadStream(filePath).pipe(res);
  return true;
}
