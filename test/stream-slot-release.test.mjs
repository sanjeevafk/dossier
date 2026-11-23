import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { handleEvaluate } from "../src/routes/evaluate.ts";
import { getActiveEvaluations } from "../src/http/limits.ts";

test("stream route releases its evaluation slot when header setup throws after acquiring it", async () => {
  const server = http.createServer(async (req, res) => {
    res.flushHeaders = () => {
      throw new Error("boom: flushHeaders failed");
    };
    const parsedUrl = new URL(req.url, "http://localhost");
    try {
      await handleEvaluate({ req, res, method: req.method, pathname: parsedUrl.pathname, parsedUrl });
    } catch {
      // the route may rethrow; what matters is the slot
    }
    res.destroy();
  });
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();
  try {
    assert.equal(getActiveEvaluations(), 0);
    await fetch(`http://127.0.0.1:${port}/api/evaluate/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Slot probe", summary: "A probe idea to check slot release on failure." })
    }).catch(() => {});
    assert.equal(getActiveEvaluations(), 0, "slot must not leak");
  } finally {
    server.close();
  }
});
