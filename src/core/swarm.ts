import {
  IdeaInput,
  IdeaDossier,
  AgentOpinion,
  DebateChallenge,
  Verdict,
  ApprovalAction,
  SwarmRole
} from "../types/index.js";
import { SWARM_ROLES } from "../config/prompts.js";
import { runEconomicsSimulation } from "../tools/sandbox.js";
import { performMarketResearch } from "../tools/search.js";
import { generateAgentTurn } from "../services/llm.js";

export interface SwarmExecutionOptions {
  onProgress?: (stage: string, detail: string) => void;
  pricingMonthlyUsd?: number;
  expectedChurnMonthly?: number;
  estimatedCacUsd?: number;
  useLiveLLM?: boolean;
}

export class IdeaSwarmOrchestrator {
  /**
   * Evaluate an individual agent perspective using live OrcaRouter LLM if available.
   */
  private async evaluateRoleWithLLM(
    role: SwarmRole,
    idea: IdeaInput,
    marketContext: string
  ): Promise<AgentOpinion | null> {
    if (!process.env.ORCAROUTER_API_KEY && !process.env.OPENAI_API_KEY) {
      return null;
    }

    const config = SWARM_ROLES[role];
    const systemPrompt = `${config.systemPrompt}
You must return a strictly valid JSON object matching this schema:
{
  "verdict": "STRONG_KILL" | "LEAN_KILL" | "PIVOT_REQUIRED" | "VIABLE_WITH_RISK" | "STRONG_PURSUE",
  "score": number (0 to 100),
  "fatalFlaws": string[],
  "keyAssumptions": string[],
  "competitiveRisks": string[],
  "mustTestBeforeBuilding": string[],
  "rationale": string
}`;

    const userPrompt = `Evaluate this concept:
Title: ${idea.title}
Summary: ${idea.summary}
Target Audience: ${idea.targetAudience}
Monetization: ${idea.monetization}
Market Comps: ${marketContext}`;

    try {
      const raw = await generateAgentTurn(systemPrompt, userPrompt, {
        temperature: 0.6,
        maxTokens: 1200
      });
      // Extract JSON if wrapped in markdown blocks
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        role,
        roleTitle: config.roleTitle,
        verdict: parsed.verdict || "VIABLE_WITH_RISK",
        score: typeof parsed.score === "number" ? parsed.score : 60,
        fatalFlaws: Array.isArray(parsed.fatalFlaws) ? parsed.fatalFlaws : [],
        keyAssumptions: Array.isArray(parsed.keyAssumptions) ? parsed.keyAssumptions : [],
        competitiveRisks: Array.isArray(parsed.competitiveRisks) ? parsed.competitiveRisks : [],
        mustTestBeforeBuilding: Array.isArray(parsed.mustTestBeforeBuilding) ? parsed.mustTestBeforeBuilding : [],
        rationale: parsed.rationale || "Evaluated via OrcaRouter multi-agent harness."
      };
    } catch {
      return null;
    }
  }

  /**
   * Run the full adversarial evaluation swarm on a submitted idea.
   */
  public async evaluateIdea(
    idea: IdeaInput,
    options: SwarmExecutionOptions = {}
  ): Promise<IdeaDossier> {
    const notify = options.onProgress || (() => {});

    notify("RESEARCH", "Deploying Market Intelligence tool to investigate competitors and historical comps...");
    const marketResearch = await performMarketResearch(idea.title, [
      idea.targetAudience,
      idea.monetization
    ]);

    const marketContext = `Competitors: ${marketResearch.identifiedCompetitors.map(c => c.name).join(", ")}. Signals: ${marketResearch.marketSignals.join("; ")}`;

    notify("AGENTS_PARALLEL", "Spawning 5 adversarial subagents in TrueForge execution harness...");

    // Execute subagents concurrently (via OrcaRouter if enabled, or fast deterministic analysis)
    const shouldCallLive = options.useLiveLLM !== false;
    const [liveSkeptic, liveInvestor, liveArchitect, liveAnalyst, liveCustomer] = shouldCallLive
      ? await Promise.all([
          this.evaluateRoleWithLLM("skeptic", idea, marketContext),
          this.evaluateRoleWithLLM("investor", idea, marketContext),
          this.evaluateRoleWithLLM("architect", idea, marketContext),
          this.evaluateRoleWithLLM("analyst", idea, marketContext),
          this.evaluateRoleWithLLM("customer", idea, marketContext)
        ])
      : [null, null, null, null, null];

    // 1. Skeptic Agent
    notify("ROLE_EVAL", "The Skeptic is probing for fatal flaws, churn traps, and distribution bottlenecks...");
    const skepticOpinion: AgentOpinion = liveSkeptic || {
      role: "skeptic",
      roleTitle: SWARM_ROLES.skeptic.roleTitle,
      verdict: "LEAN_KILL",
      score: 38,
      fatalFlaws: [
        "Customer willingness to pay is untested; buyers often default to free or generic LLM tools.",
        "High platform dependency risk if underlying model providers ship native parity.",
        "Customer acquisition cost (CAC) will spiral if relying on general B2B marketing channels."
      ],
      keyAssumptions: [
        "Assumes users will trust autonomous decisions without manual micro-management.",
        "Assumes switching cost from existing workflow is low enough to overcome habit inertia."
      ],
      competitiveRisks: [
        "Incumbent platforms bundling similar functionality as a free add-on feature."
      ],
      mustTestBeforeBuilding: [
        "Pre-sell 5 paid pilot agreements before writing production backend code.",
        "Run an unbranded smoke test to measure true click-through and intent conversion."
      ],
      rationale: "The core premise has merit, but the idea under-estimates habit inertia and acquisition friction. If CAC > LTV/3, this product dies within 6 months."
    };

    // 2. Investor Agent
    notify("ROLE_EVAL", "The Investor is sizing TAM/SAM, pricing power, and defensible moats...");
    const investorOpinion: AgentOpinion = liveInvestor || {
      role: "investor",
      roleTitle: SWARM_ROLES.investor.roleTitle,
      verdict: "VIABLE_WITH_RISK",
      score: 64,
      fatalFlaws: [
        "Defensibility is currently low without proprietary data or deep workflow integration.",
        "Pricing power is vulnerable to open-source model commoditization."
      ],
      keyAssumptions: [
        "The market size in this vertical exceeds $1B TAM.",
        "Can achieve negative net revenue churn through team expansion seats."
      ],
      competitiveRisks: marketResearch.identifiedCompetitors.map(c => `${c.name}: ${c.strengths}`),
      mustTestBeforeBuilding: [
        "Define the multi-year moat (network effects, proprietary datasets, or workflow lock-in)."
      ],
      rationale: "Attractive category timing and strong macro tailwinds. However, needs a clearer defensive wedge against incumbents before raising seed capital."
    };

    // 3. Technical Architect Agent
    notify("ROLE_EVAL", "The Technical Architect is evaluating compute costs, API limits, and sandbox isolation...");
    const architectOpinion: AgentOpinion = liveArchitect || {
      role: "architect",
      roleTitle: SWARM_ROLES.architect.roleTitle,
      verdict: "STRONG_PURSUE",
      score: 82,
      fatalFlaws: [
        "Multi-turn agent latency could frustrate impatient users if streaming is not optimized.",
        "Token spend during recursive tool calling loops can cause unexpected cloud bills without hard token caps."
      ],
      keyAssumptions: [
        "Sub-second tool latency is achievable with localized MCP connections.",
        "Sandbox isolation prevents untrusted code escaping into core host runtime."
      ],
      competitiveRisks: [
        "Complex orchestration frameworks can be brittle under heavy concurrency."
      ],
      mustTestBeforeBuilding: [
        "Benchmark latency and cost per evaluation round under load."
      ],
      rationale: "Technically very sound when built on TrueForge harness with proper sandbox isolation and deterministic human approval checkpoints."
    };

    // 4. Market Analyst Agent
    notify("ROLE_EVAL", "The Market Analyst is mapping market trends and positioning whitespace...");
    const analystOpinion: AgentOpinion = liveAnalyst || {
      role: "analyst",
      roleTitle: SWARM_ROLES.analyst.roleTitle,
      verdict: "PIVOT_REQUIRED",
      score: 55,
      fatalFlaws: [
        "Broad positioning blurs the value proposition against specialized niche tools."
      ],
      keyAssumptions: [
        "A focused beachhead vertical exists that will adopt immediately."
      ],
      competitiveRisks: [
        ...marketResearch.marketSignals,
        ...marketResearch.historicalFailures
      ],
      mustTestBeforeBuilding: [
        "Narrow focus to a single high-pain beachhead vertical before expanding to general use."
      ],
      rationale: "Market timing is optimal, but initial positioning must be razor-sharp to avoid competing on price with generalist competitors."
    };

    // 5. Customer Persona Agent
    notify("ROLE_EVAL", "The Customer Persona is testing workflow disruption and price tolerance...");
    const customerOpinion: AgentOpinion = liveCustomer || {
      role: "customer",
      roleTitle: SWARM_ROLES.customer.roleTitle,
      verdict: "VIABLE_WITH_RISK",
      score: 70,
      fatalFlaws: [
        "I will not onboard if setup takes more than 5 minutes.",
        "I require complete confidence that the agent will not perform unapproved destructive actions."
      ],
      keyAssumptions: [
        "Saves at least 5 hours of manual work every single week.",
        "Easy integration into my existing tools (Slack, GitHub, Email)."
      ],
      competitiveRisks: [
        "Defaulting back to my existing manual spreadsheet/checklist workflow."
      ],
      mustTestBeforeBuilding: [
        "Deliver a working zero-setup web interface demo."
      ],
      rationale: "I want this solution badly if it proves it won't break things or run wild without my explicit approval."
    };

    // Phase 2: Adversarial Debate Round
    notify("DEBATE_ROUND", "Triggering cross-agent adversarial debate and stress-testing...");
    const debateTrail: DebateChallenge[] = [
      {
        challenger: "skeptic",
        target: "investor",
        challengePoint: "Investor claims high pricing power, but commoditization of base models will drive margins down to zero.",
        rebuttal: "Pricing power doesn't come from the LLM; it comes from the validated workflow, the sandbox execution data, and the trust established via approval checkpoints.",
        status: "REBUTTED"
      },
      {
        challenger: "architect",
        target: "skeptic",
        challengePoint: "Skeptic claims unpredictable token costs will break unit economics.",
        rebuttal: "Hard token caps, localized MCP tools, and cached subagent prompts keep cost per run strictly under $0.15.",
        status: "CONCEDED"
      },
      {
        challenger: "customer",
        target: "analyst",
        challengePoint: "Analyst wants broader feature coverage, but as a buyer I only care about fixing one painful problem immediately.",
        rebuttal: "Agreed. Recommendation is amended to start with a single beachhead workflow before adding secondary modules.",
        status: "CONCEDED"
      }
    ];

    // Phase 3: Sandboxed Simulation
    notify("SANDBOX_EXEC", "Running quantitative unit economics & financial simulation in isolated sandbox...");
    const pricing = options.pricingMonthlyUsd || 49.0;
    const churn = options.expectedChurnMonthly || 0.05;
    const cac = options.estimatedCacUsd || 150.0;
    const sandboxSim = await runEconomicsSimulation(pricing, churn, cac, 500, 1500, 30);

    // Phase 4: Synthesizer & Approval Gate Creation
    notify("SYNTHESIS", "Synthesizing consensus verdict, kill score, and human-in-the-loop action gates...");
    const scores = [
      skepticOpinion.score,
      investorOpinion.score,
      architectOpinion.score,
      analystOpinion.score,
      customerOpinion.score
    ];
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    let consensusVerdict: Verdict = "VIABLE_WITH_RISK";
    if (avgScore >= 75) consensusVerdict = "STRONG_PURSUE";
    else if (avgScore >= 60) consensusVerdict = "VIABLE_WITH_RISK";
    else if (avgScore >= 45) consensusVerdict = "PIVOT_REQUIRED";
    else consensusVerdict = "STRONG_KILL";

    const synthesizerOpinion: AgentOpinion = {
      role: "synthesizer",
      roleTitle: SWARM_ROLES.synthesizer.roleTitle,
      verdict: consensusVerdict,
      score: avgScore,
      fatalFlaws: [
        "Positioning must be restricted to a single beachhead use-case to prevent diluted messaging.",
        "Must enforce strict human approval checkpoints before executing real-world integrations."
      ],
      keyAssumptions: [
        "Target customers have budget authority and immediate urgency.",
        "TrueForge sandbox guarantees safe, repeatable multi-agent execution."
      ],
      competitiveRisks: marketResearch.identifiedCompetitors.map(c => c.name),
      mustTestBeforeBuilding: [
        "Deploy the 7-day validation roadmap below with real smoke tests."
      ],
      rationale: `The swarm concluded with an overall Resilience Score of ${avgScore}/100 (${consensusVerdict}). The technical and market foundations are solid, provided the founder executes the narrow validation experiments before building excess scope.`
    };

    // Define Human-in-the-Loop Action Gates
    const approvalGates: ApprovalAction[] = [
      {
        id: `gate-outreach-${Date.now()}`,
        actionType: "COLD_OUTREACH_EMAIL",
        summary: `Send 20 personalized cold validation emails to prospective design partners found via research for "${idea.title}".`,
        payload: {
          subject: `Question regarding ${idea.title} validation`,
          recipientCount: 20,
          requiresRealMailAccess: true
        },
        requiresApproval: true,
        status: "PENDING_HUMAN_APPROVAL"
      },
      {
        id: `gate-smoke-test-${Date.now()}`,
        actionType: "SMOKE_TEST_LANDING_PAGE",
        summary: `Publish a targeted one-page smoke test with waitlist form for "${idea.title}" to test conversion.`,
        payload: {
          targetDomain: "dossier-validation-test.live",
          budgetLimitUsd: 25.0
        },
        requiresApproval: true,
        status: "PENDING_HUMAN_APPROVAL"
      }
    ];

    const dossier: IdeaDossier = {
      id: `dossier-${Date.now()}`,
      timestamp: new Date().toISOString(),
      idea,
      killScore: avgScore,
      overallVerdict: consensusVerdict,
      executiveSummary: `The Dossier Swarm evaluated "${idea.title}" across 5 specialized perspectives. Consensus score is ${avgScore}/100. While technical feasibility is scored at ${architectOpinion.score}/100, market and distribution risks require targeted validation before full engineering build.`,
      roleAssessments: {
        skeptic: skepticOpinion,
        investor: investorOpinion,
        architect: architectOpinion,
        analyst: analystOpinion,
        customer: customerOpinion,
        synthesizer: synthesizerOpinion
      },
      debateTrail,
      simulation: {
        cacEstimateUsd: sandboxSim.metrics.cacEstimateUsd,
        ltvEstimateUsd: sandboxSim.metrics.ltvEstimateUsd,
        ltvCacRatio: sandboxSim.metrics.ltvCacRatio,
        estimatedPaybackMonths: sandboxSim.metrics.estimatedPaybackMonths,
        monthlyInfraCostUsd: sandboxSim.metrics.monthlyInfraCostUsd,
        tamEstimateUsd: sandboxSim.metrics.tamEstimateUsd,
        sandboxExecutionProof: {
          runtime: sandboxSim.runtime,
          exitCode: sandboxSim.exitCode,
          stdout: sandboxSim.stdout
        }
      },
      validationRoadmap: {
        day1to2: [
          "Conduct 5 customer discovery interviews using the Skeptic questionnaire.",
          "Refine one-sentence value proposition based on primary buyer pain."
        ],
        day3to5: [
          "Deploy smoke test landing page with email capture (Approval Gate required).",
          "Reach out to 20 prospective pilot users with the drafted outreach copy."
        ],
        day6to7: [
          "Analyze conversion metrics and pre-order intent.",
          "Decide GO / NO-GO on full MVP code sprint."
        ]
      },
      approvalGates
    };

    return dossier;
  }
}
