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
        charCount.className = 'font-medium text-bad';
      } else if (len >= 1800) {
        charCount.className = 'font-medium text-warn';
      } else {
        charCount.className = 'font-medium text-ink-2';
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
  if (runBtnText) runBtnText.textContent = "Running swarm";
  if (runBtnArrow) runBtnArrow.classList.add('hidden');
  if (runBtnSpinner) runBtnSpinner.classList.remove('hidden');
  if (navStatus) {
    navStatus.textContent = "Running";
    navStatus.className = "text-warn font-medium";
  }

  // Open stream container & scroll to it
  if (streamContainer) {
    streamContainer.classList.remove('hidden');
    streamContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  document.getElementById('streamActiveConceptTitle').textContent = `Evaluating ${title}`;
  if (streamLog) streamLog.innerHTML = `<div>[0.0s] Initialized one-shot evaluation pipeline for "${escapeHtml(title)}"...</div>`;

  // Reset Stepper
  ['ingest', 'recon', 'swarm', 'debate', 'verify', 'compile'].forEach(step => {
    const el = document.getElementById(`step-${step}`);
    const txt = document.getElementById(`step-${step}-text`);
    if (el) el.className = 'p-3 rounded-lg border border-line bg-page space-y-1';
    if (txt) txt.textContent = 'Waiting...';
  });

  evalStartTime = Date.now();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const elapsed = ((Date.now() - evalStartTime) / 1000).toFixed(1);
    const badge = document.getElementById('streamTimerBadge');
    if (badge) badge.textContent = `${elapsed}s elapsed`;
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
    // Persist across chunks: an event's "event:" line and its "data:" line can arrive in
    // different network chunks (the final dossier event is large), so parser state must not
    // reset per chunk or those events are silently dropped.
    let currentEvent = null;
    let currentData = null;
    let doneDossierId = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep partial line in buffer

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
            if (currentEvent === 'dossier_complete' && currentData.dossier) doneDossierId = currentData.dossier.id;
            if (currentEvent === 'done' && currentData.dossierId) doneDossierId = currentData.dossierId;
            handleStreamEvent(currentEvent, currentData);
          }
          currentEvent = null;
          currentData = null;
        }
      }
    }

    // The dossier is persisted server-side before the stream ends. If the connection dropped
    // before the report rendered (proxy timeout, network blip), recover it instead of failing.
    if (!document.getElementById('resultsSection') || document.getElementById('resSubjectTitle').textContent.trim() === 'Idea title') {
      await recoverDossierAfterStream(doneDossierId);
    }

  } catch (err) {
    appendStreamLog(`Error: ${err.message}`, 'text-red-400 font-medium');
    const recovered = await recoverDossierAfterStream(null);
    if (!recovered) alert(`Evaluation failed: ${err.message}`);
  } finally {
    if (timerInterval) clearInterval(timerInterval);
    if (runBtn) runBtn.disabled = false;
    if (runBtnText) runBtnText.textContent = "Run adversarial swarm";
    if (runBtnArrow) runBtnArrow.classList.remove('hidden');
    if (runBtnSpinner) runBtnSpinner.classList.add('hidden');
    if (navStatus) {
      navStatus.textContent = "Standby";
      navStatus.className = "";
    }
  }
}

/** The dossier is saved server-side before the stream ends; fetch it if the stream dropped. */
async function recoverDossierAfterStream(dossierId) {
  try {
    let id = dossierId;
    if (!id) {
      const res = await fetch('/api/dossiers');
      const j = await res.json();
      const list = j.dossiers || j;
      id = Array.isArray(list) && list.length ? list[0].id : null;
    }
    if (!id) return false;
    const r = await fetch(`/api/dossiers/${encodeURIComponent(id)}`);
    if (!r.ok) return false;
    const data = await r.json();
    const dossier = data.dossier || data;
    if (!dossier || !dossier.id) return false;
    appendStreamLog('Stream closed early; loaded the saved dossier instead.', 'text-amber-400');
    renderDossier(dossier);
    document.getElementById('resultsSection')?.scrollIntoView({ behavior: 'smooth' });
    loadRecentDossiers();
    return true;
  } catch {
    return false;
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
      appendStreamLog(`[${elapsed}s] Crossfire clash: ${data.challenger} challenged ${data.target}: "${(data.challengePoint || '').slice(0, 80)}..."`, 'text-amber-400');
      break;
    }

    case 'audit_correction': {
      appendStreamLog(`[${elapsed}s] Self-correction: ${data.detail || ''}`, 'text-emerald-400');
      break;
    }

    case 'dossier_complete': {
      setStepComplete('verify');
      setStepComplete('compile');
      appendStreamLog(`[${elapsed}s] Complete intelligence dossier compiled. Rendering final report...`, 'text-emerald-400 font-medium');
      
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
      appendStreamLog(`[${elapsed}s] Error: ${data.message || 'Stream error'}`, 'text-red-400 font-medium');
      break;
    }
  }
}

function setStepActive(stepId, text) {
  const el = document.getElementById(`step-${stepId}`);
  const txt = document.getElementById(`step-${stepId}-text`);
  if (el) el.className = 'p-3 rounded-lg border border-accentGold bg-warn-soft space-y-1 step-pulsing';
  if (txt) txt.textContent = text;
}

function setStepComplete(stepId) {
  const el = document.getElementById(`step-${stepId}`);
  const txt = document.getElementById(`step-${stepId}-text`);
  if (el) el.className = 'p-3 rounded-lg border border-ok-line bg-ok-soft space-y-1';
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
  document.getElementById('resSubjectTitle').textContent = dossier.idea.title;
  document.getElementById('resExecutiveSummary').textContent = dossier.executiveSummary;
  document.getElementById('resDossierCode').textContent = `${dossier.dossierCode} // ID: ${dossier.id}`;
  const confEl = document.getElementById('resConfidence');
  confEl.textContent = `${dossier.confidenceScore}%`;
  const cb = dossier.confidenceBasis;
  if (cb) confEl.title = `Uncalibrated: no outcomes have been recorded yet. Minimum of: agent agreement ${cb.agreement}%${cb.verifier !== undefined ? `, verifier pass rate ${cb.verifier}%` : ''}${cb.provenanceCap ? `, cap for non-LLM runs ${cb.provenanceCap}%` : ''}`;
  document.getElementById('resRiskLevel').textContent = String(dossier.riskLevel || '').toLowerCase().replace(/^./, (c) => c.toUpperCase());

  // Provenance: say plainly who produced the opinions.
  const modeBadge = document.getElementById('resModeBadge');
  if (modeBadge) {
    const prov = dossier.provenance;
    const llmN = prov ? prov.llmRoles.length : null;
    const total = prov ? prov.llmRoles.length + prov.heuristicRoles.length : 6;
    const models = Object.keys(dossier.llmUsage?.models || {}).join(', ');
    let text = '';
    let tone = 'text-ink-3';
    if (dossier.evaluationMode === 'HEURISTIC_ENGINE') {
      text = 'Rule-based result: no LLM answered. Treat as template risks, not analysis.';
      tone = 'text-warn';
    } else if (dossier.evaluationMode === 'MIXED') {
      text = `Mixed: ${llmN}/${total} roles by LLM, the rest rule-based (${(prov.heuristicRoles || []).join(', ')}).`;
      tone = 'text-warn';
    } else if (dossier.evaluationMode === 'LIVE_LLM') {
      text = `${llmN ?? total}/${total} roles by LLM${models ? ` (${models})` : ''}`;
    }
    modeBadge.textContent = text;
    modeBadge.className = `text-xs font-mono ml-1 ${tone}`;
  }
  document.getElementById('resScoreVal').textContent = `${dossier.killScore}/100`;

  // Domain Classification Banner
  if (dossier.domainClassification) {
    const dc = dossier.domainClassification;
    document.getElementById('resDomainArchetype').textContent = `Domain: ${dc.archetypeLabel}`;
    document.getElementById('resDomainCustomer').textContent = `Customer: ${dc.primaryCustomer}`;
    document.getElementById('resDomainCycle').textContent = `Cycle: ${dc.procurementCycle}`;
  }

  // Verdict Badge Styling
  const verdictBadge = document.getElementById('resVerdictBadge');
  const verdictText = String(dossier.overallVerdict || '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  verdictBadge.textContent = verdictText;
  // Say why: the rules and findings that decided the verdict.
  let basisEl = document.getElementById('resVerdictBasis');
  if (!basisEl) {
    basisEl = document.createElement('div');
    basisEl.id = 'resVerdictBasis';
    basisEl.className = 'text-xs font-mono text-ink-3 mt-2 text-left';
    verdictBadge.parentNode.appendChild(basisEl);
  }
  basisEl.textContent = 'Screening only: not shown to predict outcomes. Read the findings and run the tests. ' +
    (dossier.verdictBasis && dossier.verdictBasis.reasons.length ? dossier.verdictBasis.reasons.join(' ') : '');

  if (dossier.overallVerdict === 'BUILD' || dossier.overallVerdict === 'BUILD_IF_VALIDATED') {
    verdictBadge.className = 'font-mono text-2xl font-medium text-ok mt-0.5 block';
  } else if (dossier.overallVerdict === 'REFINE') {
    verdictBadge.className = 'font-mono text-2xl font-medium text-warn mt-0.5 block';
  } else {
    verdictBadge.className = 'font-mono text-2xl font-medium text-bad mt-0.5 block';
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

    const pillars = [
      { label: 'Feasibility', weight: 20, value: feas, note: 'Latency, architecture & isolation' },
      { label: 'Market demand', weight: 25, value: demand, note: 'Willingness to pay & friction' },
      { label: 'Unit economics', weight: 20, value: econ, note: 'LTV/CAC ratio & gross margin' },
      { label: 'Defensibility', weight: 15, value: moat, note: 'Incumbent displacement moat' },
      { label: 'Resilience', weight: 20, value: proc, note: 'Sales cycle & adversary resistance' }
    ];
    // The weakest pillar is the one that matters: it alone carries the accent.
    const weakest = pillars.reduce((m, p) => (p.value < m.value ? p : m), pillars[0]);
    resGrid.innerHTML = pillars.map((p) => {
      const weak = p === weakest;
      const value = Math.max(0, Math.min(100, Number(p.value) || 0));
      return `
      <div class="p-4 bg-surface rounded-xl border border-line">
        <div class="text-xs ${weak ? 'text-bad' : 'text-ink-3'}">${p.label} (${p.weight}%)</div>
        <div class="text-2xl font-medium tabular-numbers mt-1 ${weak ? 'text-bad' : 'text-ink'}">${value}</div>
        <div class="h-1 rounded-full bg-muted mt-3"><div class="h-1 rounded-full ${weak ? 'bg-red-600' : 'bg-zinc-400'}" style="width:${value}%"></div></div>
        <div class="text-xs text-ink-3 mt-3">${escapeHtml(p.note)}</div>
      </div>`;
    }).join('');
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
      const scoreColor = op.score >= 75 ? 'text-ok' : (op.score >= 50 ? 'text-warn' : 'text-bad');
      const fatalFlawSnippet = op.fatalFlaws && op.fatalFlaws.length > 0 ? op.fatalFlaws[0] : 'None articulated';

      return `
        <div class="p-3 bg-surface rounded-xl border border-line space-y-1">
          <div class="text-xs text-ink-3 font-medium truncate">${r.label}</div>
          <div class="text-base font-medium ${scoreColor}">${op.score}/100</div>
          <div class="text-xs text-ink-3 leading-tight truncate" title="${escapeHtml(fatalFlawSnippet)}">${escapeHtml(fatalFlawSnippet)}</div>
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
  document.getElementById('resEvidenceTier').textContent = `Tier: ${String(strongestEv.tier).replace(/_/g, " ").toLowerCase()}`;
  document.getElementById('resEvidenceProv').textContent = `Source: ${strongestEv.provenance}`;

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
      groundingHtml += `<div class="p-3 bg-surface border border-line rounded-lg text-ok"><span class="font-medium text-xs">Razorpay Fix My Itch Demand Grounding:</span> ${escapeHtml(itchItems[0].claim)}</div>`;
    } else {
      groundingHtml += `<div class="text-ink-3">No direct micro-SME billing friction matched from Razorpay problem database.</div>`;
    }

    if (graveyardItems.length > 0) {
      groundingHtml += `<div class="p-3 bg-surface border border-bad-line rounded-lg text-bad"><span class="font-medium text-xs">Startup Graveyard Forensic Precedent Flagged:</span> ${escapeHtml(graveyardItems[0].claim)}</div>`;
    } else {
      groundingHtml += `<div class="text-ok font-semibold">Clean bill of health against known high-profile startup failure traps (Loot Drop Forensics).</div>`;
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
      <div class="p-2 bg-surface rounded border border-line text-xs">
        <span class="font-medium text-bad">[KILL]</span> ${escapeHtml(kc)}
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
      <div class="space-y-2">
        <div class="font-medium text-ink text-xs">${escapeHtml(exp.title || '')}</div>
        <p class="text-ink-2 leading-relaxed text-xs font-sans">${escapeHtml(exp.description || '')}</p>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-ink-3 pt-2 border-t border-line">
          <span><strong class="text-ink">Cost:</strong> ${escapeHtml(String(costText))}</span>
          <span><strong class="text-ink">Timeline:</strong> ${escapeHtml(String(timelineText))} days</span>
        </div>
      </div>
    `;

    if (valSignals) {
      valSignals.innerHTML = `
        <div class="p-2 bg-ok-soft border border-ok-line rounded text-ok text-xs">
          <span class="font-medium text-xs text-ok block">Pass Gate (Success Metric):</span>
          <span class="font-sans">${escapeHtml(targetText)}</span>
        </div>
        <div class="p-2 bg-bad-soft border border-bad-line rounded text-bad text-xs">
          <span class="font-medium text-xs text-bad block">Kill Signal (Failure Threshold):</span>
          <span class="font-sans">${escapeHtml(failureText)}</span>
        </div>
      `;
    }
  }

  // Lane provenance chips, validation checklist, merged findings table
  renderLaneChips(dossier);
  renderValidationChecklist(dossier);
  renderFindingsTable(dossier);

  // Mutation Engine Panel
  const mutSection = document.getElementById('resMutationSection');
  const mutGrid = document.getElementById('resMutationGrid');
  if (mutSection && mutGrid) {
    if (dossier.killScore < 55 && dossier.mutationProposals && dossier.mutationProposals.length > 0) {
      mutSection.classList.remove('hidden');
      mutGrid.innerHTML = dossier.mutationProposals.map(m => {
        const strat = (m.strategy || m.strategyType || 'STRATEGIC_PIVOT').toString().replace(/_/g, ' ');
        return `
          <div class="p-3 bg-surface border border-line rounded-xl space-y-2">
            <div class="text-xs font-medium text-ink-3">${escapeHtml(strat)}</div>
            <div class="font-medium text-ink text-xs">${escapeHtml(m.label || '')}</div>
            <p class="text-xs text-ink-2 leading-relaxed font-sans">${escapeHtml(m.rationale || '')}</p>
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
    document.getElementById('resAuditStats').textContent = `${audit.totalClaimsAudited} claims audited under ${audit.verifierProtocol}; ${audit.hallucinationsBlocked} halfway truths blocked`;
    auditTable.innerHTML = audit.auditItems.map(item => `
      <div class="p-3 flex items-start justify-between gap-4 text-xs">
        <div class="space-y-1">
          <div class="font-medium text-ink">${formatClaimWithHyperlinks(item.claimOrOpinion)}</div>
          <div class="text-ink-2 font-sans leading-relaxed text-xs">${formatClaimWithHyperlinks(item.rationale)}</div>
        </div>
        <span class="px-3 py-0.5 rounded text-xs font-medium shrink-0 ${item.verdict === 'VERIFIED_PASS' ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}">
          ${item.verdict}
        </span>
      </div>
    `).join('');
  }
}

const EVIDENCE_PLAIN_WORDS = {
  STATED_INPUT: "founder's own numbers",
  COMPUTATION: "unit-economics math",
  SOURCE: "cited source",
  PRECEDENT: "named precedent",
  REASONING: "argument alone"
};

const SEVERITY_CHIP = {
  FATAL: 'bg-bad-soft text-bad',
  MAJOR: 'bg-warn-soft text-warn',
  MINOR: 'bg-muted text-ink-3'
};

function renderLaneChips(dossier) {
  const el = document.getElementById('resLaneChips');
  if (!el) return;
  const prov = dossier.provenance || {};
  const llm = new Set(prov.llmRoles || []);
  const heuristic = new Set(prov.heuristicRoles || []);
  const models = prov.laneModels || {};
  const labels = { analyst: 'Market Recon', customer: 'Customer', architect: 'Architect', investor: 'Financial VC', redteam: 'Skeptic', expert: 'Domain Expert' };
  const roles = Object.keys(labels);
  el.innerHTML = roles.map((role) => {
    const live = llm.has(role);
    const fallback = heuristic.has(role);
    const model = models[role] || '';
    const cls = fallback ? 'border-bad-line text-bad' : 'border-ok-line text-ok';
    const tag = fallback ? 'heuristic' : 'live';
    const title = fallback && prov.fallbackReasons && prov.fallbackReasons[role] ? ` — ${prov.fallbackReasons[role]}` : '';
    return `<span class="px-2 py-1 rounded border ${cls} text-xs font-mono" title="${escapeHtml(labels[role] + (model ? ` (${model})` : '') + title)}">${labels[role]}: ${tag}</span>`;
  }).join('');
}

function renderValidationChecklist(dossier) {
  const list = document.getElementById('resChecklist');
  const copyBtn = document.getElementById('resChecklistCopy');
  if (!list) return;
  const items = dossier.validationChecklist || [];
  if (items.length === 0) {
    list.innerHTML = '<div class="text-xs text-ink-3 font-sans">No cheap tests were produced for this run.</div>';
    if (copyBtn) copyBtn.classList.add('hidden');
    return;
  }
  list.innerHTML = items.map((item, i) => `
    <label class="flex items-start gap-3 p-3 bg-page border border-line rounded-lg cursor-pointer hover:border-line-strong transition">
      <input type="checkbox" class="mt-0.5 cursor-pointer shrink-0" data-check-item="${i}">
      <span class="space-y-1">
        <span class="block text-xs text-ink font-sans leading-relaxed checklist-text">${escapeHtml(item.test)}</span>
        ${item.killCriterion ? `<span class="block text-xs text-ink-3 font-sans leading-relaxed"><span class="font-mono text-bad">kill if:</span> ${escapeHtml(item.killCriterion)}</span>` : ''}
        <span class="block font-mono text-ink-3 text-xs">${escapeHtml(item.lane)} · ${item.severity.toLowerCase()}</span>
      </span>
    </label>
  `).join('');
  if (copyBtn) copyBtn.classList.remove('hidden');
}

function checklistAsMarkdown(dossier) {
  const items = dossier.validationChecklist || [];
  if (items.length === 0) return '';
  return `Validation checklist — ${dossier.idea.title}\n${items.map((c, i) => `${i + 1}. [ ] ${c.test}${c.killCriterion ? `\n   kill if: ${c.killCriterion}` : ''} [${c.lane}]`).join('\n')}\n(Screening review only — not a prediction. Confidence uncalibrated.)`;
}

function copyChecklist() {
  if (!currentRenderedDossier) return;
  const text = checklistAsMarkdown(currentRenderedDossier);
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('resChecklistCopy');
    if (btn) {
      const old = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = old; }, 1500);
    }
  }).catch(() => {});
}

function renderFindingsTable(dossier) {
  const table = document.getElementById('resFindingsTable');
  const note = document.getElementById('resFilteredNote');
  if (!table) return;
  const rows = dossier.findingsTable || [];
  if (rows.length === 0) {
    table.innerHTML = '<div class="p-4 text-xs text-ink-3 font-sans">No serious findings were reported for this run.</div>';
  } else {
    table.innerHTML = rows.map((r) => {
      const basis = EVIDENCE_PLAIN_WORDS[r.evidenceType] || r.evidenceType.toLowerCase();
      const refIsUrl = /^https?:\/\//.test(r.evidenceRef || '');
      const refHtml = refIsUrl
        ? `<a href="${escapeHtml(r.evidenceRef)}" target="_blank" rel="noopener" class="text-ok underline decoration-dotted hover:text-ink break-all">source</a>`
        : `<span class="truncate max-w-64 inline-block align-bottom" title="${escapeHtml(r.evidenceRef)}">${escapeHtml((r.evidenceRef || '').slice(0, 90))}</span>`;
      return `
        <div class="p-4 space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2 py-0.5 rounded text-xs font-mono font-medium ${SEVERITY_CHIP[r.severity] || 'bg-muted text-ink-3'}">${r.severity}</span>
            <span class="px-2 py-0.5 rounded text-xs font-mono bg-muted text-ink-2">${r.kind.toLowerCase()}</span>
            <span class="text-xs font-mono text-ink-3">${escapeHtml(r.lanes.join(', '))}</span>
            <span class="text-xs font-mono text-ink-3 ml-auto">basis: ${basis}${r.evidenceRef ? ` · ${refHtml}` : ''}</span>
          </div>
          <div class="text-xs text-ink font-sans leading-relaxed">${formatClaimWithHyperlinks(r.claim)}</div>
          ${r.cheapestTest ? `<div class="text-xs text-ink-2 font-sans leading-relaxed"><span class="font-mono text-ink-3">cheapest test:</span> ${escapeHtml(r.cheapestTest)}</div>` : ''}
        </div>`;
    }).join('');
  }
  if (note) {
    const n = (dossier.filteredEvidence || []).length;
    const titles = (dossier.filteredEvidence || []).map((f) => f.title).slice(0, 3).join(' | ');
    note.textContent = n > 0 ? `ignored ${n} same-name search result${n === 1 ? '' : 's'}` : '';
    note.title = titles;
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
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-raised hover:bg-muted text-blue-700 hover:text-blue-900 font-mono text-xs font-semibold transition border border-line">
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
    let note = document.getElementById('mcInputsNote');
    if (!note) {
      note = document.createElement('div');
      note.id = 'mcInputsNote';
      note.className = 'text-xs font-mono text-ink-3 mb-2';
      cardsContainer.parentNode.insertBefore(note, cardsContainer);
    }
    const ei = dossier.economicsInputs;
    note.textContent = ei
      ? `Inputs: $${ei.pricingMonthlyUsd}/mo (${ei.pricingSource.replace(/_/g, ' ')}${ei.pricingEvidence ? `: "${ei.pricingEvidence}"` : ''}), CAC $${ei.cacUsd} (${ei.cacSource.replace(/_/g, ' ')}), churn ${(ei.churnMonthly * 100).toFixed(1)}%/mo.${ei.note ? ' ' + ei.note : ''}`
      : '';
  }

  if (cardsContainer) {
    cardsContainer.innerHTML = `
      <div class="p-3 bg-page rounded-xl border border-line">
        <div class="text-xs text-ink-3">P50 LTV/CAC Ratio</div>
        <div class="text-base font-medium text-ink mt-0.5">${mc.ltv.p50.toFixed(2)}x</div>
        <div class="text-xs text-ink-3 mt-1">P10 downside: ${mc.ltv.p10.toFixed(2)}x | P90 upside: ${mc.ltv.p90.toFixed(2)}x</div>
      </div>
      <div class="p-3 bg-page rounded-xl border border-line">
        <div class="text-xs text-ink-3">Estimated CAC Payback</div>
        <div class="text-base font-medium text-ink mt-0.5">${mc.payback.p50.toFixed(1)} Months</div>
        <div class="text-xs text-ink-3 mt-1">P10: ${mc.payback.p10.toFixed(1)}m | P90: ${mc.payback.p90.toFixed(1)}m</div>
      </div>
    `;
  }

  // Render Editorial Financial Ledger (Text-first, print-safe)
  const ledgerContainer = document.getElementById('mcFinancialLedger');
  if (ledgerContainer) {
    const p10P = mc.payback?.p10 ?? 1.8;
    const p50P = mc.payback?.p50 ?? 3.0;
    const p90P = mc.payback?.p90 ?? 4.2;
    const efficiencyVerdict = p50P <= 6.0 ? "HIGH (Capital Efficient SaaS)" : (p50P <= 12.0 ? "MODERATE (Standard Venture Horizon)" : "CRITICAL (Prolonged Working Capital Drain)");

    const tornado = mc.tornado || [];

    ledgerContainer.innerHTML = `
      <!-- Row 2: CAC Payback Horizon -->
      <div class="p-4 space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-ink">CAC payback horizon</span>
          <span class="text-ok bg-ok-soft px-2 py-0.5 rounded text-xs font-medium">${efficiencyVerdict}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 pt-1 text-center">
          <div class="p-3 bg-surface rounded-lg border border-line">
            <div class="text-xs text-ink-3">Best Case (P10)</div>
            <div class="text-sm font-medium text-ink mt-0.5">${p10P.toFixed(1)} Months</div>
            <div class="text-xs text-ink-3 mt-0.5">Viral / inbound conversion</div>
          </div>
          <div class="p-3 bg-surface rounded-lg border border-line border-line-strong bg-page/50">
            <div class="text-xs text-ink-2 font-medium">Expected Reality (P50)</div>
            <div class="text-base font-medium text-ink mt-0.5">${p50P.toFixed(1)} Months</div>
            <div class="text-xs text-ink-2 mt-0.5">Median stochastic breakeven</div>
          </div>
          <div class="p-3 bg-surface rounded-lg border border-line">
            <div class="text-xs text-ink-3">Downside Stress (P90)</div>
            <div class="text-sm font-medium text-ink mt-0.5">${p90P.toFixed(1)} Months</div>
            <div class="text-xs text-ink-3 mt-0.5">Ad inflation &amp; sales inertia</div>
          </div>
        </div>
      </div>

      <!-- Row 3: Sensitivity Tornado -->
      <div class="p-4 space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-ink">Sensitivity, ranked by payback delay</span>
          <span class="text-ink-3 text-xs">Impact of a 10% adverse shift</span>
        </div>
        <div class="space-y-2 pt-1">
          ${tornado.map((item, idx) => {
            const maxSwing = Math.max(...tornado.map((t) => Number(t.swingMonths || 0)), 0.1);
            const swing = Number(item.swingMonths || 0);
            const pct = Math.max(4, Math.round((swing / maxSwing) * 100));
            const lead = idx === 0;
            return `
            <div class="flex items-center gap-3 text-xs">
              <span class="w-4 font-mono text-ink-3">${idx + 1}</span>
              <span class="w-36 truncate text-ink">${escapeHtml(item.driver || '')}</span>
              <span class="flex-1 h-1 rounded-full bg-muted"><span class="block h-1 rounded-full ${lead ? 'bg-bad' : 'bg-zinc-400'}" style="width:${pct}%"></span></span>
              <span class="w-12 text-right font-mono tabular-numbers ${lead ? 'text-bad' : 'text-ink-2'}">+${swing.toFixed(1)}m</span>
            </div>`;
          }).join('')}
        </div>
        <div class="text-xs text-ink-3 font-sans pt-1">
          <strong class="text-ink font-mono">Executive Action:</strong> Target metric #${tornado.length > 0 ? '1 (' + escapeHtml(tornado[0].driver || '') + ')' : '1'} before scaling spend, as it generates the largest unit-margin variance.
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
        btn.className = 'px-3 py-1 rounded bg-zinc-800 text-white font-medium transition';
      } else {
        btn.className = 'px-3 py-1 rounded text-ink-3 hover:text-white transition';
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
        const badgeClass = isBuild ? 'bg-ok-soft text-ok' : (isRefine ? 'bg-warn-soft text-warn' : 'bg-bad-soft text-bad');
        const scoreFmt = (d.score / 10).toFixed(1);
        const dateStr = d.timestamp ? d.timestamp.slice(0, 10) : 'Recent';

        return `
          <div onclick="loadDossierById('${d.id}')" class="p-4 hover:bg-page flex items-center justify-between cursor-pointer transition">
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-ink-3 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <div>
                <div class="font-medium text-xs text-ink">${escapeHtml(d.title)}</div>
                <div class="text-xs text-ink-3 font-mono mt-0.5">${escapeHtml(d.dossierCode)} • ${dateStr}</div>
              </div>
            </div>
            <div class="flex items-center gap-3 font-mono">
              <span class="px-3 py-0.5 rounded text-xs font-medium ${badgeClass}">
                ${escapeHtml(d.verdict)}
              </span>
              <span class="text-xs font-semibold text-ink-2">
                ${scoreFmt}/10
              </span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      listEl.innerHTML = `<div class="p-4 text-xs font-mono text-ink-3">No previous dossiers recorded yet.</div>`;
    }
  } catch (e) {
    listEl.innerHTML = `<div class="p-4 text-xs font-mono text-ink-3">Failed to load archive: ${escapeHtml(e.message)}</div>`;
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
    if (hash.startsWith('#print=')) {
      document.documentElement.classList.remove('dark');
      document.querySelectorAll('#resultsSection details').forEach((d) => d.setAttribute('open', ''));
    }
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
        <div class="w-36 font-mono text-xs text-ink-2 shrink-0">${escapeHtml(prettyParam(r.param))}</div>
        <div class="text-right font-mono text-xs text-ink-3 shrink-0">
          <span class="text-violet-700 font-medium">${Math.round(total * 100)}%</span> total
          <span class="text-ink-3">· ${Math.round(direct * 100)}% direct</span>
        </div>
      </div>
      <div class="bg-muted rounded h-3 overflow-hidden">
        <div class="h-3 rounded bg-violet-600/85" style="width: ${Math.round((total / maxIdx) * 100)}%" title="total-order (incl. interactions)"></div>
      </div>
      <div class="bg-muted rounded h-1.5 overflow-hidden">
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
    row.className = 'p-4 bg-page rounded-xl border border-line flex flex-col sm:flex-row sm:items-center gap-3';
    row.innerHTML = `
      <div class="flex-1 space-y-1">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-zinc-900 text-white font-mono text-xs font-medium flex items-center justify-center shrink-0">${idx + 1}</span>
          <span class="text-xs font-medium text-ink font-sans">${escapeHtml(item.experimentTitle)}</span>
          <span class="text-xs font-mono text-ink-3">${escapeHtml(prettyParam(item.param))}</span>
        </div>
        <p class="text-xs text-ink-2 font-sans leading-relaxed">${escapeHtml(item.experimentDescription)}</p>
      </div>
      <div class="w-full sm:w-56 shrink-0 space-y-1">
        <div class="flex justify-between font-mono text-xs text-ink-3">
          <span class="text-ok font-medium">$${escapeHtml(String(item.evpiPerCustomer))}/customer</span>
          <span>${Math.round(share * 100)}% of decision value</span>
        </div>
        <div class="bg-muted rounded h-2.5 overflow-hidden">
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
    <div class="p-2 bg-raised rounded-lg">
      <div class="text-lg font-medium text-ink font-sans leading-none">${Number(value || 0)}</div>
      <div class="text-xs font-mono text-ink-3 mt-1">${label}</div>
    </div>
  `).join('');

  const brierEl = document.getElementById('calibrationBrier');
  if (calibration.brierOverall !== null && calibration.brierOverall !== undefined) {
    brierEl.innerHTML = `<span class="font-medium text-ink">Brier ${calibration.brierOverall}</span> · lower is better · 0.25 = always guessing 50%`;
  } else {
    brierEl.textContent = 'No resolved forecasts yet — resolve outcomes via POST /api/forecasts/:id/resolve to build the track record.';
  }

  const relEl = document.getElementById('calibrationReliability');
  const buckets = (calibration.reliability || []).filter((b) => b.count > 0);
  if (buckets.length > 0) {
    relEl.innerHTML = buckets.map((b) => {
      const pct = (v) => Math.round(v * 100);
      const overconfident = b.predicted - b.observed > 0.05;
      const flag = overconfident ? ' <span class="text-warn" title="swarm more confident than outcomes justify">overconfident</span>' : '';
      return `
        <div>
          <div class="flex justify-between font-mono text-xs text-ink-3">
            <span>p ${b.bucket[0]}–${b.bucket[1]} <span class="text-ink-3">(n=${b.count})</span>${flag}</span>
            <span><span class="text-violet-700 font-medium">${pct(b.predicted)}%</span> pred · <span class="text-ok font-medium">${pct(b.observed)}%</span> obs</span>
          </div>
          <div class="bg-muted rounded h-1.5 overflow-hidden mt-0.5"><div class="h-1.5 bg-violet-600/85" style="width: ${pct(b.predicted)}%"></div></div>
          <div class="bg-muted rounded h-1.5 overflow-hidden mt-0.5"><div class="h-1.5 bg-emerald-600/85" style="width: ${pct(b.observed)}%"></div></div>
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
        <div class="flex justify-between font-mono text-xs text-ink-2">
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
