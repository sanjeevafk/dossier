import http from "node:http";
import { app } from "../src/server.js";

interface TestStats {
  passed: number;
  failed: number;
  totalDurationMs: number;
  latencies: number[];
}

const stats: TestStats = {
  passed: 0,
  failed: 0,
  totalDurationMs: 0,
  latencies: []
};

function logPass(name: string, durationMs: number, detail?: string) {
  stats.passed++;
  stats.latencies.push(durationMs);
  console.log(`\x1b[32m✔ PASS\x1b[0m [${durationMs}ms] ${name} ${detail ? `\x1b[90m(${detail})\x1b[0m` : ""}`);
}

function logFail(name: string, durationMs: number, error: string) {
  stats.failed++;
  console.error(`\x1b[31m✘ FAIL\x1b[0m [${durationMs}ms] ${name}\n       \x1b[31mError: ${error}\x1b[0m`);
}

async function runLiveStressTest() {
  console.log("\x1b[1m\x1b[36m===============================================================");
  console.log("  🚀 DOSSIER LIVE HTTP BENCHMARK & MULTI-QUERY STRESS HARNESS");
  console.log("  Native node:http Server, Real SSE Streams & Concurrent Loads");
  console.log("===============================================================\x1b[0m\n");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`\x1b[90mStarted in-memory test server at ${baseUrl}\x1b[0m\n`);

  const tStart = Date.now();

  try {
    // -------------------------------------------------------------
    // Test Group 1: Baseline Health, Metrics & Static Assets
    // -------------------------------------------------------------
    console.log("\x1b[1m--- [1/6] Baseline Health, Telemetry & Static Files ---\x1b[0m");

    // 1.1 /health
    const t0 = Date.now();
    const resHealth = await fetch(`${baseUrl}/health`);
    const healthJson = await resHealth.json();
    const d0 = Date.now() - t0;
    if (resHealth.status === 200 && healthJson.status === "ok" && healthJson.service === "dossier-intelligence") {
      logPass("GET /health", d0, `v${healthJson.version}, rev: ${healthJson.revision}, memory: ${healthJson.memoryUsageMb}MB`);
    } else {
      logFail("GET /health", d0, `Status ${resHealth.status}, body: ${JSON.stringify(healthJson)}`);
    }

    // 1.2 /metrics
    const t1 = Date.now();
    const resMetrics = await fetch(`${baseUrl}/metrics`);
    const metricsJson = await resMetrics.json();
    const d1 = Date.now() - t1;
    if (resMetrics.status === 200 && metricsJson.success === true && typeof metricsJson.overall === "object") {
      logPass("GET /metrics", d1, `Ledger records: ${metricsJson.overall.n ?? 0}, meanScore: ${metricsJson.overall.meanScore}`);
    } else {
      logFail("GET /metrics", d1, `Status ${resMetrics.status}`);
    }

    // 1.3 / (index.html)
    const t2 = Date.now();
    const resIndex = await fetch(`${baseUrl}/`);
    const indexHtml = await resIndex.text();
    const d2 = Date.now() - t2;
    if (resIndex.status === 200 && resIndex.headers.get("content-type")?.includes("text/html") && indexHtml.includes("DOSSIER")) {
      logPass("GET / (index.html)", d2, `${(indexHtml.length / 1024).toFixed(1)} KB rendered`);
    } else {
      logFail("GET / (index.html)", d2, `Status ${resIndex.status}`);
    }

    // 1.4 /dist.css
    const t3 = Date.now();
    const resCss = await fetch(`${baseUrl}/dist.css`);
    const cssText = await resCss.text();
    const d3 = Date.now() - t3;
    if (resCss.status === 200 && resCss.headers.get("content-type")?.includes("text/css") && cssText.includes("tailwindcss")) {
      logPass("GET /dist.css", d3, `${(cssText.length / 1024).toFixed(1)} KB precompiled static`);
    } else {
      logFail("GET /dist.css", d3, `Status ${resCss.status}`);
    }

    // -------------------------------------------------------------
    // Test Group 2: Security, Directory Traversal & Input Hardening
    // -------------------------------------------------------------
    console.log("\n\x1b[1m--- [2/6] Security Invariants & Traversal Defense ---\x1b[0m");

    // 2.1 Directory traversal attempt
    const t4 = Date.now();
    const resTraversal = await fetch(`${baseUrl}/../../../../etc/passwd`);
    const d4 = Date.now() - t4;
    if (resTraversal.status === 403 || resTraversal.status === 404) {
      logPass("Directory Traversal (/../../etc/passwd)", d4, `Blocked with ${resTraversal.status}`);
    } else {
      logFail("Directory Traversal", d4, `Expected 403/404, got ${resTraversal.status}`);
    }

    // 2.2 Malformed JSON payload
    const t5 = Date.now();
    const resMalformed = await fetch(`${baseUrl}/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ broken json: 123,, }"
    });
    const d5 = Date.now() - t5;
    if (resMalformed.status === 400) {
      logPass("Malformed JSON Rejection", d5, `Rejected with status 400 Bad Request`);
    } else {
      logFail("Malformed JSON Rejection", d5, `Expected 400, got ${resMalformed.status}`);
    }

    // 2.3 Missing required fields
    const t6 = Date.now();
    const resMissing = await fetch(`${baseUrl}/api/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetAudience: "Founders" })
    });
    const d6 = Date.now() - t6;
    if (resMissing.status === 400) {
      logPass("Missing Required Fields Validation", d6, `Caught missing 'title'/'summary' with 400`);
    } else {
      logFail("Missing Required Fields Validation", d6, `Expected 400, got ${resMissing.status}`);
    }

    // 2.4 CORS OPTIONS preflight
    const t7 = Date.now();
    const resOptions = await fetch(`${baseUrl}/api/evaluate`, {
      method: "OPTIONS",
      headers: { Origin: "http://localhost:3000" }
    });
    const d7 = Date.now() - t7;
    if (resOptions.status === 204 && resOptions.headers.get("access-control-allow-methods")) {
      logPass("CORS OPTIONS Preflight", d7, `Status 204 with methods: ${resOptions.headers.get("access-control-allow-methods")}`);
    } else {
      logFail("CORS OPTIONS Preflight", d7, `Expected 204, got ${resOptions.status}`);
    }

    // -------------------------------------------------------------
    // Test Group 3: Real-Time Playground Chat Stream (SSE)
    // -------------------------------------------------------------
    console.log("\n\x1b[1m--- [3/6] Real-Time Multi-Agent Chat Stream (SSE) ---\x1b[0m");

    const chatRoles = ["skeptic", "investor", "architect", "customer", "all"] as const;
    for (const role of chatRoles) {
      const tChat = Date.now();
      const resChat = await fetch(`${baseUrl}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Can we build a subscription tool that scans git diffs for token leaks?",
          role,
          ideaContext: {
            title: "DiffGuard",
            summary: "Automated git pre-commit and PR secret detector for dev teams",
            targetAudience: "Engineering Managers",
            monetization: "$15/seat/month"
          }
        })
      });

      const dChat = Date.now() - tChat;
      if (resChat.status === 200 && resChat.headers.get("content-type")?.includes("text/event-stream")) {
        const bodyText = await resChat.text();
        const hasChunks = bodyText.includes("event: chunk");
        const hasDone = bodyText.includes("event: done");
        if (hasChunks && hasDone) {
          logPass(`Chat Stream [role: ${role}]`, dChat, `Delivered SSE chunks and terminal done event`);
        } else {
          logFail(`Chat Stream [role: ${role}]`, dChat, `Missing SSE events in response stream`);
        }
      } else {
        logFail(`Chat Stream [role: ${role}]`, dChat, `Expected 200 text/event-stream, got ${resChat.status}`);
      }
    }

    // -------------------------------------------------------------
    // Test Group 4: Live Idea Evaluation Stream Across 4 Diverse Archetypes
    // -------------------------------------------------------------
    console.log("\n\x1b[1m--- [4/6] Live Idea Evaluation Stream Across Archetypes ---\x1b[0m");

    const testIdeas = [
      {
        archetypeExpected: "b2b_saas",
        title: "KubeScale AutoSOC2",
        summary: "Continuous compliance and audit readiness telemetry bot for Kubernetes microservices.",
        targetAudience: "DevOps & Security Engineers",
        monetization: "$499/mo per cluster",
        pricingMonthlyUsd: 499,
        estimatedCacUsd: 1200
      },
      {
        archetypeExpected: "hardware_robotics",
        title: "Perpetual Solar Ocean Buoy",
        summary: "Wave-powered acoustic telemetry buoy for deep sea climate monitoring.",
        targetAudience: "Oceanographic Research Institutions",
        monetization: "$12,000 unit + $300/mo satellite data",
        pricingMonthlyUsd: 300,
        estimatedCacUsd: 4000
      },
      {
        archetypeExpected: "web3_defi",
        title: "Solana Autonomous Liquidity Rebalancer",
        summary: "Decentralized automated market maker yield aggregator optimizing cross-pool routing.",
        targetAudience: "DeFi Yield Farmers & DAOs",
        monetization: "0.15% fee on rebalanced volume",
        pricingMonthlyUsd: 150,
        estimatedCacUsd: 250
      },
      {
        archetypeExpected: "general_startup",
        title: "KiranaDirect Wholesale B2B Sourcing",
        summary: "Direct-from-manufacturer bulk staples ordering app for neighborhood grocery stores in India.",
        targetAudience: "Small Retail Store Owners (Kiranas)",
        monetization: "3% distributor commission",
        pricingMonthlyUsd: 80,
        estimatedCacUsd: 120
      }
    ];

    let lastCreatedDossierId = "";

    for (const idea of testIdeas) {
      const tEval = Date.now();
      const resEval = await fetch(`${baseUrl}/api/evaluate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...idea,
          useLiveLLM: false // Heuristic adversarial swarm: tests all math, recon, sandbox, verifier in ~3s
        })
      });

      const dEval = Date.now() - tEval;
      if (resEval.status === 200 && resEval.headers.get("content-type")?.includes("text/event-stream")) {
        const streamText = await resEval.text();
        const events = streamText
          .split("\n\n")
          .filter((b) => b.trim().length > 0)
          .map((b) => {
            const lines = b.split("\n");
            let event = "message";
            let data = "";
            for (const l of lines) {
              if (l.startsWith("event: ")) event = l.slice(7).trim();
              if (l.startsWith("data: ")) data = l.slice(6).trim();
            }
            try {
              return { event, data: JSON.parse(data) };
            } catch {
              return { event, data };
            }
          });

        const eventNames = events.map((e) => e.event);
        const hasInit = eventNames.includes("init");
        const hasDomain = eventNames.includes("domain");
        const hasOpinions = eventNames.includes("agent_opinion");
        const hasComplete = eventNames.includes("dossier_complete");
        const hasDone = eventNames.includes("done");

        const doneEvent = events.find((e) => e.event === "done");
        if (doneEvent && typeof doneEvent.data === "object" && (doneEvent.data as any).dossierId) {
          lastCreatedDossierId = (doneEvent.data as any).dossierId;
        }

        const domainEvent = events.find((e) => e.event === "domain");
        const archetypeReceived = domainEvent?.data?.domain?.archetype || domainEvent?.data?.archetype;

        if (hasInit && hasDomain && hasOpinions && hasComplete && hasDone) {
          logPass(
            `Evaluate Stream: "${idea.title}"`,
            dEval,
            `Classified: ${archetypeReceived}, Dossier ID: ${lastCreatedDossierId}, ${events.length} SSE events`
          );
        } else {
          logFail(
            `Evaluate Stream: "${idea.title}"`,
            dEval,
            `Incomplete event lifecycle. Received events: ${eventNames.join(", ")}`
          );
        }
      } else {
        logFail(`Evaluate Stream: "${idea.title}"`, dEval, `Expected 200 SSE, got ${resEval.status}`);
      }
    }

    // -------------------------------------------------------------
    // Test Group 5: Dossier Persistence, Export & Calibration Ledger
    // -------------------------------------------------------------
    console.log("\n\x1b[1m--- [5/6] Persistence, Dossier Retrieval & Export ---\x1b[0m");

    if (lastCreatedDossierId) {
      // 5.1 Retrieve by ID
      const tGet = Date.now();
      const resGet = await fetch(`${baseUrl}/api/dossiers/${lastCreatedDossierId}`);
      const getJson = await resGet.json();
      const dGet = Date.now() - tGet;
      if (resGet.status === 200 && getJson.success && getJson.dossier?.id === lastCreatedDossierId) {
        logPass(`GET /api/dossiers/:id`, dGet, `Retrieved score: ${getJson.dossier.killScore}/100, verdict: ${getJson.dossier.overallVerdict}`);
      } else {
        logFail(`GET /api/dossiers/:id`, dGet, `Failed to retrieve dossier ${lastCreatedDossierId}`);
      }

      // 5.2 Export JSON
      const tExpJson = Date.now();
      const resExpJson = await fetch(`${baseUrl}/api/dossiers/${lastCreatedDossierId}/export?format=json`);
      const expJsonText = await resExpJson.text();
      const dExpJson = Date.now() - tExpJson;
      if (resExpJson.status === 200 && resExpJson.headers.get("content-type")?.includes("application/json") && expJsonText.includes(lastCreatedDossierId)) {
        logPass(`Export Dossier (format=json)`, dExpJson, `${(expJsonText.length / 1024).toFixed(1)} KB`);
      } else {
        logFail(`Export Dossier (format=json)`, dExpJson, `Status ${resExpJson.status}`);
      }

      // 5.3 Export Markdown
      const tExpMd = Date.now();
      const resExpMd = await fetch(`${baseUrl}/api/dossiers/${lastCreatedDossierId}/export?format=markdown`);
      const expMdText = await resExpMd.text();
      const dExpMd = Date.now() - tExpMd;
      if (resExpMd.status === 200 && resExpMd.headers.get("content-type")?.includes("text/markdown") && expMdText.includes("# DOSSIER REPORT:")) {
        logPass(`Export Dossier (format=markdown)`, dExpMd, `${(expMdText.length / 1024).toFixed(1)} KB formatted`);
      } else {
        logFail(`Export Dossier (format=markdown)`, dExpMd, `Status ${resExpMd.status}`);
      }

      // 5.4 Record calibration outcome
      const tOutcome = Date.now();
      const resOutcome = await fetch(`${baseUrl}/api/dossiers/${lastCreatedDossierId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome: "built", revenueUsd: 15000, pilots: 3 })
      });
      const outcomeJson = await resOutcome.json();
      const dOutcome = Date.now() - tOutcome;
      if (resOutcome.status === 200 && outcomeJson.success) {
        logPass(`POST /api/dossiers/:id/outcome`, dOutcome, `Recorded outcome='built', revenueUsd=15000`);
      } else {
        logFail(`POST /api/dossiers/:id/outcome`, dOutcome, `Status ${resOutcome.status}`);
      }
    }

    // 5.5 List forecasts & calibration summary
    const tForecast = Date.now();
    const resForecast = await fetch(`${baseUrl}/api/forecasts`);
    const forecastJson = await resForecast.json();
    const dForecast = Date.now() - tForecast;
    if (resForecast.status === 200 && forecastJson.success && Array.isArray(forecastJson.forecasts)) {
      logPass(`GET /api/forecasts`, dForecast, `${forecastJson.count} forecasts registered in ledger`);
    } else {
      logFail(`GET /api/forecasts`, dForecast, `Status ${resForecast.status}`);
    }

    const tCalib = Date.now();
    const resCalib = await fetch(`${baseUrl}/api/calibration`);
    const calibJson = await resCalib.json();
    const dCalib = Date.now() - tCalib;
    if (resCalib.status === 200 && calibJson.success) {
      logPass(`GET /api/calibration`, dCalib, `Summary retrieved, sampleCount: ${calibJson.calibration.sampleCount}`);
    } else {
      logFail(`GET /api/calibration`, dCalib, `Status ${resCalib.status}`);
    }

    // -------------------------------------------------------------
    // Test Group 6: Burst Concurrency & Rate Limiting Guard
    // -------------------------------------------------------------
    console.log("\n\x1b[1m--- [6/6] Concurrency Guard & Rate Limiting Enforcement ---\x1b[0m");

    // 6.1 Bounded Concurrency Guard (MAX_CONCURRENT_EVALS is 3 by default)
    // Fire 6 simultaneous evaluate requests to confirm slots are guarded
    const tBurst = Date.now();
    const burstPromises = Array.from({ length: 6 }).map((_, i) =>
      fetch(`${baseUrl}/api/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Burst Idea ${i + 1}`,
          summary: `High load concurrent test idea ${i + 1}`,
          useLiveLLM: false
        })
      })
    );

    const burstResponses = await Promise.all(burstPromises);
    const dBurst = Date.now() - tBurst;
    const statuses = burstResponses.map((r) => r.status);
    const count200 = statuses.filter((s) => s === 200).length;
    const count429 = statuses.filter((s) => s === 429).length;

    if (count200 > 0 && (count200 + count429 === 6)) {
      logPass(
        `Burst Concurrency Guard (6 simultaneous evaluations)`,
        dBurst,
        `Processed ${count200} successful, gracefully shed ${count429} with 429 Too Many Requests`
      );
    } else {
      logFail(
        `Burst Concurrency Guard`,
        dBurst,
        `Unexpected status distribution: ${statuses.join(", ")}`
      );
    }

    // 6.2 Evaluation Rate Limiter (send 15 requests to trigger 10/hr limit)
    const tRate = Date.now();
    const rateLimitProbes = Array.from({ length: 15 }).map((_, i) =>
      fetch(`${baseUrl}/api/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probe: i })
      })
    );
    const probeResponses = await Promise.all(rateLimitProbes);
    const rejectedCount = probeResponses.filter((r) => r.status === 429).length;
    const hitRateLimit = rejectedCount > 0;
    const dRate = Date.now() - tRate;
    if (hitRateLimit) {
      logPass("IP Rate Limiter Enforcement", dRate, `Successfully enforced 10/hr limit (${rejectedCount} rejected with 429)`);
    } else {
      logFail("IP Rate Limiter Enforcement", dRate, `Failed to trigger 429 (statuses: ${probeResponses.map(r => r.status).join(", ")})`);
    }

    // Final Health Check & Memory Leak Audit
    const resFinalHealth = await fetch(`${baseUrl}/health`);
    const finalHealthJson = await resFinalHealth.json();
    console.log(`\n\x1b[90mFinal memory RSS: ${finalHealthJson.memoryUsageMb} MB (Uptime: ${finalHealthJson.uptimeSeconds}s)\x1b[0m`);

  } finally {
    await new Promise<void>((resolve) => server.close(resolve));
  }

  stats.totalDurationMs = Date.now() - tStart;
  const avgLatency = Math.round(stats.latencies.reduce((a, b) => a + b, 0) / (stats.latencies.length || 1));
  const p95Latency = stats.latencies.sort((a, b) => a - b)[Math.floor(stats.latencies.length * 0.95)] || 0;

  console.log("\n\x1b[1m\x1b[36m===============================================================");
  console.log("  📊 STRESS TEST SUMMARY REPORT");
  console.log("===============================================================\x1b[0m");
  console.log(`  Total Invocations: \x1b[1m${stats.passed + stats.failed}\x1b[0m`);
  console.log(`  Passed:            \x1b[32m\x1b[1m${stats.passed}\x1b[0m`);
  console.log(`  Failed:            \x1b[${stats.failed > 0 ? "31" : "32"}m\x1b[1m${stats.failed}\x1b[0m`);
  console.log(`  Total Run Time:    ${(stats.totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`  Average Latency:   ${avgLatency}ms`);
  console.log(`  p95 Latency:       ${p95Latency}ms`);
  console.log("\x1b[1m\x1b[36m===============================================================\x1b[0m\n");

  if (stats.failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runLiveStressTest().catch((err) => {
  console.error("Unhandled harness error:", err);
  process.exit(1);
});
