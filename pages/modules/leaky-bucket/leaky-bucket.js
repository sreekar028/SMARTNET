/**
 * SMARTNET — Leaky Bucket Simulation Module
 * pages/modules/leaky-bucket/leaky-bucket.js
 *
 * Implements the Leaky Bucket Congestion Control and Traffic Shaping algorithm.
 * Conforms to SMARTNET architecture and integration protocols.
 * Member 5: Broadcast Tree & Leaky Bucket
 */

(function () {
  'use strict';

  // Ensure SMARTNET global namespace exists
  const SMARTNET = window.SMARTNET || {};

  /* ── 1. Module Registration with Integration Layer ───────── */
  if (SMARTNET.Integration && typeof SMARTNET.Integration.registerModule === 'function') {
    SMARTNET.Integration.registerModule('leaky-bucket', {
      label: 'Leaky Bucket',
      category: 'Simulations',
      subCategory: 'Flow & Congestion Control',
      status: 'ready',
      route: 'pages/modules/leaky-bucket/index.html',
      member: 'Member 5 (Ganjikunta Swapna)',
      version: '1.0.0'
    });
  }

  /* ── 2. PURE ALGORITHM: Leaky Bucket (Section 18) ──────────
     Separated algorithm logic from UI logic (Rule 30)
  ─────────────────────────────────────────────────────────── */
  function simulateLeakyBucket(bucketSize, outputRate, incomingPackets) {
    let bucket = 0;
    let dropped = 0;
    let transmitted = 0;
    const steps = [];

    for (let i = 0; i < incomingPackets.length; i++) {
      const incoming = incomingPackets[i];
      bucket += incoming;

      let currentDropped = 0;
      if (bucket > bucketSize) {
        currentDropped = bucket - bucketSize;
        dropped += currentDropped;
        bucket = bucketSize;
      }

      const sent = Math.min(bucket, outputRate);
      bucket -= sent;
      transmitted += sent;

      steps.push({
        step: steps.length + 1,
        incoming: incoming,
        bucket: bucket,
        sent: sent,
        dropped: currentDropped
      });
    }

    // Drain remaining packets in the bucket
    while (bucket > 0) {
      const sent = Math.min(bucket, outputRate);
      bucket -= sent;
      transmitted += sent;

      steps.push({
        step: steps.length + 1,
        incoming: 0,
        bucket: bucket,
        sent: sent,
        dropped: 0
      });
    }

    return {
      steps: steps,
      transmitted: transmitted,
      dropped: dropped,
      remaining: bucket
    };
  }

  /* ── 3. Simulation State ─────────────────────────────────── */
  const state = {
    // Parameters (defaults per Section 16)
    capacity: 10,
    leakRate: 2,
    speed: 1000, // ms per tick

    // Runtime state
    timeStep: 0,
    currentLevel: 0,
    isRunning: false,
    timer: null,

    // Traffic source
    sourceNode: 'PC1',
    shaperRouter: 'R1',
    destNode: 'SERVER',

    // Sequence definitions
    presetSequences: {
      default:    [4, 3, 5, 2, 8],
      bursty:     [4, 8, 2, 10, 3, 1, 0, 7, 2, 6, 0, 1],
      cbr:        [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      congestion: [6, 12, 9, 14, 8, 10, 5, 2, 1, 0],
      spikes:     [1, 1, 12, 1, 1, 14, 1, 1, 10, 0]
    },
    activeSequence: [4, 3, 5, 2, 8],
    sequenceIdx: 0,
    drainingMode: false,

    // Metrics & History
    totalInflow: 0,
    totalConforming: 0,
    totalDropped: 0,
    history: []
  };

  /* ── 4. DOM Elements ─────────────────────────────────────── */
  const el = {};

  function initDOMElements() {
    el.capInput        = document.getElementById('lb-capacity-input');
    el.capRange        = document.getElementById('lb-capacity');
    el.capVal          = document.getElementById('lb-cap-val');
    el.capFeedback     = document.getElementById('lb-cap-feedback');

    el.rateInput       = document.getElementById('lb-rate-input');
    el.rateRange       = document.getElementById('lb-leak-rate');
    el.rateVal         = document.getElementById('lb-rate-val');
    el.rateFeedback    = document.getElementById('lb-rate-feedback');

    el.customSeqInput  = document.getElementById('lb-custom-seq');
    el.seqFeedback     = document.getElementById('lb-seq-feedback');
    el.validationAlert = document.getElementById('lb-validation-alert');

    el.speedSelect     = document.getElementById('lb-speed-select');
    el.sourceSelect    = document.getElementById('lb-source-node');
    el.routerSelect    = document.getElementById('lb-router-node');

    el.btnPlay         = document.getElementById('btn-lb-play');
    el.btnStep         = document.getElementById('btn-lb-step');
    el.btnReset        = document.getElementById('btn-lb-reset');
    el.btnSaveResult   = document.getElementById('btn-lb-save-result');
    el.btnExportCsv    = document.getElementById('btn-lb-export-csv');
    el.btnExportJson   = document.getElementById('btn-lb-export-json');

    // Visual bucket elements
    el.bucketFluid     = document.getElementById('lb-bucket-fluid');
    el.packetGrid      = document.getElementById('lb-packet-grid');
    el.overflowChute   = document.getElementById('lb-overflow-chute');
    el.overflowCount   = document.getElementById('lb-overflow-count');
    el.leakDrip        = document.getElementById('lb-leak-drip');
    el.inflowAnim      = document.getElementById('lb-inflow-anim');
    el.currFillDisplay = document.getElementById('lb-curr-fill');
    el.capMarkingMax   = document.getElementById('lb-cap-max-mark');
    el.capMarkingMid   = document.getElementById('lb-cap-mid-mark');
    el.outflowCaption  = document.getElementById('lb-outflow-caption');

    // Topology flow path
    el.topoSourceChip  = document.getElementById('topo-source-chip');
    el.topoRouterChip  = document.getElementById('topo-router-chip');
    el.topoDestChip    = document.getElementById('topo-dest-chip');

    // Top Metric counters
    el.metricFill      = document.getElementById('metric-lb-fill');
    el.metricInflow    = document.getElementById('metric-lb-inflow');
    el.metricSent      = document.getElementById('metric-lb-sent');
    el.metricDropped   = document.getElementById('metric-lb-dropped');
    el.metricDropRate  = document.getElementById('metric-lb-droprate');
    el.metricThroughput= document.getElementById('metric-lb-throughput');

    // Dedicated Results Card Elements (Section 21)
    el.resCap          = document.getElementById('res-lb-cap');
    el.resRate         = document.getElementById('res-lb-rate');
    el.resIncoming     = document.getElementById('res-lb-incoming');
    el.resSent         = document.getElementById('res-lb-sent');
    el.resDropped      = document.getElementById('res-lb-dropped');
    el.resOccupancy    = document.getElementById('res-lb-occupancy');
    el.resDropRate     = document.getElementById('res-lb-droprate');
    el.resStatus       = document.getElementById('res-lb-status');
    el.statusBadge     = document.getElementById('stat-lb-status-badge');

    // Chart & Table
    el.canvas          = document.getElementById('trafficCanvas');
    el.logTbody        = document.getElementById('lb-log-tbody');
    el.toast           = document.getElementById('sn-toast');
    el.toastMsg        = document.getElementById('sn-toast-msg');
  }

  /* ── 5. VALIDATION (Section 17) ──────────────────────────── */
  function validateInputs() {
    let isValid = true;
    let errorMsg = '';

    // Validate Bucket Size: must be positive integer (> 0)
    const capVal = parseInt(el.capInput.value, 10);
    if (isNaN(capVal) || capVal <= 0) {
      el.capInput.classList.add('is-invalid');
      isValid = false;
      errorMsg = 'Bucket size must be greater than 0.';
    } else {
      el.capInput.classList.remove('is-invalid');
      state.capacity = capVal;
    }

    // Validate Output Rate: must be positive integer (> 0)
    const rateVal = parseInt(el.rateInput.value, 10);
    if (isNaN(rateVal) || rateVal <= 0) {
      el.rateInput.classList.add('is-invalid');
      isValid = false;
      if (!errorMsg) errorMsg = 'Output rate must be greater than 0.';
    } else {
      el.rateInput.classList.remove('is-invalid');
      state.leakRate = rateVal;
    }

    // Validate Packet sequence: non-negative integers (>= 0)
    const seqText = el.customSeqInput.value.trim();
    if (!seqText) {
      el.customSeqInput.classList.add('is-invalid');
      isValid = false;
      if (!errorMsg) errorMsg = 'Packet values must be non-negative numbers.';
    } else {
      const parts = seqText.split(',').map(s => s.trim()).filter(s => s !== '');
      if (parts.length === 0) {
        el.customSeqInput.classList.add('is-invalid');
        isValid = false;
        if (!errorMsg) errorMsg = 'Packet values must be non-negative numbers.';
      } else {
        const parsed = [];
        let seqValid = true;
        for (let i = 0; i < parts.length; i++) {
          const num = Number(parts[i]);
          if (isNaN(num) || !Number.isInteger(num) || num < 0) {
            seqValid = false;
            break;
          }
          parsed.push(num);
        }

        if (!seqValid) {
          el.customSeqInput.classList.add('is-invalid');
          isValid = false;
          if (!errorMsg) errorMsg = 'Packet values must be non-negative numbers.';
        } else {
          el.customSeqInput.classList.remove('is-invalid');
          state.activeSequence = parsed;
        }
      }
    }

    if (!isValid) {
      if (el.validationAlert) {
        el.validationAlert.textContent = errorMsg;
        el.validationAlert.classList.remove('d-none');
      }
    } else {
      if (el.validationAlert) {
        el.validationAlert.classList.add('d-none');
        el.validationAlert.textContent = '';
      }
    }

    return isValid;
  }

  /* ── 6. Parameter Updates & Listeners ─────────────────────── */
  function attachEventListeners() {
    // Bucket Capacity sync
    el.capInput.addEventListener('input', function () {
      const val = parseInt(this.value, 10);
      if (!isNaN(val) && val > 0) {
        el.capRange.value = Math.min(30, Math.max(1, val));
        el.capVal.textContent = val;
        state.capacity = val;
        updateBucketMarkings();
        renderBucketVisual();
        updateResultsSection();
      }
      validateInputs();
    });

    el.capRange.addEventListener('input', function () {
      el.capInput.value = this.value;
      el.capVal.textContent = this.value;
      state.capacity = parseInt(this.value, 10);
      validateInputs();
      updateBucketMarkings();
      renderBucketVisual();
      updateResultsSection();
    });

    // Output Rate sync
    el.rateInput.addEventListener('input', function () {
      const val = parseInt(this.value, 10);
      if (!isNaN(val) && val > 0) {
        el.rateRange.value = Math.min(15, Math.max(1, val));
        el.rateVal.textContent = val;
        state.leakRate = val;
        if (el.outflowCaption) el.outflowCaption.textContent = `Output Rate = ${val} pkts/tick`;
        updateResultsSection();
      }
      validateInputs();
    });

    el.rateRange.addEventListener('input', function () {
      el.rateInput.value = this.value;
      el.rateVal.textContent = this.value;
      state.leakRate = parseInt(this.value, 10);
      if (el.outflowCaption) el.outflowCaption.textContent = `Output Rate = ${this.value} pkts/tick`;
      validateInputs();
      updateResultsSection();
    });

    // Sequence input
    el.customSeqInput.addEventListener('input', function () {
      validateInputs();
    });

    // Speed dropdown
    el.speedSelect.addEventListener('change', function () {
      state.speed = parseInt(this.value, 10) || 1000;
      if (state.isRunning) {
        clearInterval(state.timer);
        state.timer = setInterval(stepSimulation, state.speed);
      }
    });

    // Preset chips
    document.querySelectorAll('[data-preset]').forEach(chip => {
      chip.addEventListener('click', function () {
        document.querySelectorAll('[data-preset]').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        const pKey = this.dataset.preset;
        const seq = state.presetSequences[pKey] || state.presetSequences.default;
        el.customSeqInput.value = seq.join(', ');
        validateInputs();
      });
    });

    // Topology selectors
    if (el.sourceSelect) {
      el.sourceSelect.addEventListener('change', function () {
        state.sourceNode = this.value;
        updateTopologyPathDisplay();
      });
    }
    if (el.routerSelect) {
      el.routerSelect.addEventListener('change', function () {
        state.shaperRouter = this.value;
        updateTopologyPathDisplay();
      });
    }

    // Controls
    el.btnPlay.addEventListener('click', togglePlayPause);
    el.btnStep.addEventListener('click', stepSimulation);
    el.btnReset.addEventListener('click', resetSimulation);
    el.btnSaveResult.addEventListener('click', saveResultsToIntegration);
    el.btnExportCsv.addEventListener('click', exportCSV);
    el.btnExportJson.addEventListener('click', exportJSON);

    // Live Burst Injection buttons
    document.querySelectorAll('[data-inject]').forEach(btn => {
      btn.addEventListener('click', function () {
        const amt = parseInt(this.dataset.inject, 10);
        if (amt > 0) injectManualBurst(amt);
      });
    });
  }

  function updateTopologyPathDisplay() {
    if (el.topoSourceChip) el.topoSourceChip.textContent = `💻 ${state.sourceNode}`;
    if (el.topoRouterChip) el.topoRouterChip.textContent = `📡 ${state.shaperRouter} (Shaper)`;
    if (el.topoDestChip)   el.topoDestChip.textContent   = `🖥️ ${state.destNode}`;
  }

  function updateBucketMarkings() {
    if (el.capMarkingMax) el.capMarkingMax.textContent = state.capacity;
    if (el.capMarkingMid) el.capMarkingMid.textContent = Math.round(state.capacity / 2);
  }

  /* ── 7. Core Simulation Step Algorithm ───────────────────── */
  function stepSimulation() {
    if (!validateInputs()) {
      pauseSimulation();
      return;
    }

    let incoming = 0;

    // Check if we still have incoming sequence packets
    if (state.sequenceIdx < state.activeSequence.length) {
      incoming = state.activeSequence[state.sequenceIdx];
      state.sequenceIdx++;
    } else {
      // All input packets processed — drain remaining bucket (Section 18)
      state.drainingMode = true;
      if (state.currentLevel === 0) {
        pauseSimulation();
        updateResultsSection('Completed');
        showToast('All packets processed and buffer completely drained!');
        return;
      }
      incoming = 0;
    }

    state.timeStep++;

    // Calculate queue dynamics
    const availableSpace = Math.max(0, state.capacity - state.currentLevel);
    const accepted = Math.min(incoming, availableSpace);
    const dropped = incoming - accepted;

    // Buffer after arrival before leak
    const bufferBeforeLeak = state.currentLevel + accepted;

    // Outflow leak at constant rate
    const transmitted = Math.min(bufferBeforeLeak, state.leakRate);
    const bufferAfterLeak = bufferBeforeLeak - transmitted;

    // Update state
    state.currentLevel = bufferAfterLeak;
    state.totalInflow += incoming;
    state.totalConforming += transmitted;
    state.totalDropped += dropped;

    // Step record matching Section 20: Step | Incoming | Bucket | Transmitted | Dropped
    const stepRecord = {
      step: state.timeStep,
      incoming: incoming,
      bucket: bufferAfterLeak,
      sent: transmitted,
      dropped: dropped
    };
    state.history.push(stepRecord);

    // Visual updates
    triggerInflowAnimation(incoming);
    triggerOutflowAnimation(transmitted);
    triggerOverflowAnimation(dropped);
    renderBucketVisual();
    updateMetricCards();
    updateResultsSection(state.isRunning ? 'Running...' : 'Paused');
    appendLogRow(stepRecord);
    renderLiveChart();
  }

  /* ── 8. Manual Burst Injection ───────────────────────────── */
  function injectManualBurst(amount) {
    if (!validateInputs()) return;

    state.timeStep++;
    const incoming = amount;
    const availableSpace = Math.max(0, state.capacity - state.currentLevel);
    const accepted = Math.min(incoming, availableSpace);
    const dropped = incoming - accepted;

    const bufferBeforeLeak = state.currentLevel + accepted;
    const transmitted = Math.min(bufferBeforeLeak, state.leakRate);
    const bufferAfterLeak = bufferBeforeLeak - transmitted;

    state.currentLevel = bufferAfterLeak;
    state.totalInflow += incoming;
    state.totalConforming += transmitted;
    state.totalDropped += dropped;

    const stepRecord = {
      step: state.timeStep,
      incoming: incoming,
      bucket: bufferAfterLeak,
      sent: transmitted,
      dropped: dropped
    };
    state.history.push(stepRecord);

    triggerInflowAnimation(incoming);
    triggerOutflowAnimation(transmitted);
    triggerOverflowAnimation(dropped);
    renderBucketVisual();
    updateMetricCards();
    updateResultsSection(state.isRunning ? 'Running...' : 'Paused');
    appendLogRow(stepRecord);
    renderLiveChart();

    showToast(`Injected burst of +${amount} packets`);
  }

  /* ── 9. Play / Pause / Reset Handlers ────────────────────── */
  function togglePlayPause() {
    if (state.isRunning) {
      pauseSimulation();
    } else {
      startSimulation();
    }
  }

  function startSimulation() {
    if (!validateInputs()) return;

    state.isRunning = true;
    el.btnPlay.innerHTML = '⏸️ Pause';
    el.btnPlay.classList.remove('btn-primary-sn');
    el.btnPlay.classList.add('btn-secondary-sn');
    updateResultsSection('Running...');
    state.timer = setInterval(stepSimulation, state.speed);
  }

  function pauseSimulation() {
    state.isRunning = false;
    el.btnPlay.innerHTML = '▶️ Run Simulation';
    el.btnPlay.classList.add('btn-primary-sn');
    el.btnPlay.classList.remove('btn-secondary-sn');
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    updateResultsSection(state.history.length > 0 ? (state.currentLevel === 0 && state.sequenceIdx >= state.activeSequence.length ? 'Completed' : 'Paused') : 'Ready');
  }

  function resetSimulation() {
    pauseSimulation();

    state.timeStep = 0;
    state.currentLevel = 0;
    state.sequenceIdx = 0;
    state.drainingMode = false;
    state.totalInflow = 0;
    state.totalConforming = 0;
    state.totalDropped = 0;
    state.history = [];

    // Reset default values if inputs valid
    validateInputs();

    // Reset UI
    if (el.logTbody) el.logTbody.innerHTML = '';
    renderBucketVisual();
    updateMetricCards();
    updateResultsSection('Ready');
    renderLiveChart();

    if (el.overflowChute) el.overflowChute.classList.remove('active');
    if (el.leakDrip) el.leakDrip.classList.remove('active');

    showToast('Simulation reset to initial state.');
  }

  /* ── 10. Visual Bucket Rendering ─────────────────────────── */
  function renderBucketVisual() {
    const pct = state.capacity > 0 ? Math.min(100, Math.round((state.currentLevel / state.capacity) * 100)) : 0;

    if (el.bucketFluid) {
      el.bucketFluid.style.height = `${pct}%`;
      if (pct > 85) {
        el.bucketFluid.style.background = 'linear-gradient(180deg, rgba(239, 68, 68, 0.8) 0%, rgba(220, 38, 38, 0.95) 100%)';
      } else if (pct > 60) {
        el.bucketFluid.style.background = 'linear-gradient(180deg, rgba(245, 158, 11, 0.8) 0%, rgba(217, 119, 6, 0.95) 100%)';
      } else {
        el.bucketFluid.style.background = 'linear-gradient(180deg, rgba(79, 142, 247, 0.75) 0%, rgba(37, 99, 235, 0.95) 100%)';
      }
    }

    if (el.currFillDisplay) {
      el.currFillDisplay.textContent = `${state.currentLevel} / ${state.capacity} (${pct}%)`;
    }

    if (el.packetGrid) {
      el.packetGrid.innerHTML = '';
      const chipsCount = Math.min(state.currentLevel, 40);
      for (let i = 0; i < chipsCount; i++) {
        const chip = document.createElement('div');
        chip.className = 'packet-chip';
        chip.title = `Queued Packet #${i + 1}`;
        el.packetGrid.appendChild(chip);
      }
    }
  }

  function triggerInflowAnimation(count) {
    if (!el.inflowAnim || count <= 0) return;
    el.inflowAnim.innerHTML = `<span style="font-size:0.75rem;font-weight:700;color:var(--color-primary);animation:pulse-dot 0.4s;">+${count}</span>`;
    setTimeout(() => {
      if (el.inflowAnim) el.inflowAnim.innerHTML = '';
    }, 450);
  }

  function triggerOutflowAnimation(count) {
    if (!el.leakDrip) return;
    if (count > 0) {
      el.leakDrip.classList.add('active');
      setTimeout(() => {
        if (el.leakDrip) el.leakDrip.classList.remove('active');
      }, 500);
    }
  }

  function triggerOverflowAnimation(droppedCount) {
    if (!el.overflowChute) return;
    if (droppedCount > 0) {
      el.overflowChute.classList.add('active');
      if (el.overflowCount) el.overflowCount.textContent = `-${droppedCount} Drop`;
      setTimeout(() => {
        if (el.overflowChute) el.overflowChute.classList.remove('active');
      }, 800);
    }
  }

  /* ── 11. Results Display & Metrics (Section 21) ──────────── */
  function updateMetricCards() {
    const dropRate = state.totalInflow > 0
      ? ((state.totalDropped / state.totalInflow) * 100).toFixed(1)
      : '0.0';

    const throughput = (state.leakRate * 1.5 * 8 / (state.speed / 1000)).toFixed(1);

    if (el.metricFill)       el.metricFill.textContent       = `${state.currentLevel} pkts`;
    if (el.metricInflow)     el.metricInflow.textContent     = state.totalInflow;
    if (el.metricSent)       el.metricSent.textContent       = state.totalConforming;
    if (el.metricDropped)    el.metricDropped.textContent    = state.totalDropped;
    if (el.metricDropRate)   el.metricDropRate.textContent   = `${dropRate}%`;
    if (el.metricThroughput) el.metricThroughput.textContent = `${throughput} Mbps`;
  }

  function updateResultsSection(overrideStatus) {
    const dropRate = state.totalInflow > 0
      ? ((state.totalDropped / state.totalInflow) * 100).toFixed(1)
      : '0.0';

    const statusText = overrideStatus || (
      state.isRunning ? 'Running...' :
      (state.history.length > 0 && state.currentLevel === 0 && state.sequenceIdx >= state.activeSequence.length ? 'Completed' :
      (state.history.length > 0 ? 'Paused' : 'Ready'))
    );

    if (el.resCap)       el.resCap.textContent       = `${state.capacity} pkts`;
    if (el.resRate)      el.resRate.textContent      = `${state.leakRate} pkts/tick`;
    if (el.resIncoming)  el.resIncoming.textContent  = state.totalInflow;
    if (el.resSent)      el.resSent.textContent      = state.totalConforming;
    if (el.resDropped)   el.resDropped.textContent   = state.totalDropped;
    if (el.resOccupancy) el.resOccupancy.textContent = `${state.currentLevel} pkts`;
    if (el.resDropRate)  el.resDropRate.textContent  = `${dropRate}%`;
    if (el.resStatus)    el.resStatus.textContent    = statusText;

    if (el.statusBadge) {
      el.statusBadge.textContent = statusText;
      if (statusText === 'Completed') {
        el.statusBadge.className = 'sn-badge success';
      } else if (statusText === 'Running...') {
        el.statusBadge.className = 'sn-badge primary';
      } else {
        el.statusBadge.className = 'sn-badge info';
      }
    }
  }

  /* ── 12. Step Table Rendering (Section 20) ────────────────── */
  function appendLogRow(step) {
    if (!el.logTbody) return;

    const tr = document.createElement('tr');
    tr.className = step.dropped > 0 ? 'row-dropped animate-fade-in-up' : 'animate-fade-in-up';

    tr.innerHTML = `
      <td class="text-mono">#${step.step}</td>
      <td class="text-mono">${step.incoming}</td>
      <td class="text-mono">${step.bucket}</td>
      <td class="text-mono" style="color:var(--color-accent);">${step.sent}</td>
      <td class="text-mono" style="${step.dropped > 0 ? 'color:var(--color-danger);font-weight:700;' : ''}">${step.dropped}</td>
    `;

    // Prepend newest row
    el.logTbody.insertBefore(tr, el.logTbody.firstChild);
  }

  /* ── 13. Real-Time Canvas Waveform Chart (Section 22) ─────── */
  function renderLiveChart() {
    if (!el.canvas) return;
    const ctx = el.canvas.getContext('2d');
    const width = el.canvas.parentElement.clientWidth - 40 || 600;
    const height = 220;
    el.canvas.width = width;
    el.canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    const history = state.history.slice(-25); // show last 25 steps
    if (history.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Simulation timeline will appear here once you run or step the simulation.', width / 2, height / 2);
      return;
    }

    const padding = { top: 20, right: 30, bottom: 30, left: 40 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVal = Math.max(
      state.capacity + 2,
      ...history.map(d => Math.max(d.incoming, d.sent, d.bucket, d.dropped))
    );

    function getX(idx) {
      if (history.length === 1) return padding.left + chartW / 2;
      return padding.left + (idx / (history.length - 1)) * chartW;
    }
    function getY(val) {
      return padding.top + chartH - (val / maxVal) * chartH;
    }

    // Grid lines
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i <= 4; i++) {
      const yVal = Math.round((maxVal / 4) * i);
      const yPos = getY(yVal);
      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(padding.left + chartW, yPos);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(yVal, padding.left - 8, yPos + 3);
    }
    ctx.setLineDash([]);

    // 1. Draw Incoming Traffic (Bars)
    const barWidth = Math.max(4, Math.min(16, chartW / (history.length * 2)));
    history.forEach((pt, i) => {
      const x = getX(i) - barWidth / 2;
      const y = getY(pt.incoming);
      const h = padding.top + chartH - y;

      ctx.fillStyle = 'rgba(79, 142, 247, 0.4)';
      ctx.fillRect(x, y, barWidth, h);

      if (pt.dropped > 0) {
        const dropY = getY(pt.dropped);
        const dropH = padding.top + chartH - dropY;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.fillRect(x, dropY, barWidth, dropH);
      }
    });

    // 2. Draw Buffer Occupancy (Amber Line)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    history.forEach((pt, i) => {
      const x = getX(i);
      const y = getY(pt.bucket);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 3. Draw Fixed Output Rate (Emerald Line)
    ctx.strokeStyle = '#06d6a0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((pt, i) => {
      const x = getX(i);
      const y = getY(pt.sent);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Outflow dots
    history.forEach((pt, i) => {
      const x = getX(i);
      const y = getY(pt.sent);
      ctx.fillStyle = '#06d6a0';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // X-Axis labels
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    history.forEach((pt, i) => {
      if (i % Math.ceil(history.length / 6) === 0 || i === history.length - 1) {
        ctx.fillText(`T+${pt.step}`, getX(i), height - 10);
      }
    });
  }

  /* ── 14. Save Results to Integration Layer (Section 23) ─── */
  function saveResultsToIntegration() {
    if (state.history.length === 0) {
      showToast('Run the simulation first to generate results.');
      return;
    }

    const dropRate = state.totalInflow > 0
      ? ((state.totalDropped / state.totalInflow) * 100).toFixed(1)
      : '0.0';

    const throughput = (state.leakRate * 1.5 * 8 / (state.speed / 1000)).toFixed(1);

    // Exact result schema conforming to Section 23
    const payload = {
      experiment: 'Leaky Bucket',
      module: 'leaky-bucket',
      status: 'Completed',
      inputs: {
        bucketSize: state.capacity,
        outputRate: state.leakRate,
        incomingPackets: [...state.activeSequence]
      },
      results: {
        transmittedPackets: state.totalConforming,
        droppedPackets: state.totalDropped,
        dropRate: parseFloat(dropRate),
        finalOccupancy: state.currentLevel,
        steps: [...state.history]
      },
      metrics: {
        throughput: `${throughput} Mbps`,
        packetLoss: `${dropRate}%`,
        bucketCapacity: `${state.capacity} pkts`,
        leakRate: `${state.leakRate} pkts/tick`,
        totalPackets: state.totalInflow,
        packetsSent: state.totalConforming,
        packetsDropped: state.totalDropped
      },
      timestamp: new Date().toISOString()
    };

    if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
      SMARTNET.Integration.saveResult(payload);
      showToast('Leaky Bucket results saved to SMARTNET Dashboard!');
    } else {
      console.warn('[LeakyBucket] SMARTNET.Integration not found, fallback to localStorage.');
      try {
        const stored = JSON.parse(localStorage.getItem('smartnet_results') || '[]');
        stored.unshift(payload);
        localStorage.setItem('smartnet_results', JSON.stringify(stored));
        showToast('Result saved to localStorage!');
      } catch (err) {
        showToast('Error saving results: ' + err.message);
      }
    }
  }

  /* ── 15. Data Export (CSV / JSON) ────────────────────────── */
  function exportCSV() {
    if (state.history.length === 0) {
      showToast('No simulation data to export.');
      return;
    }

    // Header matching Section 20 table
    let csv = 'Step,Incoming,Bucket,Transmitted,Dropped\n';
    state.history.forEach(r => {
      csv += `${r.step},${r.incoming},${r.bucket},${r.sent},${r.dropped}\n`;
    });

    downloadBlob(csv, 'smartnet_leaky_bucket_results.csv', 'text/csv;charset=utf-8;');
    showToast('Exported CSV file.');
  }

  function exportJSON() {
    if (state.history.length === 0) {
      showToast('No simulation data to export.');
      return;
    }

    const dropRate = state.totalInflow > 0
      ? ((state.totalDropped / state.totalInflow) * 100).toFixed(1)
      : '0.0';

    const data = {
      experiment: 'Leaky Bucket',
      module: 'leaky-bucket',
      inputs: {
        bucketSize: state.capacity,
        outputRate: state.leakRate,
        incomingPackets: state.activeSequence
      },
      results: {
        totalIncoming: state.totalInflow,
        totalTransmitted: state.totalConforming,
        totalDropped: state.totalDropped,
        dropRatePercent: parseFloat(dropRate),
        finalOccupancy: state.currentLevel,
        steps: state.history
      },
      exportedAt: new Date().toISOString()
    };

    const json = JSON.stringify(data, null, 2);
    downloadBlob(json, 'smartnet_leaky_bucket_results.json', 'application/json');
    showToast('Exported JSON file.');
  }

  function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /* ── 16. Toast Notification ──────────────────────────────── */
  function showToast(msg) {
    if (!el.toast || !el.toastMsg) return;
    el.toastMsg.textContent = msg;
    el.toast.classList.add('show');
    setTimeout(() => {
      el.toast.classList.remove('show');
    }, 2800);
  }

  /* ── 17. Window Resize Handler ───────────────────────────── */
  window.addEventListener('resize', () => {
    renderLiveChart();
  });

  /* ── 18. Bootstrap Lifecycle ─────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    if (SMARTNET.Navigation && typeof SMARTNET.Navigation.init === 'function') {
      SMARTNET.Navigation.init('sn-nav-container');
    }
    if (SMARTNET.Integration && typeof SMARTNET.Integration.init === 'function') {
      SMARTNET.Integration.init();
    }

    initDOMElements();
    validateInputs();
    attachEventListeners();
    updateTopologyPathDisplay();
    updateBucketMarkings();
    renderBucketVisual();
    updateMetricCards();
    updateResultsSection();
    renderLiveChart();

    console.log('[SMARTNET] Leaky Bucket module initialized successfully.');
  });

  // Expose pure algorithm for testing and verification
  window.SMARTNET_LeakyBucket = {
    simulateLeakyBucket,
    state
  };
  window.SMARTNET = SMARTNET;

})();
