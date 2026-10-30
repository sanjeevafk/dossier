import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
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
  } catch {}
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
  kind?: "api" | "cli";
  extraHeaders?: Record<string, string>;
}

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
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

// Backward-compatible default client stub
const defaultProviders = resolveProviders();
const primary = defaultProviders[0] || {
  name: "fallback",
  apiKey: "dummy-key",
  baseURL: "https://api.orcarouter.ai/v1",
  defaultModel: "orcarouter/auto"
};

export const llmClient = {
  baseURL: primary.baseURL || "https://api.orcarouter.ai/v1",
  apiKey: primary.apiKey
};

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
    signal: AbortSignal.timeout(25000)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM ${provider.name} (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json: any = await res.json();
  return json.choices?.[0]?.message?.content || "";
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
    signal: AbortSignal.timeout(25000)
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
      } catch {}
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
      } catch {}
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

  let lastError: Error | null = null;

  for (const provider of rotationOrder(providers)) {
    try {
      if (provider.kind === "cli") {
        const text = await runGenericCliTurn(provider, systemPrompt, userPrompt, options);
        if (text.trim()) {
          onChunk(text);
          return text;
        }
        throw new Error("CLI provider returned empty response");
      }

      const model = (options.model && (options.model.startsWith(provider.name) || !options.model.includes("/")))
        ? options.model
        : provider.defaultModel;

      const full = await fetchChatStream(provider, model, systemPrompt, userPrompt, options, onChunk);
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
    throw new Error("No live LLM configured (API keys, LLM_BASE_URL, LOCAL_LLM_URL, or LLM_CLI_CMD)");
  }

  let lastError: Error | null = null;

  for (const provider of rotationOrder(providers)) {
    try {
      let content: string;
      if (provider.kind === "cli") {
        content = await runGenericCliTurn(provider, systemPrompt, userPrompt, options);
      } else {
        const model = (options.model && (options.model.startsWith(provider.name) || !options.model.includes("/")))
          ? options.model
          : provider.defaultModel;

        content = await fetchChatCompletion(provider, model, systemPrompt, userPrompt, options);
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
