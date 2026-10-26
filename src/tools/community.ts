import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CommunityDiscussion {
  platform: string; // "hackernews" | "reddit" | "twitter"
  title: string;
  url: string;
  score?: number; // upvotes / points
  comments?: number;
}

export interface CommunitySentimentResult {
  provider: "hackernews+agent-reach" | "hackernews" | "agent-reach" | "none";
  discussions: CommunityDiscussion[];
  errors: string[];
}

const COMMUNITY_TIMEOUT_MS = 8000;
const MAX_DISCUSSIONS = 5;

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
}

/**
 * Hacker News community search via the public Algolia HN Search API.
 * Zero-key and server-safe — the always-on community evidence backend.
 * Long branded titles query poorly, so a condensed-token retry runs when the
 * full-title query yields fewer than two relevant discussions.
 */
async function queryHackerNews(
  query: string,
  fetchImpl: FetchImpl
): Promise<CommunityDiscussion[]> {
  const discussions = await hnAlgoliaSearch(query, fetchImpl);
  if (discussions.length >= 2) return discussions;

  const condensed = significantTokens(query).slice(1, 4).join(" ");
  if (!condensed || condensed === query.toLowerCase()) return discussions;

  const retry = await hnAlgoliaSearch(condensed, fetchImpl);
  const seen = new Set(discussions.map((d) => d.url));
  return [...discussions, ...retry.filter((d) => !seen.has(d.url))];
}

async function hnAlgoliaSearch(query: string, fetchImpl: FetchImpl): Promise<CommunityDiscussion[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COMMUNITY_TIMEOUT_MS);
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=8`;
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HN Algolia HTTP ${res.status}`);
    const data = await res.json();
    const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];

    const tokens = significantTokens(query);
    const discussions: CommunityDiscussion[] = [];
    for (const hit of hits) {
      const title = String(hit.title || hit.story_title || "").trim();
      if (!title) continue;
      // Relevance guard: only keep hits sharing a significant token with the query.
      if (tokens.length > 0 && !tokens.some((t) => title.toLowerCase().includes(t))) continue;
      discussions.push({
        platform: "hackernews",
        title: title.slice(0, 140),
        url: String(hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`),
        score: typeof hit.points === "number" ? hit.points : undefined,
        comments: typeof hit.num_comments === "number" ? hit.num_comments : undefined
      });
      if (discussions.length >= MAX_DISCUSSIONS) break;
    }
    return discussions;
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractUrls(text: string, hostPattern: RegExp): string[] {
  return [...new Set((text.match(hostPattern) || []))].slice(0, MAX_DISCUSSIONS);
}

/**
 * Reddit bridge via agent-reach ecosystem CLIs (opencli → rdt). Both require
 * browser login state on the host; when absent the bridge yields nothing —
 * never synthetic discussions.
 */
async function bridgeReddit(query: string): Promise<CommunityDiscussion[]> {
  const commands: string[][] = [
    ["opencli", "reddit", "search", query, "-f", "yaml"],
    ["rdt", "search", query, "--limit", "5"]
  ];

  for (const cmd of commands) {
    try {
      const { stdout } = await execFileAsync(cmd[0], cmd.slice(1), {
        timeout: COMMUNITY_TIMEOUT_MS,
        maxBuffer: 1024 * 1024
      });
      const urls = extractUrls(stdout, /https?:\/\/(?:www\.)?reddit\.com\/r\/[\w/.\-?=%]+/g);
      if (urls.length === 0) continue;
      const titles = (stdout.match(/(?:title|Title):\s*(.+)/g) || [])
        .map((l) => l.replace(/^(?:title|Title):\s*/, "").trim())
        .filter(Boolean);
      return urls.map((url, i) => ({
        platform: "reddit",
        title: (titles[i] || url.split("/").slice(-2).join("/")).slice(0, 140),
        url
      }));
    } catch {
      continue; // binary missing, not logged in, or failed — try next backend
    }
  }
  return [];
}

/**
 * Twitter/X bridge via twitter-cli (requires configured cookies on the host).
 * Best-effort: any upstream failure yields zero discussions, not filler.
 */
async function bridgeTwitter(query: string): Promise<CommunityDiscussion[]> {
  try {
    const { stdout } = await execFileAsync("twitter", ["search", query, "-n", "5"], {
      timeout: COMMUNITY_TIMEOUT_MS,
      maxBuffer: 1024 * 1024
    });
    if (/ok:\s*false/.test(stdout)) return [];
    const urls = extractUrls(stdout, /https?:\/\/(?:www\.)?(?:x|twitter)\.com\/\w+\/status\/\d+/g);
    if (urls.length === 0) return [];
    const texts = stdout
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 25 && !l.startsWith("http"));
    return urls.map((url, i) => ({
      platform: "twitter",
      title: (texts[i] || "X post").slice(0, 140),
      url
    }));
  } catch {
    return [];
  }
}

/**
 * Community sentiment recon. Always tries Hacker News (native, zero-config);
 * additionally bridges into the agent-reach ecosystem CLIs for login-walled
 * platforms (Reddit, X) when the host has them configured.
 *
 * Honesty contract: results contain ONLY discussions actually retrieved from
 * the named platform with a real URL. If nothing is found, `discussions` is
 * empty and `provider` says what ran — callers must surface that absence.
 */
export async function queryCommunitySentiment(
  ideaTitle: string,
  fetchImpl: FetchImpl = fetch
): Promise<CommunitySentimentResult> {
  const query = ideaTitle.trim().slice(0, 120);
  const errors: string[] = [];
  const discussions: CommunityDiscussion[] = [];

  try {
    const hn = await queryHackerNews(query, fetchImpl);
    discussions.push(...hn);
  } catch (err: any) {
    errors.push(`hackernews: ${err?.message || "query failed"}`);
  }

  const [reddit, twitter] = await Promise.all([bridgeReddit(query), bridgeTwitter(query)]);
  discussions.push(...reddit, ...twitter);

  const usedHn = discussions.some((d) => d.platform === "hackernews");
  const usedBridge = discussions.some((d) => d.platform !== "hackernews");
  const provider: CommunitySentimentResult["provider"] =
    usedHn && usedBridge ? "hackernews+agent-reach" : usedHn ? "hackernews" : usedBridge ? "agent-reach" : "none";

  return { provider, discussions: discussions.slice(0, MAX_DISCUSSIONS + 2), errors };
}
