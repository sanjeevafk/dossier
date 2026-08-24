import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.ORCAROUTER_API_KEY || process.env.OPENAI_API_KEY || "";
const baseURL = process.env.OPENAI_BASE_URL || "https://api.orcarouter.ai/v1";
const defaultModel = process.env.MODEL_NAME || "orcarouter/auto";

export const llmClient = new OpenAI({
  baseURL,
  apiKey: apiKey || "dummy-key",
  timeout: 12000,
  maxRetries: 1
});

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Execute an LLM completion turn via OrcaRouter (or OpenAI-compatible endpoint).
 */
export async function generateAgentTurn(
  systemPrompt: string,
  userPrompt: string,
  options: LLMGenerateOptions = {}
): Promise<string> {
  const model = options.model || defaultModel;
  const temperature = options.temperature ?? 0.7;

  if (!apiKey || apiKey === "dummy-key") {
    throw new Error("Missing ORCAROUTER_API_KEY in environment");
  }

  const response = await llmClient.chat.completions.create({
    model,
    temperature,
    max_tokens: options.maxTokens || 1500,
    response_format: options.jsonMode ? { type: "json_object" } : undefined,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });

  return response.choices[0]?.message?.content || "";
}
