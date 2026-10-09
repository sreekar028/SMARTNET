/**
 * SMARTNET — ns2.js
 * Member 7: Network Analysis Tools
 * NS2 Simulation Trace Analyzer & Performance Metrics Engine
 */

var SMARTNET = window.SMARTNET || {};

SMARTNET.NS2 = (function () {
  'use strict';

  // State
  let rawTraceRecords = [];
  let computedMetrics = {};
  let activeMode = 'demo';

  /* ═══════════════════════════════════════════════════════════
     1. DEMONSTRATION TRACES (Mode C)
  ════════════════════════════════════════════════════════════ */
  const DEMO_TRACES = {
    cbr_udp: (function () {
      const records = [];
      let pktId = 0;
      // PC1 (0) -> R1 (4) -> R3 (6) -> Server (7)
      for (let t = 0.500; t <= 2.000; t += 0.050) {
        pktId++;
        const timeStr = t.toFixed(5);
        const tQueue = (t + 0.001).toFixed(5);
        const tHop1 = (t + 0.006).toFixed(5);
        const tHop2 = (t + 0.012).toFixed(5);
        const tRecv = (t + 0.018).toFixed(5);

        // Enqueue at PC1 (0->4)
        records.push({ event: '+', time: parseFloat(timeStr), from: '0', to: '4', type: 'cbr', size: 1000, fid: '1', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
        // Dequeue at PC1
        records.push({ event: '-', time: parseFloat(tQueue), from: '0', to: '4', type: 'cbr', size: 1000, fid: '1', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
        // Receive at R1 (4)
        records.push({ event: 'r', time: parseFloat(tHop1), from: '0', to: '4', type: 'cbr', size: 1000, fid: '1', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
        // Forward R1 -> R3 (4->6)
        records.push({ event: '+', time: parseFloat(tHop1), from: '4', to: '6', type: 'cbr', size: 1000, fid: '1', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
        records.push({ event: 'r', time: parseFloat(tHop2), from: '4', to: '6', type: 'cbr', size: 1000, fid: '1', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
        // Forward R3 -> Server (6->7)
        records.push({ event: '+', time: parseFloat(tHop2), from: '6', to: '7', type: 'cbr', size: 1000, fid: '1', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
        records.push({ event: 'r', time: parseFloat(tRecv), from: '6', to: '7', type: 'cbr', size: 1000, fid: '1', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
      }
      return records;
    })(),

    tcp_congestion: (function () {
      const records = [];
      let pktId = 0;
      // PC1 (0) sends TCP bursts, bottleneck router R3 (6) drops packets when queue fills
      for (let t = 1.000; t <= 3.500; t += 0.040) {
        pktId++;
        const isDropped = (pktId >= 15 && pktId <= 18) || (pktId >= 35 && pktId <= 37);
        const timeStr = t.toFixed(5);
        const tHop1 = (t + 0.005).toFixed(5);
        const tHop2 = (t + 0.012).toFixed(5);
        const tRecv = (t + 0.022).toFixed(5);

        // Enqueue PC1
        records.push({ event: '+', time: parseFloat(timeStr), from: '0', to: '4', type: 'tcp', size: 1040, fid: '2', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
        records.push({ event: '-', time: parseFloat((t + 0.001).toFixed(5)), from: '0', to: '4', type: 'tcp', size: 1040, fid: '2', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
        records.push({ event: 'r', time: parseFloat(tHop1), from: '0', to: '4', type: 'tcp', size: 1040, fid: '2', src: '0.0', dst: '7.0', seq: pktId, id: pktId });

        if (isDropped) {
          // Drop at bottleneck router R3 (6->7) queue overflow
          records.push({ event: 'd', time: parseFloat(tHop2), from: '6', to: '7', type: 'tcp', size: 1040, fid: '2', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
        } else {
          records.push({ event: 'r', time: parseFloat(tHop2), from: '4', to: '6', type: 'tcp', size: 1040, fid: '2', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
          records.push({ event: '+', time: parseFloat(tHop2), from: '6', to: '7', type: 'tcp', size: 1040, fid: '2', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
          records.push({ event: 'r', time: parseFloat(tRecv), from: '6', to: '7', type: 'tcp', size: 1040, fid: '2', src: '0.0', dst: '7.0', seq: pktId, id: pktId });
        }
      }
      return records;
    })(),

    mixed_traffic: (function () {
      const records = [];
      let pktId = 0;
      // Multi-flow: Flow 1 (PC1 -> Server TCP) & Flow 2 (PC2 -> Server UDP)
      for (let t = 0.200; t <= 2.200; t += 0.035) {
        pktId++;
        const isFlow1 = pktId % 2 === 0;
        const srcNode = isFlow1 ? '0' : '1';
        const pType = isFlow1 ? 'tcp' : 'cbr';
        const pSize = isFlow1 ? 1040 : 512;
        const fid = isFlow1 ? '1' : '2';

        const tHop1 = (t + 0.004).toFixed(5);
        const tHop2 = (t + 0.010).toFixed(5);
        const tRecv = (t + 0.017).toFixed(5);

        records.push({ event: '+', time: parseFloat(t.toFixed(5)), from: srcNode, to: '4', type: pType, size: pSize, fid: fid, src: `${srcNode}.0`, dst: '7.0', seq: pktId, id: pktId });
        records.push({ event: 'r', time: parseFloat(tHop1), from: srcNode, to: '4', type: pType, size: pSize, fid: fid, src: `${srcNode}.0`, dst: '7.0', seq: pktId, id: pktId });
        records.push({ event: 'r', time: parseFloat(tHop2), from: '4', to: '6', type: pType, size: pSize, fid: fid, src: `${srcNode}.0`, dst: '7.0', seq: pktId, id: pktId });

        // Rare drop on high load
        if (pktId === 23 || pktId === 41) {
          records.push({ event: 'd', time: parseFloat(tHop2), from: '6', to: '7', type: pType, size: pSize, fid: fid, src: `${srcNode}.0`, dst: '7.0', seq: pktId, id: pktId });
        } else {
          records.push({ event: 'r', time: parseFloat(tRecv), from: '6', to: '7', type: pType, size: pSize, fid: fid, src: `${srcNode}.0`, dst: '7.0', seq: pktId, id: pktId });
        }
      }
      return records;
    })()
  };

  /* ═══════════════════════════════════════════════════════════
     2. TRACE FILE PARSING & METRIC COMPUTATION
  ═══════════════════════════════════════════════════════════ */

  /**
   * Parse NS-2 standard wired or wireless text trace
   */
  function parseNs2TraceText(text) {
    const lines = text.trim().split(/\r?\n/);
    const parsed = [];

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;

      const tokens = line.split(/\s+/);
      if (tokens.length >= 12) {
        // Wired trace: [event] [time] [from] [to] [pkt_type] [pkt_size] [flags] [fid] [src_addr] [dst_addr] [seq_num] [pkt_id]
        parsed.push({
          event: tokens[0],
          time: parseFloat(tokens[1]),
          from: tokens[2],
          to: tokens[3],
          type: tokens[4],
          size: parseInt(tokens[5], 10) || 512,
          flags: tokens[6],
          fid: tokens[7],
          src: tokens[8],
          dst: tokens[9],
          seq: parseInt(tokens[10], 10) || 0,
          id: parseInt(tokens[11], 10) || 0
        });
      } else if (tokens.length >= 5) {
        // Simplified/flexible format
        parsed.push({
          event: tokens[0],
          time: parseFloat(tokens[1]) || 0,
          from: tokens[2] || '0',
          to: tokens[3] || '1',
          type: tokens[4] || 'cbr',
          size: parseInt(tokens[5], 10) || 512,
          src: tokens[6] || '0.0',
          dst: tokens[7] || '1.0',
          seq: parseInt(tokens[8], 10) || 0,
          id: parseInt(tokens[9], 10) || parsed.length + 1
        });
      }
    }

    if (parsed.length === 0) {
      throw new Error('No valid NS2 trace entries recognized. Ensure file contains standard NS2 12-column trace lines.');
    }

    return parsed;
  }

  /**
   * Calculate academic network metrics from trace records
   */
  function calculateMetrics(records) {
    let sentCount = 0;
    let recvCount = 0;
    let dropCount = 0;
    let totalRecvBytes = 0;

    let minTime = Infinity;
    let maxTime = -Infinity;

    // Track per-packet send and receive timestamps for delay/jitter
    const sendTimes = {};
    const recvTimes = {};
    const delays = [];

    // Distinct application packets originated
    const seenSentIds = new Set();
    const seenRecvIds = new Set();
    const seenDropIds = new Set();

    records.forEach(r => {
      if (r.time < minTime) minTime = r.time;
      if (r.time > maxTime) maxTime = r.time;

      // Event classification
      if (r.event === '+') {
        // Origination enqueue (count unique packet IDs to prevent double counting forwarded hops)
        if (!seenSentIds.has(r.id)) {
          seenSentIds.add(r.id);
          sentCount++;
          sendTimes[r.id] = r.time;
        }
      } else if (r.event === 'r') {
        // Receive event at destination
        // If final destination node (e.g. Server '7' or dst address)
        if (!seenRecvIds.has(r.id)) {
          seenRecvIds.add(r.id);
          recvCount++;
          totalRecvBytes += r.size;
          recvTimes[r.id] = r.time;

          if (sendTimes[r.id] !== undefined) {
            const delay = (r.time - sendTimes[r.id]) * 1000; // in ms
            if (delay >= 0) delays.push(delay);
          }
        }
      } else if (r.event === 'd') {
        if (!seenDropIds.has(r.id)) {
          seenDropIds.add(r.id);
          dropCount++;
        }
      }
    });

    // Fallback if records format did not use '+' origination
    if (sentCount === 0) {
      sentCount = recvCount + dropCount;
    }

    const duration = maxTime > minTime ? (maxTime - minTime) : 1.0;

    // Formulas:
    // PDR = (Recv / Sent) * 100
    const pdr = sentCount > 0 ? (recvCount / sentCount) * 100 : 0;
    // PLR = (Drop / Sent) * 100
    const plr = sentCount > 0 ? (dropCount / sentCount) * 100 : 0;
    // Throughput = (Total Bits / Duration) / 1000  (in Kbps)
    const throughputKbps = duration > 0 ? ((totalRecvBytes * 8) / duration) / 1000 : 0;

    // Delay & Jitter
    let avgDelay = 0;
    let jitter = 0;
    if (delays.length > 0) {
      avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      if (delays.length > 1) {
        let jitterSum = 0;
        for (let i = 1; i < delays.length; i++) {
          jitterSum += Math.abs(delays[i] - delays[i - 1]);
        }
        jitter = jitterSum / (delays.length - 1);
      }
    }

    return {
      sentCount,
      recvCount,
      dropCount,
      totalRecvBytes,
      duration,
      pdr: parseFloat(pdr.toFixed(2)),
      plr: parseFloat(plr.toFixed(2)),
      throughputKbps: parseFloat(throughputKbps.toFixed(2)),
      avgDelay: parseFloat(avgDelay.toFixed(2)),
      jitter: parseFloat(jitter.toFixed(2)),
      delays
    };
  }

  /* ═══════════════════════════════════════════════════════════
     3. OTcl SCRIPT GENERATOR (Mode B)
  ═══════════════════════════════════════════════════════════ */

  function generateOTclScript(agentType) {
    return `# ======================================================================
# SMARTNET Organizational Topology — NS-2 Simulation Script
# Topology: Server -- R3 -- (R1, R2) -- (PC1, PC2, PC3, PC4)
# Generated for Member 7 NS2 Performance Analysis
# ======================================================================

set ns [new Simulator]

# Open trace file for output
set tf [open out.tr w]
$ns trace-all $tf

# Open NAM visualization file
set nf [open out.nam w]
$ns namtrace-all $nf

# Define Nodes
set server [$ns node] ;# Node 7
set r3     [$ns node] ;# Node 6 (Core Router)
set r1     [$ns node] ;# Node 4 (Subnet 1 Router)
set r2     [$ns node] ;# Node 5 (Subnet 2 Router)
set pc1    [$ns node] ;# Node 0
set pc2    [$ns node] ;# Node 1
set pc3    [$ns node] ;# Node 2
set pc4    [$ns node] ;# Node 3

# Define Duplex Links (Bandwidth, Delay, Queue Type)
# Core Infrastructure
$ns duplex-link $server $r3 100Mb 2ms DropTail
$ns duplex-link $r3 $r1     50Mb  5ms DropTail
$ns duplex-link $r3 $r2     50Mb  5ms DropTail

# Access Subnets
$ns duplex-link $r1 $pc1    10Mb  2ms DropTail
$ns duplex-link $r1 $pc2    10Mb  2ms DropTail
$ns duplex-link $r2 $pc3    10Mb  2ms DropTail
$ns duplex-link $r2 $pc4    10Mb  2ms DropTail

# Set Queue Limits
$ns queue-limit $r3 $server 20
$ns queue-limit $r1 $r3 20

# Setup Traffic Source & Destination
# Selected Agent: ${agentType}
set srcAgent [new ${agentType}]
$ns attach-agent $pc1 $srcAgent

set sinkAgent [new Agent/TCPSink]
$ns attach-agent $server $sinkAgent
$ns connect $srcAgent $sinkAgent

# Application Traffic Generator
set app [new Application/FTP]
$app attach-agent $srcAgent

# Simulation Schedule
$ns at 0.5 "$app start"
$ns at 4.5 "$app stop"
$ns at 5.0 "finish"

proc finish {} {
    global ns tf nf
    $ns flush-trace
    close $tf
    close $nf
    puts "SMARTNET NS2 Simulation Complete: out.tr generated."
    exit 0
}

$ns run
`;
  }

  /* ═══════════════════════════════════════════════════════════
     4. UI RENDERING & CHARTS
  ═══════════════════════════════════════════════════════════ */

  function loadDemoScenario(key) {
    const data = DEMO_TRACES[key];
    if (!data) return;
    rawTraceRecords = JSON.parse(JSON.stringify(data));
    computedMetrics = calculateMetrics(rawTraceRecords);
    updateUI();
  }

  function handleTraceFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const text = evt.target.result;
        rawTraceRecords = parseNs2TraceText(text);
        computedMetrics = calculateMetrics(rawTraceRecords);
        updateUI();
      } catch (err) {
        alert('Trace Parse Error: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function updateUI() {
    renderMetricCards();
    renderTraceTable();
    renderEventChart();
    renderThroughputChart();
  }

  function renderMetricCards() {
    const m = computedMetrics;
    const pdrEl = document.getElementById('metric-pdr');
    const plrEl = document.getElementById('metric-plr');
    const tpEl = document.getElementById('metric-throughput');
    const delayEl = document.getElementById('metric-delay');
    const jitterEl = document.getElementById('metric-jitter');

    const sentEl = document.getElementById('metric-sent');
    const recvEl = document.getElementById('metric-recv');
    const dropEl = document.getElementById('metric-drop');
    const durEl = document.getElementById('metric-duration');

    if (pdrEl) pdrEl.textContent = `${m.pdr}%`;
    if (plrEl) plrEl.textContent = `${m.plr}%`;
    if (tpEl) tpEl.textContent = `${m.throughputKbps} Kbps`;
    if (delayEl) delayEl.textContent = `${m.avgDelay} ms`;
    if (jitterEl) jitterEl.textContent = `Jitter: ${m.jitter} ms`;

    if (sentEl) sentEl.textContent = m.sentCount;
    if (recvEl) recvEl.textContent = m.recvCount;
    if (dropEl) dropEl.textContent = m.dropCount;
    if (durEl) durEl.textContent = `${m.duration.toFixed(2)} s`;
  }

  function renderTraceTable() {
    const tbody = document.getElementById('ns2-trace-rows');
    const countEl = document.getElementById('trace-line-count');
    if (countEl) countEl.textContent = rawTraceRecords.length;
    if (!tbody) return;

    if (rawTraceRecords.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No trace events loaded.</td></tr>';
      return;
    }

    // Render first 80 rows for responsiveness
    const slice = rawTraceRecords.slice(0, 80);
    let html = '';

    slice.forEach(r => {
      let eventClass = 'event-plus';
      if (r.event === '-') eventClass = 'event-minus';
      else if (r.event === 'r') eventClass = 'event-r';
      else if (r.event === 'd') eventClass = 'event-d';

      html += `
        <tr>
          <td><span class="${eventClass}">${r.event}</span></td>
          <td>${r.time.toFixed(5)}</td>
          <td>${r.from}</td>
          <td>${r.to}</td>
          <td><span class="badge bg-secondary">${r.type}</span></td>
          <td>${r.size}</td>
          <td>${r.src}</td>
          <td>${r.dst}</td>
          <td>#${r.id} (${r.seq})</td>
        </tr>
      `;
    });

    if (rawTraceRecords.length > 80) {
      html += `<tr><td colspan="9" class="text-center text-muted py-2 small">... and ${rawTraceRecords.length - 80} additional records</td></tr>`;
    }

    tbody.innerHTML = html;
  }

  function renderEventChart() {
    const canvas = document.getElementById('canvas-ns2-events');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (rawTraceRecords.length < 2) return;

    const bins = 16;
    const maxT = Math.max(...rawTraceRecords.map(r => r.time));
    const minT = Math.min(...rawTraceRecords.map(r => r.time));
    const dur = maxT > minT ? (maxT - minT) : 1;
    const binSize = dur / bins;

    const sentBins = new Array(bins).fill(0);
    const recvBins = new Array(bins).fill(0);
    const dropBins = new Array(bins).fill(0);

    rawTraceRecords.forEach(r => {
      let b = Math.floor((r.time - minT) / binSize);
      if (b >= bins) b = bins - 1;
      if (r.event === '+') sentBins[b]++;
      else if (r.event === 'r') recvBins[b]++;
      else if (r.event === 'd') dropBins[b]++;
    });

    const maxVal = Math.max(...sentBins, ...recvBins, ...dropBins, 1);
    const padX = 25;
    const padY = 20;
    const chartW = w - padX * 2;
    const chartH = h - padY * 2;
    const binW = chartW / bins;

    // Baseline
    ctx.strokeStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(padX, h - padY);
    ctx.lineTo(w - padX, h - padY);
    ctx.stroke();

    for (let i = 0; i < bins; i++) {
      const bx = padX + i * binW + 2;
      const bw = (binW - 4) / 3;

      // Sent (blue)
      const sh = (sentBins[i] / maxVal) * (chartH - 10);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(bx, h - padY - sh, bw, sh);

      // Recv (green)
      const rh = (recvBins[i] / maxVal) * (chartH - 10);
      ctx.fillStyle = '#34d399';
      ctx.fillRect(bx + bw, h - padY - rh, bw, rh);

      // Drop (red)
      const dh = (dropBins[i] / maxVal) * (chartH - 10);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(bx + bw * 2, h - padY - dh, bw, dh);
    }
  }

  function renderThroughputChart() {
    const canvas = document.getElementById('canvas-ns2-throughput');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (rawTraceRecords.length < 2) return;

    const bins = 20;
    const maxT = Math.max(...rawTraceRecords.map(r => r.time));
    const minT = Math.min(...rawTraceRecords.map(r => r.time));
    const dur = maxT > minT ? (maxT - minT) : 1;
    const binSize = dur / bins;
    const bytesPerBin = new Array(bins).fill(0);

    rawTraceRecords.forEach(r => {
      if (r.event === 'r') {
        let b = Math.floor((r.time - minT) / binSize);
        if (b >= bins) b = bins - 1;
        bytesPerBin[b] += r.size;
      }
    });

    // Throughput per bin in Kbps
    const tpValues = bytesPerBin.map(bytes => ((bytes * 8) / binSize) / 1000);
    const maxTp = Math.max(...tpValues, 10);

    const padX = 35;
    const padY = 25;
    const chartW = w - padX * 2;
    const chartH = h - padY * 2;

    // Draw grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padX, padY);
    ctx.lineTo(padX, h - padY);
    ctx.lineTo(w - padX, h - padY);
    ctx.stroke();

    // Line curve
    ctx.strokeStyle = '#4f8ef7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    tpValues.forEach((val, i) => {
      const x = padX + (i / (bins - 1)) * chartW;
      const y = h - padY - (val / maxTp) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under curve
    ctx.lineTo(w - padX, h - padY);
    ctx.lineTo(padX, h - padY);
    ctx.fillStyle = 'rgba(79, 142, 247, 0.12)';
    ctx.fill();

    // Axis labels
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.fillText(`${Math.round(maxTp)}k`, 5, padY + 10);
    ctx.fillText('0', 18, h - padY);
  }

  /* ═══════════════════════════════════════════════════════════
     5. SAVE RESULTS & INTEGRATION
  ═══════════════════════════════════════════════════════════ */

  function saveResults() {
    if (rawTraceRecords.length === 0) {
      alert('No simulation metrics available to save.');
      return;
    }

    const m = computedMetrics;
    const record = {
      module: 'ns2',
      title: 'NS2 Simulation Performance Analysis',
      timestamp: new Date().toISOString(),
      parameters: {
        mode: activeMode,
        traceRecords: rawTraceRecords.length,
        durationSeconds: m.duration
      },
      metrics: {
        packetsSent: m.sentCount,
        packetsReceived: m.recvCount,
        packetsDropped: m.dropCount,
        packetDeliveryRatioPct: m.pdr,
        packetLossRatioPct: m.plr,
        averageThroughputKbps: m.throughputKbps,
        averageDelayMs: m.avgDelay,
        jitterMs: m.jitter
      },
      status: 'Completed',
      notes: `PDR: ${m.pdr}%, PLR: ${m.plr}%, Throughput: ${m.throughputKbps} Kbps, Delay: ${m.avgDelay} ms.`
    };

    if (window.SMARTNET && window.SMARTNET.Integration && typeof window.SMARTNET.Integration.saveResult === 'function') {
      window.SMARTNET.Integration.saveResult(record);
      alert('NS2 performance evaluation report successfully saved to SMARTNET Results Center!');
    } else {
      alert('Simulation performance report recorded in active session.');
    }
  }

  function resetAll() {
    rawTraceRecords = [];
    computedMetrics = {
      sentCount: 0, recvCount: 0, dropCount: 0,
      pdr: 0, plr: 0, throughputKbps: 0, avgDelay: 0, jitter: 0, duration: 0
    };
    updateUI();
  }

  /* ═══════════════════════════════════════════════════════════
     6. INITIALIZATION
  ═══════════════════════════════════════════════════════════ */

  function init() {
    if (window.SMARTNET && window.SMARTNET.Navigation && typeof window.SMARTNET.Navigation.init === 'function') {
      window.SMARTNET.Navigation.init('sn-nav-container');
    }
    if (window.SMARTNET && window.SMARTNET.Integration && typeof window.SMARTNET.Integration.init === 'function') {
      window.SMARTNET.Integration.init();
    }

    // Mode Selector
    const modeSelect = document.getElementById('ns2-mode-select');
    if (modeSelect) {
      modeSelect.addEventListener('change', function (e) {
        activeMode = e.target.value;
        document.getElementById('panel-ns2-demo')?.classList.toggle('d-none', activeMode !== 'demo');
        document.getElementById('panel-ns2-upload')?.classList.toggle('d-none', activeMode !== 'upload');
        document.getElementById('panel-ns2-scenario')?.classList.toggle('d-none', activeMode !== 'scenario');
        document.getElementById('section-tcl-script')?.classList.toggle('d-none', activeMode !== 'scenario');
      });
    }

    // Buttons
    document.getElementById('btn-load-ns2-demo')?.addEventListener('click', function () {
      const scenario = document.getElementById('ns2-demo-select')?.value || 'cbr_udp';
      loadDemoScenario(scenario);
    });

    document.getElementById('ns2-file-input')?.addEventListener('change', handleTraceFileUpload);

    document.getElementById('btn-generate-tcl')?.addEventListener('click', function () {
      const agentType = document.getElementById('ns2-agent-type')?.value || 'Agent/TCP';
      const script = generateOTclScript(agentType);
      const view = document.getElementById('tcl-code-view');
      if (view) view.textContent = script;
      document.getElementById('section-tcl-script')?.classList.remove('d-none');
    });

    document.getElementById('btn-download-tcl')?.addEventListener('click', function () {
      const view = document.getElementById('tcl-code-view');
      const scriptText = view ? view.textContent : '';
      const blob = new Blob([scriptText], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'smartnet_topology.tcl';
      a.click();
    });

    document.getElementById('btn-reset-ns2')?.addEventListener('click', resetAll);
    document.getElementById('btn-save-ns2-results')?.addEventListener('click', saveResults);

    // Initial demonstration trace
    loadDemoScenario('cbr_udp');
  }

  return {
    init,
    loadDemoScenario,
    saveResults,
    resetAll
  };
})();

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', function () {
  SMARTNET.NS2.init();
});
