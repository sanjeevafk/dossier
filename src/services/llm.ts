import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

export interface LLMProviderConfig {
  name: string;
  apiKey: string;
  baseURL: string;
  defaultModel: string;
}

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Resolve ordered candidate providers from environment variables.
 */
function resolveProviders(): LLMProviderConfig[] {
  const providers: LLMProviderConfig[] = [];

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

// Backward-compatible default client
const defaultProviders = resolveProviders();
const primary = defaultProviders[0] || {
  name: "fallback",
  apiKey: "dummy-key",
  baseURL: "https://api.orcarouter.ai/v1",
  defaultModel: "orcarouter/auto"
};

export const llmClient = new OpenAI({
  baseURL: primary.baseURL,
  apiKey: primary.apiKey,
  timeout: 15000,
  maxRetries: 1
});

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
    throw new Error("No live LLM API keys configured (GEMINI_API_KEY, OPENAI_API_KEY, or ORCAROUTER_API_KEY)");
  }

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
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

      const content = response.choices[0]?.message?.content || "";
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
