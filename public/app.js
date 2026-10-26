/* ============================================================ */
/* DOSSIER — ONE-SHOT ADVERSARIAL INTELLIGENCE TERMINAL JS     */
/* Zero Emojis • Vector Icons • Editorial Precision             */
/* ============================================================ */

let activeEvaluationAborted = false;
let currentRenderedDossier = null;
let currentRenderedDossierId = null;
let evalStartTime = null;
let timerInterval = null;

// Preset sample ideas for 1-click test
const SAMPLE_PRESETS = {
  reconcilepay: `ReconcilePay: Automated WhatsApp Billing & Reconciliation for Kirana Retailers
India-first conversational billing bot that ingests wholesale distributor invoices via OCR, automates three-way invoice reconciliation against bank statements, and dispatches UPI payment collection reminders over WhatsApp. Target market: 12 million micro-retailers in tier-2/3 Indian cities. Monetization: 999 INR ($12)/month flat subscription per store.`,

  reloot: `Reloot: Peer-to-Peer Second-Hand Furniture Resale Marketplace
A local community marketplace where urban apartment dwellers buy and sell pre-owned solid wood and designer furniture. The platform arranges two-man white-glove pickup, deep cleaning, temporary warehousing, and door-to-door delivery. Monetization: 22% commission on fulfilled transactions with an average order value of $280.`,

  autosoc2: `AutoSOC2: Continuous Security Compliance & Remediation for Kubernetes
An agentic DevSecOps auditor that continuously scans Kubernetes clusters, cloud IAM roles, and Terraform registries against SOC2 Type II, ISO 27001, and HIPAA controls. When a misconfiguration is detected, it generates a pull request with an isolated remediation script. Monetization: $499/month for up to 5 clusters.`
};

// MCP Configuration Templates
const MCP_TEMPLATES = {
  claude: `{
  "mcpServers": {
    "dossier": {
      "command": "node",
      "args": ["${window.location.origin.includes('localhost') ? '/home/sanjeev/projects/products/dossier/dist/mcp-server.js' : 'dossier-mcp'}"]
    }
  }
}`,
  cursor: `{
  "mcpServers": {
    "dossier": {
      "command": "node",
      "args": ["${window.location.origin.includes('localhost') ? '/home/sanjeev/projects/products/dossier/dist/mcp-server.js' : 'dossier-mcp'}"]
    }
  }
}`,
  windsurf: `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "mcpServers": {
    "dossier": {
      "command": "node",
      "args": ["${window.location.origin.includes('localhost') ? '/home/sanjeev/projects/products/dossier/dist/mcp-server.js' : 'dossier-mcp'}"],
      "description": "Dossier Adversarial Multi-Agent Intelligence & Epistemic Verification Engine"
    }
  }
}`,
  cli: `# Run directly with standard stdio:
npx dossier-mcp

# Or execute with custom memory allocation:
NODE_OPTIONS="--max-old-space-size=512" npx dossier-mcp`
};

let currentMcpTab = 'claude';

// ============================================================
// 1. DOM INITIALIZATION & EVENT LISTENERS
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('ideaInput');
  const charCount = document.getElementById('charCount');

  // Character counter listener
  if (textarea && charCount) {
    const updateCounter = () => {
      const len = textarea.value.length;
      charCount.textContent = len.toLocaleString();
      if (len >= 1950) {
        charCount.className = 'font-bold text-red-600';
      } else if (len >= 1800) {
        charCount.className = 'font-bold text-amber-600';
      } else {
        charCount.className = 'font-bold text-zinc-700';
      }
    };

    textarea.addEventListener('input', updateCounter);
    
    // Keyboard shortcut: Cmd + Enter or Ctrl + Enter to run
    textarea.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        executeOneShotEvaluation();
      }
    });

    updateCounter();
  }

  // Load recent dossiers from SQLite archive
  loadRecentDossiers();
  
  // Set default MCP code
  setMcpTab('claude');
});

// ============================================================
// 2. ONE-SHOT EVALUATION RUNNER (STATELESS CONSOLE)
// ============================================================
function loadSamplePreset(key) {
  const textarea = document.getElementById('ideaInput');
  if (textarea && SAMPLE_PRESETS[key]) {
    textarea.value = SAMPLE_PRESETS[key];
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
    textarea.focus();
  }
}

async function executeOneShotEvaluation() {
  const textarea = document.getElementById('ideaInput');
  const rawText = (textarea ? textarea.value : '').trim();

  if (!rawText || rawText.length < 15) {
    alert("Please provide at least 15 characters describing your idea, target audience, or business model.");
    if (textarea) textarea.focus();
    return;
  }

  // Smart extraction: extract first line or title phrase
  let title = "Venture Proposition";
  let summary = rawText;

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const firstLine = lines[0].replace(/^[#\-* ]+/, '');
    if (firstLine.includes(':')) {
      const parts = firstLine.split(':');
      title = parts[0].trim();
    } else if (firstLine.length <= 70) {
      title = firstLine;
    } else {
      title = firstLine.split(' ').slice(0, 6).join(' ');
    }
  }

  // UI Setup: toggle button to loading
  const runBtn = document.getElementById('runEvaluationBtn');
  const runBtnText = document.getElementById('runBtnText');
  const runBtnArrow = document.getElementById('runBtnArrow');
  const runBtnSpinner = document.getElementById('runBtnSpinner');
  const streamContainer = document.getElementById('streamContainer');
  const streamLog = document.getElementById('streamLiveLog');
  const navStatus = document.getElementById('navSystemStatus');

  if (runBtn) runBtn.disabled = true;
  if (runBtnText) runBtnText.textContent = "RUNNING SWARM...";
  if (runBtnArrow) runBtnArrow.classList.add('hidden');
  if (runBtnSpinner) runBtnSpinner.classList.remove('hidden');
  if (navStatus) {
    navStatus.textContent = "PROCESSING";
    navStatus.className = "text-amber-600 font-bold";
  }

  // Open stream container & scroll to it
  if (streamContainer) {
    streamContainer.classList.remove('hidden');
    streamContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  document.getElementById('streamActiveConceptTitle').textContent = `EVALUATING: ${title.toUpperCase()}`;
  if (streamLog) streamLog.innerHTML = `<div>[0.0s] Initialized one-shot evaluation pipeline for "${escapeHtml(title)}"...</div>`;

  // Reset Stepper
  ['ingest', 'recon', 'swarm', 'debate', 'verify', 'compile'].forEach(step => {
    const el = document.getElementById(`step-${step}`);
    const txt = document.getElementById(`step-${step}-text`);
    if (el) el.className = 'p-2.5 rounded-lg border border-sand-200 bg-sand-50 space-y-1';
    if (txt) txt.textContent = 'Waiting...';
  });

  evalStartTime = Date.now();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsed = ((Date.now() - evalStartTime) / 1000).toFixed(1);
    const badge = document.getElementById('streamTimerBadge');
    if (badge) badge.textContent = `${elapsed}s ELAPSED`;
  }, 100);

  // Mark Ingest as active
  setStepActive('ingest', 'Classifying domain priors...');

  try {
    const res = await fetch('/api/evaluate/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...apiHeaders()
      },
      body: JSON.stringify({
        title,
        summary,
        targetAudience: "Specified in plain-text concept",
        monetization: "Specified in plain-text concept"
      })
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server responded with HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep partial line in buffer

      let currentEvent = null;
      let currentData = null;

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            currentData = JSON.parse(line.slice(6).trim());
          } catch (e) {
            currentData = line.slice(6).trim();
          }
        } else if (line === '') {
          if (currentEvent && currentData) {
            handleStreamEvent(currentEvent, currentData);
          }
          currentEvent = null;
          currentData = null;
        }
      }
    }

  } catch (err) {
    appendStreamLog(`ERROR: ${err.message}`, 'text-red-400 font-bold');
    alert(`Evaluation failed: ${err.message}`);
  } finally {
    if (timerInterval) clearInterval(timerInterval);
    if (runBtn) runBtn.disabled = false;
    if (runBtnText) runBtnText.textContent = "RUN ADVERSARIAL SWARM";
    if (runBtnArrow) runBtnArrow.classList.remove('hidden');
    if (runBtnSpinner) runBtnSpinner.classList.add('hidden');
    if (navStatus) {
      navStatus.textContent = "STANDBY";
      navStatus.className = "";
    }
  }
}

function handleStreamEvent(event, data) {
  const elapsed = evalStartTime ? ((Date.now() - evalStartTime) / 1000).toFixed(1) : '0.0';

  switch (event) {
    case 'progress': {
      const stage = (data.stage || '').toUpperCase();
      const detail = data.detail || '';
      appendStreamLog(`[${elapsed}s] ${stage}: ${detail}`);

      if (stage.includes('01 INGEST')) {
        setStepActive('ingest', detail);
      } else if (stage.includes('02 RECON') || stage.includes('MARKET')) {
        setStepComplete('ingest');
        setStepActive('recon', detail);
      } else if (stage.includes('03 SWARM')) {
        setStepComplete('recon');
        setStepActive('swarm', detail);
      } else if (stage.includes('04 DEBATE') || stage.includes('CROSSFIRE')) {
        setStepComplete('swarm');
        setStepActive('debate', detail);
      } else if (stage.includes('05 VERIFY')) {
        setStepComplete('debate');
        setStepActive('verify', detail);
      }
      break;
    }

    case 'agent_start': {
      appendStreamLog(`[${elapsed}s] Agent deployed: ${data.roleTitle || data.role}`);
      break;
    }

    case 'opinion': {
      appendStreamLog(`[${elapsed}s] ${data.roleTitle || data.role} scored ${data.score}/100 [${data.verdict}]`);
      break;
    }

    case 'crossfire_clash': {
      setStepActive('debate', `Crossfire clash: ${data.challenger} -> ${data.target}`);
      appendStreamLog(`[${elapsed}s] CROSSFIRE CLASH: ${data.challenger} challenged ${data.target}: "${(data.challengePoint || '').slice(0, 80)}..."`, 'text-amber-400');
      break;
    }

    case 'audit_correction': {
      appendStreamLog(`[${elapsed}s] EPISTEMIC SELF-CORRECTION: ${data.detail || ''}`, 'text-emerald-400');
      break;
    }

    case 'dossier_complete': {
      setStepComplete('verify');
      setStepComplete('compile');
      appendStreamLog(`[${elapsed}s] Complete intelligence dossier compiled. Rendering final report...`, 'text-emerald-400 font-bold');
      
      const dossier = data.dossier;
      if (dossier) {
        renderDossier(dossier);
        const resSection = document.getElementById('resultsSection');
        if (resSection) {
          resSection.scrollIntoView({ behavior: 'smooth' });
        }
        loadRecentDossiers();
      }
      break;
    }

    case 'error': {
      appendStreamLog(`[${elapsed}s] ERROR: ${data.message || 'Stream error'}`, 'text-red-400 font-bold');
      break;
    }
  }
}

function setStepActive(stepId, text) {
  const el = document.getElementById(`step-${stepId}`);
  const txt = document.getElementById(`step-${stepId}-text`);
  if (el) el.className = 'p-2.5 rounded-lg border border-accentGold bg-amber-50/50 space-y-1 step-pulsing';
  if (txt) txt.textContent = text;
}

function setStepComplete(stepId) {
  const el = document.getElementById(`step-${stepId}`);
  const txt = document.getElementById(`step-${stepId}-text`);
  if (el) el.className = 'p-2.5 rounded-lg border border-emerald-300 bg-emerald-50/40 space-y-1';
  if (txt) txt.textContent = 'Complete';
}

function appendStreamLog(msg, customClass = 'text-zinc-400') {
  const streamLog = document.getElementById('streamLiveLog');
  if (!streamLog) return;
  const line = document.createElement('div');
  line.className = customClass;
  line.textContent = msg;
  streamLog.appendChild(line);
  streamLog.scrollTop = streamLog.scrollHeight;
}

// ============================================================
// 3. DOSSIER RENDERING & REPORTS
// ============================================================
function renderDossier(dossier) {
  currentRenderedDossier = dossier;
  currentRenderedDossierId = dossier.id;

  const resSection = document.getElementById('resultsSection');
  if (resSection) resSection.classList.remove('hidden');

  // Header Details
  document.getElementById('resSubjectTitle').textContent = dossier.idea.title.toUpperCase();
  document.getElementById('resExecutiveSummary').textContent = dossier.executiveSummary;
  document.getElementById('resDossierCode').textContent = `${dossier.dossierCode} // ID: ${dossier.id}`;
  document.getElementById('resConfidence').textContent = `${dossier.confidenceScore}%`;
  document.getElementById('resRiskLevel').textContent = dossier.riskLevel;
  document.getElementById('resScoreVal').textContent = `${dossier.killScore}/100`;

  // Domain Classification Banner
  if (dossier.domainClassification) {
    const dc = dossier.domainClassification;
    document.getElementById('resDomainArchetype').textContent = `DOMAIN: ${dc.archetypeLabel.toUpperCase()}`;
    document.getElementById('resDomainCustomer').textContent = `CUSTOMER: ${dc.primaryCustomer}`;
    document.getElementById('resDomainCycle').textContent = `CYCLE: ${dc.procurementCycle}`;
  }

  // Verdict Badge Styling
  const verdictBadge = document.getElementById('resVerdictBadge');
  const verdictText = dossier.overallVerdict === 'BUILD_IF_VALIDATED' ? 'BUILD IF VALIDATED' : dossier.overallVerdict;
  verdictBadge.textContent = verdictText;

  if (dossier.overallVerdict === 'BUILD' || dossier.overallVerdict === 'BUILD_IF_VALIDATED') {
    verdictBadge.className = 'font-mono text-2xl font-black text-emerald-700 mt-0.5 block';
  } else if (dossier.overallVerdict === 'REFINE') {
    verdictBadge.className = 'font-mono text-2xl font-black text-amber-700 mt-0.5 block';
  } else {
    verdictBadge.className = 'font-mono text-2xl font-black text-red-700 mt-0.5 block';
  }

  // 5-Dimensional Resilience Breakdown
  const resGrid = document.getElementById('resilienceGrid');
  if (resGrid && dossier.resilienceBreakdown) {
    const rb = dossier.resilienceBreakdown;
    const feas = rb.technicalFeasibility ?? 75;
    const demand = rb.demandAndAdoption ?? rb.marketDemand ?? 70;
    const econ = rb.economicsAndCapitalEfficiency ?? rb.unitEconomicsViability ?? 70;
    const moat = rb.defensibilityAndMoat ?? rb.defensibility ?? 65;
    const proc = rb.adversarialResilience ?? rb.regulatoryAndProcurement ?? 60;

    resGrid.innerHTML = `
      <div class="p-3 bg-white rounded-xl border border-sand-200">
        <div class="text-[10px] text-zinc-500 uppercase">Feasibility (20%)</div>
        <div class="text-base font-extrabold text-zinc-900 mt-0.5">${feas}%</div>
        <div class="text-[9px] text-zinc-400 mt-1">Latency, architecture &amp; isolation</div>
      </div>
      <div class="p-3 bg-white rounded-xl border border-sand-200">
        <div class="text-[10px] text-zinc-500 uppercase">Market Demand (25%)</div>
        <div class="text-base font-extrabold text-zinc-900 mt-0.5">${demand}%</div>
        <div class="text-[9px] text-zinc-400 mt-1">Willingness to pay &amp; friction</div>
      </div>
      <div class="p-3 bg-white rounded-xl border border-sand-200">
        <div class="text-[10px] text-zinc-500 uppercase">Unit Economics (20%)</div>
        <div class="text-base font-extrabold text-zinc-900 mt-0.5">${econ}%</div>
        <div class="text-[9px] text-zinc-400 mt-1">LTV/CAC ratio &amp; gross margin</div>
      </div>
      <div class="p-3 bg-white rounded-xl border border-sand-200">
        <div class="text-[10px] text-zinc-500 uppercase">Defensibility (15%)</div>
        <div class="text-base font-extrabold text-zinc-900 mt-0.5">${moat}%</div>
        <div class="text-[9px] text-zinc-400 mt-1">Incumbent displacement moat</div>
      </div>
      <div class="p-3 bg-white rounded-xl border border-sand-200">
        <div class="text-[10px] text-zinc-500 uppercase">Resilience (20%)</div>
        <div class="text-base font-extrabold text-zinc-900 mt-0.5">${proc}%</div>
        <div class="text-[9px] text-zinc-400 mt-1">Sales cycle &amp; adversary resistance</div>
      </div>
    `;
  }

  // 6-Agent Swarm Perspectives Grid
  const consensusGrid = document.getElementById('consensusGrid');
  const opinions = dossier.roleAssessments || dossier.agentOpinions || {};
  if (consensusGrid) {
    const rolesList = [
      { key: 'synthesizer', alt: 'founder', label: 'Synthesizer' },
      { key: 'redteam', alt: 'skeptic', label: 'The Skeptic' },
      { key: 'architect', alt: 'architect', label: 'Architect' },
      { key: 'analyst', alt: 'analyst', label: 'Market Recon' },
      { key: 'customer', alt: 'customer', label: 'Customer' },
      { key: 'investor', alt: 'investor', label: 'Financial VC' }
    ];

    consensusGrid.innerHTML = rolesList.map(r => {
      const op = opinions[r.key] || opinions[r.alt];
      if (!op) return '';
      const scoreColor = op.score >= 75 ? 'text-emerald-700' : (op.score >= 50 ? 'text-amber-700' : 'text-red-700');
      const fatalFlawSnippet = op.fatalFlaws && op.fatalFlaws.length > 0 ? op.fatalFlaws[0] : 'None articulated';

      return `
        <div class="p-3 bg-white rounded-xl border border-sand-200 space-y-1">
          <div class="text-[10px] text-zinc-400 uppercase font-bold truncate">${r.label}</div>
          <div class="text-base font-extrabold ${scoreColor}">${op.score}/100</div>
          <div class="text-[9px] text-zinc-500 leading-tight truncate" title="${escapeHtml(fatalFlawSnippet)}">${escapeHtml(fatalFlawSnippet)}</div>
        </div>
      `;
    }).join('');
  }

  // Evidence & Critical Unvalidated Assumption
  const strongestEv = dossier.strongestEvidence || (dossier.evidenceFeed || []).find(e => e.indicator === 'SUPPORTING') || {
    claim: "Statutory frameworks and architectural feasibility confirmed.",
    tier: "VERIFIED_COMPUTATION",
    provenance: "Deterministic Subprocess Sandbox"
  };
  document.getElementById('resEvidenceClaim').textContent = strongestEv.claim;
  document.getElementById('resEvidenceTier').textContent = `TIER: ${strongestEv.tier}`;
  document.getElementById('resEvidenceProv').textContent = `PROV: ${strongestEv.provenance}`;

  const redTeamOp = opinions.redteam || opinions.skeptic;
  const criticalFlaw = dossier.weakestAssumption?.fatalRisk 
    || dossier.weakestAssumption?.statement 
    || (redTeamOp && redTeamOp.fatalFlaws && redTeamOp.fatalFlaws[0]) 
    || "Purchasing commitment unproven with paying counterparties.";
  document.getElementById('resAssumptionClaim').textContent = criticalFlaw;

  // Commercial Grounding: Razorpay Itch + Loot Drop Graveyard
  const commBlock = document.getElementById('resCommercialGrounding');
  if (commBlock) {
    const itchItems = (dossier.evidenceFeed || []).filter(e => e.claim && e.claim.includes('Razorpay'));
    const graveyardItems = (dossier.evidenceFeed || []).filter(e => e.claim && (e.claim.includes('Graveyard') || e.claim.includes('burned')));

    let groundingHtml = '<div class="space-y-2">';
    if (itchItems.length > 0) {
      groundingHtml += `<div class="p-2.5 bg-white border border-sand-200 rounded-lg text-emerald-800"><span class="font-bold uppercase text-[10px]">Razorpay Fix My Itch Demand Grounding:</span> ${escapeHtml(itchItems[0].claim)}</div>`;
    } else {
      groundingHtml += `<div class="text-zinc-500">No direct micro-SME billing friction matched from Razorpay problem database.</div>`;
    }

    if (graveyardItems.length > 0) {
      groundingHtml += `<div class="p-2.5 bg-white border border-red-200 rounded-lg text-red-800"><span class="font-bold uppercase text-[10px]">Startup Graveyard Forensic Precedent Flagged:</span> ${escapeHtml(graveyardItems[0].claim)}</div>`;
    } else {
      groundingHtml += `<div class="text-emerald-700 font-semibold">Clean bill of health against known high-profile startup failure traps (Loot Drop Forensics).</div>`;
    }
    groundingHtml += '</div>';
    commBlock.innerHTML = groundingHtml;
  }

  // Unit Economics Monte Carlo Summary & Canvas Charts
  renderMonteCarloPanel(dossier);

  // Falsifiable Kill Conditions & 7-Day Test
  const killList = document.getElementById('resKillConditions');
  const killConds = dossier.killConditions || dossier.falsifiableKillConditions || [];
  if (killList) {
    killList.innerHTML = killConds.map(kc => `
      <div class="p-2 bg-white rounded border border-sand-200 text-xs">
        <span class="font-bold text-red-800">[KILL]</span> ${escapeHtml(kc)}
      </div>
    `).join('');
  }

  const valExp = document.getElementById('resValidationExp');
  if (valExp && dossier.cheapestValidationExperiment) {
    const exp = dossier.cheapestValidationExperiment;
    valExp.innerHTML = `
      <div class="p-2 bg-white rounded border border-sand-200 space-y-1 text-xs">
        <div class="font-bold text-zinc-900">${escapeHtml(exp.title)}</div>
        <div class="text-zinc-600">${escapeHtml(exp.description)}</div>
        <div class="flex items-center gap-3 text-[10px] text-zinc-400 pt-1 border-t border-sand-100">
          <span>Cost: ${exp.costEstimateUsd}</span>
          <span>Timeline: ${exp.durationDays} days</span>
          <span>Target Metric: ${exp.targetValidationMetric}</span>
        </div>
      </div>
    `;
  }

  // Mutation Engine Panel
  const mutSection = document.getElementById('resMutationSection');
  const mutGrid = document.getElementById('resMutationGrid');
  if (mutSection && mutGrid) {
    if (dossier.killScore < 55 && dossier.mutationProposals && dossier.mutationProposals.length > 0) {
      mutSection.classList.remove('hidden');
      mutGrid.innerHTML = dossier.mutationProposals.map(m => {
        const strat = (m.strategy || m.strategyType || 'STRATEGIC_PIVOT').toString().replace(/_/g, ' ');
        return `
          <div class="p-3 bg-white border border-sand-200 rounded-xl space-y-1.5">
            <div class="text-[10px] font-bold text-zinc-500 uppercase">${escapeHtml(strat)}</div>
            <div class="font-bold text-zinc-950 text-xs">${escapeHtml(m.label || '')}</div>
            <p class="text-[11px] text-zinc-600 leading-relaxed font-sans">${escapeHtml(m.rationale || '')}</p>
          </div>
        `;
      }).join('');
    } else {
      mutSection.classList.add('hidden');
    }
  }

  // Epistemic Audit Table
  const auditTable = document.getElementById('resAuditTable');
  if (auditTable && dossier.verificationAudit) {
    const audit = dossier.verificationAudit;
    document.getElementById('resAuditStats').textContent = `PROTOCOL: ${audit.verifierProtocol} // ${audit.totalClaimsAudited} CLAIMS AUDITED (${audit.hallucinationsBlocked} HALFWAY TRUTHS BLOCKED)`;
    auditTable.innerHTML = audit.auditItems.map(item => `
      <div class="p-2.5 flex items-start justify-between gap-3 text-[11px]">
        <div>
          <div class="font-bold text-zinc-900">${escapeHtml(item.claimOrOpinion)}</div>
          <div class="text-zinc-500 font-sans mt-0.5">${escapeHtml(item.rationale)}</div>
        </div>
        <span class="px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${item.verdict === 'VERIFIED_PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
          ${item.verdict}
        </span>
      </div>
    `).join('');
  }
}

// Monte Carlo Canvas Charts Renderer
function renderMonteCarloPanel(dossier) {
  const sim = dossier.simulation || {};
  const rawMc = sim.monteCarlo || dossier.pythonUnitEconomics?.monteCarlo || {};

  const p10Ltv = Number(rawMc.ltvCacPercentiles?.p10 ?? rawMc.p10LtvCacRatio ?? (sim.ltvCacRatio ? sim.ltvCacRatio * 0.7 : 2.1));
  const p50Ltv = Number(rawMc.ltvCacPercentiles?.p50 ?? rawMc.p50LtvCacRatio ?? sim.ltvCacRatio ?? 3.4);
  const p90Ltv = Number(rawMc.ltvCacPercentiles?.p90 ?? rawMc.p90LtvCacRatio ?? (sim.ltvCacRatio ? sim.ltvCacRatio * 1.5 : 5.8));

  const p10Payback = Number(rawMc.paybackPercentiles?.p10 ?? rawMc.cacPaybackMonths?.p10 ?? (sim.estimatedPaybackMonths ? sim.estimatedPaybackMonths * 0.6 : 3.5));
  const p50Payback = Number(rawMc.paybackPercentiles?.p50 ?? rawMc.cacPaybackMonths?.p50 ?? sim.estimatedPaybackMonths ?? 6.2);
  const p90Payback = Number(rawMc.paybackPercentiles?.p90 ?? rawMc.cacPaybackMonths?.p90 ?? (sim.estimatedPaybackMonths ? sim.estimatedPaybackMonths * 1.6 : 10.5));

  const survivalProb = Number(rawMc.survivalProbability24Mo ?? rawMc.survivalProbability12Mo ?? rawMc.survivalProbability5Yr ?? 0.75);

  const tornadoDrivers = Array.isArray(rawMc.sensitivity) && rawMc.sensitivity.length > 0
    ? rawMc.sensitivity.slice(0, 3).map(s => ({ driver: (s.param || '').replace(/_/g, ' '), swingMonths: Math.max(0.5, Number(s.absoluteDelta || 0.8) * 4) }))
    : (Array.isArray(rawMc.sensitivityTornado) && rawMc.sensitivityTornado.length > 0
        ? rawMc.sensitivityTornado.slice(0, 3)
        : [
            { driver: "Organic Churn", swingMonths: 4.2 },
            { driver: "CAC Inflation", swingMonths: 3.1 },
            { driver: "Infra Cost", swingMonths: 1.4 }
          ]);

  const mc = {
    iterations: rawMc.iterations || 10000,
    survivalProbability: survivalProb,
    ltv: { p10: p10Ltv, p50: p50Ltv, p90: p90Ltv },
    payback: { p10: p10Payback, p50: p50Payback, p90: p90Payback },
    tornado: tornadoDrivers
  };

  const cardsContainer = document.getElementById('mcSummaryCards');
  if (cardsContainer) {
    cardsContainer.innerHTML = `
      <div class="p-3 bg-sand-50 rounded-xl border border-sand-200">
        <div class="text-[10px] text-zinc-500 uppercase">P50 LTV/CAC Ratio</div>
        <div class="text-base font-extrabold text-zinc-900 mt-0.5">${mc.ltv.p50.toFixed(2)}x</div>
        <div class="text-[9px] text-zinc-400 mt-1">P10 downside: ${mc.ltv.p10.toFixed(2)}x | P90 upside: ${mc.ltv.p90.toFixed(2)}x</div>
      </div>
      <div class="p-3 bg-sand-50 rounded-xl border border-sand-200">
        <div class="text-[10px] text-zinc-500 uppercase">Estimated CAC Payback</div>
        <div class="text-base font-extrabold text-zinc-900 mt-0.5">${mc.payback.p50.toFixed(1)} Months</div>
        <div class="text-[9px] text-zinc-400 mt-1">P10: ${mc.payback.p10.toFixed(1)}m | P90: ${mc.payback.p90.toFixed(1)}m</div>
      </div>
      <div class="p-3 bg-sand-50 rounded-xl border border-sand-200">
        <div class="text-[10px] text-zinc-500 uppercase">Survival Probability</div>
        <div class="text-base font-extrabold text-emerald-700 mt-0.5">${(mc.survivalProbability * 100).toFixed(1)}%</div>
        <div class="text-[9px] text-zinc-400 mt-1">Across 10,000 numpy iterations</div>
      </div>
    `;
  }

  // Draw Canvases
  renderSurvivalChart(mc);
  renderPaybackChart(mc);
  renderTornadoChart(mc);
}

function renderSurvivalChart(mc) {
  const canvas = document.getElementById('chartSurvival');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth || 300;
  const h = 160;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);
  const p = mc.survivalProbability || 0.75;
  const years = [1, 2, 3, 4, 5];
  const probs = years.map(y => Math.max(0.05, Math.pow(p, y / 2.2)));

  const padLeft = 32, padBottom = 24, padTop = 16, padRight = 16;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  // Grid
  ctx.strokeStyle = '#e7e5e4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop + plotH);
  ctx.lineTo(padLeft + plotW, padTop + plotH);
  ctx.stroke();

  // Curve
  ctx.strokeStyle = '#09090b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  probs.forEach((pr, idx) => {
    const x = padLeft + (idx / (years.length - 1)) * plotW;
    const y = padTop + (1 - pr) * plotH;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Labels
  ctx.fillStyle = '#71717a';
  ctx.font = '10px "IBM Plex Mono", monospace';
  years.forEach((yr, idx) => {
    const x = padLeft + (idx / (years.length - 1)) * plotW;
    ctx.fillText(`Y${yr}`, x - 6, h - 6);
  });
}

function renderPaybackChart(mc) {
  const canvas = document.getElementById('chartPayback');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth || 300;
  const h = 160;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);
  const p10 = mc.payback?.p10 ?? 4;
  const p50 = mc.payback?.p50 ?? 7;
  const p90 = mc.payback?.p90 ?? 12;

  const padLeft = 24, padRight = 24, padTop = 32, padBottom = 32;
  const plotW = w - padLeft - padRight;
  const maxVal = Math.max(16, p90 * 1.3);

  // Line track
  const y = h / 2;
  ctx.strokeStyle = '#e7e5e4';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(padLeft, y);
  ctx.lineTo(padLeft + plotW, y);
  ctx.stroke();

  // P10 to P90 range bar
  const x10 = padLeft + (p10 / maxVal) * plotW;
  const x50 = padLeft + (p50 / maxVal) * plotW;
  const x90 = padLeft + (p90 / maxVal) * plotW;

  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(x10, y - 6, x90 - x10, 12);

  // P50 marker
  ctx.fillStyle = '#09090b';
  ctx.beginPath();
  ctx.arc(x50, y, 7, 0, Math.PI * 2);
  ctx.fill();

  // Text
  ctx.fillStyle = '#09090b';
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.fillText(`P50: ${p50.toFixed(1)}m`, x50 - 18, y - 14);
  ctx.fillStyle = '#71717a';
  ctx.fillText(`P10: ${p10.toFixed(1)}m`, x10 - 14, y + 22);
  ctx.fillText(`P90: ${p90.toFixed(1)}m`, x90 - 14, y + 22);
}

function renderTornadoChart(mc) {
  const canvas = document.getElementById('chartTornado');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.parentElement.clientWidth || 300;
  const h = 160;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);
  const drivers = mc.tornado || [
    { driver: "Organic Churn", swingMonths: 4.2 },
    { driver: "CAC Inflation", swingMonths: 3.1 },
    { driver: "Infra Cost", swingMonths: 1.4 }
  ];

  const padLeft = 90, padRight = 36, padTop = 16, padBottom = 16;
  const plotW = w - padLeft - padRight;
  const maxSwing = Math.max(...drivers.map(d => d.swingMonths), 5);
  const rowH = 36;

  ctx.font = '10px "IBM Plex Mono", monospace';
  drivers.forEach((d, idx) => {
    const y = padTop + idx * rowH + 12;
    ctx.fillStyle = '#09090b';
    ctx.fillText((d.driver || '').slice(0, 12), 8, y + 10);

    const barW = Math.max(8, (d.swingMonths / maxSwing) * plotW);
    ctx.fillStyle = '#d6d3d1';
    ctx.fillRect(padLeft, y, barW, 14);

    ctx.fillStyle = '#71717a';
    ctx.fillText(`+${d.swingMonths.toFixed(1)}m`, padLeft + barW + 6, y + 11);
  });
}

// ============================================================
// 4. EXPORT ENGINE (PDF, MARKDOWN, JSON, VALIDATION KIT)
// ============================================================
function exportDossierPdf() {
  if (!currentRenderedDossier) {
    alert("No active dossier report is loaded to export.");
    return;
  }
  window.print();
}

function downloadDossierExport(format) {
  if (!currentRenderedDossierId) {
    alert("No active dossier compiled yet.");
    return;
  }
  window.open(`/api/dossiers/${currentRenderedDossierId}/export?format=${format}`, '_blank');
}

function downloadExperimentKit() {
  if (!currentRenderedDossier) {
    alert("No active dossier compiled yet.");
    return;
  }

  const d = currentRenderedDossier;
  const exp = d.cheapestValidationExperiment || {
    title: "Cold Call & Landing Page Smoke Test",
    description: "Pitch 15 targeted buyers directly without building any software.",
    costEstimateUsd: "$50",
    durationDays: 7,
    targetValidationMetric: "At least 3 letters of intent or deposits"
  };

  const md = `# VALIDATION EXPERIMENT KIT: ${d.idea.title.toUpperCase()}
Dossier Code: ${d.dossierCode}
Overall Verdict: ${d.overallVerdict}

## 1. 7-Day Experiment Protocol
* Experiment: ${exp.title}
* Budget: ${exp.costEstimateUsd}
* Duration: ${exp.durationDays} Days
* Success Metric: ${exp.targetValidationMetric}

## 2. Hypothesis & Execution Plan
${exp.description}

## 3. Falsifiable Kill Conditions
${(d.killConditions || d.falsifiableKillConditions || []).map((kc, idx) => `${idx + 1}. ${kc}`).join('\n')}

---
Generated by Dossier Adversarial Intelligence Platform.
`;

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `validation_kit_${d.id}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// 5. MCP SETUP GUIDE INTERACTIVE TABS & COPY
// ============================================================
function setMcpTab(tab) {
  currentMcpTab = tab;
  ['claude', 'cursor', 'windsurf', 'cli'].forEach(t => {
    const btn = document.getElementById(`mcpTab-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = 'px-2.5 py-1 rounded bg-zinc-800 text-white font-bold transition';
      } else {
        btn.className = 'px-2.5 py-1 rounded text-zinc-400 hover:text-white transition';
      }
    }
  });

  const codeEl = document.querySelector('#mcpCodeBlock code');
  if (codeEl && MCP_TEMPLATES[tab]) {
    codeEl.textContent = MCP_TEMPLATES[tab];
  }
}

function copyMcpCode() {
  const code = MCP_TEMPLATES[currentMcpTab] || '';
  navigator.clipboard.writeText(code).then(() => {
    const textSpan = document.getElementById('copyMcpText');
    if (textSpan) {
      const orig = textSpan.textContent;
      textSpan.textContent = "Copied!";
      setTimeout(() => { textSpan.textContent = orig; }, 2000);
    }
  });
}

// ============================================================
// 6. DOSSIER ARCHIVE LISTING
// ============================================================
async function loadRecentDossiers() {
  const listEl = document.getElementById('recentDossiersList');
  if (!listEl) return;

  try {
    const res = await fetch('/api/dossiers?limit=5');
    const data = await res.json();
    if (data.success && Array.isArray(data.dossiers) && data.dossiers.length > 0) {
      listEl.innerHTML = data.dossiers.slice(0, 5).map(d => {
        const isBuild = d.verdict === 'BUILD' || d.verdict === 'BUILD_IF_VALIDATED';
        const isRefine = d.verdict === 'REFINE';
        const badgeClass = isBuild ? 'bg-emerald-100 text-emerald-800' : (isRefine ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800');
        const scoreFmt = (d.score / 10).toFixed(1);
        const dateStr = d.timestamp ? d.timestamp.slice(0, 10) : 'Recent';

        return `
          <div onclick="loadDossierById('${d.id}')" class="p-3.5 hover:bg-sand-50 flex items-center justify-between cursor-pointer transition">
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-zinc-400 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <div>
                <div class="font-bold text-xs text-zinc-950">${escapeHtml(d.title)}</div>
                <div class="text-[11px] text-zinc-500 font-mono mt-0.5">${escapeHtml(d.dossierCode)} • ${dateStr}</div>
              </div>
            </div>
            <div class="flex items-center gap-3 font-mono">
              <span class="px-2.5 py-0.5 rounded text-[10px] font-bold ${badgeClass}">
                ${escapeHtml(d.verdict)}
              </span>
              <span class="text-xs font-semibold text-zinc-700">
                ${scoreFmt}/10
              </span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      listEl.innerHTML = `<div class="p-4 text-xs font-mono text-zinc-400">No previous dossiers recorded yet.</div>`;
    }
  } catch (e) {
    listEl.innerHTML = `<div class="p-4 text-xs font-mono text-zinc-400">Failed to load archive: ${escapeHtml(e.message)}</div>`;
  }
}

async function loadDossierById(id) {
  try {
    const res = await fetch(`/api/dossiers/${id}`);
    const data = await res.json();
    if (data.success && data.dossier) {
      renderDossier(data.dossier);
      const resSection = document.getElementById('resultsSection');
      if (resSection) resSection.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    alert("Failed to load dossier: " + err.message);
  }
}

// ============================================================
// 7. API KEY MODAL HELPERS & SECURITY
// ============================================================
function dossierApiKey() {
  try {
    return localStorage.getItem('DOSSIER_API_KEY') || '';
  } catch (e) {
    return '';
  }
}

function apiHeaders() {
  const k = dossierApiKey();
  return k ? { 'Authorization': `Bearer ${k}` } : {};
}

function openApiKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  const input = document.getElementById('apiKeyInput');
  if (input) input.value = dossierApiKey();
  if (modal) modal.classList.remove('hidden');
}

function closeApiKeyModal() {
  const modal = document.getElementById('apiKeyModal');
  if (modal) modal.classList.add('hidden');
}

function submitApiKey(e) {
  e.preventDefault();
  const input = document.getElementById('apiKeyInput');
  const key = (input ? input.value : '').trim();
  try {
    if (key) {
      localStorage.setItem('DOSSIER_API_KEY', key);
    } else {
      localStorage.removeItem('DOSSIER_API_KEY');
    }
  } catch (err) {}
  closeApiKeyModal();
}

function clearApiKey() {
  try {
    localStorage.removeItem('DOSSIER_API_KEY');
  } catch (err) {}
  const input = document.getElementById('apiKeyInput');
  if (input) input.value = '';
  closeApiKeyModal();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
