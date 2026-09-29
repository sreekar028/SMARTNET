/**
 * SMARTNET — Leaky Bucket Simulation Module
 * pages/modules/leaky-bucket/leaky-bucket.js
 *
 * Implements the Leaky Bucket Congestion Control and Traffic Shaping algorithm.
 * Conforms to SMARTNET architecture and integration protocols.
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
      member: 'Ganjikunta Swapna',
      version: '1.0.0'
    });
  }

  /* ── 2. Simulation State ─────────────────────────────────── */
  const state = {
    // Parameters
    capacity: 10,
    leakRate: 3,
    speed: 1000, // ms per tick
    loop: false,

    // Runtime state
    timeStep: 0,
    currentLevel: 0,
    isRunning: false,
    timer: null,

    // Traffic source
    sourceNode: 'PC1',
    shaperRouter: 'R1',
    destNode: 'SERVER',
    arrivalMode: 'preset', // 'preset' | 'custom' | 'random'
    activePreset: 'bursty',

    // Sequence definitions
    presetSequences: {
      bursty:     [4, 8, 2, 10, 3, 1, 0, 7, 2, 6, 0, 1],
      cbr:        [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      congestion: [6, 12, 9, 14, 8, 10, 5, 2, 1, 0],
      spikes:     [1, 1, 12, 1, 1, 14, 1, 1, 10, 0]
    },
    activeSequence: [4, 8, 2, 10, 3, 1, 0, 7, 2, 6, 0, 1],
    sequenceIdx: 0,

    // Metrics & History
    totalInflow: 0,
    totalConforming: 0,
    totalDropped: 0,
    history: []
  };

  /* ── 3. DOM Elements ─────────────────────────────────────── */
  const el = {};

  function initDOMElements() {
    el.capInput        = document.getElementById('lb-capacity');
    el.capVal          = document.getElementById('lb-cap-val');
    el.rateInput       = document.getElementById('lb-leak-rate');
    el.rateVal         = document.getElementById('lb-rate-val');
    el.speedInput      = document.getElementById('lb-speed');
    el.speedVal        = document.getElementById('lb-speed-val');
    el.customSeqInput  = document.getElementById('lb-custom-seq');
    el.sourceSelect    = document.getElementById('lb-source-node');
    el.routerSelect    = document.getElementById('lb-router-node');
    el.loopCheck       = document.getElementById('lb-loop-check');

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

    // Topology flow path
    el.topoSourceChip  = document.getElementById('topo-source-chip');
    el.topoRouterChip  = document.getElementById('topo-router-chip');
    el.topoDestChip    = document.getElementById('topo-dest-chip');

    // Metric counters
    el.metricFill      = document.getElementById('metric-lb-fill');
    el.metricInflow    = document.getElementById('metric-lb-inflow');
    el.metricSent      = document.getElementById('metric-lb-sent');
    el.metricDropped   = document.getElementById('metric-lb-dropped');
    el.metricDropRate  = document.getElementById('metric-lb-droprate');
    el.metricThroughput= document.getElementById('metric-lb-throughput');

    // Chart & Table
    el.canvas          = document.getElementById('trafficCanvas');
    el.logTbody        = document.getElementById('lb-log-tbody');
    el.toast           = document.getElementById('sn-toast');
    el.toastMsg        = document.getElementById('sn-toast-msg');
  }

  /* ── 4. Parameter Updates & Listeners ─────────────────────── */
  function attachEventListeners() {
    // Sliders
    el.capInput.addEventListener('input', function (e) {
      state.capacity = parseInt(e.target.value, 10);
      el.capVal.textContent = state.capacity;
      updateBucketMarkings();
      renderBucketVisual();
    });

    el.rateInput.addEventListener('input', function (e) {
      state.leakRate = parseInt(e.target.value, 10);
      el.rateVal.textContent = state.leakRate;
    });

    el.speedInput.addEventListener('input', function (e) {
      const spdFactor = parseFloat(e.target.value);
      state.speed = Math.round(1000 / spdFactor);
      el.speedVal.textContent = spdFactor + 'x';
      if (state.isRunning) {
        clearInterval(state.timer);
        state.timer = setInterval(stepSimulation, state.speed);
      }
    });

    // Preset selector chips
    document.querySelectorAll('[data-preset]').forEach(chip => {
      chip.addEventListener('click', function () {
        document.querySelectorAll('[data-preset]').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        const pKey = this.dataset.preset;
        state.activePreset = pKey;
        state.arrivalMode = 'preset';
        state.activeSequence = [...state.presetSequences[pKey]];
        state.sequenceIdx = 0;
        el.customSeqInput.value = state.activeSequence.join(', ');
      });
    });

    // Custom sequence parsing
    el.customSeqInput.addEventListener('change', function () {
      const raw = this.value.trim();
      const parsed = raw.split(/[\s,]+/).map(v => parseInt(v, 10)).filter(v => !isNaN(v) && v >= 0);
      if (parsed.length > 0) {
        state.activeSequence = parsed;
        state.arrivalMode = 'custom';
        state.sequenceIdx = 0;
        document.querySelectorAll('[data-preset]').forEach(c => c.classList.remove('active'));
      }
    });

    // Topology Node Selectors
    el.sourceSelect.addEventListener('change', function () {
      state.sourceNode = this.value;
      // Auto-assign logical router in common topology
      if (state.sourceNode === 'PC1' || state.sourceNode === 'PC2') {
        state.shaperRouter = 'R1';
      } else {
        state.shaperRouter = 'R2';
      }
      el.routerSelect.value = state.shaperRouter;
      updateTopologyPathDisplay();
    });

    el.routerSelect.addEventListener('change', function () {
      state.shaperRouter = this.value;
      updateTopologyPathDisplay();
    });

    // Loop checkbox
    el.loopCheck.addEventListener('change', function () {
      state.loop = this.checked;
    });

    // Manual burst inject buttons
    document.querySelectorAll('[data-inject]').forEach(btn => {
      btn.addEventListener('click', function () {
        const burst = parseInt(this.dataset.inject, 10);
        injectManualBurst(burst);
      });
    });

    // Simulation Controls
    el.btnPlay.addEventListener('click', togglePlayPause);
    el.btnStep.addEventListener('click', stepSimulation);
    el.btnReset.addEventListener('click', resetSimulation);
    el.btnSaveResult.addEventListener('click', saveResultsToIntegration);
    el.btnExportCsv.addEventListener('click', exportCSV);
    el.btnExportJson.addEventListener('click', exportJSON);
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

  /* ── 5. Core Simulation Step Algorithm ───────────────────── */
  function stepSimulation() {
    // Determine incoming packet burst for this time tick
    let incoming = 0;

    if (state.sequenceIdx < state.activeSequence.length) {
      incoming = state.activeSequence[state.sequenceIdx];
      state.sequenceIdx++;
    } else if (state.loop && state.activeSequence.length > 0) {
      state.sequenceIdx = 0;
      incoming = state.activeSequence[state.sequenceIdx];
      state.sequenceIdx++;
    } else {
      // Sequence completed, drain remaining queue or pause
      if (state.currentLevel === 0) {
        pauseSimulation();
        showToast('Sequence completed and buffer emptied!');
        return;
      }
      incoming = 0;
    }

    state.timeStep++;

    // Calculate queue dynamics
    const availableSpace = Math.max(0, state.capacity - state.currentLevel);
    const accepted = Math.min(incoming, availableSpace);
    const dropped = incoming - accepted;

    // Buffer after inflow before leakage
    const bufferBeforeLeak = state.currentLevel + accepted;

    // Outflow leakage at constant rate
    const transmitted = Math.min(bufferBeforeLeak, state.leakRate);
    const bufferAfterLeak = bufferBeforeLeak - transmitted;

    // Update state
    state.currentLevel = bufferAfterLeak;
    state.totalInflow += incoming;
    state.totalConforming += transmitted;
    state.totalDropped += dropped;

    // Record step history record
    const stepRecord = {
      t: state.timeStep,
      incoming: incoming,
      accepted: accepted,
      dropped: dropped,
      transmitted: transmitted,
      queueRemaining: bufferAfterLeak,
      capacity: state.capacity,
      leakRate: state.leakRate
    };
    state.history.push(stepRecord);

    // Visual updates
    triggerInflowAnimation(incoming);
    triggerOutflowAnimation(transmitted);
    triggerOverflowAnimation(dropped);
    renderBucketVisual();
    updateMetricCards();
    appendLogRow(stepRecord);
    renderLiveChart();
  }

  /* ── 6. Manual Burst Injection ───────────────────────────── */
  function injectManualBurst(amount) {
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
      t: state.timeStep,
      incoming: incoming,
      accepted: accepted,
      dropped: dropped,
      transmitted: transmitted,
      queueRemaining: bufferAfterLeak,
      capacity: state.capacity,
      leakRate: state.leakRate,
      isManual: true
    };
    state.history.push(stepRecord);

    triggerInflowAnimation(incoming);
    triggerOutflowAnimation(transmitted);
    triggerOverflowAnimation(dropped);
    renderBucketVisual();
    updateMetricCards();
    appendLogRow(stepRecord);
    renderLiveChart();

    showToast(`Injected manual burst of +${amount} packets`);
  }

  /* ── 7. Play / Pause / Reset Handlers ────────────────────── */
  function togglePlayPause() {
    if (state.isRunning) {
      pauseSimulation();
    } else {
      startSimulation();
    }
  }

  function startSimulation() {
    state.isRunning = true;
    el.btnPlay.innerHTML = '⏸️ Pause';
    el.btnPlay.classList.remove('btn-primary-sn');
    el.btnPlay.classList.add('btn-secondary-sn');
    state.timer = setInterval(stepSimulation, state.speed);
  }

  function pauseSimulation() {
    state.isRunning = false;
    el.btnPlay.innerHTML = '▶️ Run';
    el.btnPlay.classList.add('btn-primary-sn');
    el.btnPlay.classList.remove('btn-secondary-sn');
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function resetSimulation() {
    pauseSimulation();
    state.timeStep = 0;
    state.currentLevel = 0;
    state.sequenceIdx = 0;
    state.totalInflow = 0;
    state.totalConforming = 0;
    state.totalDropped = 0;
    state.history = [];

    if (el.logTbody) el.logTbody.innerHTML = '';
    renderBucketVisual();
    updateMetricCards();
    renderLiveChart();
    showToast('Simulation reset to initial state.');
  }

  /* ── 8. Visual Animations ────────────────────────────────── */
  function triggerInflowAnimation(count) {
    if (count <= 0 || !el.inflowAnim) return;
    el.inflowAnim.classList.remove('active');
    void el.inflowAnim.offsetWidth; // reflow
    el.inflowAnim.classList.add('active');
  }

  function triggerOutflowAnimation(count) {
    if (!el.leakDrip) return;
    if (count > 0) {
      el.leakDrip.classList.add('dripping');
    } else {
      el.leakDrip.classList.remove('dripping');
    }
  }

  function triggerOverflowAnimation(dropped) {
    if (!el.overflowChute || !el.overflowCount) return;
    if (dropped > 0) {
      el.overflowCount.textContent = `+${dropped} Loss`;
      el.overflowChute.classList.add('overflowing');
      setTimeout(() => {
        el.overflowChute.classList.remove('overflowing');
      }, 700);
    }
  }

  function renderBucketVisual() {
    const fillPercent = Math.min(100, Math.round((state.currentLevel / state.capacity) * 100));

    if (el.bucketFluid) {
      el.bucketFluid.style.height = `${fillPercent}%`;
      el.bucketFluid.className = 'bucket-fluid';
      if (fillPercent >= 90) {
        el.bucketFluid.classList.add('full');
      } else if (fillPercent >= 60) {
        el.bucketFluid.classList.add('high');
      }
    }

    if (el.currFillDisplay) {
      el.currFillDisplay.textContent = `${state.currentLevel} / ${state.capacity} (${fillPercent}%)`;
    }

    // Render queued packet chips inside bucket (up to 6 visual representations)
    if (el.packetGrid) {
      el.packetGrid.innerHTML = '';
      const visibleChips = Math.min(state.currentLevel, 6);
      for (let i = 0; i < visibleChips; i++) {
        const chip = document.createElement('div');
        chip.className = 'packet-chip';
        chip.innerHTML = `<span>📦 Pkt #${state.currentLevel - i}</span><span>Conforming</span>`;
        el.packetGrid.appendChild(chip);
      }
      if (state.currentLevel > 6) {
        const more = document.createElement('div');
        more.className = 'packet-chip text-muted';
        more.style.justifyContent = 'center';
        more.textContent = `+ ${state.currentLevel - 6} more in queue`;
        el.packetGrid.appendChild(more);
      }
    }
  }

  /* ── 9. Metric Cards Updates ─────────────────────────────── */
  function updateMetricCards() {
    const dropRate = state.totalInflow > 0
      ? ((state.totalDropped / state.totalInflow) * 100).toFixed(1)
      : '0.0';

    // Calculate throughput in Mbps (assuming 1 packet = 1500 bytes on 10Mbps link)
    // Throughput = leakRate * packetSize * 8 / tickInterval
    const instantaneousThroughput = (state.leakRate * 1.5 * 8 / (state.speed / 1000)).toFixed(1);

    if (el.metricFill)      el.metricFill.textContent      = `${state.currentLevel} pkts`;
    if (el.metricInflow)    el.metricInflow.textContent    = state.totalInflow;
    if (el.metricSent)      el.metricSent.textContent      = state.totalConforming;
    if (el.metricDropped)   el.metricDropped.textContent   = state.totalDropped;
    if (el.metricDropRate)  el.metricDropRate.textContent  = `${dropRate}%`;
    if (el.metricThroughput)el.metricThroughput.textContent= `${instantaneousThroughput} Mbps`;
  }

  /* ── 10. Execution Log Table ─────────────────────────────── */
  function appendLogRow(rec) {
    if (!el.logTbody) return;

    const tr = document.createElement('tr');
    let statusBadge = '<span class="sn-badge success">Conforming</span>';
    if (rec.dropped > 0) {
      statusBadge = `<span class="sn-badge danger">Drop (${rec.dropped})</span>`;
    } else if (rec.incoming === 0 && rec.transmitted === 0) {
      statusBadge = '<span class="sn-badge muted">Idle</span>';
    } else if (rec.queueRemaining > rec.capacity * 0.7) {
      statusBadge = '<span class="sn-badge warning">Buffer High</span>';
    }

    tr.innerHTML = `
      <td style="font-family:var(--font-mono);font-weight:700;">T+${rec.t}</td>
      <td style="font-family:var(--font-mono);color:var(--color-primary);">${rec.incoming}</td>
      <td style="font-family:var(--font-mono);color:var(--color-accent);">${rec.transmitted}</td>
      <td style="font-family:var(--font-mono);color:${rec.dropped > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">${rec.dropped}</td>
      <td style="font-family:var(--font-mono);">${rec.queueRemaining} / ${rec.capacity}</td>
      <td>${statusBadge}</td>
    `;

    // Prepend newest row to top
    el.logTbody.insertBefore(tr, el.logTbody.firstChild);

    // Limit to latest 50 rows in DOM
    if (el.logTbody.children.length > 50) {
      el.logTbody.removeChild(el.logTbody.lastChild);
    }
  }

  /* ── 11. Real-Time Canvas Chart ──────────────────────────── */
  function renderLiveChart() {
    if (!el.canvas) return;
    const ctx = el.canvas.getContext('2d');
    const width = el.canvas.clientWidth || 600;
    const height = el.canvas.clientHeight || 220;

    // Handle high-DPI
    const dpr = window.devicePixelRatio || 1;
    el.canvas.width = width * dpr;
    el.canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, width, height);

    const history = state.history.slice(-25); // show last 25 points
    if (history.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Live traffic timeline will appear here as simulation runs', width / 2, height / 2);
      return;
    }

    const padLeft = 40, padRight = 20, padTop = 20, padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Find max value for Y-axis scaling
    let maxY = Math.max(state.capacity + 2, 12);
    history.forEach(pt => {
      if (pt.incoming > maxY) maxY = pt.incoming + 2;
    });

    const getY = (val) => padTop + chartH - (val / maxY) * chartH;
    const getX = (idx) => padLeft + (idx / Math.max(history.length - 1, 1)) * chartW;

    // Draw horizontal grid lines
    ctx.strokeStyle = '#1e3a5f';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.textAlign = 'right';

    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
      const val = Math.round((maxY / ySteps) * i);
      const y = getY(val);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillText(val, padLeft - 8, y + 3);
    }

    // Draw Capacity Limit reference line
    const capY = getY(state.capacity);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(padLeft, capY);
    ctx.lineTo(width - padRight, capY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.fillText(`Cap: ${state.capacity}`, width - padRight, capY - 4);

    // 1. Draw Inflow Bursts (Blue Bars)
    const barWidth = Math.max(2, (chartW / history.length) * 0.4);
    history.forEach((pt, i) => {
      const x = getX(i);
      const yIn = getY(pt.incoming);
      const base = getY(0);

      ctx.fillStyle = 'rgba(79, 142, 247, 0.55)';
      ctx.fillRect(x - barWidth / 2, yIn, barWidth, base - yIn);

      // Dropped portion in red at top of bar
      if (pt.dropped > 0) {
        const dropHeight = (pt.dropped / maxY) * chartH;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x - barWidth / 2, yIn, barWidth, dropHeight);
      }
    });

    // 2. Draw Buffer Fill Level (Yellow/Orange Line & fill)
    ctx.beginPath();
    history.forEach((pt, i) => {
      const x = getX(i);
      const y = getY(pt.queueRemaining);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Draw Conforming Output Leak Rate (Green Line)
    ctx.beginPath();
    history.forEach((pt, i) => {
      const x = getX(i);
      const y = getY(pt.transmitted);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#06d6a0';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Draw data points on green line
    history.forEach((pt, i) => {
      const x = getX(i);
      const y = getY(pt.transmitted);
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
        ctx.fillText(`T+${pt.t}`, getX(i), height - 10);
      }
    });
  }

  /* ── 12. Save Results to Integration Layer ───────────────── */
  function saveResultsToIntegration() {
    if (state.history.length === 0) {
      showToast('Run the simulation first to generate results.');
      return;
    }

    const dropRate = state.totalInflow > 0
      ? ((state.totalDropped / state.totalInflow) * 100).toFixed(1)
      : '0.0';

    const throughput = (state.leakRate * 1.5 * 8 / (state.speed / 1000)).toFixed(1);

    const payload = {
      experiment: 'Leaky Bucket Congestion Control',
      module: 'leaky-bucket',
      status: 'Completed',
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
      showToast('Result saved to SMARTNET Dashboard!');
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

  /* ── 13. Data Export (CSV / JSON) ────────────────────────── */
  function exportCSV() {
    if (state.history.length === 0) {
      showToast('No simulation data to export.');
      return;
    }

    let csv = 'Time,Incoming,Accepted,Dropped,Transmitted,BufferRemaining,Capacity,LeakRate\n';
    state.history.forEach(r => {
      csv += `${r.t},${r.incoming},${r.accepted},${r.dropped},${r.transmitted},${r.queueRemaining},${r.capacity},${r.leakRate}\n`;
    });

    downloadBlob(csv, 'smartnet_leaky_bucket_results.csv', 'text/csv;charset=utf-8;');
    showToast('Exported CSV file.');
  }

  function exportJSON() {
    if (state.history.length === 0) {
      showToast('No simulation data to export.');
      return;
    }

    const data = {
      experiment: 'Leaky Bucket Simulation',
      module: 'leaky-bucket',
      parameters: {
        capacity: state.capacity,
        leakRate: state.leakRate,
        sourceNode: state.sourceNode,
        shaperRouter: state.shaperRouter,
        destNode: state.destNode
      },
      summary: {
        totalInflow: state.totalInflow,
        totalConforming: state.totalConforming,
        totalDropped: state.totalDropped,
        dropRatePercent: state.totalInflow > 0 ? ((state.totalDropped / state.totalInflow) * 100).toFixed(1) : 0
      },
      trace: state.history,
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

  /* ── 14. Toast Notification ──────────────────────────────── */
  function showToast(msg) {
    if (!el.toast || !el.toastMsg) return;
    el.toastMsg.textContent = msg;
    el.toast.classList.add('show');
    setTimeout(() => {
      el.toast.classList.remove('show');
    }, 2800);
  }

  /* ── 15. Window Resize Handler ───────────────────────────── */
  window.addEventListener('resize', () => {
    renderLiveChart();
  });

  /* ── 16. Bootstrap Lifecycle ─────────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {
    // Mount shared navigation & integration
    if (SMARTNET.Navigation && typeof SMARTNET.Navigation.init === 'function') {
      SMARTNET.Navigation.init('sn-nav-container');
    }
    if (SMARTNET.Integration && typeof SMARTNET.Integration.init === 'function') {
      SMARTNET.Integration.init();
    }

    initDOMElements();
    attachEventListeners();
    updateTopologyPathDisplay();
    updateBucketMarkings();
    renderBucketVisual();
    updateMetricCards();
    renderLiveChart();

    console.log('[SMARTNET] Leaky Bucket module initialized successfully.');
  });

  window.SMARTNET = SMARTNET;

})();
