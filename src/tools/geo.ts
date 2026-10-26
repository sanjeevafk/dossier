export interface GeoJurisdiction {
  countryCode: string; // ISO 3166-1 alpha-2 (e.g. "IN", "US", "GB", "DE", "BR", "SG", "NG")
  regionName: string;
  currency: string;
  regulatoryFramework: string;
  googleNewsLocale: {
    gl: string;
    ceid: string;
    hl: string;
  };
  worldBankCountry: string;
  preferredCommunityChannels: Array<"hackernews" | "v2ex" | "reddit" | "rss">;
}

/**
 * Infer the targeted regulatory, economic, and regional jurisdiction from an idea's
 * target audience, summary, and title.
 */
export function detectJurisdiction(
  targetAudience: string = "",
  summary: string = "",
  title: string = ""
): GeoJurisdiction {
  const combined = `${targetAudience} ${summary} ${title}`.toLowerCase();

  // 1. India / South Asia
  if (/\b(india|indian|bharat|delhi|mumbai|bangalore|bengaluru|kirana|asha|upi|rbi|cdsco|ayushman)\b/i.test(combined)) {
    return {
      countryCode: "IN",
      regionName: "India",
      currency: "INR",
      regulatoryFramework: "India Digital Personal Data Protection (DPDP) Act, RBI Digital Lending Guidelines",
      googleNewsLocale: { gl: "IN", ceid: "IN:en", hl: "en-IN" },
      worldBankCountry: "IN",
      preferredCommunityChannels: ["hackernews", "rss"]
    };
  }

  // 2. United Kingdom
  if (/\b(uk|united kingdom|britain|british|london|england|scotland|nhs|fca|mhra)\b/i.test(combined)) {
    return {
      countryCode: "GB",
      regionName: "United Kingdom",
      currency: "GBP",
      regulatoryFramework: "UK Data Protection Act, FCA / MHRA Digital Health Governance",
      googleNewsLocale: { gl: "GB", ceid: "GB:en", hl: "en-GB" },
      worldBankCountry: "GB",
      preferredCommunityChannels: ["hackernews", "rss"]
    };
  }

  // 3. European Union / Continental Europe
  if (/\b(europe|european|eu|germany|german|france|french|berlin|paris|amsterdam|gdpr|ce mark|ai act)\b/i.test(combined)) {
    return {
      countryCode: "EU",
      regionName: "European Union",
      currency: "EUR",
      regulatoryFramework: "EU Artificial Intelligence Act (EU AI Act), GDPR, CE Mark Medical/Software Directives",
      googleNewsLocale: { gl: "DE", ceid: "DE:en", hl: "en" },
      worldBankCountry: "EU",
      preferredCommunityChannels: ["hackernews", "rss"]
    };
  }

  // 4. Brazil & Latin America
  if (/\b(brazil|brasil|brazilian|sao paulo|latam|latin america|lgpd|bacen|anvisa)\b/i.test(combined)) {
    return {
      countryCode: "BR",
      regionName: "Brazil (LATAM)",
      currency: "BRL",
      regulatoryFramework: "Brazil LGPD (General Data Protection Law), BACEN / ANVISA Regulatory Frameworks",
      googleNewsLocale: { gl: "BR", ceid: "BR:pt-419", hl: "pt-BR" },
      worldBankCountry: "BR",
      preferredCommunityChannels: ["hackernews", "rss"]
    };
  }

  // 5. Singapore & Southeast Asia / APAC
  if (/\b(singapore|asean|southeast asia|apac|mas sandbox|pdpa|hong kong)\b/i.test(combined)) {
    return {
      countryCode: "SG",
      regionName: "Singapore (APAC)",
      currency: "SGD",
      regulatoryFramework: "Singapore Personal Data Protection Act (PDPA), MAS Regulatory Sandbox",
      googleNewsLocale: { gl: "SG", ceid: "SG:en", hl: "en-SG" },
      worldBankCountry: "SG",
      preferredCommunityChannels: ["hackernews", "v2ex"]
    };
  }

  // 6. China / East Asia
  if (/\b(china|chinese|beijing|shanghai|shenzhen|wechat|bilibili|v2ex)\b/i.test(combined)) {
    return {
      countryCode: "CN",
      regionName: "China (East Asia)",
      currency: "CNY",
      regulatoryFramework: "CAC Generative AI Service Interim Measures, PIPL (Personal Information Protection Law)",
      googleNewsLocale: { gl: "HK", ceid: "HK:en", hl: "en-HK" },
      worldBankCountry: "CN",
      preferredCommunityChannels: ["v2ex", "hackernews"]
    };
  }

  // 7. Sub-Saharan Africa
  if (/\b(nigeria|nigerian|kenya|kenyan|lagos|nairobi|ghana|africa|african|cbn|nafdac)\b/i.test(combined)) {
    return {
      countryCode: "NG",
      regionName: "Nigeria (Sub-Saharan Africa)",
      currency: "NGN",
      regulatoryFramework: "Nigeria Data Protection Act (NDPA), CBN Fintech Regulatory Sandbox",
      googleNewsLocale: { gl: "NG", ceid: "NG:en", hl: "en-NG" },
      worldBankCountry: "NG",
      preferredCommunityChannels: ["hackernews", "rss"]
    };
  }

  // 8. Default: United States / Global
  return {
    countryCode: "US",
    regionName: "United States (Global)",
    currency: "USD",
    regulatoryFramework: "US Federal Trade Commission (FTC), SEC Regulations, NIST AI Risk Management Framework",
    googleNewsLocale: { gl: "US", ceid: "US:en", hl: "en-US" },
    worldBankCountry: "US",
    preferredCommunityChannels: ["hackernews", "rss"]
  };
}
