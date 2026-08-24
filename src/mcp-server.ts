#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import { IdeaSwarmOrchestrator } from "./core/swarm.js";
import { StanfordRobustVerifier } from "./core/verifier.js";
import { runEconomicsSimulation } from "./tools/sandbox.js";
import { runStressTestSuite } from "./stress-test.js";
import { IdeaInput, AgentOpinion, DebateChallenge, ApprovalAction, EvidenceItem } from "./types/index.js";

/**
 * Dossier Model Context Protocol (MCP) Server
 * Exposes Dossier's adversarial multi-agent swarm, Stanford CS329A epistemic verification,
 * Python unit economics sandbox, and stress testing capabilities to any AI agent harness.
 */
class DossierMCPServer {
  private server: Server;
  private verifier: StanfordRobustVerifier;

  constructor() {
    this.server = new Server(
      {
        name: "dossier-adversarial-intelligence",
        version: "0.2.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.verifier = new StanfordRobustVerifier();

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[Dossier MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // 1. List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "evaluate_idea",
            description:
              "Evaluates a startup concept, product feature, or technical proposal using a 6-agent domain-aware adversarial swarm. Performs Stanford CS329A epistemic verification, isolated Python unit economics simulation, multi-round Red Team debate, and outputs actionable kill conditions and human approval checkpoints.",
            inputSchema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Name of the startup idea or technical proposal (e.g. 'VanRakshak Disaster Drones')"
                },
                summary: {
                  type: "string",
                  description: "Detailed description of the problem, solution, and core workflow."
                },
                targetAudience: {
                  type: "string",
                  description: "Target customer, industry vertical, or procurement entity."
                },
                monetization: {
                  type: "string",
                  description: "Revenue model, pricing tier, or contract structure."
                },
                pricing: {
                  type: "number",
                  description: "Optional monthly price or unit contract size in USD (default: 49)"
                },
                cac: {
                  type: "number",
                  description: "Optional estimated customer acquisition cost in USD (default: 150)"
                }
              },
              required: ["title", "summary", "targetAudience", "monetization"]
            }
          },
          {
            name: "stress_test_concept",
            description:
              "Runs Dossier's 5-invariant adversarial stress test suite on the harness. Evaluates prompt injection defense, impossible physics detection, sandbox isolation, economic boundary fuzzing, and burst concurrency multiplexing.",
            inputSchema: {
              type: "object",
              properties: {
                includeLoadTest: {
                  type: "boolean",
                  description: "Whether to include burst concurrency load tests (default: true)"
                }
              }
            }
          },
          {
            name: "run_sandbox_economics",
            description:
              "Executes an isolated Python 3 subprocess in a sandboxed runtime with Exit Code capture to compute LTV, CAC, payback period, and gross margin bounds deterministically.",
            inputSchema: {
              type: "object",
              properties: {
                pricingMonthly: {
                  type: "number",
                  description: "Monthly customer subscription or contract value in USD (default: 49)."
                },
                cac: {
                  type: "number",
                  description: "Estimated customer acquisition cost in USD (default: 150)."
                },
                churnRate: {
                  type: "number",
                  description: "Monthly customer churn rate as a float between 0.01 and 0.50 (default: 0.05)."
                },
                expectedUsersMonth12: {
                  type: "number",
                  description: "Projected active users by Month 12 (default: 1000)."
                }
              },
              required: ["pricingMonthly", "cac"]
            }
          },
          {
            name: "verify_claims_epistemics",
            description:
              "Audits an array of factual or technical claims against Stanford CS329A Epistemic Verification standards. Classifies each claim into 7 distinct evidence states (VERIFIED_FACT, VERIFIED_COMPUTATION, EXTERNAL_EVIDENCE, MODELLED_ASSUMPTION, INFERENCE, UNKNOWN, CONTRADICTED).",
            inputSchema: {
              type: "object",
              properties: {
                claims: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      claim: { type: "string", description: "The statement or metric to verify" },
                      source: { type: "string", description: "Source or provenance of the claim" },
                      isCalculation: { type: "boolean", description: "Whether this claim is a deterministic math computation" },
                      hasExternalSource: { type: "boolean", description: "Whether this claim cites a third-party source" },
                      isFact: { type: "boolean", description: "Whether this claim is verified external factual evidence" }
                    },
                    required: ["claim"]
                  },
                  description: "List of claims to evaluate"
                }
              },
              required: ["claims"]
            }
          }
        ]
      };
    });

    // 2. Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "evaluate_idea": {
            const input: IdeaInput = {
              title: String(args?.title || "Untitled Concept"),
              summary: String(args?.summary || ""),
              targetAudience: String(args?.targetAudience || "General"),
              monetization: String(args?.monetization || "Subscription")
            };

            const orchestrator = new IdeaSwarmOrchestrator();
            const dossier = await orchestrator.evaluateIdea(input, {
              pricingMonthlyUsd: typeof args?.pricing === "number" ? args.pricing : undefined,
              estimatedCacUsd: typeof args?.cac === "number" ? args.cac : undefined,
              useLiveLLM: true
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      dossierId: dossier.id,
                      dossierCode: dossier.dossierCode,
                      timestamp: dossier.timestamp,
                      domain: {
                        archetype: dossier.domainClassification.archetype,
                        archetypeLabel: dossier.domainClassification.archetypeLabel,
                        primaryCustomer: dossier.domainClassification.primaryCustomer,
                        procurementCycle: dossier.domainClassification.procurementCycle,
                        regulatoryEnvironment: dossier.domainClassification.regulatoryEnvironment
                      },
                      verdict: {
                        overallVerdict: dossier.overallVerdict,
                        resilienceScore: dossier.killScore,
                        confidenceLevel: dossier.confidenceScore,
                        riskLevel: dossier.riskLevel,
                        dimensionalBreakdown: dossier.resilienceBreakdown,
                        verdictConstraintNote: dossier.epistemicSummary?.hasUnvalidatedFatalAssumptions
                          ? `Constrained to ${dossier.overallVerdict} due to unvalidated fatal assumptions.`
                          : "Unconditional evaluation."
                      },
                      epistemicAudit: {
                        epistemicSummary: dossier.epistemicSummary,
                        strongestEvidence: dossier.strongestEvidence,
                        weakestAssumption: dossier.weakestAssumption,
                        contradictions: dossier.contradictions,
                        evidenceFeed: dossier.evidenceFeed
                      },
                      specialistOpinions: Object.values(dossier.roleAssessments).map((o: AgentOpinion) => ({
                        role: o.roleTitle,
                        verdict: o.verdict,
                        score: o.score,
                        fatalFlaw: o.fatalFlaws[0] || "None identified",
                        mustTestBeforeBuilding: o.mustTestBeforeBuilding[0] || "None"
                      })),
                      adversarialDebateTrail: dossier.debateTrail.map((t: DebateChallenge) => ({
                        round: t.round,
                        challenger: t.challenger,
                        target: t.target,
                        challengePoint: t.challengePoint,
                        rebuttal: t.rebuttal,
                        status: t.status
                      })),
                      killConditions: dossier.killConditions,
                      cheapestValidationExperiment: dossier.cheapestValidationExperiment,
                      sandboxedUnitEconomics: {
                        cacEstimateUsd: dossier.simulation.cacEstimateUsd,
                        ltvEstimateUsd: dossier.simulation.ltvEstimateUsd,
                        ltvCacRatio: dossier.simulation.ltvCacRatio,
                        estimatedPaybackMonths: dossier.simulation.estimatedPaybackMonths,
                        monthlyInfraCostUsd: dossier.simulation.monthlyInfraCostUsd,
                        tamEstimateUsd: dossier.simulation.tamEstimateUsd,
                        sandboxExecutionProof: dossier.simulation.sandboxExecutionProof
                      },
                      humanApprovalGates: dossier.approvalGates.map((a: ApprovalAction) => ({
                        id: a.id,
                        actionType: a.actionType,
                        summary: a.summary,
                        status: a.status,
                        requiresApproval: a.requiresApproval
                      }))
                    },
                    null,
                    2
                  )
                }
              ]
            };
          }

          case "stress_test_concept": {
            const results = await runStressTestSuite();

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(results, null, 2)
                }
              ]
            };
          }

          case "run_sandbox_economics": {
            const price = Number(args?.pricingMonthly || 49);
            const cac = Number(args?.cac || 150);
            const churn = Number(args?.churnRate || 0.05);
            const users = Number(args?.expectedUsersMonth12 || 1000);

            const sim = await runEconomicsSimulation(price, churn, cac, users, 500, 100);

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      status: sim.exitCode === 0 ? "SUCCESS" : "FAILED",
                      exitCode: sim.exitCode,
                      runtime: sim.runtime,
                      metrics: sim.metrics,
                      stdout: sim.stdout.trim()
                    },
                    null,
                    2
                  )
                }
              ]
            };
          }

          case "verify_claims_epistemics": {
            const claims = Array.isArray(args?.claims) ? args.claims : [];
            const audited = claims.map((c: any) => {
              let state = "MODELLED_ASSUMPTION";
              if (c.isCalculation) {
                state = "VERIFIED_COMPUTATION";
              } else if (c.hasExternalSource && c.source) {
                state = "EXTERNAL_EVIDENCE";
              } else if (c.isFact && c.source) {
                state = "VERIFIED_FACT";
              }

              return {
                claim: c.claim,
                epistemicState: state,
                provenance: c.source || "User / Agent Input",
                riskMitigationImpact: state.startsWith("VERIFIED") ? "MITIGATES_RISK" : "DOES_NOT_MITIGATE"
              };
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      totalClaimsAudited: audited.length,
                      claims: audited,
                      ruleNote: "Per Stanford CS329A: Unvalidated assumptions and model agreements can never be labelled VERIFIED."
                    },
                    null,
                    2
                  )
                }
              ]
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error executing tool ${name}: ${err.message}`
            }
          ],
          isError: true
        };
      }
    });
  }

  public async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("[Dossier MCP Server] Running on stdio transport");
  }
}

const server = new DossierMCPServer();
server.run().catch((error) => {
  console.error("Fatal error running Dossier MCP Server:", error);
  process.exit(1);
});
