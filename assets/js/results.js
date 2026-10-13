/**
 * SMARTNET — results.js
 * Centralized Results Center Controller
 */

var SMARTNET = window.SMARTNET || {};

SMARTNET.Results = (function () {
  'use strict';

  let currentResults = [];
  let filteredResults = [];
  let selectedResult = null;

  // Module Icons & Friendly Names Map
  const MODULE_META = {
    crc:             { name: 'CRC Simulation', icon: '🔁' },
    framing:         { name: 'Framing', icon: '📦' },
    slidingWindow:   { name: 'Sliding Window', icon: '🪟' },
    'sliding-window':{ name: 'Sliding Window', icon: '🪟' },
    goBackN:         { name: 'Go-Back-N ARQ', icon: '↩️' },
    'go-back-n':     { name: 'Go-Back-N ARQ', icon: '↩️' },
    dijkstra:        { name: 'Dijkstra Routing', icon: '🗺️' },
    distanceVector:  { name: 'Distance Vector', icon: '📡' },
    'distance-vector':{ name: 'Distance Vector', icon: '📡' },
    broadcastTree:   { name: 'Broadcast Tree', icon: '🌳' },
    'broadcast-tree':{ name: 'Broadcast Tree', icon: '🌳' },
    leakyBucket:     { name: 'Leaky Bucket', icon: '🪣' },
    'leaky-bucket':  { name: 'Leaky Bucket', icon: '🪣' },
    encryption:      { name: 'Encryption', icon: '🔒' },
    wireshark:       { name: 'Wireshark Analyzer', icon: '🦈' },
    ns2:             { name: 'NS2 Simulation', icon: '📈' },
    nmap:            { name: 'Nmap Scanner', icon: '🔍' }
  };

  const SAMPLE_RESULTS = [
    {
      experiment: 'CRC Simulation',
      module: 'crc',
      status: 'Completed',
      parameters: { dataWord: '110100011', polynomial: '1011 (CRC-3)' },
      metrics: { transmittedCodeword: '110100011100', remainder: '000', errorDetected: false },
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      notes: 'No bit errors detected; remainder zero verified.'
    },
    {
      experiment: 'Sliding Window Protocol',
      module: 'slidingWindow',
      status: 'Completed',
      parameters: { totalFrames: 8, windowSize: 4, sender: 'PC1', receiver: 'Server' },
      metrics: { framesTransmitted: 8, framesAcknowledged: 8, windowUtilization: '100%', throughput: '98.5%' },
      timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
      notes: 'All frames successfully pipelined and acknowledged.'
    },
    {
      experiment: 'Dijkstra Shortest Path',
      module: 'dijkstra',
      status: 'Completed',
      parameters: { source: 'PC1', destination: 'SERVER', graphNodes: 8 },
      metrics: { optimalPath: 'PC1 → R1 → R3 → SERVER', totalCost: 4, visitedNodes: 5 },
      timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
      notes: 'Shortest path calculated via R1 and R3 core link.'
    },
    {
      experiment: 'Wireshark Packet Analysis',
      module: 'wireshark',
      status: 'Completed',
      parameters: { captureMode: 'Demonstration Scenario', trafficProfile: 'SmartNet Enterprise' },
      metrics: { totalPackets: 15, totalBytes: '1.4 KB', dominantProtocol: 'TCP (53%)', captureDuration: '0.065 s' },
      timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
      notes: 'HTTP GET and 3-way handshake fully captured.'
    },
    {
      experiment: 'NS2 Performance Analysis',
      module: 'ns2',
      status: 'Completed',
      parameters: { traceFormat: 'NS2 Wired Trace', trafficModel: 'CBR / UDP', scenario: 'PC1 -> Server' },
      metrics: { packetsSent: 31, packetsReceived: 31, packetDeliveryRatio: '100%', averageDelay: '18.00 ms', throughput: '440.00 Kbps' },
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      notes: 'High reliability under normal traffic conditions.'
    }
  ];

  /* ── 1. Data Fetching & State ────────────────────────────── */
  function loadResults() {
    if (window.SMARTNET && window.SMARTNET.Integration && typeof window.SMARTNET.Integration.getResults === 'function') {
      currentResults = window.SMARTNET.Integration.getResults() || [];
    } else {
      try {
        const stored = localStorage.getItem('smartnet_results');
        currentResults = stored ? JSON.parse(stored) : [];
      } catch (_) {
        currentResults = [];
      }
    }
    applyFilters();
  }

  /* ── 2. Filtering & Search ───────────────────────────────── */
  function applyFilters() {
    const searchVal = (document.getElementById('filter-search')?.value || '').trim().toLowerCase();
    const moduleVal = (document.getElementById('filter-module')?.value || '').trim().toLowerCase();
    const statusVal = (document.getElementById('filter-status')?.value || '').trim();

    filteredResults = currentResults.filter((r, idx) => {
      // Module filter
      if (moduleVal) {
        const rMod = (r.module || '').toLowerCase();
        if (rMod !== moduleVal && rMod.replace(/-/g, '') !== moduleVal.replace(/-/g, '')) {
          return false;
        }
      }

      // Status filter
      if (statusVal && r.status !== statusVal) {
        return false;
      }

      // Search filter
      if (searchVal) {
        const runId = `#run-${idx + 1}`.toLowerCase();
        const expName = (r.experiment || r.title || '').toLowerCase();
        const metricsStr = r.metrics ? JSON.stringify(r.metrics).toLowerCase() : '';
        const notesStr = (r.notes || '').toLowerCase();
        const match = runId.includes(searchVal) || expName.includes(searchVal) || metricsStr.includes(searchVal) || notesStr.includes(searchVal);
        if (!match) return false;
      }

      return true;
    });

    renderUI();
  }

  /* ── 3. Render Dashboard ─────────────────────────────────── */
  function renderUI() {
    renderKPIs();
    renderTable();
  }

  function renderKPIs() {
    const total = currentResults.length;
    let successful = 0;
    let failed = 0;
    const modulesSet = new Set();
    let latestRun = null;

    currentResults.forEach(r => {
      if (r.status === 'Completed') successful++;
      else if (r.status === 'Failed') failed++;

      if (r.module) modulesSet.add(r.module);
      if (!latestRun && r.timestamp) latestRun = r;
    });

    const successPct = total > 0 ? Math.round((successful / total) * 100) : 0;
    const failPct = total > 0 ? Math.round((failed / total) * 100) : 0;

    const elTotal = document.getElementById('kpi-total-runs');
    const elUnique = document.getElementById('kpi-unique-modules');
    const elSuccess = document.getElementById('kpi-successful-runs');
    const elSuccessRate = document.getElementById('kpi-success-rate');
    const elFailed = document.getElementById('kpi-failed-runs');
    const elFailRate = document.getElementById('kpi-fail-rate');
    const elRecentMod = document.getElementById('kpi-recent-module');
    const elRecentTime = document.getElementById('kpi-recent-time');

    if (elTotal) elTotal.textContent = total;
    if (elUnique) elUnique.textContent = `Across ${modulesSet.size} distinct module${modulesSet.size === 1 ? '' : 's'}`;
    if (elSuccess) elSuccess.textContent = successful;
    if (elSuccessRate) elSuccessRate.textContent = `${successPct}% success rate`;
    if (elFailed) elFailed.textContent = failed;
    if (elFailRate) elFailRate.textContent = `${failPct}% failure rate`;

    if (latestRun) {
      const meta = MODULE_META[latestRun.module] || { name: latestRun.experiment || latestRun.module, icon: '📊' };
      if (elRecentMod) elRecentMod.textContent = `${meta.icon} ${meta.name}`;
      if (elRecentTime) elRecentTime.textContent = formatDateTime(latestRun.timestamp);
    } else {
      if (elRecentMod) elRecentMod.textContent = 'None';
      if (elRecentTime) elRecentTime.textContent = 'No simulation records';
    }
  }

  function renderTable() {
    const tbody = document.getElementById('results-table-body');
    const tableSection = document.getElementById('results-table-section');
    const emptyState = document.getElementById('results-empty-state');
    if (!tbody) return;

    if (filteredResults.length === 0) {
      if (currentResults.length === 0) {
        tableSection?.classList.add('d-none');
        emptyState?.classList.remove('d-none');
      } else {
        tableSection?.classList.remove('d-none');
        emptyState?.classList.add('d-none');
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center text-muted py-5">
              No results match the active filter criteria. Try clearing filters.
            </td>
          </tr>
        `;
      }
      return;
    }

    tableSection?.classList.remove('d-none');
    emptyState?.classList.add('d-none');

    let html = '';
    filteredResults.forEach((r, idx) => {
      const meta = MODULE_META[r.module] || { name: r.experiment || r.title || r.module, icon: '📊' };
      const runId = `#RUN-${String(currentResults.indexOf(r) + 1).padStart(2, '0')}`;
      const statusBadge = getStatusBadge(r.status);
      const metricsSummary = formatMetricSummary(r.metrics);
      const timeStr = formatDateTime(r.timestamp);

      html += `
        <tr>
          <td><span class="font-monospace small fw-bold text-muted">${runId}</span></td>
          <td>
            <div class="d-flex align-items-center gap-2">
              <span>${meta.icon}</span>
              <div>
                <div class="fw-bold">${escapeHtml(meta.name)}</div>
                <div class="text-muted" style="font-size:0.75rem;">${escapeHtml(r.experiment || r.module)}</div>
              </div>
            </div>
          </td>
          <td><span class="font-monospace small text-muted">${timeStr}</span></td>
          <td>${statusBadge}</td>
          <td>
            <div class="text-truncate" style="max-width: 380px;" title="${escapeHtml(metricsSummary)}">
              ${metricsSummary}
            </div>
          </td>
          <td class="text-end">
            <button class="btn btn-outline-primary btn-sm py-1 px-2" style="font-size:0.75rem;" onclick="SMARTNET.Results.openDetails(${currentResults.indexOf(r)})">
              Details
            </button>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  }

  function getStatusBadge(status) {
    const s = (status || 'Completed').toLowerCase();
    if (s === 'completed') return `<span class="sn-badge success">Completed</span>`;
    if (s === 'failed') return `<span class="sn-badge danger">Failed</span>`;
    if (s === 'running') return `<span class="sn-badge info">Running</span>`;
    return `<span class="sn-badge warning">${escapeHtml(status || 'Pending')}</span>`;
  }

  function formatMetricSummary(metrics) {
    if (!metrics || typeof metrics !== 'object' || Object.keys(metrics).length === 0) {
      return '<span class="text-muted">—</span>';
    }
    return Object.entries(metrics)
      .slice(0, 3)
      .map(([k, v]) => {
        let valStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return `<span class="text-muted">${escapeHtml(k)}:</span> <strong style="color:var(--text-primary);">${escapeHtml(valStr)}</strong>`;
      })
      .join(' &nbsp;·&nbsp; ');
  }

  function formatDateTime(isoString) {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch (_) {
      return isoString;
    }
  }

  /* ── 4. Result Details Modal ─────────────────────────────── */
  function openDetails(index) {
    const record = currentResults[index];
    if (!record) return;

    selectedResult = record;
    const meta = MODULE_META[record.module] || { name: record.experiment || record.title || record.module, icon: '📊' };
    const runId = `#RUN-${String(index + 1).padStart(2, '0')}`;

    document.getElementById('modal-icon').textContent = meta.icon;
    document.getElementById('modalResultDetailsLabel').textContent = meta.name;
    document.getElementById('modal-subtitle').textContent = record.experiment || record.module;
    document.getElementById('modal-run-id').textContent = runId;
    document.getElementById('modal-timestamp').textContent = formatDateTime(record.timestamp);

    const badgeEl = document.getElementById('modal-status-badge');
    if (badgeEl) {
      badgeEl.className = record.status === 'Completed' ? 'sn-badge success'
                        : record.status === 'Failed' ? 'sn-badge danger'
                        : record.status === 'Running' ? 'sn-badge info' : 'sn-badge warning';
      badgeEl.textContent = record.status || 'Completed';
    }

    // Parameters Body
    const paramsBody = document.getElementById('modal-params-body');
    if (paramsBody) {
      if (record.parameters && Object.keys(record.parameters).length > 0) {
        paramsBody.innerHTML = Object.entries(record.parameters).map(([k, v]) => `
          <tr>
            <th>${escapeHtml(k)}</th>
            <td>${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</td>
          </tr>
        `).join('');
      } else {
        paramsBody.innerHTML = '<tr><td colspan="2" class="text-muted text-center py-2">No input parameters logged.</td></tr>';
      }
    }

    // Metrics Body
    const metricsBody = document.getElementById('modal-metrics-body');
    if (metricsBody) {
      if (record.metrics && Object.keys(record.metrics).length > 0) {
        metricsBody.innerHTML = Object.entries(record.metrics).map(([k, v]) => `
          <tr>
            <th>${escapeHtml(k)}</th>
            <td>${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</td>
          </tr>
        `).join('');
      } else {
        metricsBody.innerHTML = '<tr><td colspan="2" class="text-muted text-center py-2">No metrics recorded.</td></tr>';
      }
    }

    // Notes
    const notesContainer = document.getElementById('modal-notes-container');
    const notesText = document.getElementById('modal-notes-text');
    if (notesContainer && notesText) {
      if (record.notes || record.warning || record.error) {
        notesContainer.classList.remove('d-none');
        notesText.textContent = record.notes || record.warning || record.error;
      } else {
        notesContainer.classList.add('d-none');
      }
    }

    // Raw JSON
    const rawJsonBox = document.getElementById('modal-raw-json');
    if (rawJsonBox) {
      rawJsonBox.textContent = JSON.stringify(record, null, 2);
    }

    // Show modal
    const modalEl = document.getElementById('modalResultDetails');
    if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  }

  function copyRawJson() {
    if (!selectedResult) return;
    const jsonStr = JSON.stringify(selectedResult, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      const btn = document.getElementById('btn-copy-json');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      }
    });
  }

  /* ── 5. Actions: Export, Clear, Sample ────────────────────── */
  function exportJson() {
    if (currentResults.length === 0) {
      alert('No recorded results to export.');
      return;
    }
    const blob = new Blob([JSON.stringify(currentResults, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'smartnet_simulation_results.json');
  }

  function exportCsv() {
    if (currentResults.length === 0) {
      alert('No recorded results to export.');
      return;
    }
    const headers = ['RunID', 'Module', 'Experiment', 'Status', 'Timestamp', 'Metrics'];
    const rows = [headers.join(',')];

    currentResults.forEach((r, idx) => {
      const runId = `RUN-${idx + 1}`;
      const mod = `"${(r.module || '').replace(/"/g, '""')}"`;
      const exp = `"${(r.experiment || r.title || '').replace(/"/g, '""')}"`;
      const stat = `"${(r.status || '').replace(/"/g, '""')}"`;
      const ts = `"${(r.timestamp || '').replace(/"/g, '""')}"`;
      const met = `"${(r.metrics ? JSON.stringify(r.metrics) : '').replace(/"/g, '""')}"`;
      rows.push([runId, mod, exp, stat, ts, met].join(','));
    });

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    downloadBlob(blob, 'smartnet_simulation_results.csv');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function clearAllResults() {
    if (window.SMARTNET && window.SMARTNET.Integration && typeof window.SMARTNET.Integration.clearResults === 'function') {
      window.SMARTNET.Integration.clearResults();
    } else {
      localStorage.removeItem('smartnet_results');
    }
    loadResults();

    // Close modal
    const modalEl = document.getElementById('modalConfirmClear');
    if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
    }
  }

  function loadSampleData() {
    SAMPLE_RESULTS.forEach(sample => {
      if (window.SMARTNET && window.SMARTNET.Integration && typeof window.SMARTNET.Integration.saveResult === 'function') {
        window.SMARTNET.Integration.saveResult(sample);
      }
    });
    loadResults();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ── 6. Initialization ───────────────────────────────────── */
  function init() {
    if (window.SMARTNET && window.SMARTNET.Navigation && typeof window.SMARTNET.Navigation.init === 'function') {
      window.SMARTNET.Navigation.init('sn-nav-container');
    }
    if (window.SMARTNET && window.SMARTNET.Integration && typeof window.SMARTNET.Integration.init === 'function') {
      window.SMARTNET.Integration.init();
      window.SMARTNET.Integration.onResult(() => { loadResults(); });
    }

    // Attach listeners
    document.getElementById('filter-search')?.addEventListener('input', applyFilters);
    document.getElementById('filter-module')?.addEventListener('change', applyFilters);
    document.getElementById('filter-status')?.addEventListener('change', applyFilters);
    document.getElementById('btn-clear-filters')?.addEventListener('click', () => {
      const s = document.getElementById('filter-search');
      const m = document.getElementById('filter-module');
      const st = document.getElementById('filter-status');
      if (s) s.value = '';
      if (m) m.value = '';
      if (st) st.value = '';
      applyFilters();
    });

    document.getElementById('btn-refresh-results')?.addEventListener('click', loadResults);
    document.getElementById('btn-export-json')?.addEventListener('click', (e) => { e.preventDefault(); exportJson(); });
    document.getElementById('btn-export-csv')?.addEventListener('click', (e) => { e.preventDefault(); exportCsv(); });

    document.getElementById('btn-confirm-clear')?.addEventListener('click', () => {
      const modalEl = document.getElementById('modalConfirmClear');
      if (modalEl && window.bootstrap && typeof window.bootstrap.Modal === 'function') {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
      }
    });

    document.getElementById('btn-execute-clear')?.addEventListener('click', clearAllResults);
    document.getElementById('btn-load-sample-data')?.addEventListener('click', loadSampleData);
    document.getElementById('btn-empty-load-sample')?.addEventListener('click', loadSampleData);
    document.getElementById('btn-copy-json')?.addEventListener('click', copyRawJson);

    loadResults();
  }

  return {
    init,
    openDetails,
    loadResults,
    loadSampleData,
    exportJson,
    exportCsv,
    clearAllResults
  };
})();

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', function () {
  SMARTNET.Results.init();
});
