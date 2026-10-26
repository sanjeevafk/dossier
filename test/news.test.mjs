import test from "node:test";
import assert from "node:assert/strict";
import { queryNewsHeadlines } from "../dist/tools/news.js";
import { dossierStorage } from "../dist/services/storage.js";

function fetchMock(payloadXml, ok = true) {
  return async () => ({
    ok,
    text: async () => payloadXml
  });
}

test("Google News RSS parses articles with title, source, and links", async () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>Google News</title>
      <item>
        <title><![CDATA[NASA's Perseverance Rover Breaks Mars Record - ScienceAlert]]></title>
        <link>https://news.google.com/rss/articles/XYZ123</link>
        <pubDate>Mon, 26 Oct 2026 08:00:00 GMT</pubDate>
        <source url="https://sciencealert.com">ScienceAlert</source>
      </item>
      <item>
        <title>Autonomous Rover Mission Cleared for Launch - SpaceNews</title>
        <link>https://news.google.com/rss/articles/ABC456</link>
        <pubDate>Sun, 25 Oct 2026 12:00:00 GMT</pubDate>
        <source url="https://spacenews.com">SpaceNews</source>
      </item>
    </channel>
  </rss>`;

  const result = await queryNewsHeadlines("Mars Rover Exploration", fetchMock(xml));
  assert.equal(result.articles.length, 2);
  assert.equal(result.articles[0].source, "ScienceAlert");
  assert.ok(result.articles[0].title.includes("Perseverance"));
  assert.equal(result.articles[0].url, "https://news.google.com/rss/articles/XYZ123");
  assert.ok(result.keyTakeaway.includes("ScienceAlert"));
});

test("Google News returns honest empty on HTTP failure", async () => {
  const result = await queryNewsHeadlines("RareUnicornStartupNoNewsExists", fetchMock("", false));
  assert.equal(result.articles.length, 0);
  assert.ok(result.keyTakeaway.includes("No recent media reports"));
});

test("Google News utilizes SQLite cache on repeated queries", async () => {
  const key = "cached-rover-query";
  dossierStorage.setReconCache(`news:google:${key}`, "google-news", {
    articles: [
      {
        title: "Cached Rover Article",
        source: "CachedSource",
        url: "https://example.com/cached"
      }
    ]
  });

  const result = await queryNewsHeadlines(key, async () => {
    throw new Error("Should not be called because cache exists");
  });

  assert.equal(result.source, "Google News (cached)");
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].title, "Cached Rover Article");
});
