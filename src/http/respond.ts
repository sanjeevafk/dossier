import http, { IncomingMessage, ServerResponse } from "node:http";

export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export function sendText(res: ServerResponse, statusCode: number, text: string, contentType = "text/plain; charset=utf-8"): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", contentType);
  res.end(text);
}

export function readJsonBody(req: IncomingMessage, maxBytes = 256 * 1024): Promise<any> {
  return new Promise((resolve, reject) => {
    let receivedBytes = 0;
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => {
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        req.destroy();
        reject(new Error("Request payload exceeded size limit"));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString("utf-8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON payload"));
      }
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}
