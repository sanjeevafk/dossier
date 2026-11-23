import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

function loadEnvFile(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore unreadable or missing .env file
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env"));
const packageEnv = path.resolve(import.meta.dirname, "..", "..", ".env");
if (fs.existsSync(packageEnv)) {
  loadEnvFile(packageEnv);
}

const execFileAsync = promisify(execFile);

export interface LLMProviderConfig {
  name: string;
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  kind?: "api" | "cli" | "responses";
  extraHeaders?: Record<string, string>;
}

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LlmUsage {
  calls: number;
  failedCalls: number;
  inputTokens: number;
  outputTokens: number;
  models: Record<string, number>;
  /** Responses served from the response cache: real API burn stays 0 for them. */
  cacheHits: number;
  startedAt: number;
  /** Aborted when the caller (e.g. a disconnected HTTP client) no longer wants the result. */
  signal?: AbortSignal;
}

const usageStore = new AsyncLocalStorage<LlmUsage>();

/** Run `fn` with a fresh usage tracker; every LLM call made inside (including parallel ones) is recorded on it. */
export function runWithUsageTracking<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  const usage: LlmUsage = { calls: 0, failedCalls: 0, inputTokens: 0, outputTokens: 0, models: {}, cacheHits: 0, startedAt: Date.now() };
  // Non-enumerable: the usage object is serialized into dossiers and API responses; the signal must not leak into them.
  if (signal) Object.defineProperty(usage, "signal", { value: signal, enumerable: false });
  return usageStore.run(usage, fn);
}

/** Per-request timeout, also cut short when the surrounding evaluation is aborted. */
function requestSignal(timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  const abort = usageStore.getStore()?.signal;
  return abort ? AbortSignal.any([timeout, abort]) : timeout;
}

export function currentLlmUsage(): LlmUsage | undefined {
  return usageStore.getStore();
}

/**
 * Per-evaluation spend guardrails, enforced only inside a usage tracker (so chat and CLI
 * paths are unaffected). On breach the call throws; the swarm marks the remaining roles
 * as heuristic fallbacks and the dossier completes with honest degraded provenance.
 */
export function enforceEvaluationBudget(): void {
  const u = usageStore.getStore();
  if (!u) return;
  u.signal?.throwIfAborted();
  const maxTokens = Number(process.env.DOSSIER_MAX_EVAL_TOKENS);
  if (Number.isFinite(maxTokens) && maxTokens > 0 && u.inputTokens + u.outputTokens >= maxTokens) {
    throw new Error(
      `Evaluation LLM budget exceeded: ${u.inputTokens + u.outputTokens} >= ${Math.round(maxTokens)} tokens (DOSSIER_MAX_EVAL_TOKENS); remaining roles fall back to heuristics`
    );
  }
  const deadline = Number(process.env.DOSSIER_EVAL_TIMEOUT_MS);
  if (Number.isFinite(deadline) && deadline > 0 && u.startedAt && Date.now() - u.startedAt >= deadline) {
    throw new Error(
      `Evaluation LLM deadline exceeded: ${Math.round((Date.now() - u.startedAt) / 1000)}s >= ${Math.round(deadline / 1000)}s (DOSSIER_EVAL_TIMEOUT_MS); remaining roles fall back to heuristics`
    );
  }
}

// ---- response cache (opt-in via DOSSIER_RESPONSE_CACHE=1) --------------------------------------
// Content-addressed, file-backed cache of non-streaming turns. Serving a hit records zero
// tokens (no API burn) and bumps usage.cacheHits. Deterministic re-runs (e.g. CI metric
// regen) become free; variance experiments must leave it off.

interface CacheEntry {
  text: string;
  provider: string;
  model: string;
  createdAt: string;
}

const cacheDir = () => process.env.DOSSIER_CACHE_DIR || ".llm-cache";

function responseCacheKey(systemPrompt: string, userPrompt: string, options: LLMGenerateOptions): string {
  return crypto.createHash("sha256").update(JSON.stringify({ systemPrompt, userPrompt, options })).digest("hex");
}

function responseCacheGet(key: string): CacheEntry | null {
  try {
    const file = path.join(cacheDir(), `${key}.json`);
    if (!fs.existsSync(file)) return null;
    const entry = JSON.parse(fs.readFileSync(file, "utf8")) as CacheEntry;
    if (typeof entry.text !== "string" || !entry.text.trim()) return null;
    return entry;
  } catch {
    return null;
  }
}

function responseCachePut(key: string, entry: CacheEntry): void {
  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(path.join(cacheDir(), `${key}.json`), JSON.stringify(entry));
  } catch {
    // cache write failures must never break a call
  }
}

function recordUsage(provider: string, model: string, inputTokens = 0, outputTokens = 0): void {
  const u = usageStore.getStore();
  if (!u) return;
  u.calls += 1;
  u.inputTokens += Number(inputTokens) || 0;
  u.outputTokens += Number(outputTokens) || 0;
  const key = `${provider}/${model}`;
  u.models[key] = (u.models[key] || 0) + 1;
}

function recordFailure(): void {
  const u = usageStore.getStore();
  if (u) u.failedCalls += 1;
}

/** USD cost from measured tokens, or undefined when no per-million-token prices are configured. */
export function estimateCostUsd(usage: LlmUsage | undefined): number | undefined {
  const pin = Number(process.env.LLM_PRICE_IN_PER_M);
  const pout = Number(process.env.LLM_PRICE_OUT_PER_M);
  if (!usage || !Number.isFinite(pin) || !Number.isFinite(pout) || (!pin && !pout)) return undefined;
  return Math.round(((usage.inputTokens * pin + usage.outputTokens * pout) / 1_000_000) * 10_000) / 10_000;
}

let cliAvailableCache: boolean | null = null;

/**
 * Detect if a generic external CLI command is configured and available in PATH.
 */
function cliAvailable(): boolean {
  const cliCmd = process.env.LLM_CLI_CMD;
  if (!cliCmd) return false;
  if (cliAvailableCache !== null) return cliAvailableCache;
  const binary = cliCmd.trim().split(/\s+/)[0];
  try {
    execFileSync(binary, ["--version"], { timeout: 3000, stdio: "ignore" });
    cliAvailableCache = true;
  } catch {
    try {
      execFileSync("which", [binary], { timeout: 3000, stdio: "ignore" });
      cliAvailableCache = true;
    } catch {
      cliAvailableCache = false;
    }
  }
  return cliAvailableCache;
}

/**
 * Resolve ordered candidate providers from environment variables.
 *
 * Backend selection via DOSSIER_LLM_BACKEND:
 *  - "cli"      → force generic CLI provider (configured via LLM_CLI_CMD)
 *  - "api"      → force HTTP API-key providers only
 *  - unset      → API keys if present, otherwise generic CLI if configured, otherwise heuristic
 */
function resolveProviders(): LLMProviderConfig[] {
  const providers: LLMProviderConfig[] = [];
  const backend = (process.env.DOSSIER_LLM_BACKEND || "").trim().toLowerCase();
  const forceCli = backend === "cli";
  const forceApi = backend === "api" || backend === "llm";

  if (!forceCli) {
    // Meta Muse via the OpenAI "Responses" API shape (MODEL_API_KEY)
    if (process.env.MODEL_API_KEY) {
      providers.push({
        name: "meta",
        kind: "responses",
        apiKey: process.env.MODEL_API_KEY,
        baseURL: process.env.META_BASE_URL || "https://api.meta.ai/v1",
        defaultModel: process.env.META_MODEL || "muse-ember-1.0"
      });
    }

    // 0. Generic OpenAI-compatible endpoint (vLLM, LiteLLM, LMStudio, Ollama, custom proxy)
    if (process.env.LLM_BASE_URL) {
      providers.push({
        name: "custom-api",
        apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "no-key",
        baseURL: process.env.LLM_BASE_URL,
        defaultModel: process.env.LLM_MODEL || process.env.MODEL_NAME || "default"
      });
    }

    // 1. Groq ultra-low-latency LPU (Primary)
    if (process.env.GROQ_API_KEY) {
      const groqModel = process.env.GROQ_MODEL ||
        (process.env.MODEL_NAME?.startsWith("openai/") || process.env.MODEL_NAME?.startsWith("qwen/")
          ? process.env.MODEL_NAME
          : "openai/gpt-oss-120b");
      providers.push({
        name: "groq",
        apiKey: process.env.GROQ_API_KEY,
        baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
        defaultModel: groqModel
      });
    }

    // 2. OpenRouter gateway (Fallback)
    if (process.env.OPENROUTER_API_KEY) {
      providers.push({
        name: "openrouter",
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultModel: process.env.OPENROUTER_MODEL || "openrouter/free",
        extraHeaders: {
          "HTTP-Referer": "https://github.com/sanjeevafk/dossier",
          "X-Title": "Dossier"
        }
      });
    }

    // 3. Google Gemini via OpenAI-compatible endpoint
    if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith("AQ.")) {
      const geminiModel = process.env.GEMINI_MODEL ||
        (process.env.MODEL_NAME?.startsWith("gemini") ? process.env.MODEL_NAME : "gemini-2.5-flash");
      providers.push({
        name: "gemini",
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        defaultModel: geminiModel
      });
    }

    // 4. OpenAI direct
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes("dummy")) {
      const openaiModel = process.env.OPENAI_MODEL ||
        (process.env.MODEL_NAME?.startsWith("gpt") ? process.env.MODEL_NAME : "gpt-4o-mini");
      providers.push({
        name: "openai",
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
        defaultModel: openaiModel
      });
    }

    // 5. OrcaRouter gateway (ORCAROUTER_MODEL can pin the free tier, e.g. orcarouter/free)
    if (process.env.ORCAROUTER_API_KEY && !process.env.ORCAROUTER_API_KEY.includes("dummy")) {
      const orcaModel = process.env.ORCAROUTER_MODEL ||
        (process.env.MODEL_NAME && process.env.MODEL_NAME !== "orcarouter/auto" ? process.env.MODEL_NAME : "orcarouter/free");
      providers.push({
        name: "orcarouter",
        apiKey: process.env.ORCAROUTER_API_KEY,
        baseURL: "https://api.orcarouter.ai/v1",
        defaultModel: orcaModel
      });
    }

    // 6. Local OpenAI-compatible endpoint (Ollama / vLLM / LMStudio)
    if (process.env.LOCAL_LLM_URL || process.env.OLLAMA_URL) {
      providers.push({
        name: "local",
        apiKey: "local-no-key",
        baseURL: process.env.LOCAL_LLM_URL || process.env.OLLAMA_URL || "http://localhost:11434/v1",
        defaultModel: process.env.MODEL_NAME || "deepseek-r1"
      });
    }
  }

  // 7. Generic pluggable CLI bridge — executes external command if configured
  if ((forceCli || !forceApi) && cliAvailable()) {
    providers.push({
      name: "custom-cli",
      apiKey: "none",
      baseURL: "",
      defaultModel: process.env.LLM_MODEL || "custom-cli-model",
      kind: "cli"
    });
  }

  return providers;
}

let lastSuccessfulProvider = "";
let lastSuccessfulModel = "";

export function getLLMStatus(): {
  hasLiveLLM: boolean;
  activeProvider: string;
  activeModel: string;
  configuredProviders: string[];
} {
  const providers = resolveProviders();
  if (providers.length === 0) {
    return {
      hasLiveLLM: false,
      activeProvider: "heuristic-offline",
      activeModel: "none",
      configuredProviders: []
    };
  }
  return {
    hasLiveLLM: true,
    activeProvider: lastSuccessfulProvider || providers[0].name,
    activeModel: lastSuccessfulModel || providers[0].defaultModel,
    configuredProviders: providers.map(p => p.name)
  };
}

/**
 * Execute one completion turn through a generic external CLI command.
 * The command is configured via LLM_CLI_CMD (e.g. `ollama run llama3`).
 * The combined prompt is passed as an argument.
 */
async function runGenericCliTurn(
  provider: LLMProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  options: LLMGenerateOptions
): Promise<string> {
  const prompt = `${systemPrompt.trim()}\n\n---\n\n${userPrompt.trim()}`;
  const cliCmd = process.env.LLM_CLI_CMD;
  if (!cliCmd) {
    throw new Error("No LLM_CLI_CMD configured for CLI execution");
  }

  const timeoutS = Number.parseInt(process.env.LLM_CLI_TIMEOUT_S || "120", 10) || 120;
  const parts = cliCmd.trim().split(/\s+/);
  const binary = parts[0];
  const baseArgs = parts.slice(1);

  const { stdout } = await execFileAsync(binary, [...baseArgs, prompt], {
    timeout: (timeoutS + 15) * 1000,
    maxBuffer: 8 * 1024 * 1024
  });

  if (stdout && stdout.trim()) {
    lastSuccessfulModel = options.model || provider.defaultModel;
    return stdout;
  }
  throw new Error("CLI LLM command returned empty response");
}

// Rotation state. Providers that have answered recently share the load (free tiers enforce per-minute
// limits); providers that fail are benched with an escalating cooldown, and bad credentials (401/403)
// are benched for an hour so a dead key stops costing a failed request on every call.
const PROVIDER_COOLDOWN_MS = 60_000;
const AUTH_COOLDOWN_MS = 60 * 60_000;
const MAX_COOLDOWN_MS = 15 * 60_000;
const PROVEN_WINDOW_MS = 30 * 60_000;
const providerCooldowns = new Map<string, number>();
const providerFailures = new Map<string, number>();
const providerLastOk = new Map<string, number>();
let rotationCursor = 0;

function providerHealthy(name: string): boolean {
  const until = providerCooldowns.get(name) || 0;
  return Date.now() >= until;
}

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /\((401|403)\)|invalid[_ ]api[_ ]key|user not found|unauthori[sz]ed/i.test(msg);
}

function markProviderUnhealthy(name: string, err?: unknown): void {
  const failures = (providerFailures.get(name) || 0) + 1;
  providerFailures.set(name, failures);
  const cooldown = isAuthError(err)
    ? AUTH_COOLDOWN_MS
    : Math.min(MAX_COOLDOWN_MS, PROVIDER_COOLDOWN_MS * 2 ** Math.min(failures - 1, 4));
  providerCooldowns.set(name, Date.now() + cooldown);
}

function markProviderOk(name: string): void {
  providerFailures.set(name, 0);
  providerCooldowns.delete(name);
  providerLastOk.set(name, Date.now());
}

/** Test hook: forget all provider health state. */
export function resetProviderHealth(): void {
  providerCooldowns.clear();
  providerFailures.clear();
  providerLastOk.clear();
  rotationCursor = 0;
}

/** Proven providers first (round-robin among them), then untried ones in configured order, benched ones last. */
function rotationOrder(providers: LLMProviderConfig[]): LLMProviderConfig[] {
  const healthy = providers.filter((p) => providerHealthy(p.name));
  const cooling = providers.filter((p) => !providerHealthy(p.name));
  if (healthy.length === 0) return providers; // everything benched — try anyway rather than give up
  const now = Date.now();
  const proven = healthy.filter((p) => now - (providerLastOk.get(p.name) || 0) < PROVEN_WINDOW_MS);
  const untried = healthy.filter((p) => !proven.includes(p));
  const start = proven.length ? rotationCursor % proven.length : 0;
  rotationCursor = (rotationCursor + 1) % Math.max(1, proven.length || 1);
  return [...proven.slice(start), ...proven.slice(0, start), ...untried, ...cooling];
}

async function fetchChatCompletion(
  provider: LLMProviderConfig,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: LLMGenerateOptions
): Promise<string> {
  const url = `${provider.baseURL.replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
      ...(provider.extraHeaders || {})
    },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 2500,
      response_format: options.jsonMode ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    }),
    signal: requestSignal(25000)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM ${provider.name} (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    choices?: Array<{ message?: { content?: string } }>;
  };
  recordUsage(provider.name, model, json.usage?.prompt_tokens, json.usage?.completion_tokens);
  return json.choices?.[0]?.message?.content || "";
}

/** Responses-API turn (POST /responses). Reasoning tokens count against the output budget, so leave headroom. */
async function fetchResponsesTurn(
  provider: LLMProviderConfig,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: LLMGenerateOptions
): Promise<string> {
  const url = `${provider.baseURL.replace(/\/+$/, "")}/responses`;
  const instructions = options.jsonMode
    ? `${systemPrompt}\n\nRespond with a single valid JSON object and no other text.`
    : systemPrompt;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
      ...(provider.extraHeaders || {})
    },
    body: JSON.stringify({
      model,
      instructions,
      input: [{ role: "user", content: [{ type: "input_text", text: userPrompt }] }],
      temperature: options.temperature ?? 0.7,
      max_output_tokens: Math.min(32000, (options.maxTokens || 2500) + 14000),
      stream: false
    }),
    signal: requestSignal(90000)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM ${provider.name} (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: unknown;
    status?: string;
    incomplete_details?: { reason?: string };
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };
  recordUsage(provider.name, model, json.usage?.input_tokens, json.usage?.output_tokens);
  if (json.error) throw new Error(`LLM ${provider.name}: ${JSON.stringify(json.error).slice(0, 300)}`);
  const text = (json.output || [])
    .filter((item) => item?.type === "message")
    .flatMap((item) => item.content || [])
    .filter((part) => part?.type === "output_text")
    .map((part) => part.text || "")
    .join("");
  // A truncated answer is a failed answer: partial JSON would parse as garbage or not at all.
  if (json.status === "incomplete") {
    throw new Error(`LLM ${provider.name}: response incomplete (${json.incomplete_details?.reason || "unknown"})`);
  }
  return text;
}

async function fetchChatStream(
  provider: LLMProviderConfig,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  options: LLMGenerateOptions,
  onChunk: (text: string) => void
): Promise<string> {
  const url = `${provider.baseURL.replace(/\/+$/, "")}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
      ...(provider.extraHeaders || {})
    },
    body: JSON.stringify({
      model,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || 2500,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    }),
    signal: requestSignal(25000)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM ${provider.name} (${res.status}): ${errText.slice(0, 300)}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body to stream");
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return full;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content || "";
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
    // Ignore unreadable or missing .env file
  }
    }
  }

  if (buffer.trim().startsWith("data:")) {
    const data = buffer.trim().slice(5).trim();
    if (data !== "[DONE]") {
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content || "";
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      } catch {
    // Ignore unreadable or missing .env file
  }
    }
  }

  return full;
}

/**
 * Streaming variant: emits text deltas via onChunk as they arrive and returns
 * the full text. CLI providers stream as one buffered chunk; API providers
 * stream token-by-token.
 */
export async function streamAgentTurn(
  systemPrompt: string,
  userPrompt: string,
  options: LLMGenerateOptions,
  onChunk: (text: string) => void
): Promise<string> {
  const providers = resolveProviders();

  if (providers.length === 0) {
    throw new Error("No live LLM configured (API keys, LLM_BASE_URL, LOCAL_LLM_URL, or LLM_CLI_CMD)");
  }

  const errors: string[] = [];

  for (const provider of rotationOrder(providers)) {
    try {
      if (provider.kind === "cli") {
        const text = await runGenericCliTurn(provider, systemPrompt, userPrompt, options);
        if (text.trim()) {
          lastSuccessfulProvider = provider.name;
          lastSuccessfulModel = options.model || provider.defaultModel;
          markProviderOk(provider.name);
          onChunk(text);
          return text;
        }
        throw new Error("CLI provider returned empty response");
      }

      const model = (options.model && (options.model.startsWith(provider.name) || !options.model.includes("/")))
        ? options.model
        : provider.defaultModel;

      if (provider.kind === "responses") {
        const text = await fetchResponsesTurn(provider, model, systemPrompt, userPrompt, options);
        if (text.trim()) {
          lastSuccessfulProvider = provider.name;
          lastSuccessfulModel = model;
          markProviderOk(provider.name);
          onChunk(text);
          return text;
        }
        throw new Error(`provider ${provider.name} returned nothing`);
      }

      const full = await fetchChatStream(provider, model, systemPrompt, userPrompt, options, onChunk);
      if (full.trim()) {
        lastSuccessfulProvider = provider.name;
        lastSuccessfulModel = model;
        markProviderOk(provider.name);
        return full;
      }
      throw new Error(`provider ${provider.name} streamed nothing`);
    } catch (err: unknown) {
      markProviderUnhealthy(provider.name, err);
      recordFailure();
      const errObj = err as { cause?: { code?: string }; message?: string } | null;
      errors.push(`${provider.name}: ${(errObj?.cause?.code || errObj?.message || "error").toString().slice(0, 160)}`);
    }
  }

  throw new Error(`All LLM providers failed to stream — ${errors.join(" | ")}`);
}

/**
 * Execute an LLM completion turn across available providers.
 * Round-robin rotation spreads load over free tiers; automatic fallback moves
 * to the next healthy provider on any failure or empty response.
 */
export async function generateAgentTurnDetailed(
  systemPrompt: string,
  userPrompt: string,
  options: LLMGenerateOptions = {}
): Promise<{ text: string; provider: string; model: string }> {
  const providers = resolveProviders();

  if (providers.length === 0) {
    throw new Error("No live LLM configured (API keys, LLM_BASE_URL, LOCAL_LLM_URL, or LLM_CLI_CMD)");
  }

  const cacheEnabled = process.env.DOSSIER_RESPONSE_CACHE === "1";
  const cacheKey = cacheEnabled ? responseCacheKey(systemPrompt, userPrompt, options) : null;
  if (cacheKey) {
    const hit = responseCacheGet(cacheKey);
    if (hit) {
      const u = usageStore.getStore();
      if (u) u.cacheHits += 1;
      return { text: hit.text, provider: hit.provider, model: hit.model };
    }
  }

  // A cache hit costs nothing, so the budget is enforced only for calls that would hit the API.
  enforceEvaluationBudget();

  const errors: string[] = [];

  for (const provider of rotationOrder(providers)) {
    try {
      let content: string;
      let usedModel = provider.defaultModel;
      if (provider.kind === "cli") {
        content = await runGenericCliTurn(provider, systemPrompt, userPrompt, options);
        usedModel = options.model || provider.defaultModel;
      } else {
        const model = (options.model && (options.model.startsWith(provider.name) || !options.model.includes("/")))
          ? options.model
          : provider.defaultModel;
        usedModel = model;

        content = provider.kind === "responses"
          ? await fetchResponsesTurn(provider, model, systemPrompt, userPrompt, options)
          : await fetchChatCompletion(provider, model, systemPrompt, userPrompt, options);
      }

      if (content.trim()) {
        lastSuccessfulProvider = provider.name;
        lastSuccessfulModel = usedModel;
        markProviderOk(provider.name);
        if (cacheKey) responseCachePut(cacheKey, { text: content, provider: provider.name, model: usedModel, createdAt: new Date().toISOString() });
        return { text: content, provider: provider.name, model: usedModel };
      }
      errors.push(`${provider.name}: empty response`);
      recordFailure();
      markProviderUnhealthy(provider.name, "empty response"); // empty response — treat as unhealthy, rotate
    } catch (err: unknown) {
      const errObj = err as { cause?: { code?: string }; message?: string } | null;
      errors.push(`${provider.name}: ${(errObj?.cause?.code || errObj?.message || "error").toString().slice(0, 160)}`);
      recordFailure();
      markProviderUnhealthy(provider.name, err); // error (rate limit, 402, timeout, bad key) — cooldown, rotate
    }
  }

  throw new Error(`All LLM providers failed — ${errors.join(" | ")}`);
}

export async function generateAgentTurn(
  systemPrompt: string,
  userPrompt: string,
  options: LLMGenerateOptions = {}
): Promise<string> {
  return (await generateAgentTurnDetailed(systemPrompt, userPrompt, options)).text;
}

export interface ProviderModelList {
  provider: string;
  baseURL: string;
  configuredModel: string;
  /** true when the configured model appears in the provider's own model list. */
  configuredModelListed: boolean | null;
  models: string[];
  error?: string;
}

/**
 * Read-only diagnostic: asks each configured provider which models this key can use.
 * Answers the question a 404 "model_not_found" leaves open — is the model missing, or does
 * this key simply not have access? Never returns or logs the key.
 */
export async function listProviderModels(): Promise<ProviderModelList[]> {
  const out: ProviderModelList[] = [];
  for (const provider of resolveProviders()) {
    if (provider.kind === "cli") {
      out.push({ provider: provider.name, baseURL: "cli", configuredModel: provider.defaultModel, configuredModelListed: null, models: [], error: "CLI provider: model listing not applicable" });
      continue;
    }
    const url = `${provider.baseURL.replace(/\/+$/, "")}/models`;
    try {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${provider.apiKey}`, ...(provider.extraHeaders ?? {}) },
        signal: AbortSignal.timeout(15_000)
      });
      if (!resp.ok) {
        out.push({ provider: provider.name, baseURL: provider.baseURL, configuredModel: provider.defaultModel, configuredModelListed: null, models: [], error: `HTTP ${resp.status}` });
        continue;
      }
      const json = (await resp.json()) as {
        data?: Array<string | { id?: string; name?: string }>;
        models?: Array<string | { id?: string; name?: string }>;
      };
      const models: string[] = (Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [])
        .map((m) => (typeof m === "string" ? m : m?.id ?? m?.name))
        .filter((m): m is string => typeof m === "string");
      out.push({
        provider: provider.name,
        baseURL: provider.baseURL,
        configuredModel: provider.defaultModel,
        configuredModelListed: models.length ? models.includes(provider.defaultModel) : null,
        models: models.slice(0, 100)
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "request failed";
      out.push({ provider: provider.name, baseURL: provider.baseURL, configuredModel: provider.defaultModel, configuredModelListed: null, models: [], error: msg.slice(0, 160) });
    }
  }
  return out;
}
