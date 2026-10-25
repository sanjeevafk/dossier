/* Dossier app logic — extracted from index.html (C4 split, no changes) */
    let currentChatRole = 'all';
    let currentIdeaContext = {
      title: "AI Study Companion",
      summary: "An automated real-time study companion for high school students that monitors browser homework sessions, diagnoses knowledge gaps, and provides parental progress alerts.",
      targetAudience: "Parents & Students",
      monetization: "$29/month"
    };

    function switchView(viewName) {
      const homeView = document.getElementById('homeView');
      const playgroundView = document.getElementById('playgroundView');
      const navHome = document.getElementById('navHomeBtn');
      const navPlayground = document.getElementById('navPlaygroundBtn');

      if (viewName === 'playground') {
        homeView.classList.add('hidden');
        playgroundView.classList.remove('hidden');
        navPlayground.classList.add('bg-zinc-100', 'text-zinc-950', 'font-bold');
        navPlayground.classList.remove('text-zinc-600');
        navHome.classList.remove('bg-zinc-100', 'text-zinc-950');
        navHome.classList.add('text-zinc-600');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        playgroundView.classList.add('hidden');
        homeView.classList.remove('hidden');
        navHome.classList.add('bg-zinc-100', 'text-zinc-950', 'font-bold');
        navHome.classList.remove('text-zinc-600');
        navPlayground.classList.remove('bg-zinc-100', 'text-zinc-950');
        navPlayground.classList.add('text-zinc-600');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }

    function setChatRole(role) {
      currentChatRole = role;
      document.querySelectorAll('.role-chip').forEach(btn => {
        btn.classList.remove('bg-zinc-900', 'text-white', 'font-bold');
        btn.classList.add('bg-zinc-100', 'text-zinc-700', 'font-semibold');
      });
      const activeBtn = document.getElementById(`roleBtn-${role}`);
      if (activeBtn) {
        activeBtn.classList.remove('bg-zinc-100', 'text-zinc-700', 'font-semibold');
        activeBtn.classList.add('bg-zinc-900', 'text-white', 'font-bold');
      }
    }

    function updateChatConcept() {
      const val = document.getElementById('chatConceptSelect').value;
      if (val === 'study_companion') {
        currentIdeaContext = {
          title: "AI Study Companion",
          summary: "Real-time AI homework monitor diagnosing knowledge gaps with parental WhatsApp notifications.",
          targetAudience: "Parents & Students",
          monetization: "$29/month"
        };
      } else if (val === 'micro_saas') {
        currentIdeaContext = {
          title: "Autonomous Micro-SaaS Agent",
          summary: "Monitors Stripe chargebacks and customer churn, executes automated recovery workflows in a sandbox.",
          targetAudience: "SaaS Founders",
          monetization: "$79/month"
        };
      } else if (val === 'ev_charging') {
        currentIdeaContext = {
          title: "Hyperlocal EV Charging",
          summary: "P2P driveway EV charging reservation and dynamic kilowatt pricing platform.",
          targetAudience: "EV Owners & Homeowners",
          monetization: "$19/month"
        };
      } else if (val === 'ai_auditor') {
        currentIdeaContext = {
          title: "AI SOC2 Auditor",
          summary: "Scans cloud infra for SOC2/HIPAA compliance violations and writes remediation scripts.",
          targetAudience: "B2B CTOs",
          monetization: "$499/month"
        };
      } else if (val === 'custom') {
        openCustomConceptModal();
        return;
      }
      appendSystemNote(`Swarm context updated to: "${currentIdeaContext.title}"`);
      restoreChatHistory();
    }

    function openCustomConceptModal() {
      document.getElementById('customConceptModal').classList.remove('hidden');
      document.getElementById('customConceptModal').classList.add('flex');
      const t = document.getElementById('customConceptTitle');
      if (t && !t.value) t.value = "My AI Project";
    }

    function closeCustomConceptModal() {
      document.getElementById('customConceptModal').classList.add('hidden');
      document.getElementById('customConceptModal').classList.remove('flex');
      document.getElementById('chatConceptSelect').value = currentIdeaContext.title === document.getElementById('customConceptTitle').value ? 'custom' : document.getElementById('chatConceptSelect').value;
    }

    function submitCustomConcept(e) {
      if (e) e.preventDefault();
      const customTitle = document.getElementById('customConceptTitle').value.trim();
      const customSummary = document.getElementById('customConceptSummary').value.trim();
      if (customTitle && customSummary) {
        currentIdeaContext = {
          title: customTitle,
          summary: customSummary,
          targetAudience: document.getElementById('customConceptAudience').value.trim() || "Target Users",
          monetization: document.getElementById('customConceptMonetization').value.trim() || "Subscription"
        };
        appendSystemNote(`Swarm context updated to: "${currentIdeaContext.title}"`);
      }
      closeCustomConceptModal();
    }

    function sendQuickMessage(text) {
      document.getElementById('chatInput').value = text;
      handleChatSubmit(new Event('submit'));
    }

    async function handleChatSubmit(e) {
      e.preventDefault();
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if (!text) return;

      const submitBtn = document.getElementById('chatSubmitBtn');
      const btnText = document.getElementById('chatBtnText');
      const spinner = document.getElementById('chatSpinner');

      // Append user message
      appendUserMessage(text);
      input.value = '';

      submitBtn.disabled = true;
      btnText.textContent = "...";
      spinner.classList.remove('hidden');

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({
            message: text,
            role: currentChatRole,
            ideaContext: currentIdeaContext
          })
        });
        if (res.status === 401) {
          openApiKeyModal();
          appendAgentMessage("System Alert", "Unauthorized (401): enter your DOSSIER_API_KEY, then retry.", "ERROR");
          return;
        }
        const data = await res.json();
        if (data.success) {
          appendAgentMessage(data.agentName, data.reply, data.epistemicState);
        } else {
          appendAgentMessage("System Alert", "Error: " + (data.error || "Execution failed"), "ERROR");
        }
      } catch (err) {
        appendAgentMessage("System Alert", "Network error: " + err.message, "ERROR");
      } finally {
        submitBtn.disabled = false;
        btnText.textContent = "Send";
        spinner.classList.add('hidden');
      }
    }

    function chatStorageKey() {
      try {
        return `dossier_chat_${currentIdeaContext.title.slice(0, 40)}`;
      } catch (e) {
        return 'dossier_chat_default';
      }
    }

    function persistChatMessage(kind, agentName, text, epistemicState) {
      try {
        const key = chatStorageKey();
        const raw = window.localStorage.getItem(key);
        const history = raw ? JSON.parse(raw) : [];
        history.push({ kind, agentName, text, epistemicState, at: new Date().toISOString() });
        window.localStorage.setItem(key, JSON.stringify(history.slice(-50)));
      } catch (e) { /* storage unavailable */ }
    }

    function restoreChatHistory() {
      try {
        const key = chatStorageKey();
        const raw = window.localStorage.getItem(key);
        if (!raw) return;
        const history = JSON.parse(raw);
        const container = document.getElementById('chatMessages');
        if (!container || !Array.isArray(history) || history.length === 0) return;
        container.innerHTML = '';
        for (const m of history.slice(-50)) {
          if (m.kind === 'user') appendUserMessage(m.text, true);
          else if (m.kind === 'agent') appendAgentMessage(m.agentName, m.text, m.epistemicState, true);
          else if (m.kind === 'note') appendSystemNote(m.text, true);
        }
      } catch (e) { /* corrupt history — start fresh */ }
    }

    function appendUserMessage(text, skipPersist) {
      if (!skipPersist) persistChatMessage('user', null, text, null);
      const container = document.getElementById('chatMessages');
      const div = document.createElement('div');
      div.className = 'flex items-start justify-end gap-3 max-w-3xl ml-auto';
      div.innerHTML = `
        <div class="space-y-1 text-right">
          <div class="text-[10px] text-zinc-400 font-mono">You</div>
          <div class="p-3.5 bg-zinc-900 text-white rounded-2xl rounded-tr-xs text-xs font-sans leading-relaxed">
            ${escapeHtml(text)}
          </div>
        </div>
      `;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function appendAgentMessage(agentName, markdownText, epistemicState, skipPersist) {
      if (!skipPersist) persistChatMessage('agent', agentName, markdownText, epistemicState);
      const container = document.getElementById('chatMessages');
      const div = document.createElement('div');
      div.className = 'flex items-start gap-3 max-w-3xl';
      
      const badgeColor = epistemicState === 'CHALLENGE_FLAGGED' ? 'bg-red-50 text-red-700 border-red-200' :
        (epistemicState === 'VERIFIED_COMPUTATION' || epistemicState === 'VERIFIED_FACT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
        'bg-amber-50 text-amber-800 border-amber-200');

      const formattedHtml = formatChatMarkdown(markdownText);

      div.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-brandYellow border border-black flex items-center justify-center font-bold text-xs text-black shrink-0">
          ${agentName.includes('Skeptic') ? '🛡️' : (agentName.includes('Investor') ? '💰' : (agentName.includes('Architect') ? '⚙️' : 'DS'))}
        </div>
        <div class="space-y-1.5 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-bold text-xs text-zinc-900">${escapeHtml(agentName)}</span>
            <span class="px-2 py-0.2 rounded text-[9px] font-mono font-bold border ${badgeColor}">
              ${escapeHtml(epistemicState)}
            </span>
            <span class="text-[10px] text-zinc-400 font-mono">Just now</span>
          </div>
          <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl rounded-tl-xs text-xs text-zinc-800 leading-relaxed font-sans space-y-2">
            ${formattedHtml}
          </div>
        </div>
      `;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function appendSystemNote(note, skipPersist) {
      if (!skipPersist) persistChatMessage('note', null, note, null);
      const container = document.getElementById('chatMessages');
      const div = document.createElement('div');
      div.className = 'text-center my-2';
      div.innerHTML = `<span class="text-[10px] font-mono text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200">ℹ️ ${escapeHtml(note)}</span>`;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    }

    function clearChatHistory() {
      try { window.localStorage.removeItem(chatStorageKey()); } catch (e) { /* ignore */ }
      const container = document.getElementById('chatMessages');
      container.innerHTML = `
        <div class="flex items-start gap-3 max-w-3xl">
          <div class="w-8 h-8 rounded-full bg-brandYellow border border-black flex items-center justify-center font-bold text-xs text-black shrink-0">
            DS
          </div>
          <div class="space-y-1.5">
            <div class="flex items-center gap-2">
              <span class="font-bold text-xs text-zinc-900">Swarm Orchestrator</span>
              <span class="px-2 py-0.2 rounded text-[9px] font-mono font-bold bg-zinc-100 text-zinc-600 border border-zinc-200">RESET COMPLETE</span>
            </div>
            <div class="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs text-zinc-800 leading-relaxed">
              Playground session reset. All 6 subagents ready for a fresh debate on <strong>"${currentIdeaContext.title}"</strong>.
            </div>
          </div>
        </div>
      `;
    }

    function formatChatMarkdown(txt) {
      let out = escapeHtml(txt);
      out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/\n\n/g, '</p><p>');
      out = out.replace(/\n/g, '<br>');
      return `<p>${out}</p>`;
    }

    function escapeHtml(string) {
      return String(string)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Modal and Home Helpers
    function openIntakeModal() {
      document.getElementById('intakeModal').classList.remove('hidden');
    }
    function closeIntakeModal() {
      document.getElementById('intakeModal').classList.add('hidden');
    }
    function scrollToRecent() {
      document.getElementById('recentDossiersSection').scrollIntoView({ behavior: 'smooth' });
    }
    function scrollToHowItWorks() {
      document.getElementById('howItWorksSection').scrollIntoView({ behavior: 'smooth' });
    }

    function loadPreset(key) {
      if (key === 'ai_auditor') {
        document.getElementById('modalTitle').value = "AI SOC2 Compliance Auditor";
        document.getElementById('modalSummary').value = "Scans cloud infrastructure for SOC2/HIPAA violations, writes remediation scripts in a sandboxed runtime, and halts for human approval before applying patches.";
        document.getElementById('modalTarget').value = "B2B CTOs & DevOps";
        document.getElementById('modalPrice').value = "499";
      } else if (key === 'micro_saas') {
        document.getElementById('modalTitle').value = "Autonomous Micro-SaaS Agent";
        document.getElementById('modalSummary').value = "Monitors Stripe chargebacks and customer churn, executes automated recovery workflows in a sandbox, and gates refunds on operator sign-off.";
        document.getElementById('modalTarget').value = "SaaS Founders";
        document.getElementById('modalPrice').value = "79";
      } else if (key === 'study_companion') {
        document.getElementById('modalTitle').value = "AI Study Companion";
        document.getElementById('modalSummary').value = "An automated real-time study companion for high school students that monitors browser homework sessions, diagnoses knowledge gaps, and provides parental alerts.";
        document.getElementById('modalTarget').value = "Parents & Students";
        document.getElementById('modalPrice').value = "29";
      } else if (key === 'ev_charging') {
        document.getElementById('modalTitle').value = "Hyperlocal EV Charging";
        document.getElementById('modalSummary').value = "P2P driveway EV charging reservation and dynamic kilowatt pricing platform for dense residential suburbs.";
        document.getElementById('modalTarget').value = "EV Owners & Homeowners";
        document.getElementById('modalPrice').value = "19";
      } else if (key === 'voice_crm') {
        document.getElementById('modalTitle').value = "Voice-first CRM for SMBs";
        document.getElementById('modalSummary').value = "Voice recording mobile app for field contractors that transcribes audio notes into CRM lead updates.";
        document.getElementById('modalTarget').value = "Plumbers & Electricians";
        document.getElementById('modalPrice').value = "39";
      }
      openIntakeModal();
    }

    function loadSampleDossierDirect() {
      loadPreset('study_companion');
      document.getElementById('modalEvalForm').dispatchEvent(new Event('submit'));
    }

    function resetStreamingHud(conceptTitle) {
      const hud = document.getElementById('streamingHudSection');
      hud.classList.remove('hidden');
      document.getElementById('resultsSection').classList.add('hidden');
      document.getElementById('streamConceptTitle').textContent = conceptTitle.toUpperCase();
      document.getElementById('streamStatusBadge').textContent = 'LIVE SWARM DEBATE IN PROGRESS';
      document.getElementById('streamCurrentStage').textContent = 'STAGE 01 // INGESTING';
      document.getElementById('streamCurrentDetail').textContent = 'Ingesting concept into TrueForge execution runtime...';
      document.getElementById('streamCrossfireBox').classList.add('hidden');

      // Phase 3.1/3.2/3.3 reset — clear pulses, arcs, dials, charts, and mutation cards
      clearAllNodePulses();
      clearCrossfireArcs();
      clearAllSwarmDials();
      const mutationSection = document.getElementById('mutationSection');
      if (mutationSection) mutationSection.classList.add('hidden');
      const mutationCards = document.getElementById('mutationCards');
      if (mutationCards) mutationCards.innerHTML = '';

      const roles = ['analyst', 'customer', 'architect', 'investor', 'redteam', 'expert'];
      roles.forEach(r => {
        const scoreEl = document.getElementById(`tile-${r}-score`);
        const tile = document.getElementById(`tile-${r}`);
        if (scoreEl) {
          scoreEl.textContent = 'WAITING...';
          scoreEl.className = 'text-xs font-bold text-zinc-500 mt-1';
        }
        if (tile) {
          tile.className = 'p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg text-center transition-all';
        }
      });
      hud.scrollIntoView({ behavior: 'smooth' });
    }

    function highlightSvgNode(role, score) {
      const nodeMap = {
        analyst: 'svgNodeAnalyst',
        customer: 'svgNodeCustomer',
        architect: 'svgNodeArchitect',
        investor: 'svgNodeInvestor',
        redteam: 'svgNodeRedteam',
        founder: 'svgNodeFounder'
      };
      const circleMap = {
        analyst: 'svgCircleAnalyst',
        customer: 'svgCircleCustomer',
        architect: 'svgCircleArchitect',
        investor: 'svgCircleInvestor',
        redteam: 'svgCircleRedteam',
        founder: 'svgCircleFounder'
      };
      const nodeId = nodeMap[role];
      const circleId = circleMap[role];
      const node = document.getElementById(nodeId);
      const circle = document.getElementById(circleId);
      if (node && circle) {
        node.style.transform = (node.getAttribute('transform') || '') + ' scale(1.1)';
        circle.setAttribute('stroke-width', '3');
        circle.setAttribute('stroke', score < 45 ? '#ef4444' : '#10b981');
        setTimeout(() => {
          node.style.transform = node.getAttribute('transform').replace(' scale(1.1)', '');
        }, 1200);
      }
    }

    // ======================= Phase 3.1 — Live Swarm Canvas =======================
    const SWARM_NODE_CENTERS = {
      analyst: [368, 133],
      customer: [260, 320],
      architect: [152, 257],
      investor: [368, 257],
      redteam: [152, 133],
      founder: [260, 70],
      expert: [260, 195]
    };
    let crossfireArcEls = [];

    function svgRoleCapitalized(role) {
      return role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
    }

    function startNodePulse(role) {
      const node = document.getElementById(`svgNode${svgRoleCapitalized(role)}`);
      if (node) node.classList.add('node-pulsing');
      const dial = document.getElementById(`svgScore${svgRoleCapitalized(role)}`);
      if (dial) {
        dial.textContent = '···';
        dial.setAttribute('fill', '#a1a1aa');
      }
    }

    function stopNodePulse(role) {
      const node = document.getElementById(`svgNode${svgRoleCapitalized(role)}`);
      if (node) node.classList.remove('node-pulsing');
      const corner = document.getElementById(`svgNode${svgRoleCapitalized(role)}`);
      if (!corner && role !== 'expert') return;
    }

    function clearAllNodePulses() {
      ['analyst', 'customer', 'architect', 'investor', 'redteam', 'founder'].forEach(stopNodePulse);
    }

    function updateNodeDial(role, score) {
      const dial = document.getElementById(`svgScore${svgRoleCapitalized(role)}`);
      if (!dial) return;
      dial.textContent = `${score}/100`;
      dial.setAttribute('fill', score < 45 ? '#ef4444' : (score >= 70 ? '#10b981' : '#f59e0b'));
    }

    function clearAllSwarmDials() {
      ['analyst', 'customer', 'architect', 'investor', 'redteam'].forEach((r) => {
        const dial = document.getElementById(`svgScore${svgRoleCapitalized(r)}`);
        if (dial) {
          dial.textContent = '';
          dial.setAttribute('fill', '#a1a1aa');
        }
      });
    }

    function drawCrossfireArc(challenger, target) {
      const svg = document.getElementById('swarmOrbitSvg');
      const from = SWARM_NODE_CENTERS[challenger];
      const to = SWARM_NODE_CENTERS[target];
      if (!svg || !from || !to) return;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from[0]);
      line.setAttribute('y1', from[1]);
      line.setAttribute('x2', to[0]);
      line.setAttribute('y2', to[1]);
      line.setAttribute('stroke', '#ef4444');
      line.setAttribute('stroke-width', '2.5');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-dasharray', '6 8');
      line.classList.add('crossfire-arc');
      svg.appendChild(line);
      crossfireArcEls.push(line);
      setTimeout(() => {
        line.remove();
        crossfireArcEls = crossfireArcEls.filter((el) => el !== line);
      }, 6500);
    }

    function clearCrossfireArcs() {
      crossfireArcEls.forEach((el) => el.remove());
      crossfireArcEls = [];
    }

    function evalStartMsRef() {
      return window.evalStartMs || Date.now();
    }

    function handleStreamEvent(event, data) {
      if (event === 'stage' || (data && data.stage)) {
        document.getElementById('streamCurrentStage').textContent = data.stage || 'STAGE // ACTIVE';
        document.getElementById('streamCurrentDetail').textContent = data.detail || '';
      }

      if (event === 'agent_start') {
        startNodePulse(data.role);
      }

      if (event === 'agent_opinion') {
        const role = data.role;
        stopNodePulse(role);
        updateNodeDial(role, data.score);
        const scoreEl = document.getElementById(`tile-${role}-score`);
        const tile = document.getElementById(`tile-${role}`);
        if (scoreEl && tile) {
          scoreEl.textContent = `${data.score}/100`;
          if (data.score >= 70) {
            scoreEl.className = 'text-xs font-extrabold text-emerald-400 mt-1';
            tile.className = 'p-3 bg-emerald-950/40 border border-emerald-600/50 rounded-lg text-center transition-all shadow-sm';
          } else if (data.score >= 50) {
            scoreEl.className = 'text-xs font-extrabold text-amber-400 mt-1';
            tile.className = 'p-3 bg-amber-950/40 border border-amber-600/50 rounded-lg text-center transition-all shadow-sm';
          } else {
            scoreEl.className = 'text-xs font-extrabold text-red-400 mt-1';
            tile.className = 'p-3 bg-red-950/40 border border-red-600/50 rounded-lg text-center transition-all shadow-sm';
          }
        }
        highlightSvgNode(role, data.score);
      }

      if (event === 'crossfire_start') {
        drawCrossfireArc(data.agentA, data.agentB);
      }

      if (event === 'crossfire_clash') {
        drawCrossfireArc(data.challenger, data.target);
        const box = document.getElementById('streamCrossfireBox');
        const textEl = document.getElementById('streamCrossfireText');
        box.classList.remove('hidden');
        textEl.innerHTML = `<strong>${data.challenger.toUpperCase()} ➔ ${data.target.toUpperCase()}:</strong> "${data.challengePoint}"<br><span class="text-emerald-400 font-semibold"><strong>Rebuttal:</strong> ${data.rebuttal || 'Counter-evidence provided.'}</span>`;
      }

      if (event === 'dossier_complete' && data.dossier) {
        document.getElementById('streamStatusBadge').textContent = 'CONSENSUS REACHED // DOSSIER COMPILED';
        clearAllNodePulses();
        clearCrossfireArcs();
        renderDossier(data.dossier);
        setTimeout(() => {
          document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
        }, 600);
      }

      if (event === 'done' && data.dossierId) {
        window.lastEvalSecs = (Date.now() - evalStartMsRef()) / 1000;
        loadDossierById(data.dossierId);
      }
    }

    document.getElementById('modalEvalForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('modalSubmitBtn');
      const btnText = document.getElementById('modalBtnText');
      const spinner = document.getElementById('modalSpinner');

      const title = document.getElementById('modalTitle').value;
      const summary = document.getElementById('modalSummary').value;
      const targetAudience = document.getElementById('modalTarget').value;
      const price = document.getElementById('modalPrice').value;

      submitBtn.disabled = true;
      btnText.textContent = "Deploying Swarm Stream...";
      spinner.classList.remove('hidden');

      const payload = {
        title,
        summary,
        targetAudience,
        monetization: `$${price}/mo`,
        pricingMonthlyUsd: price,
        estimatedCacUsd: 120
      };

      closeIntakeModal();
      resetStreamingHud(title);
      const evalStartMs = Date.now();
      window.evalStartMs = evalStartMs;

      try {
        const res = await fetch('/api/evaluate/stream', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify(payload)
        });

        if (res.status === 401) {
          openApiKeyModal();
          alert("Unauthorized (401): enter your DOSSIER_API_KEY, then retry the evaluation.");
          throw new Error("Unauthorized — API key required.");
        }

        if (!res.ok || !res.body) {
          throw new Error("Streaming endpoint unavailable, using standard evaluator.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';

          for (const block of blocks) {
            if (!block.trim()) continue;
            let eventType = 'message';
            let dataStr = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event: ')) eventType = line.slice(7).trim();
              if (line.startsWith('data: ')) dataStr = line.slice(6).trim();
            }
            if (dataStr) {
              try {
                const parsed = JSON.parse(dataStr);
                handleStreamEvent(eventType, parsed);
              } catch (err) {}
            }
          }
        }
      } catch (err) {
        console.warn("Stream fallback to REST:", err);
        // Fallback to standard POST /api/evaluate
        try {
          const fallbackRes = await fetch('/api/evaluate', {
            method: 'POST',
            headers: apiHeaders(),
            body: JSON.stringify(payload)
          });
          if (fallbackRes.status === 401) {
            openApiKeyModal();
            alert("Unauthorized (401): enter your DOSSIER_API_KEY, then retry the evaluation.");
            return;
          }
          const data = await fallbackRes.json();
          if (data.success) {
            window.lastEvalSecs = (Date.now() - evalStartMs) / 1000;
            window.evalStartMs = Date.now();
            renderDossier(data.dossier);
            document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
          } else {
            alert("Evaluation Error: " + data.error);
          }
        } catch (postErr) {
          alert("Failed to evaluate concept: " + postErr.message);
        }
      } finally {
        submitBtn.disabled = false;
        btnText.textContent = "Deploy Swarm & Generate Dossier →";
        spinner.classList.add('hidden');
      }
    });

    // ======================= Phase 3.2 — Monte Carlo Charts =======================
    function setupChartCanvas(canvas, logicalWidth, logicalHeight) {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(220, Math.round(rect.width || logicalWidth));
      canvas.width = w * dpr;
      canvas.height = logicalHeight * dpr;
      canvas.style.height = logicalHeight + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      return { ctx, w, h: logicalHeight };
    }

    function renderSurvivalChart(mc) {
      const canvas = document.getElementById('survivalChart');
      if (!canvas) return;
      const { ctx, w, h } = setupChartCanvas(canvas, 420, 200);
      const pad = { l: 40, r: 12, t: 14, b: 26 };
      const months = 24;
      const insol = Array.isArray(mc.insolvencyCurveByMonth) ? mc.insolvencyCurveByMonth : [];
      const points = [{ month: 0, solvent: 100 }].concat(
        insol.map((v, i) => ({ month: (i + 1) * 2, solvent: Math.max(0, (1 - v) * 100) }))
      );

      const xFor = (m) => pad.l + (m / months) * (w - pad.l - pad.r);
      const yFor = (pct) => pad.t + (1 - pct / 100) * (h - pad.t - pad.b);

      ctx.strokeStyle = '#e4e4e7';
      ctx.lineWidth = 1;
      [0, 25, 50, 75, 100].forEach((p) => {
        ctx.beginPath();
        ctx.moveTo(xFor(0), yFor(p));
        ctx.lineTo(xFor(months), yFor(p));
        ctx.stroke();
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '9px "IBM Plex Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${p}%`, pad.l - 6, yFor(p) + 3);
      });

      ctx.beginPath();
      points.forEach((p, i) => {
        const x = xFor(p.month);
        const y = yFor(p.solvent);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.lineTo(xFor(points[points.length - 1].month), yFor(0));
      ctx.lineTo(xFor(0), yFor(0));
      ctx.closePath();
      ctx.fillStyle = 'rgba(16,185,129,0.12)';
      ctx.fill();

      ctx.strokeStyle = '#d4d4d8';
      ctx.setLineDash([3, 3]);
      [12, 24].forEach((m) => {
        ctx.beginPath();
        ctx.moveTo(xFor(m), yFor(100));
        ctx.lineTo(xFor(m), yFor(0));
        ctx.stroke();
      });
      ctx.setLineDash([]);

      ctx.fillStyle = '#71717a';
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      [0, 6, 12, 18, 24].forEach((m) => ctx.fillText(`${m}`, xFor(m), h - 8));

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 10px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`12mo: ${Math.round((mc.survivalProbability12Mo || 0) * 100)}% survive`, pad.l + 8, pad.t + 2);
      ctx.fillText(`24mo: ${Math.round((mc.survivalProbability24Mo || 0) * 100)}% survive`, pad.l + 8, pad.t + 15);
    }

    function renderPaybackChart(mc) {
      const canvas = document.getElementById('paybackChart');
      if (!canvas) return;
      const { ctx, w, h } = setupChartCanvas(canvas, 420, 200);
      const pad = { l: 14, r: 14, t: 40, b: 26 };
      const p10 = mc.paybackPercentiles ? mc.paybackPercentiles.p10 : mc.estimatedPaybackMonths;
      const p50 = mc.paybackPercentiles ? mc.paybackPercentiles.p50 : mc.estimatedPaybackMonths;
      const p90 = mc.paybackPercentiles ? mc.paybackPercentiles.p90 : mc.estimatedPaybackMonths;

      const mean = (p10 + 2 * p50 + p90) / 4;
      const sd = Math.max(0.12, (p90 - p10) / 2.563);
      const xMin = Math.max(0, p10 - (p90 - p10) * 0.6 - 0.4);
      const xMax = p90 + (p90 - p10) * 0.6 + 0.8;
      const xFor = (v) => pad.l + ((v - xMin) / (xMax - xMin)) * (w - pad.l - pad.r);

      const pdf = (v) => Math.exp(-Math.pow(v - mean, 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
      let peak = 0;
      for (let i = 0; i <= 90; i++) {
        const v = xMin + (i / 90) * (xMax - xMin);
        peak = Math.max(peak, pdf(v));
      }
      const yBase = h - pad.b;
      const yFor = (d) => yBase - (d / peak) * (yBase - pad.t);

      ctx.beginPath();
      for (let i = 0; i <= 90; i++) {
        const v = xMin + (i / 90) * (xMax - xMin);
        const x = xFor(v);
        const y = yFor(pdf(v));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.lineTo(xFor(xMax), yBase);
      ctx.lineTo(xFor(xMin), yBase);
      ctx.closePath();
      ctx.fillStyle = 'rgba(250,204,21,0.18)';
      ctx.fill();

      ctx.font = '9px "IBM Plex Mono", monospace';
      [[p10, '#f59e0b', 'P10'], [p50, '#09090b', 'P50'], [p90, '#f59e0b', 'P90']].forEach(([v, color, label]) => {
        ctx.strokeStyle = color;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(xFor(v), yBase);
        ctx.lineTo(xFor(v), pad.t - 12);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(`${label} ${v.toFixed(1)}`, xFor(v), pad.t - 16);
      });

      ctx.fillStyle = '#a1a1aa';
      ctx.textAlign = 'center';
      ctx.fillText('months to payback', (w / 2), h - 8);
    }

    function renderTornado(mc) {
      const list = document.getElementById('tornadoList');
      if (!list) return;
      list.innerHTML = '';
      if (!mc || !Array.isArray(mc.sensitivity) || mc.sensitivity.length === 0) {
        list.innerHTML = '<div class="text-xs text-zinc-400 font-sans">Tornado data unavailable — embedded fallback sandbox ran without distribution.</div>';
        return;
      }
      const maxDelta = Math.max(...mc.sensitivity.map((s) => s.absoluteDelta), 0.0001);
      mc.sensitivity.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3';
        const pct = Math.round((item.absoluteDelta / maxDelta) * 100);
        row.innerHTML = `
          <div class="w-36 font-mono text-[10px] text-zinc-600 uppercase shrink-0">${(item.param || '').replace(/_/g, ' ')}</div>
          <div class="flex-1 bg-zinc-100 rounded h-3.5 overflow-hidden">
            <div class="h-3.5 rounded bg-amber-500/80" style="width: ${pct}%"></div>
          </div>
          <div class="w-16 text-right font-mono text-[10px] text-zinc-500 shrink-0">±${item.absoluteDelta.toFixed(2)}×</div>
        `;
        list.appendChild(row);
      });
    }

    function renderMonteCarloPanel(dossier) {
      const section = document.getElementById('monteCarloSection');
      const summarySurv = document.getElementById('survivalSummary');
      const summaryPay = document.getElementById('paybackSummary');
      if (!section) return;
      const mc = dossier.simulation && dossier.simulation.monteCarlo;
      if (!mc) {
        section.classList.add('hidden');
        return;
      }
      section.classList.remove('hidden');
      renderSurvivalChart(mc);
      renderPaybackChart(mc);
      renderTornado(mc);
      if (summarySurv) {
        summarySurv.textContent = `${mc.iterations.toLocaleString()} runs · churn N(${(mc.simulationNotes || '')[0] ? 'μ sample' : 'μ sample'}, σ) · steady-state replacement model`;
      }
      if (summaryPay) {
        const lc = mc.ltvCacPercentiles || { p10: dossier.simulation.ltvCacRatio, p50: dossier.simulation.ltvCacRatio, p90: dossier.simulation.ltvCacRatio };
        summaryPay.textContent = `LTV/CAC P10–P90: ${lc.p10}x – ${lc.p90}x (P50 ${lc.p50}x) · token burden P50 ${Math.round(((mc.tokenCostBurdenPercent && mc.tokenCostBurdenPercent.p50) || 0) * 100)}% of gross`;
      }
    }

    // ======================= Phase 3.3 — Mutation Engine =======================
    const STRATEGY_META = {
      WEDGE_PIVOT: { icon: '🎯', color: 'text-cyan-700', border: 'border-cyan-200' },
      MODEL_INVERSION: { icon: '💼', color: 'text-amber-700', border: 'border-amber-200' },
      TROJAN_DISTRIBUTION: { icon: '🐴', color: 'text-violet-700', border: 'border-violet-200' }
    };

    function renderMutationPanel(dossier) {
      const section = document.getElementById('mutationSection');
      const cards = document.getElementById('mutationCards');
      if (!section || !cards) return;
      const proposals = dossier.mutationProposals || [];
      window.lastMutationProposals = proposals;
      if (!proposals.length) {
        section.classList.add('hidden');
        return;
      }
      section.classList.remove('hidden');
      cards.innerHTML = '';
      proposals.forEach((p) => {
        const meta = STRATEGY_META[p.strategy] || {};
        const card = document.createElement('div');
        card.className = `p-4 bg-white rounded-xl border ${meta.border || 'border-zinc-200'} space-y-2 flex flex-col`;
        card.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-mono font-bold uppercase ${meta.color || 'text-zinc-500'}">${meta.icon || '🔁'} ${p.label}</span>
            <span class="text-[9px] font-mono text-zinc-400">${p.id}</span>
          </div>
          <div class="text-xs font-bold text-zinc-900 font-sans leading-snug">${escapeHtml(p.mutatedIdea.title)}</div>
          <p class="text-[11px] text-zinc-600 font-sans leading-relaxed">${escapeHtml(p.mutatedIdea.summary)}</p>
          <div class="text-[10px] font-mono text-zinc-500 uppercase">🎯 ${escapeHtml(p.mutatedIdea.targetAudience)}</div>
          <div class="text-[10px] font-mono text-emerald-700 uppercase font-bold">💰 ${escapeHtml(p.mutatedIdea.monetization)}</div>
          <p class="text-[10px] text-zinc-500 font-sans italic border-t border-zinc-100 pt-2">${escapeHtml(p.rationale)}</p>
          <button onclick="reevaluateMutationProposal('${p.id}')" class="mt-auto px-3 py-2 bg-zinc-900 hover:bg-zinc-700 text-white font-mono text-[11px] font-bold rounded-lg transition cursor-pointer">RE-EVALUATE PIVOT →</button>
        `;
        cards.appendChild(card);
      });
    }

    window.reevaluateMutationProposal = function(proposalId) {
      const proposals = window.lastMutationProposals || [];
      const proposal = proposals.find((x) => x.id === proposalId);
      if (!proposal) return;
      document.getElementById('modalTitle').value = proposal.mutatedIdea.title;
      document.getElementById('modalSummary').value = proposal.mutatedIdea.summary;
      document.getElementById('modalTarget').value = proposal.mutatedIdea.targetAudience;
      const priceMatch = /\$([0-9,]+)/.exec(proposal.mutatedIdea.monetization);
      document.getElementById('modalPrice').value = priceMatch ? priceMatch[1].replace(/,/g, '') : '49';
      openIntakeModal();
      document.getElementById('modalEvalForm').dispatchEvent(new Event('submit'));
    };

    window.downloadExperimentKit = function() {
      const dossier = window.currentRenderedDossier;
      if (!dossier) {
        alert("No active dossier compiled yet.");
        return;
      }
      const exp = dossier.cheapestValidationExperiment || {};
      const lines = [
        `# Experiment Kit — ${dossier.idea.title}`,
        `Dossier: ${dossier.dossierCode} | Verdict: ${dossier.overallVerdict} (${dossier.killScore}/100)`,
        ``,
        `## 1. LOI Email (copy-paste)`,
        `Subject: 15-min pilot — ${dossier.idea.title}`,
        ``,
        `Hi [Name] — we're testing ${dossier.idea.title} with ${dossier.idea.targetAudience}.`,
        `Would you sign a non-binding LOI for a 14-day pilot at ${dossier.idea.monetization}? No payment now — we just need 3 design partners.`,
        `Reply YES and I'll send the one-pager.`,
        ``,
        `## 2. Ten-Interview Script`,
        `1. What breaks most often in your current workflow? (5 min)`,
        `2. Walk me through the last time it broke. (5 min)`,
        `3. What have you already paid to fix it? (3 min)`,
        `4. If this existed today, would you pilot it for 14 days? (2 min)`,
        `5. Will you sign a non-binding LOI now? (5 min)`,
        ``,
        `## 3. Kill-Condition Tracker`,
        ...(dossier.killConditions || []).map((k, i) => `- [ ] KILL-${i + 1}: ${k}`),
        ``,
        `Success gate: ${exp.successMetric || "n/a"}`,
        `Failure kill signal: ${exp.failureKillSignal || "n/a"}`,
        `Cost: $${exp.estimatedCostUsd ?? 0} | Time: ${exp.timeToExecuteDays ?? "?"} days`
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `experiment-kit-${dossier.dossierCode || dossier.id}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    function renderDossier(dossier) {
      window.currentRenderedDossier = dossier;
      window.currentRenderedDossierId = dossier.id;
      document.getElementById('resultsSection').classList.remove('hidden');
      document.getElementById('resSubjectTitle').textContent = dossier.idea.title.toUpperCase();
      document.getElementById('resExecutiveSummary').textContent = dossier.executiveSummary;
      document.getElementById('resConfidence').textContent = `${dossier.confidenceScore}%`;
      document.getElementById('resRiskLevel').textContent = dossier.riskLevel;
      if (document.getElementById('resScoreVal')) {
        document.getElementById('resScoreVal').textContent = `${dossier.killScore}/100`;
      }
      const scoreLabel = document.getElementById('resScoreLabel');
      if (scoreLabel) scoreLabel.textContent = 'RESILIENCE SCORE';
      const modeBadge = document.getElementById('resModeBadge');
      if (modeBadge) {
        const secs = window.lastEvalSecs != null ? window.lastEvalSecs : null;
        const recon = dossier.externalEvidenceSources && dossier.externalEvidenceSources.length > 0
          ? `${dossier.externalEvidenceSources.length} sources`
          : 'heuristic priors';
        modeBadge.textContent = `${dossier.evaluationMode === 'LIVE_LLM' ? 'LIVE LLM' : 'HEURISTIC'} • ${recon}${secs != null ? ` • ${secs.toFixed(1)}s` : ''}`;
      }

      // Domain Banner
      if (dossier.domainClassification) {
        document.getElementById('resDomainArchetype').textContent = `DOMAIN: ${dossier.domainClassification.archetypeLabel.toUpperCase()}`;
        document.getElementById('resDomainCustomer').textContent = `CUSTOMER: ${dossier.domainClassification.primaryCustomer}`;
        document.getElementById('resDomainCycle').textContent = `CYCLE: ${dossier.domainClassification.procurementCycle}`;
      }

      const verdictBadge = document.getElementById('resVerdictBadge');
      verdictBadge.textContent = dossier.overallVerdict === 'BUILD_IF_VALIDATED' ? 'BUILD IF VALIDATED' : dossier.overallVerdict;
      verdictBadge.className = (dossier.overallVerdict === 'BUILD' || dossier.overallVerdict === 'BUILD_IF_VALIDATED') ? 'font-mono text-2xl font-black text-emerald-600 mt-0.5 block' :
        (dossier.overallVerdict === 'REFINE' ? 'font-mono text-2xl font-black text-amber-600 mt-0.5 block' : 'font-mono text-2xl font-black text-red-600 mt-0.5 block');

      // Render 5-Dimensional Resilience Breakdown
      const resilienceGrid = document.getElementById('resilienceGrid');
      if (resilienceGrid && dossier.resilienceBreakdown) {
        const rb = dossier.resilienceBreakdown;
        resilienceGrid.innerHTML = `
          <div class="p-3 bg-white rounded-xl border border-zinc-200">
            <div class="text-[10px] text-zinc-500 uppercase">Feasibility (20%)</div>
            <div class="text-base font-extrabold text-emerald-600 mt-0.5">${rb.technicalFeasibility}%</div>
            <div class="text-[9px] text-zinc-400 mt-1 font-sans">Process isolation &amp; latency</div>
          </div>
          <div class="p-3 bg-white rounded-xl border border-zinc-200">
            <div class="text-[10px] text-zinc-500 uppercase">Demand &amp; Adoption (25%)</div>
            <div class="text-base font-extrabold text-amber-600 mt-0.5">${rb.demandAndAdoption}%</div>
            <div class="text-[9px] text-zinc-400 mt-1 font-sans">User urgency vs inertia</div>
          </div>
          <div class="p-3 bg-white rounded-xl border border-zinc-200">
            <div class="text-[10px] text-zinc-500 uppercase">Economics &amp; CAC (20%)</div>
            <div class="text-base font-extrabold text-emerald-600 mt-0.5">${rb.economicsAndCapitalEfficiency}%</div>
            <div class="text-[9px] text-zinc-400 mt-1 font-sans">LTV/CAC &amp; payback</div>
          </div>
          <div class="p-3 bg-white rounded-xl border border-zinc-200">
            <div class="text-[10px] text-zinc-500 uppercase">Defensibility (15%)</div>
            <div class="text-base font-extrabold text-cyan-600 mt-0.5">${rb.defensibilityAndMoat}%</div>
            <div class="text-[9px] text-zinc-400 mt-1 font-sans">Workflow &amp; data moat</div>
          </div>
          <div class="p-3 bg-white rounded-xl border border-zinc-200">
            <div class="text-[10px] text-zinc-500 uppercase">Adversarial (20%)</div>
            <div class="text-base font-extrabold text-red-600 mt-0.5">${rb.adversarialResilience}%</div>
            <div class="text-[9px] text-zinc-400 mt-1 font-sans">Red team attack resilience</div>
          </div>
        `;
      }

      // Render Consensus Grid
      const consensusGrid = document.getElementById('consensusGrid');
      consensusGrid.innerHTML = '';
      for (const [role, info] of Object.entries(dossier.roleAssessments)) {
        if (role === 'synthesizer') continue;
        const box = document.createElement('div');
        const scoreColor = info.score >= 70 ? 'text-emerald-600' : (info.score >= 50 ? 'text-amber-600' : 'text-red-600');
        box.className = 'p-3 bg-white rounded-xl border border-zinc-200 text-center';
        box.innerHTML = `
          <div class="text-[10px] text-zinc-500 uppercase">${info.roleTitle.replace(/^\d+\s*\/\/\s*/, '')}</div>
          <div class="text-base font-extrabold ${scoreColor} mt-0.5">${info.score}%</div>
          <div class="text-[9px] text-zinc-400 uppercase mt-0.5 font-bold">${info.verdict}</div>
        `;
        consensusGrid.appendChild(box);
      }

      // Render Strongest Evidence & Weakest Assumption
      if (dossier.strongestEvidence) {
        document.getElementById('strongestEvidenceType').textContent = dossier.strongestEvidence.claimType;
        document.getElementById('strongestEvidenceText').textContent = `"${dossier.strongestEvidence.claim}"`;
        document.getElementById('strongestEvidenceProv').textContent = `Provenance: ${dossier.strongestEvidence.provenance} (Confidence: ${dossier.strongestEvidence.confidencePercent}%)`;
      }

      if (dossier.weakestAssumption) {
        document.getElementById('weakestAssumptionText').textContent = `"${dossier.weakestAssumption.statement}" — Fatal Risk: ${dossier.weakestAssumption.fatalRisk}`;
        document.getElementById('weakestAssumptionDisproof').textContent = `Disproof Trigger: ${dossier.weakestAssumption.disproofThreshold}`;
      }

      // Render Kill Conditions
      const killList = document.getElementById('killConditionsList');
      if (killList && dossier.killConditions) {
        killList.innerHTML = '';
        dossier.killConditions.forEach(cond => {
          const li = document.createElement('li');
          li.textContent = cond;
          killList.appendChild(li);
        });
      }

      // Render Cheapest Validation Experiment
      if (dossier.cheapestValidationExperiment) {
        const exp = dossier.cheapestValidationExperiment;
        document.getElementById('cheapestExpTitle').textContent = exp.title;
        document.getElementById('cheapestExpDesc').textContent = exp.description;
        document.getElementById('cheapestExpCostTime').textContent = `Cost: $${exp.estimatedCostUsd} | Time: ${exp.timeToExecuteDays} Days`;
        document.getElementById('cheapestExpMetric').textContent = `Success: ${exp.successMetric}`;
      }

      // Render Contradictions
      const contradictionsList = document.getElementById('contradictionsList');
      contradictionsList.innerHTML = '';
      dossier.contradictions.forEach(c => {
        const item = document.createElement('div');
        item.className = 'p-3.5 bg-white rounded-xl border border-zinc-200 space-y-1.5';
        item.innerHTML = `
          <div class="text-red-700 text-xs"><span class="font-bold">${c.agentA}:</span> "${c.claimA}"</div>
          <div class="text-amber-700 text-xs"><span class="font-bold">${c.agentB}:</span> "${c.claimB}"</div>
          <div class="text-[10px] text-zinc-500 italic pt-1 border-t border-zinc-100 font-sans">${c.guidance}</div>
        `;
        contradictionsList.appendChild(item);
      });

      // Render Sandbox
      document.getElementById('sandboxStdout').textContent = dossier.simulation.sandboxExecutionProof.stdout;

      // Phase 3.2 / 3.3 renderers — stochastic charts & mutation engine
      renderMonteCarloPanel(dossier);
      renderMutationPanel(dossier);

      // Store active dossier ID for exports
      window.currentRenderedDossierId = dossier.id;

      // Render Approvals
      const approvalList = document.getElementById('approvalList');
      approvalList.innerHTML = '';
      dossier.approvalGates.forEach(gate => {
        const isApproved = gate.status === 'APPROVED';
        const isRejected = gate.status === 'REJECTED';
        const isPending = !isApproved && !isRejected;

        const badgeClass = isApproved ? 'bg-emerald-100 text-emerald-800' : (isRejected ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800');

        const item = document.createElement('div');
        item.className = 'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-zinc-200';
        item.innerHTML = `
          <div>
            <div class="flex items-center gap-2">
              <span class="text-zinc-900 font-sans text-xs font-bold">${escapeHtml(gate.summary)}</span>
              <span id="gate-badge-${gate.id}" class="text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase ${badgeClass}">${gate.status}</span>
            </div>
            <div class="text-zinc-500 font-mono text-[10px] uppercase mt-0.5">Action: ${gate.actionType} • Dual-Key Safety: Active</div>
          </div>
          <div id="gate-btns-${gate.id}" class="flex items-center gap-2 shrink-0">
            ${isPending ? `
              <button onclick="handleApprovalAction('${gate.id}', 'APPROVE')" class="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-mono text-xs font-bold rounded-lg transition cursor-pointer">AUTHORIZE</button>
              <button onclick="handleApprovalAction('${gate.id}', 'REJECT')" class="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 font-mono text-xs font-bold rounded-lg transition cursor-pointer">VETO</button>
            ` : `
              <span class="text-xs font-mono font-bold ${isApproved ? 'text-emerald-700' : 'text-red-700'}">
                ${isApproved ? '✔ AUTHORIZED BY OPERATOR' : '✖ VETOED BY OPERATOR'}
              </span>
            `}
          </div>
        `;
        approvalList.appendChild(item);
      });

      // Refresh recent dossiers sidebar
      loadRecentDossiers();
    }

    function dossierApiKey() {
      let key = null;
      try {
        key = window.localStorage.getItem('dossier_api_key');
      } catch (e) { /* storage unavailable */ }
      if (!key) {
        openApiKeyModal();
        return '';
      }
      return key || '';
    }

    function apiHeaders() {
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dossierApiKey()}`
      };
    }

    function openApiKeyModal() {
      document.getElementById('apiKeyModal').classList.remove('hidden');
      document.getElementById('apiKeyModal').classList.add('flex');
    }

    function closeApiKeyModal() {
      document.getElementById('apiKeyModal').classList.add('hidden');
      document.getElementById('apiKeyModal').classList.remove('flex');
    }

    function submitApiKey(e) {
      if (e) e.preventDefault();
      const key = document.getElementById('apiKeyInput').value.trim();
      if (key) {
        try { window.localStorage.setItem('dossier_api_key', key); } catch (e) { /* ignore */ }
      }
      closeApiKeyModal();
    }

    function clearApiKey() {
      try { window.localStorage.removeItem('dossier_api_key'); } catch (e) { /* ignore */ }
      document.getElementById('apiKeyInput').value = '';
    }

    async function handleApprovalAction(actionId, decision) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${dossierApiKey()}`
        };
        if (!dossierApiKey()) {
          alert("Enter your DOSSIER_API_KEY first (Settings), then retry.");
          return;
        }
        const res = await fetch(`/api/approval/${actionId}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ decision })
        });
        if (res.status === 401) {
          try { window.localStorage.removeItem('dossier_api_key'); } catch (e) { /* ignore */ }
          alert("Unauthorized (401): set a valid DOSSIER_API_KEY. Cleared stored key — retry after entering it.");
          return;
        }
        const data = await res.json();
        if (data.success) {
          const badge = document.getElementById(`gate-badge-${actionId}`);
          if (badge) {
            badge.textContent = data.newStatus;
            badge.className = data.newStatus === 'APPROVED'
              ? 'text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-emerald-100 text-emerald-800'
              : 'text-[9px] font-mono px-2 py-0.5 rounded font-bold uppercase bg-red-100 text-red-800';
          }
          const btnGroup = document.getElementById(`gate-btns-${actionId}`);
          if (btnGroup) {
            btnGroup.innerHTML = `<span class="text-xs font-mono font-bold ${data.newStatus === 'APPROVED' ? 'text-emerald-700' : 'text-red-700'}">${data.newStatus === 'APPROVED' ? '✔ AUTHORIZED BY OPERATOR' : '✖ VETOED BY OPERATOR'}</span>`;
          }
        } else {
          alert("Approval failed: " + data.error);
        }
      } catch (err) {
        alert("Failed to update approval: " + err.message);
      }
    }

    function downloadDossierExport(format) {
      if (!window.currentRenderedDossierId) {
        alert("No active dossier compiled yet.");
        return;
      }
      window.open(`/api/dossiers/${window.currentRenderedDossierId}/export?format=${format}`, '_blank');
    }

    async function loadRecentDossiers() {
      try {
        const res = await fetch('/api/dossiers?limit=5');
        const data = await res.json();
        if (data.success && Array.isArray(data.dossiers) && data.dossiers.length > 0) {
          const container = document.getElementById('recentDossiersList');
          if (!container) return;

          container.innerHTML = data.dossiers.map(d => {
            const isBuild = d.verdict === 'BUILD' || d.verdict === 'BUILD_IF_VALIDATED';
            const isRefine = d.verdict === 'REFINE';
            const badgeBg = isBuild ? 'bg-badgeGreenBg text-badgeGreenText' : (isRefine ? 'bg-badgeAmberBg text-badgeAmberText' : 'bg-badgeRedBg text-badgeRedText');
            const scoreFormatted = (d.score / 10).toFixed(1);
            const dateStr = d.timestamp ? d.timestamp.slice(0, 10) : 'Recent';

            return `
              <div onclick="loadDossierById('${d.id}')" class="p-3.5 hover:bg-zinc-50 flex items-center justify-between cursor-pointer transition">
                <div class="flex items-center gap-3">
                  <svg class="w-5 h-5 text-zinc-800 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <div>
                    <div class="font-bold text-xs text-zinc-950">${escapeHtml(d.title)}</div>
                    <div class="text-[11px] text-zinc-500 font-mono mt-0.5">${escapeHtml(d.dossierCode)} • ${dateStr}</div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="px-2.5 py-0.5 rounded text-[11px] font-bold ${badgeBg} tracking-wider">
                    ${escapeHtml(d.verdict)}
                  </span>
                  <span class="text-xs font-semibold text-zinc-600 font-mono">
                    ${scoreFormatted}/10
                  </span>
                </div>
              </div>
            `;
          }).join('');
        }
      } catch (err) {
        // Fallback gracefully to default items
      }
    }

    async function loadDossierById(id) {
      try {
        const res = await fetch(`/api/dossiers/${id}`);
        const data = await res.json();
        if (data.success && data.dossier) {
          renderDossier(data.dossier);
          document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
        }
      } catch (err) {
        alert("Failed to load dossier: " + err.message);
      }
    }

    // Initialize recent dossiers on page load
    window.addEventListener('DOMContentLoaded', () => {
      loadRecentDossiers();
    });
