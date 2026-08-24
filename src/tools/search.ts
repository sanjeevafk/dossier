export interface MarketCompetitor {
  name: string;
  url?: string;
  category: "direct" | "indirect" | "incumbent";
  strengths: string;
  vulnerability: string;
}

export interface ResearchFindings {
  query: string;
  identifiedCompetitors: MarketCompetitor[];
  marketSignals: string[];
  historicalFailures: string[];
}

/**
 * Market intelligence tool for querying competitors and historical comps.
 */
export async function performMarketResearch(ideaTitle: string, domainKeywords: string[]): Promise<ResearchFindings> {
  const query = `${ideaTitle} ${domainKeywords.join(" ")}`;
  
  // Synthetic market analyzer / MCP hook for competitor mapping
  const normalizedTitle = ideaTitle.toLowerCase();

  let competitors: MarketCompetitor[] = [];
  let signals: string[] = [];
  let historicalFailures: string[] = [];

  if (normalizedTitle.includes("agent") || normalizedTitle.includes("ai") || normalizedTitle.includes("swarm")) {
    competitors = [
      {
        name: "AutoGPT / CrewAI",
        category: "direct",
        strengths: "Large open source ecosystem, multi-agent concepts.",
        vulnerability: "High hallucination rate, lack of deterministic human approval gates and strict sandbox verification."
      },
      {
        name: "LangGraph / CopilotKit",
        category: "indirect",
        strengths: "Strong developer tooling for state machines.",
        vulnerability: "Requires heavy custom coding for adversarial multi-agent dynamics."
      },
      {
        name: "Y Combinator Co-founder matching & forums",
        category: "incumbent",
        strengths: "Established founder network.",
        vulnerability: "Human feedback is slow, sugarcoated, and non-rigorous."
      }
    ];
    signals = [
      "Agentic workflows shifting from single prompt to adversarial verification.",
      "High demand for automated idea vetting before allocating engineer headcount.",
      "MCP (Model Context Protocol) emerging as standard for tool communication."
    ];
    historicalFailures = [
      "Generic chat idea rating tools failed due to superficial positive bias.",
      "Pure ungrounded LLM feedback lacked financial/unit-economics simulations."
    ];
  } else {
    competitors = [
      {
        name: "Niche SaaS Incumbents",
        category: "incumbent",
        strengths: "Existing customer base and distribution channels.",
        vulnerability: "Legacy architecture, slow to adopt autonomous agent workflows."
      },
      {
        name: "Indie Hacker Tools",
        category: "direct",
        strengths: "Fast shipping and agile iteration.",
        vulnerability: "Lack of deep security, sandboxing, and adversarial cross-checks."
      }
    ];
    signals = [
      "Customer willingness to pay is tied strictly to time saved and measurable ROI.",
      "High CAC across paid search favors organic and community distribution."
    ];
    historicalFailures = [
      "Products with high switching friction without 10x ROI failed to retain users."
    ];
  }

  return {
    query,
    identifiedCompetitors: competitors,
    marketSignals: signals,
    historicalFailures
  };
}
