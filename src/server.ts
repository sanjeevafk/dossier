import express, { Application, Request, Response } from "express";
import cors from "cors";
import path from "node:path";
import { IdeaSwarmOrchestrator } from "./core/swarm.js";
import { IdeaInput } from "./types/index.js";

const app: Application = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

const orchestrator = new IdeaSwarmOrchestrator();

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "idea-swarm-trueforge", timestamp: new Date().toISOString() });
});

// Evaluate endpoint
app.post("/api/evaluate", async (req: Request, res: Response) => {
  try {
    const { title, summary, targetAudience, monetization, pricingMonthlyUsd, estimatedCacUsd } = req.body;

    if (!title || !summary) {
      res.status(400).json({ error: "Missing required fields: 'title' and 'summary'" });
      return;
    }

    const ideaInput: IdeaInput = {
      title,
      summary,
      targetAudience: targetAudience || "General Founders / Businesses",
      monetization: monetization || "$49/month SaaS"
    };

    const dossier = await orchestrator.evaluateIdea(ideaInput, {
      pricingMonthlyUsd: pricingMonthlyUsd ? parseFloat(pricingMonthlyUsd) : undefined,
      estimatedCacUsd: estimatedCacUsd ? parseFloat(estimatedCacUsd) : undefined
    });

    res.json({ success: true, dossier });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || "Evaluation failed" });
  }
});

// Approval action gate endpoint (Human-in-the-loop)
app.post("/api/approval/:actionId", (req: Request, res: Response) => {
  const { actionId } = req.params;
  const { decision } = req.body; // 'APPROVE' | 'REJECT'

  if (!["APPROVE", "REJECT"].includes(decision)) {
    res.status(400).json({ error: "Decision must be either 'APPROVE' or 'REJECT'" });
    return;
  }

  res.json({
    success: true,
    actionId,
    newStatus: decision === "APPROVE" ? "APPROVED" : "REJECTED",
    message: `Action ${actionId} has been successfully updated by human operator.`
  });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => {
    console.log(`⚡ Idea Swarm Server listening on http://localhost:${port}`);
  });
}

export default app;
