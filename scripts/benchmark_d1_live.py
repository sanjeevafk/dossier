import json
import time
import urllib.request
from pathlib import Path

# Load benchmark concepts from JSON/extracted list
CONCEPTS = [
    {
        "id": "BM-01",
        "title": "AutoSOC2: Continuous AI Security Compliance Auditor",
        "state": "AutoSOC2: Continuous AI Security Compliance Auditor. Autonomous agent pipeline that connects to AWS, GitHub, and Okta to continuously generate SOC2 Type II audit evidence and remediation PRs. Target Audience: B2B SaaS CTOs and Security Engineers (Series A-C). Monetization: Enterprise SaaS ($1,200/mo per organization).",
        "ground_truth": "BUILD"
    },
    {
        "id": "BM-02",
        "title": "SwaraSetu: Offline Indic Clinical Triage (SIH26133)",
        "state": "SwaraSetu: Offline Indic Clinical Triage (SIH26133). Offline-first, voice-native clinical triage for 22+ Indic languages via Sarvam AI and deterministic WHO IMCI decision trees across WhatsApp and ASHA tablets. Target Audience: ASHA Health Workers, Rural Patients, State Health Missions. Monetization: B2G / NGO District Licensing ($1,200/yr per district).",
        "ground_truth": "KILL (Clinical Malpractice & WhatsApp PHI)"
    },
    {
        "id": "BM-03",
        "title": "VanRakshak: Autonomous Drone Forest Patrolling",
        "state": "VanRakshak: Autonomous Drone Forest Patrolling. AI-powered autonomous multi-drone swarm for real-time forest fire detection, anti-poaching, and illegal logging prevention using edge YOLOv8 vision. Target Audience: State Forest Departments & National Wildlife Parks. Monetization: B2G Drone-as-a-Service ($1,500/mo per reserve).",
        "ground_truth": "REFINE (B2G Procurement Delay)"
    },
    {
        "id": "BM-04",
        "title": "ChatNotes: AI Chrome Extension for Meeting Summaries",
        "state": "ChatNotes: AI Chrome Extension for Meeting Summaries. A Chrome extension that records Google Meet audio and sends transcripts to OpenAI GPT-4o to output bulleted notes into Google Docs. Target Audience: General remote workers and college students. Monetization: Freemium with $10/mo Pro subscription.",
        "ground_truth": "KILL (Zero-Moat AI Wrapper)"
    },
    {
        "id": "BM-05",
        "title": "KissanAI: WhatsApp Agronomy Advisory",
        "state": "KissanAI: WhatsApp Agronomy Advisory. WhatsApp bot giving personalized crop diagnosis and weather alerts to smallholder farmers in Hindi and Marathi using fine-tuned LLaMA. Target Audience: Smallholder farmers across Maharashtra & MP. Monetization: Freemium B2C ($1/mo farmer subscription).",
        "ground_truth": "REFINE (CAC > WTP)"
    },
    {
        "id": "BM-06",
        "title": "PromptShield: Enterprise LLM Guardrail Proxy",
        "state": "PromptShield: Enterprise LLM Guardrail Proxy. Low-latency edge gateway that inspects LLM prompts and completions for PII leaks, prompt injections, and jailbreaks with sub-15ms overhead. Target Audience: Enterprise Chief Information Security Officers (CISOs). Monetization: Usage-based API pricing ($0.002 per 1,000 requests) + $2,500/mo enterprise tier.",
        "ground_truth": "BUILD"
    },
    {
        "id": "BM-07",
        "title": "LegalLens: Indian Case Law Discovery",
        "state": "LegalLens: Indian Case Law Discovery. Vector semantic search over Supreme Court of India and High Court judgments with automated headnote extraction and citation validation. Target Audience: Independent advocates, boutique litigation firms. Monetization: Professional SaaS ($49/mo per seat).",
        "ground_truth": "BUILD"
    },
    {
        "id": "BM-08",
        "title": "BhaiyaFix: Uber for Local Handymen in Tier-2 Cities",
        "state": "BhaiyaFix: Uber for Local Handymen in Tier-2 Cities. Hyperlocal on-demand handyman and appliance repair marketplace for Tier-2 Indian cities with instant UPI escrow. Target Audience: Urban homeowners in Jaipur, Lucknow, Indore. Monetization: 15% platform commission on completed service bookings.",
        "ground_truth": "REFINE (Unit Economics & Disintermediation)"
    },
    {
        "id": "BM-09",
        "title": "CodeReviewAI: Autonomous GitHub PR Reviewer",
        "state": "CodeReviewAI: Autonomous GitHub PR Reviewer. GitHub Action that reads pull requests, flags OWASP vulnerabilities, verifies test coverage, and suggests performance improvements. Target Audience: Engineering teams at seed to Series B tech startups. Monetization: Developer tool ($20/seat/month).",
        "ground_truth": "BUILD / REFINE"
    },
    {
        "id": "BM-10",
        "title": "MedClaimSync: Cashless Health Insurance TPA Automation",
        "state": "MedClaimSync: Cashless Health Insurance TPA Automation. OCR and FHIR pipeline that reconciles hospital discharge summaries with Indian IRDAI claim codes to pre-authorize cashless hospitalizations. Target Audience: Third-party administrators (TPAs) and private hospital billing desks. Monetization: Per-claim processing fee (INR 250 per cleared pre-auth).",
        "ground_truth": "BUILD"
    },
    {
        "id": "BM-11",
        "title": "CommuniAid: Hyperlocal Flood & Disaster Coordination",
        "state": "CommuniAid: Hyperlocal Flood & Disaster Coordination. Volunteer disaster coordination platform connecting stranded citizens with boat rescue teams and dry ration drops during monsoon floods. Target Audience: Disaster response volunteers, NDRF squads, affected citizens. Monetization: Free platform, funded entirely by donor grants and civic tech philanthropy.",
        "ground_truth": "KILL (Zero Direct Monetization)"
    },
    {
        "id": "BM-12",
        "title": "ViralThreads: AI Twitter/X Thread Composer",
        "state": "ViralThreads: AI Twitter/X Thread Composer. Chrome extension that takes any blog post URL and generates 10 viral Twitter/X threads optimized for engagement using GPT-4. Target Audience: Solopreneurs, indie hackers, social media managers. Monetization: $19/mo subscription.",
        "ground_truth": "KILL (Zero-Moat AI Wrapper)"
    },
    {
        "id": "BM-13",
        "title": "FinAuditAI: GST & TDS Reconciliation Engine",
        "state": "FinAuditAI: GST & TDS Reconciliation Engine. Automated reconciliation tool that matches GSTR-2B purchase registers with ERP purchase orders and bank statements to reclaim uncredited input tax credit. Target Audience: Chartered Accountants, CFOs of mid-market enterprises (INR 50-500 Cr revenue). Monetization: Annual enterprise license ($4,500/year).",
        "ground_truth": "BUILD"
    },
    {
        "id": "BM-14",
        "title": "EduMentor: Real-time Audio AI Tutor for IIT-JEE",
        "state": "EduMentor: Real-time Audio AI Tutor for IIT-JEE. Ultra-low latency voice conversational agent that coaches students through physics and mathematics numerical problems step-by-step. Target Audience: Aspirants preparing for competitive exams (JEE/NEET). Monetization: Consumer subscription (INR 499/month).",
        "ground_truth": "REFINE / BUILD"
    }
]

QUESTIONS = {
    "moat": {
        "type": "choice",
        "instructions": "Evaluate the architectural defensibility and moat.",
        "criteria": {
            "thin_wrapper": "Commodity wrapper around third-party LLM with zero proprietary moat.",
            "defensible_workflow": "Defensible enterprise workflow, proprietary data moat, or edge integration."
        }
    },
    "regulatory_risk": {
        "type": "choice",
        "instructions": "Evaluate legal, regulatory, liability, and clinical feasibility.",
        "criteria": {
            "regulatory_fatal": "Severe regulatory non-compliance, uninsurable medical liability.",
            "standard_compliance": "Standard SaaS compliance."
        }
    },
    "sales_cycle": {
        "type": "choice",
        "instructions": "Evaluate enterprise procurement and distribution friction.",
        "criteria": {
            "procurement_deadlock": "State procurement cycles exceeding 4-9 months.",
            "viable_distribution": "Manageable sales cycle."
        }
    },
    "monetization": {
        "type": "choice",
        "instructions": "Evaluate unit economics and customer willingness to pay.",
        "criteria": {
            "monetization_zero": "Zero direct monetization or donor-funded.",
            "viable_economics": "Demonstrated enterprise ACV or sustainable consumer unit economics."
        }
    }
}

def evaluate_live():
    url = "http://127.0.0.1:8080/v1/systemone"
    results = []
    
    print(f"Executing Live Benchmark against LiquidAI/d1-omni-600M-GGUF across {len(CONCEPTS)} concepts...\n")
    print(f"{'ID':<6} | {'Concept Title':<32} | {'Moat P(wrap)':<12} | {'Reg P(fatal)':<12} | {'Mon P(zero)':<12} | {'Latency':<8}")
    print("-" * 92)

    for c in CONCEPTS:
        payload = json.dumps({"state": c["state"], "questions": QUESTIONS}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        
        t0 = time.perf_counter()
        with urllib.request.urlopen(req, timeout=10.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        ans = data.get("answers", {})
        p_wrap = ans.get("moat", {}).get("probabilities", {}).get("thin_wrapper", 0.0)
        p_reg = ans.get("regulatory_risk", {}).get("probabilities", {}).get("regulatory_fatal", 0.0)
        p_mon = ans.get("monetization", {}).get("probabilities", {}).get("monetization_zero", 0.0)

        results.append({
            "id": c["id"],
            "title": c["title"],
            "ground_truth": c["ground_truth"],
            "p_wrapper": round(p_wrap, 4),
            "p_regulatory_fatal": round(p_reg, 4),
            "p_monetization_zero": round(p_mon, 4),
            "latency_ms": round(elapsed_ms, 1),
            "raw_answers": ans
        })

        short_title = (c['title'][:30] + '..') if len(c['title']) > 32 else c['title']
        print(f"{c['id']:<6} | {short_title:<32} | {p_wrap:<12.4f} | {p_reg:<12.4f} | {p_mon:<12.4f} | {elapsed_ms:>6.1f}ms")

    with open("/tmp/d1_omni_benchmark_live.json", "w") as f:
        json.dump(results, f, indent=2)

    print("\nLive benchmark complete. Saved to /tmp/d1_omni_benchmark_live.json")

if __name__ == "__main__":
    evaluate_live()
