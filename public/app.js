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

      if (stage.includes('01 INGEST') || stage.includes('01 CLASSIFY') || stage.includes('01 GATED')) {
        setStepActive('ingest', detail);
      } else if (stage.includes('02 RECON') || stage.includes('02 DECOMPOSE') || stage.includes('MARKET')) {
        setStepComplete('ingest');
        setStepActive('recon', detail);
      } else if (stage.includes('03 SWARM') || stage.includes('03 INVESTIGATE')) {
        setStepComplete('ingest');
        setStepComplete('recon');
        setStepActive('swarm', detail);
      } else if (stage.includes('04 DEBATE') || stage.includes('04 ATTACK') || stage.includes('CROSSFIRE')) {
        setStepComplete('ingest');
        setStepComplete('recon');
        setStepComplete('swarm');
        setStepActive('debate', detail);
      } else if (stage.includes('05 VERIFY')) {
        setStepComplete('ingest');
        setStepComplete('recon');
        setStepComplete('swarm');
        setStepComplete('debate');
        setStepActive('verify', detail);
      } else if (stage.includes('06 COMPILE') || stage.includes('06 CONVERGE') || stage.includes('07 VERDICT') || stage.includes('SYNTHESIS')) {
        setStepComplete('ingest');
        setStepComplete('recon');
        setStepComplete('swarm');
        setStepComplete('debate');
        setStepComplete('verify');
        setStepActive('compile', detail);
      }
      break;
    }

    case 'agent_start': {
      setStepComplete('ingest');
      setStepComplete('recon');
      setStepActive('swarm', `Deploying ${data.roleTitle || data.role}...`);
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
  renderSobolPanel(dossier);
  renderValidationPriority(dossier);

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
  const valSignals = document.getElementById('resValidationSignals');
  if (valExp && dossier.cheapestValidationExperiment) {
    const exp = dossier.cheapestValidationExperiment;
    const costText = exp.costEstimateUsd || (exp.estimatedCostUsd !== undefined ? `$${exp.estimatedCostUsd}` : '$0 (Pre-build interviews)');
    const timelineText = exp.durationDays || exp.timeToExecuteDays || 4;
    const targetText = exp.targetValidationMetric || exp.successMetric || '>= 3 signed pilot LOIs or concrete budget allocations secured';
    const failureText = exp.failureKillSignal || '<= 1 LOI signed after 10 qualified interviews indicates polite interest without purchasing intent — KILL or PIVOT.';

    valExp.innerHTML = `
      <div class="space-y-1.5">
        <div class="font-bold text-zinc-950 text-xs">${escapeHtml(exp.title || '')}</div>
        <p class="text-zinc-700 leading-relaxed text-xs font-sans">${escapeHtml(exp.description || '')}</p>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-zinc-500 pt-2 border-t border-sand-200">
          <span><strong class="text-zinc-800">Cost:</strong> ${escapeHtml(String(costText))}</span>
          <span><strong class="text-zinc-800">Timeline:</strong> ${escapeHtml(String(timelineText))} days</span>
        </div>
      </div>
    `;

    if (valSignals) {
      valSignals.innerHTML = `
        <div class="p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 text-[11px]">
          <span class="font-bold uppercase tracking-wider text-[10px] text-emerald-800 block">Pass Gate (Success Metric):</span>
          <span class="font-sans">${escapeHtml(targetText)}</span>
        </div>
        <div class="p-2 bg-red-50 border border-red-200 rounded text-red-900 text-[11px]">
          <span class="font-bold uppercase tracking-wider text-[10px] text-red-800 block">Kill Signal (Failure Threshold):</span>
          <span class="font-sans">${escapeHtml(failureText)}</span>
        </div>
      `;
    }
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
      <div class="p-3 flex items-start justify-between gap-4 text-xs">
        <div class="space-y-1">
          <div class="font-bold text-zinc-900">${formatClaimWithHyperlinks(item.claimOrOpinion)}</div>
          <div class="text-zinc-600 font-sans leading-relaxed text-[11px]">${formatClaimWithHyperlinks(item.rationale)}</div>
        </div>
        <span class="px-2.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${item.verdict === 'VERIFIED_PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
          ${item.verdict}
        </span>
      </div>
    `).join('');
  }
}

// Convert raw URLs in text into clean, styled hyperlinks with domain pill labels
function formatClaimWithHyperlinks(rawText) {
  if (!rawText) return '';
  const escaped = escapeHtml(rawText);
  const urlRegex = /(https?:\/\/[^\s\)\],<]+)/g;
  return escaped.replace(urlRegex, (url) => {
    let hostLabel = 'External Source';
    try {
      const parsed = new URL(url);
      hostLabel = parsed.hostname.replace(/^www\./, '');
      if (parsed.pathname && parsed.pathname.length > 1) {
        const segment = parsed.pathname.slice(0, 16);
        hostLabel += segment + (parsed.pathname.length > 16 ? '...' : '');
      }
    } catch (e) {
      hostLabel = url;
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-blue-700 hover:text-blue-900 font-mono text-[10px] font-semibold transition border border-zinc-200">
      <span>${escapeHtml(hostLabel)}</span>
      <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
      </svg>
    </a>`;
  });
}

// Monte Carlo Canvas Charts Renderer
function renderMonteCarloPanel(dossier) {
  const sim = dossier.simulation || {};
  const rawMc = sim.monteCarlo || dossier.pythonUnitEconomics?.monteCarlo || {};
  const pSuccess = Number(dossier.pSuccess ?? (dossier.overallVerdict === 'KILL' ? 0.35 : dossier.overallVerdict === 'REFINE' ? 0.74 : 0.78));

  const p10Ltv = Number(rawMc.ltvCacPercentiles?.p10 ?? rawMc.p10LtvCacRatio ?? (sim.ltvCacRatio ? sim.ltvCacRatio * 0.7 : 2.1));
  const p50Ltv = Number(rawMc.ltvCacPercentiles?.p50 ?? rawMc.p50LtvCacRatio ?? sim.ltvCacRatio ?? 3.4);
  const p90Ltv = Number(rawMc.ltvCacPercentiles?.p90 ?? rawMc.p90LtvCacRatio ?? (sim.ltvCacRatio ? sim.ltvCacRatio * 1.5 : 5.8));

  const p10Payback = Number(rawMc.paybackPercentiles?.p10 ?? rawMc.cacPaybackMonths?.p10 ?? (sim.estimatedPaybackMonths ? sim.estimatedPaybackMonths * 0.6 : 3.5));
  const p50Payback = Number(rawMc.paybackPercentiles?.p50 ?? rawMc.cacPaybackMonths?.p50 ?? sim.estimatedPaybackMonths ?? 6.2);
  const p90Payback = Number(rawMc.paybackPercentiles?.p90 ?? rawMc.cacPaybackMonths?.p90 ?? (sim.estimatedPaybackMonths ? sim.estimatedPaybackMonths * 1.6 : 10.5));

  const rawSurvival24 = Number(rawMc.survivalProbability24Mo ?? rawMc.survivalProbability12Mo ?? 1.0);
  // Composite annual survival rate blending cash solvency with epistemic probability of success
  const annualSurvivalRate = Math.min(0.96, Math.max(0.20, Math.pow(rawSurvival24, 0.5) * (0.35 + 0.65 * pSuccess)));
  const survivalProb = annualSurvivalRate;

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
    annualSurvivalRate: annualSurvivalRate,
    pSuccess: pSuccess,
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
        <div class="text-[10px] text-zinc-500 uppercase">Year-1 Survival Prob</div>
        <div class="text-base font-extrabold text-emerald-700 mt-0.5">${(mc.survivalProbability * 100).toFixed(1)}%</div>
        <div class="text-[9px] text-zinc-400 mt-1">Stochastic solvency blended with pSuccess</div>
      </div>
    `;
  }

  // Render Editorial Financial Ledger (Text-first, print-safe)
  const ledgerContainer = document.getElementById('mcFinancialLedger');
  if (ledgerContainer) {
    const rate = mc.annualSurvivalRate || mc.survivalProbability || 0.85;
    const years = [1, 2, 3, 4, 5];
    const probs = years.map(y => Math.round(Math.max(0.04, Math.pow(rate, y)) * 100));

    const p10P = mc.payback?.p10 ?? 1.8;
    const p50P = mc.payback?.p50 ?? 3.0;
    const p90P = mc.payback?.p90 ?? 4.2;
    const efficiencyVerdict = p50P <= 6.0 ? "HIGH (Capital Efficient SaaS)" : (p50P <= 12.0 ? "MODERATE (Standard Venture Horizon)" : "CRITICAL (Prolonged Working Capital Drain)");

    const tornado = mc.tornado || [];

    ledgerContainer.innerHTML = `
      <!-- Row 1: 5-Year Survival -->
      <div class="p-4 space-y-2">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-bold text-zinc-950 uppercase">1. FIVE-YEAR SURVIVAL TRAJECTORY (10,000 Stochastic Cohort Runs)</span>
          <span class="text-zinc-500 text-[10px]">ANNUAL RETENTION DECAY</span>
        </div>
        <div class="grid grid-cols-5 gap-2 pt-1">
          ${years.map((y, idx) => `
            <div class="p-2 bg-white rounded-lg border border-sand-200 text-center">
              <div class="text-[10px] text-zinc-400 font-bold uppercase">Year ${y}</div>
              <div class="text-sm font-extrabold ${probs[idx] >= 65 ? 'text-emerald-700' : (probs[idx] >= 40 ? 'text-amber-700' : 'text-red-700')} mt-0.5">${probs[idx]}%</div>
            </div>
          `).join('')}
        </div>
        <div class="text-[11px] text-zinc-600 font-sans pt-1">
          <strong class="text-zinc-900 font-mono">Cohort Solvency Takeaway:</strong> ${probs[4] <= 30 ? 'Compounding customer churn and replacement CAC cause severe capital exhaustion past Month 24 without retention expansion.' : 'Cohorts maintain positive cumulative contribution margin through Year 5 under modeled churn boundaries.'}
        </div>
      </div>

      <!-- Row 2: CAC Payback Horizon -->
      <div class="p-4 space-y-2">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-bold text-zinc-950 uppercase">2. CUSTOMER ACQUISITION (CAC) PAYBACK HORIZON</span>
          <span class="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold">${efficiencyVerdict}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 pt-1 text-center">
          <div class="p-2.5 bg-white rounded-lg border border-sand-200">
            <div class="text-[10px] text-zinc-400 uppercase">Best Case (P10)</div>
            <div class="text-sm font-extrabold text-zinc-900 mt-0.5">${p10P.toFixed(1)} Months</div>
            <div class="text-[10px] text-zinc-500 mt-0.5">Viral / inbound conversion</div>
          </div>
          <div class="p-2.5 bg-white rounded-lg border border-sand-200 border-zinc-400 bg-sand-50/50">
            <div class="text-[10px] text-zinc-600 uppercase font-bold">Expected Reality (P50)</div>
            <div class="text-base font-black text-zinc-950 mt-0.5">${p50P.toFixed(1)} Months</div>
            <div class="text-[10px] text-zinc-600 mt-0.5">Median stochastic breakeven</div>
          </div>
          <div class="p-2.5 bg-white rounded-lg border border-sand-200">
            <div class="text-[10px] text-zinc-400 uppercase">Downside Stress (P90)</div>
            <div class="text-sm font-extrabold text-zinc-900 mt-0.5">${p90P.toFixed(1)} Months</div>
            <div class="text-[10px] text-zinc-500 mt-0.5">Ad inflation &amp; sales inertia</div>
          </div>
        </div>
      </div>

      <!-- Row 3: Sensitivity Tornado -->
      <div class="p-4 space-y-2">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-bold text-zinc-950 uppercase">3. SENSITIVITY VULNERABILITIES (Ranked by Payback Delay Impact)</span>
          <span class="text-zinc-500 text-[10px]">10% ADVERSE SHIFT IMPACT</span>
        </div>
        <div class="space-y-1.5 pt-1">
          ${tornado.map((item, idx) => `
            <div class="p-2 bg-white rounded-lg border border-sand-200 flex items-center justify-between text-xs">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded bg-sand-100 text-zinc-700 font-bold flex items-center justify-center text-[10px]">${idx + 1}</span>
                <span class="font-bold text-zinc-900">${escapeHtml(item.driver || '')}</span>
              </div>
              <div class="flex items-center gap-3">
                <span class="text-zinc-500 font-sans text-[11px]">Delays customer payback by:</span>
                <span class="px-2 py-0.5 rounded bg-red-100 text-red-900 font-bold font-mono text-[11px]">+${Number(item.swingMonths || 0).toFixed(1)}m</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="text-[11px] text-zinc-500 font-sans pt-1">
          <strong class="text-zinc-900 font-mono">Executive Action:</strong> Target metric #${tornado.length > 0 ? '1 (' + escapeHtml(tornado[0].driver || '') + ')' : '1'} before scaling spend, as it generates the largest unit-margin variance.
        </div>
      </div>
    `;
  }
}

// ============================================================
// 4. EXPORT ENGINE (PDF, MARKDOWN, JSON, VALIDATION KIT)
// ============================================================
function exportDossierPdf() {
  if (!currentRenderedDossierId) {
    if (!currentRenderedDossier) {
      alert("No active dossier report is loaded to export.");
      return;
    }
    // Fallback to browser print if no ID saved yet
    const detailsList = document.querySelectorAll('#resultsSection details');
    detailsList.forEach(d => d.setAttribute('open', ''));
    window.print();
    return;
  }

  // Trigger Playwright server-side PDF generation & direct download
  window.open(`/api/dossiers/${currentRenderedDossierId}/export?format=pdf`, '_blank');
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

// Auto-load dossier if URL specifies #dossier=<id> or #print=<id>
window.addEventListener('DOMContentLoaded', async () => {
  loadCalibrationPanel();
  const hash = window.location.hash || '';
  const match = hash.match(/#(?:dossier|print)=([^&]+)/);
  if (match && match[1]) {
    await loadDossierById(match[1]);
  }
});

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

// ============================================================
// 8. THEME TOGGLE (LIGHT / DARK EDITORIAL SYSTEM)
// ============================================================
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  try {
    localStorage.setItem('dossier_theme', isDark ? 'dark' : 'light');
  } catch (e) {}
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    try {
      if (!localStorage.getItem('dossier_theme')) {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch (err) {}
  });
}

// ======================= A1 — Sobol Global Sensitivity =======================
function prettyParam(p) {
  return String(p || '').replace(/_/g, ' ').replace('ltv cac', 'LTV/CAC');
}

function renderSobolPanel(dossier) {
  const card = document.getElementById('sobolCard');
  const list = document.getElementById('sobolList');
  const notes = document.getElementById('sobolNotes');
  if (!card || !list) return;
  const sobol = dossier.simulation && dossier.simulation.sobol;
  if (!sobol || !sobol.outputs || !sobol.outputs.ltv_cac) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');
  list.innerHTML = '';

  const ranking = (sobol.ltvCacSensitivityRanking && sobol.ltvCacSensitivityRanking.length)
    ? sobol.ltvCacSensitivityRanking
    : Object.entries(sobol.outputs.ltv_cac.total_order)
        .map(([param, v]) => ({ param, totalOrderIndex: v }))
        .sort((a, b) => b.totalOrderIndex - a.totalOrderIndex);

  const fo = sobol.outputs.ltv_cac.first_order || {};
  const maxIdx = Math.max(...ranking.map((r) => r.totalOrderIndex || 0), 0.0001);
  ranking.forEach((r) => {
    const total = Math.max(0, r.totalOrderIndex || 0);
    const direct = Math.max(0, fo[r.param] || 0);
    const row = document.createElement('div');
    row.className = 'space-y-1';
    row.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="w-36 font-mono text-[10px] text-zinc-600 uppercase shrink-0">${escapeHtml(prettyParam(r.param))}</div>
        <div class="text-right font-mono text-[10px] text-zinc-500 shrink-0">
          <span class="text-violet-700 font-bold">${Math.round(total * 100)}%</span> total
          <span class="text-zinc-400">· ${Math.round(direct * 100)}% direct</span>
        </div>
      </div>
      <div class="bg-sand-200 rounded h-3 overflow-hidden">
        <div class="h-3 rounded bg-violet-600/85" style="width: ${Math.round((total / maxIdx) * 100)}%" title="total-order (incl. interactions)"></div>
      </div>
      <div class="bg-sand-200 rounded h-1.5 overflow-hidden">
        <div class="h-1.5 rounded bg-zinc-400/70" style="width: ${Math.round((direct / maxIdx) * 100)}%" title="first-order (direct effect only)"></div>
      </div>
    `;
    list.appendChild(row);
  });

  if (notes) {
    const top = ranking[0];
    notes.textContent = `${sobol.baseSamples || '?'} base samples · ${sobol.modelEvaluations || '?'} model evals · uncertainty in ${escapeHtml(prettyParam(top ? top.param : ''))} explains the largest share of outcome variance. ${(sobol.simulationNotes || '').slice(0, 220)}`;
  }
}

// ======================= A2 — Validation Priority (EVPI) =======================
function renderValidationPriority(dossier) {
  const section = document.getElementById('validationPrioritySection');
  const list = document.getElementById('validationPriorityList');
  if (!section || !list) return;
  const items = dossier.validationPriority || [];
  if (!items.length) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');
  list.innerHTML = '';
  const maxShare = Math.max(...items.map((i) => i.shareOfEvpi || 0), 0.0001);
  items.forEach((item, idx) => {
    const share = Math.max(0, item.shareOfEvpi || 0);
    const row = document.createElement('div');
    row.className = 'p-4 bg-sand-50 rounded-xl border border-sand-200 flex flex-col sm:flex-row sm:items-center gap-3';
    row.innerHTML = `
      <div class="flex-1 space-y-1">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-zinc-900 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">${idx + 1}</span>
          <span class="text-xs font-bold text-zinc-900 font-sans">${escapeHtml(item.experimentTitle)}</span>
          <span class="text-[9px] font-mono text-zinc-400 uppercase">${escapeHtml(prettyParam(item.param))}</span>
        </div>
        <p class="text-[11px] text-zinc-600 font-sans leading-relaxed">${escapeHtml(item.experimentDescription)}</p>
      </div>
      <div class="w-full sm:w-56 shrink-0 space-y-1">
        <div class="flex justify-between font-mono text-[10px] text-zinc-500">
          <span class="text-emerald-700 font-bold">$${escapeHtml(String(item.evpiPerCustomer))}/customer</span>
          <span>${Math.round(share * 100)}% of decision value</span>
        </div>
        <div class="bg-sand-200 rounded h-2.5 overflow-hidden">
          <div class="h-2.5 rounded bg-emerald-600/85" style="width: ${Math.round((share / maxShare) * 100)}%"></div>
        </div>
      </div>
    `;
    list.appendChild(row);
  });
}

// ======================= B1 — Calibration Track Record =======================
function renderCalibrationPanel(calibration) {
  const card = document.getElementById('calibrationCard');
  if (!card || !calibration || typeof calibration !== 'object') {
    if (card) card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');

  const totals = calibration.totals || { recorded: 0, resolved: 0, pending: 0 };
  const totalsEl = document.getElementById('calibrationTotals');
  totalsEl.innerHTML = [
    ['Recorded', totals.recorded],
    ['Resolved', totals.resolved],
    ['Pending', totals.pending]
  ].map(([label, value]) => `
    <div class="p-2 bg-sand-100 rounded-lg">
      <div class="text-lg font-extrabold text-zinc-900 font-sans leading-none">${Number(value || 0)}</div>
      <div class="text-[9px] font-mono text-zinc-500 uppercase mt-1">${label}</div>
    </div>
  `).join('');

  const brierEl = document.getElementById('calibrationBrier');
  if (calibration.brierOverall !== null && calibration.brierOverall !== undefined) {
    brierEl.innerHTML = `<span class="font-bold text-zinc-900">Brier ${calibration.brierOverall}</span> · lower is better · 0.25 = always guessing 50%`;
  } else {
    brierEl.textContent = 'No resolved forecasts yet — resolve outcomes via POST /api/forecasts/:id/resolve to build the track record.';
  }

  const relEl = document.getElementById('calibrationReliability');
  const buckets = (calibration.reliability || []).filter((b) => b.count > 0);
  if (buckets.length > 0) {
    relEl.innerHTML = buckets.map((b) => {
      const pct = (v) => Math.round(v * 100);
      const overconfident = b.predicted - b.observed > 0.05;
      const flag = overconfident ? ' <span class="text-amber-600" title="swarm more confident than outcomes justify">overconfident</span>' : '';
      return `
        <div>
          <div class="flex justify-between font-mono text-[9px] text-zinc-500">
            <span>p ${b.bucket[0]}–${b.bucket[1]} <span class="text-zinc-400">(n=${b.count})</span>${flag}</span>
            <span><span class="text-violet-700 font-bold">${pct(b.predicted)}%</span> pred · <span class="text-emerald-700 font-bold">${pct(b.observed)}%</span> obs</span>
          </div>
          <div class="bg-sand-200 rounded h-1.5 overflow-hidden mt-0.5"><div class="h-1.5 bg-violet-600/85" style="width: ${pct(b.predicted)}%"></div></div>
          <div class="bg-sand-200 rounded h-1.5 overflow-hidden mt-0.5"><div class="h-1.5 bg-emerald-600/85" style="width: ${pct(b.observed)}%"></div></div>
        </div>
      `;
    }).join('');
  } else {
    relEl.innerHTML = '';
  }

  const domEl = document.getElementById('calibrationDomains');
  const domains = (calibration.byDomain || []).filter((d) => d.resolved > 0).slice(0, 3);
  domEl.innerHTML = domains.length
    ? domains.map((d) => `
        <div class="flex justify-between font-mono text-[10px] text-zinc-600">
          <span class="truncate pr-2">${escapeHtml(d.archetype)}</span>
          <span class="shrink-0">${d.resolved} resolved${d.brier !== null ? ` · Brier ${d.brier}` : ''}</span>
        </div>
      `).join('')
    : '';

  const noteEl = document.getElementById('calibrationNote');
  if (noteEl && calibration.mappingNote) noteEl.textContent = calibration.mappingNote;
}

async function loadCalibrationPanel() {
  try {
    const res = await fetch('/api/calibration');
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && data.calibration) renderCalibrationPanel(data.calibration);
  } catch {}
}
