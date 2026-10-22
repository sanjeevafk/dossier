process.env.NODE_ENV = "test";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

test("Server-Sent Events (SSE) stream endpoint emits structured events", async () => {
  const { default: app } = await import("../dist/server.js");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/evaluate/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Autonomous Drone Forest Patrolling",
        summary: "Autonomous drone swarm for real-time forest fire and illegal logging detection.",
        targetAudience: "Forestry & Disaster Response Teams",
        monetization: "$2,500/month per reserve",
        pricingMonthlyUsd: 2500,
        estimatedCacUsd: 3000,
        useLiveLLM: false
      })
    });

    assert.equal(res.status, 200, "SSE stream response must be 200 OK");
    assert.ok(res.headers.get("content-type")?.includes("text/event-stream"), "Content-type must be text/event-stream");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let eventsReceived = [];
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        if (!block.trim()) continue;
        let eventType = "message";
        let dataStr = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event: ")) eventType = line.slice(7).trim();
          if (line.startsWith("data: ")) dataStr = line.slice(6).trim();
        }
        if (dataStr) {
          try {
            eventsReceived.push({ type: eventType, data: JSON.parse(dataStr) });
          } catch {}
        }
      }
    }

    const eventTypes = eventsReceived.map((e) => e.type);
    assert.ok(eventsReceived.length >= 5, `Expected at least 5 events, received ${eventsReceived.length}`);
    assert.ok(eventTypes.includes("init"), "Must emit init event");
    assert.ok(eventTypes.includes("domain"), "Must emit domain classification event");
    assert.ok(eventTypes.includes("agent_opinion"), "Must emit agent opinion events");
    assert.ok(eventTypes.includes("dossier_complete"), "Must emit dossier_complete event");
    assert.ok(eventTypes.includes("done"), "Must emit done event");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
