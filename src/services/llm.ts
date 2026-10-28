import OpenAI from "openai";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();
const packageEnv = path.resolve(import.meta.dirname, "..", "..", ".env");
if (fs.existsSync(packageEnv)) {
  dotenv.config({ path: packageEnv, override: false });
}

const execFileAsync = promisify(execFile);

export interface LLMProviderConfig {
  name: string;
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  kind?: "api" | "cli";
  extraHeaders?: Record<string, string>;
}

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

const AGY_PRINT_TIMEOUT_S = Number.parseInt(process.env.AGY_PRINT_TIMEOUT_S || "120", 10) || 120;
let agyAvailableCache: boolean | null = null;

/**
 * Detect the authenticated `agy` CLI once; result is cached for the process.
 */
function agyAvailable(): boolean {
  if (agyAvailableCache !== null) return agyAvailableCache;
  try {
    execFileSyncSafe();
    agyAvailableCache = true;
  } catch {
    agyAvailableCache = false;
  }
  return agyAvailableCache;
}

function execFileSyncSafe(): void {
  // Minimal spawn probe: throws if the binary is missing or unusable.
  execFileSync("agy", ["--help"], { timeout: 10000, stdio: "ignore" });
}

/**
 * Resolve ordered candidate providers from environment variables.
 *
 * Backend selection via DOSSIER_LLM_BACKEND:
 *  - "agy"      → force the authenticated agy CLI (subscription quota, no API keys)
 *  - "api"      → force API-key providers only
 *  - unset      → API keys if present, otherwise agy CLI if installed, otherwise heuristic
 */
function resolveProviders(): LLMProviderConfig[] {
  const providers: LLMProviderConfig[] = [];
  const backend = (process.env.DOSSIER_LLM_BACKEND || "").trim().toLowerCase();
  const forceCli = backend === "agy";
  const forceApi = backend === "api" || backend === "llm";

  if (!forceCli) {
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

  // 7. Authenticated agy CLI — works with zero API keys or acts as fallback when APIs are cooling
  if ((forceCli || !forceApi) && agyAvailable()) {
    providers.push({
      name: "agy-cli",
      apiKey: "none",
      baseURL: "",
      defaultModel: process.env.AGY_MODEL || "gemini-3.8-flash-low",
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
 * Execute one completion turn through the authenticated agy CLI.
 * The system prompt and user prompt are merged into a single print-mode prompt;
 * JSON discipline comes from the caller's prompts (swarm extracts the {...} block).
 */
async function runAgyCliTurn(
  provider: LLMProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  options: LLMGenerateOptions
): Promise<string> {
  const prompt = `${systemPrompt.trim()}\n\n---\n\n${userPrompt.trim()}`;
  const targetModel = options.model || provider.defaultModel;
  const fallbackModels = ["gemini-3.8-flash-medium", "gemini-3.8-flash-high", "gpt-oss-120b-medium"];
  const candidateModels = [targetModel, ...fallbackModels.filter(m => m !== targetModel)];

  let lastErr: any = null;
  for (const model of candidateModels) {
    try {
      const args = [
        "-p", prompt,
        "--disable-slash-commands",
        "--print-timeout", `${AGY_PRINT_TIMEOUT_S}s`,
        "--model", model
      ];
      const { stdout } = await execFileAsync("agy", args, {
        timeout: (AGY_PRINT_TIMEOUT_S + 30) * 1000,
        maxBuffer: 8 * 1024 * 1024
      });
      if (stdout && stdout.trim()) {
        lastSuccessfulModel = model;
        return stdout;
      }
    } catch (err: any) {
      lastErr = err;
      const errMsg = String(err?.message || "");
      if (errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota reached") || errMsg.includes("429")) {
        // Quota exhausted on this model — seamlessly try next candidate model
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Backward-compatible default client
const defaultProviders = resolveProviders();
const primary = defaultProviders[0] || {
  name: "fallback",
  apiKey: "dummy-key",
  baseURL: "https://api.orcarouter.ai/v1",
  defaultModel: "orcarouter/auto"
};

export const llmClient = new OpenAI({
  baseURL: primary.baseURL || "https://api.orcarouter.ai/v1",
  apiKey: primary.apiKey,
  timeout: 15000,
  maxRetries: 1
});

// Rotation state: free tiers enforce per-minute limits, so consecutive turns
// spread across the healthy provider chain instead of hammering the first one.
// The order stays stable; failures mark a provider unhealthy until its cooldown.
const PROVIDER_COOLDOWN_MS = 60_000;
const providerCooldowns = new Map<string, number>();
let rotationCursor = 0;

function providerHealthy(name: string): boolean {
  const until = providerCooldowns.get(name) || 0;
  return Date.now() >= until;
}

function markProviderUnhealthy(name: string): void {
  providerCooldowns.set(name, Date.now() + PROVIDER_COOLDOWN_MS);
}

/** Ordered candidate list starting at the rotation cursor, unhealthy providers last. */
function rotationOrder(providers: LLMProviderConfig[]): LLMProviderConfig[] {
  const healthy = providers.filter((p) => providerHealthy(p.name));
  const cooling = providers.filter((p) => !providerHealthy(p.name));
  if (healthy.length === 0) return providers; // everything cooling — try anyway rather than give up
  const start = rotationCursor % healthy.length;
  rotationCursor = (rotationCursor + 1) % Math.max(1, healthy.length);
  return [...healthy.slice(start), ...healthy.slice(0, start), ...cooling];
}

/**
 * Streaming variant: emits text deltas via onChunk as they arrive and returns
 * the full text. CLI (agy) providers stream as one buffered chunk; API providers
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
    throw new Error("No live LLM configured (API keys, LOCAL_LLM_URL, or authenticated `agy` CLI)");
  }

  let lastError: Error | null = null;

  for (const provider of rotationOrder(providers)) {
    try {
      if (provider.kind === "cli") {
        const text = await runAgyCliTurn(provider, systemPrompt, userPrompt, options);
        if (text.trim()) {
          onChunk(text);
          return text;
        }
        throw new Error("agy returned empty response");
      }

      const client = new OpenAI({
        baseURL: provider.baseURL,
        apiKey: provider.apiKey,
        timeout: 25000,
        maxRetries: 1,
        defaultHeaders: provider.extraHeaders
      });
      const model = (options.model && (options.model.startsWith(provider.name) || !options.model.includes("/")))
        ? options.model
        : provider.defaultModel;
      const temperature = options.temperature ?? 0.7;

      const stream = await client.chat.completions.create({
        model,
        temperature,
        max_tokens: options.maxTokens || 2500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        stream: true
      });

      let full = "";
      for await (const part of stream) {
        const delta = part.choices?.[0]?.delta?.content || "";
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      }
      if (full.trim()) return full;
      throw new Error(`provider ${provider.name} streamed nothing`);
    } catch (err: any) {
      markProviderUnhealthy(provider.name);
      lastError = err;
    }
  }

  throw lastError || new Error("All configured LLM providers failed to stream a completion");
}

/**
 * Execute an LLM completion turn across available providers.
 * Round-robin rotation spreads load over free tiers; automatic fallback moves
 * to the next healthy provider on any failure or empty response.
 */
export async function generateAgentTurn(
  systemPrompt: string,
  userPrompt: string,
  options: LLMGenerateOptions = {}
): Promise<string> {
  const providers = resolveProviders();

  if (providers.length === 0) {
    throw new Error("No live LLM configured (API keys, LOCAL_LLM_URL, or authenticated `agy` CLI)");
  }

  let lastError: Error | null = null;

  for (const provider of rotationOrder(providers)) {
    try {
      let content: string;
      if (provider.kind === "cli") {
        content = await runAgyCliTurn(provider, systemPrompt, userPrompt, options);
      } else {
        const client = new OpenAI({
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
          timeout: 25000,
          maxRetries: 1,
          defaultHeaders: provider.extraHeaders
        });

        const model = (options.model && (options.model.startsWith(provider.name) || !options.model.includes("/")))
          ? options.model
          : provider.defaultModel;
        const temperature = options.temperature ?? 0.7;

        const response = await client.chat.completions.create({
          model,
          temperature,
          max_tokens: options.maxTokens || 2500,
          response_format: options.jsonMode ? { type: "json_object" } : undefined,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        });

        content = response.choices[0]?.message?.content || "";
      }

      if (content.trim()) {
        lastSuccessfulProvider = provider.name;
        lastSuccessfulModel = provider.kind === "cli" ? (options.model || provider.defaultModel) : (options.model || provider.defaultModel);
        return content;
      }
      markProviderUnhealthy(provider.name); // empty response — treat as unhealthy, rotate
    } catch (err: any) {
      lastError = err;
      markProviderUnhealthy(provider.name); // error (rate limit, 402, timeout) — cooldown, rotate
    }
  }

  throw lastError || new Error("All configured LLM providers failed to generate completion");
}
