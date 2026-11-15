/**
 * Deterministic extraction of revenue inputs from the free-text `monetization` field.
 * Auditable by construction: every result carries the matched text, and anything it
 * cannot parse is reported as such rather than guessed.
 */

export type MonetizationModel = "subscription" | "take_rate" | "license" | "one_time" | "unknown";

export interface ParsedMonetization {
  model: MonetizationModel;
  /** Revenue per paying customer per month in USD, when the text states a price. */
  monthlyUsd?: number;
  /** Commission or take rate in percent, for marketplace-style models. */
  takeRatePct?: number;
  /** The text fragment the numbers were read from. */
  evidence?: string;
}

// Fixed reference rates (USD per unit). Rough on purpose: the point is order of magnitude, not FX accuracy.
const USD_PER: Record<string, number> = { usd: 1, inr: 1 / 83, eur: 1.08, gbp: 1.27 };

const CURRENCY_TOKEN = String.raw`(?:\$|usd|us\$|₹|rs\.?|inr|€|eur|£|gbp)`;
const AMOUNT = String.raw`(\d[\d,]*(?:\.\d+)?)\s*(k|m)?`;

function currencyOf(token: string): keyof typeof USD_PER {
  const t = token.toLowerCase();
  if (t === "₹" || t.startsWith("rs") || t === "inr") return "inr";
  if (t === "€" || t === "eur") return "eur";
  if (t === "£" || t === "gbp") return "gbp";
  return "usd";
}

function periodMultiplier(fragment: string): number | undefined {
  const f = fragment.toLowerCase();
  if (/(one[- ]time|lifetime|upfront|per project)/.test(f)) return undefined;
  if (/(\/\s*(?:yr|year)|per\s+(?:\w+\s+)*?(?:yr|year)|annual|annually|yearly|p\.a\.|\ba year\b)/.test(f)) return 1 / 12;
  if (/(\/\s*(?:wk|week)|per\s+(?:\w+\s+)*?week|weekly)/.test(f)) return 52 / 12;
  if (/(\/\s*(?:mo|month)|per\s+(?:\w+\s+)*?month|monthly|\ba month\b)/.test(f)) return 1;
  return undefined;
}

export function parseMonetization(text: string | undefined): ParsedMonetization {
  const raw = (text ?? "").trim();
  if (!raw) return { model: "unknown" };

  // Take rate / commission: "12% take rate", "10% commission", "2% of GMV"
  const take = raw.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of\s+\w+\s+)?(?:take[- ]?rate|commission|fee|cut|of (?:gmv|transaction|sales|volume))/i)
    ?? raw.match(/(?:take[- ]?rate|commission)\s*(?:of|:)?\s*(\d+(?:\.\d+)?)\s*%/i);
  const perTxn = take ? null : raw.match(/(\d+(?:\.\d+)?)\s*%[^.;]{0,40}?\b(?:transaction|booking|sale|order|payment|milestone|rental|purchase)s?\b/i);
  if (!take && perTxn) {
    return { model: "take_rate", takeRatePct: Number(perTxn[1]), evidence: perTxn[0] };
  }
  if (take) {
    return { model: "take_rate", takeRatePct: Number(take[1]), evidence: take[0] };
  }

  // Priced: "$15/month per store", "₹499 per month", "$1,200 per district per year", "$5/mo freemium"
  const priced = new RegExp(`(${CURRENCY_TOKEN})\\s*${AMOUNT}(.{0,40})|${AMOUNT}\\s*(${CURRENCY_TOKEN})(.{0,40})`, "i").exec(raw);
  if (priced) {
    const token = priced[1] ?? priced[7];
    const numStr = priced[2] ?? priced[5];
    const suffix = (priced[3] ?? priced[6] ?? "").toLowerCase();
    const tail = priced[4] ?? priced[8] ?? "";
    let amount = Number(numStr.replace(/,/g, ""));
    if (suffix === "k") amount *= 1_000;
    if (suffix === "m") amount *= 1_000_000;
    const usd = amount * USD_PER[currencyOf(token)];
    const fragment = priced[0];
    const mult = periodMultiplier(`${fragment} ${tail}`);
    if (mult === undefined) {
      // A price with no billing period is a one-off charge only if the text says so; otherwise it is ambiguous.
      return { model: /(one[- ]time|lifetime|upfront|device|unit|hardware|license)/i.test(raw) ? "one_time" : "unknown", evidence: fragment };
    }
    const monthly = Math.round(usd * mult * 100) / 100;
    if (monthly > 0) return { model: "subscription", monthlyUsd: monthly, evidence: fragment };
  }

  return { model: "unknown" };
}
