import OpenAI from "openai";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import dotenv from "dotenv";

dotenv.config();

const execFileAsync = promisify(execFile);

export interface LLMProviderConfig {
  name: string;
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  kind?: "api" | "cli";
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
    // 1. Google Gemini via OpenAI-compatible endpoint
    if (process.env.GEMINI_API_KEY) {
      const geminiModel = process.env.GEMINI_MODEL ||
        (process.env.MODEL_NAME?.startsWith("gemini") ? process.env.MODEL_NAME : "gemini-3.8-flash");
      providers.push({
        name: "gemini",
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        defaultModel: geminiModel
      });
    }

    // 2. OpenAI direct
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

    // 3. OrcaRouter gateway
    if (process.env.ORCAROUTER_API_KEY && !process.env.ORCAROUTER_API_KEY.includes("dummy")) {
      providers.push({
        name: "orcarouter",
        apiKey: process.env.ORCAROUTER_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL || "https://api.orcarouter.ai/v1",
        defaultModel: process.env.ORCAROUTER_MODEL || process.env.MODEL_NAME || "orcarouter/auto"
      });
    }

    // 4. Local OpenAI-compatible endpoint (Ollama / vLLM / LMStudio)
    if (process.env.LOCAL_LLM_URL || process.env.OLLAMA_URL) {
      providers.push({
        name: "local",
        apiKey: "local-no-key",
        baseURL: process.env.LOCAL_LLM_URL || process.env.OLLAMA_URL || "http://localhost:11434/v1",
        defaultModel: process.env.MODEL_NAME || "deepseek-r1"
      });
    }
  }

  // 5. Authenticated agy CLI — works with zero API keys when `agy` is installed
  // and logged in. Forced by DOSSIER_LLM_BACKEND=agy, or used as the no-key fallback.
  if ((forceCli || (!forceApi && providers.length === 0)) && agyAvailable()) {
    providers.push({
      name: "agy-cli",
      apiKey: "none",
      baseURL: "",
      defaultModel: process.env.AGY_MODEL || "gemini-3.8-flash-medium",
      kind: "cli"
    });
  }

  return providers;
}

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
    activeProvider: providers[0].name,
    activeModel: providers[0].defaultModel,
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
  const args = [
    "-p", prompt,
    "--disable-slash-commands",
    "--print-timeout", `${AGY_PRINT_TIMEOUT_S}s`,
    "--model", options.model || provider.defaultModel
  ];
  const { stdout } = await execFileAsync("agy", args, {
    timeout: (AGY_PRINT_TIMEOUT_S + 30) * 1000,
    maxBuffer: 8 * 1024 * 1024
  });
  return stdout;
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

/**
 * Streaming variant: emits text deltas via onChunk as they arrive and returns
 * the full text. CLI (agy) providers stream as one buffered chunk; API providers
 * stream token-by-token. Fails over across the provider chain like
 * generateAgentTurn, but a mid-stream failure surfaces to the caller (partial
 * output may already have been emitted).
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

  for (const provider of providers) {
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
        maxRetries: 1
      });
      const model = options.model || provider.defaultModel;
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
      lastError = err;
      // Continue to next provider in failover chain
    }
  }

  throw lastError || new Error("All configured LLM providers failed to stream a completion");
}

/**
 * Execute an LLM completion turn across available providers with graceful failover.
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

  for (const provider of providers) {
    try {
      let content: string;
      if (provider.kind === "cli") {
        content = await runAgyCliTurn(provider, systemPrompt, userPrompt, options);
      } else {
        const client = new OpenAI({
          baseURL: provider.baseURL,
          apiKey: provider.apiKey,
          timeout: 25000,
          maxRetries: 1
        });

        const model = options.model || provider.defaultModel;
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
        return content;
      }
    } catch (err: any) {
      lastError = err;
      // Continue to next provider in failover chain
    }
  }

  throw lastError || new Error("All configured LLM providers failed to generate completion");
}
