import test from "node:test";
import assert from "node:assert/strict";
import {
  scrapeWebPageWithJina,
  queryGitHubTraction,
  queryV2EXCommunity,
  queryAgentReachIntel
} from "../dist/tools/agentReach.js";

test("scrapeWebPageWithJina parses markdown title, pricing, and bullet claims", async () => {
  const markdownSample = `Title: Pinecone - Vector Database for AI
URL Source: https://pinecone.io/pricing

# Pinecone Serverless Pricing
Vector database designed for high performance AI applications.

- Fully managed serverless vector indexing with zero maintenance.
- Predictable consumption pricing at $50/mo standard tier.
- Sub-50ms latency queries with automated sharding.

Pricing starts at $50/mo for dedicated enterprise clusters.`;

  const mockFetch = async () => ({
    ok: true,
    text: async () => markdownSample
  });

  const res = await scrapeWebPageWithJina("https://pinecone.io/pricing", mockFetch);
  assert.ok(res !== null);
  assert.equal(res.title, "Pinecone - Vector Database for AI");
  assert.equal(res.extractedPricing, "$50/mo");
  assert.equal(res.keyClaims.length, 3);
  assert.ok(res.keyClaims[0].includes("serverless"));
});

test("scrapeWebPageWithJina returns null on non-http or 404 response", async () => {
  const mockFetch = async () => ({
    ok: false,
    text: async () => "Not Found"
  });

  const res = await scrapeWebPageWithJina("https://nonexistent-service.internal/404", mockFetch);
  assert.equal(res, null);

  const invalidUrlRes = await scrapeWebPageWithJina("invalid-url", mockFetch);
  assert.equal(invalidUrlRes, null);
});

test("queryGitHubTraction parses GitHub API response correctly", async () => {
  const ghApiResponse = {
    items: [
      {
        full_name: "qdrant/qdrant",
        stargazers_count: 21500,
        description: "Vector Search Engine and Database for the next generation of AI",
        html_url: "https://github.com/qdrant/qdrant"
      },
      {
        full_name: "milvus-io/milvus",
        stargazers_count: 32000,
        description: "A cloud-native vector database",
        html_url: "https://github.com/milvus-io/milvus"
      }
    ]
  };

  const mockFetch = async () => ({
    ok: true,
    json: async () => ghApiResponse
  });

  const repos = await queryGitHubTraction("vector search database", mockFetch);
  assert.ok(Array.isArray(repos));
  assert.ok(repos.length > 0);
  assert.ok(repos.some(r => r.stars > 0));
});

test("queryV2EXCommunity parses hot developer topics", async () => {
  const mockV2EX = [
    {
      id: 998822,
      title: "How are people optimizing local vector index builds in Rust?",
      url: "https://v2ex.com/t/998822",
      replies: 42
    }
  ];

  const mockFetch = async () => ({
    ok: true,
    json: async () => mockV2EX
  });

  const topics = await queryV2EXCommunity(mockFetch);
  assert.equal(topics.length, 1);
  assert.equal(topics[0].platform, "v2ex");
  assert.equal(topics[0].replies, 42);
  assert.ok(topics[0].title.includes("vector index"));
});

test("queryAgentReachIntel combines deep scrape, github, and community", async () => {
  const markdownSample = `Title: Competitor Spec
- Feature A: low latency
- Feature B: cost effective
Starts at $29/mo`;

  const mockFetch = async (url) => {
    if (String(url).includes("r.jina.ai")) {
      return { ok: true, text: async () => markdownSample };
    }
    if (String(url).includes("v2ex.com")) {
      return {
        ok: true,
        json: async () => [{ id: 123, title: "APAC discussion", url: "https://v2ex.com/t/123", replies: 10 }]
      };
    }
    return {
      ok: true,
      json: async () => ({
        items: [{ full_name: "mock/engine", stargazers_count: 1500, description: "Fast engine", html_url: "https://github.com/mock/engine" }]
      })
    };
  };

  const intel = await queryAgentReachIntel(
    "Fast Vector Database",
    {
      competitorUrl: "https://competitor.com",
      isTechSoftware: true,
      preferredChannels: ["v2ex"]
    },
    mockFetch
  );

  assert.ok(intel.gitHubRepos.length > 0);
  assert.ok(intel.deepScrape !== undefined);
  assert.equal(intel.regionalDiscussions.length, 1);
  assert.ok(intel.keyTakeaway.includes("Competitor Spec"));
  assert.ok(intel.keyTakeaway.includes("GitHub open-source"));
});
