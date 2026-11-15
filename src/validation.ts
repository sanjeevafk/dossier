import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();

// Accepts numbers or numeric strings; treats ""/null/0 as "not provided" (matches prior behaviour).
const optionalAmount = z.preprocess(
  (v) => (v === "" || v === null || v === 0 || v === "0" ? undefined : typeof v === "string" ? Number(v) : v),
  z.number().finite().positive().max(1e9).optional()
);

export const evaluateSchema = z.object({
  title: z.string({ error: "Missing required fields: 'title' and 'summary'" }).trim().min(1, "Missing required fields: 'title' and 'summary'").max(200, "'title' must be at most 200 characters"),
  summary: z.string({ error: "Missing required fields: 'title' and 'summary'" }).trim().min(1, "Missing required fields: 'title' and 'summary'").max(5000, "'summary' must be at most 5000 characters"),
  targetAudience: optionalText(500),
  monetization: optionalText(500),
  pricingMonthlyUsd: optionalAmount,
  estimatedCacUsd: optionalAmount,
  useLiveLLM: z.boolean().optional()
});

const ROLES = ["all", "skeptic", "market", "founder", "analyst", "customer", "architect", "investor", "redteam", "expert", "synthesizer"] as const;

export const chatSchema = z.object({
  message: z.string({ error: "Missing required field: 'message'" }).trim().min(1, "Missing required field: 'message'").max(4000, "'message' must be at most 4000 characters"),
  role: z.enum(ROLES, { error: `'role' must be one of: ${ROLES.join(", ")}` }).default("all"),
  ideaContext: z
    .object({
      title: optionalText(200),
      summary: optionalText(5000),
      targetAudience: optionalText(500),
      monetization: optionalText(500)
    })
    .optional()
});

export const outcomeSchema = z.object({
  outcome: z.enum(["built", "killed", "pivoted"], { error: "outcome must be one of: built | killed | pivoted" }),
  revenueUsd: z.number().finite().min(0).max(1e12).optional(),
  pilots: z.number().int().min(0).max(1e9).optional()
});

export const resolveSchema = z.object({
  outcome: z.boolean({ error: "Field 'outcome' must be a boolean (did the forecast hold?)" }),
  notes: z.string().max(2000).optional(),
  resolvedBy: z.string().max(200).optional()
});

/** Returns parsed data, or the first human-readable error message. */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): { ok: true; data: z.infer<S> } | { ok: false; error: string } {
  const result = schema.safeParse(body ?? {});
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "Invalid request body" };
}
