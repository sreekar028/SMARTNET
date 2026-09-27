/**
 * SMARTNET — app.js
 * Dashboard-specific JavaScript.
 *
 * Responsibilities:
 *   - Initialize Navigation and Integration layers
 *   - Render the SVG topology visualization
 *   - Load and display recent results
 *   - Update performance metric cards
 *   - Animate stat counters
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ── 1. Boot shared layers ──────────────────────────────── */
  SMARTNET.Navigation.init('sn-nav-container');
  SMARTNET.Integration.init();

  /* ── 2. Topology Visualization ──────────────────────────── */
  (async function renderTopology() {
    const topoData = await SMARTNET.Integration.getTopology();
    const topo     = topoData.topology;
    const svg      = document.getElementById('topology-svg');
    if (!svg || !topo) return;

    // SVG coordinate space
    const W = 740, H = 380;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    // --- Build node position map ---
    const nodeMap = {};
    topo.nodes.forEach(n => { nodeMap[n.id] = n; });

    // Scale node positions to fit SVG
    const xs = topo.nodes.map(n => n.x);
    const ys = topo.nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const padX = 80, padY = 60;

    function scaleX(x) {
      if (maxX === minX) return W / 2;
      return padX + ((x - minX) / (maxX - minX)) * (W - padX * 2);
    }
    function scaleY(y) {
      if (maxY === minY) return H / 2;
      return padY + ((y - minY) / (maxY - minY)) * (H - padY * 2);
    }

    let svgContent = `<defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="var(--border-color-light)" />
      </marker>
    </defs>`;

    // --- Draw links ---
    topo.links.forEach(link => {
      const s = nodeMap[link.source];
      const t = nodeMap[link.target];
      if (!s || !t) return;
      const x1 = scaleX(s.x), y1 = scaleY(s.y);
      const x2 = scaleX(t.x), y2 = scaleY(t.y);
      // Bandwidth label midpoint
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      svgContent += `
        <line class="topo-link" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
          <title>${link.source} ↔ ${link.target} | ${link.bandwidth} | Cost: ${link.cost}</title>
        </line>
        <text x="${mx}" y="${my - 6}" text-anchor="middle"
              style="fill:var(--text-muted);font-size:9px;font-family:var(--font-mono);">
          ${link.bandwidth}
        </text>`;
    });

    // Node radius by type
    function nodeRadius(type) {
      return type === 'server' ? 28 : type === 'router' ? 22 : 18;
    }

    // Node shape class
    function nodeClass(type) {
      return `topo-node-${type}`;
    }

    // Node emoji icon
    function nodeIcon(type) {
      return type === 'server' ? '🖥️' : type === 'router' ? '📡' : '💻';
    }

    // --- Draw nodes ---
    topo.nodes.forEach(node => {
      const cx = scaleX(node.x);
      const cy = scaleY(node.y);
      const r  = nodeRadius(node.type);
      svgContent += `
        <g class="topo-node-group" role="img" aria-label="${node.label} (${node.type})">
          <circle cx="${cx}" cy="${cy}" r="${r}" class="${nodeClass(node.type)}">
            <title>${node.label} — ${node.type}</title>
          </circle>
          <text class="topo-label" x="${cx}" y="${cy}">${node.label}</text>
          <text class="topo-sublabel" x="${cx}" y="${cy + r + 12}">${nodeIcon(node.type)}</text>
        </g>`;
    });

    svg.innerHTML = svgContent;
  })();

  /* ── 3. Recent Results ──────────────────────────────────── */
  function renderResults() {
    const results = SMARTNET.Integration.getResults();
    const tbody   = document.getElementById('results-tbody');
    const emptyEl = document.getElementById('results-empty');
    if (!tbody) return;

    if (!results || results.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    // Show latest 5
    const latest = results.slice(0, 5);
    tbody.innerHTML = latest.map(r => {
      const statusClass = r.status === 'Completed' ? 'success'
                        : r.status === 'Failed'    ? 'danger'
                        : r.status === 'Running'   ? 'info'
                        : 'muted';
      const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '—';
      // Build a short metric summary
      const metricSummary = r.metrics
        ? Object.entries(r.metrics).slice(0, 2)
            .map(([k, v]) => `${k}: <strong>${v}</strong>`)
            .join(' | ')
        : '—';
      return `
        <tr>
          <td><strong style="color:var(--text-primary)">${escHtml(r.experiment)}</strong></td>
          <td><span class="sn-badge ${statusClass}">${escHtml(r.status)}</span></td>
          <td style="font-size:0.78rem;">${metricSummary}</td>
          <td style="font-size:0.75rem;color:var(--text-muted);">${ts}</td>
        </tr>`;
    }).join('');
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  renderResults();

  // Re-render if a new result arrives while dashboard is open
  SMARTNET.Integration.onResult(() => renderResults());

  /* ── 4. Stat counter animation ──────────────────────────── */
  function animateCounter(el, target, duration) {
    const start = performance.now();
    function step(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const counters = document.querySelectorAll('[data-count]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        animateCounter(el, target, 900);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.4 });

  counters.forEach(el => observer.observe(el));

  /* ── 5. Performance metrics from integration ────────────── */
  function updatePerformanceMetrics() {
    const results = SMARTNET.Integration.getResults();
    // Look for a Leaky Bucket or throughput result
    const throughputResult = results.find(r =>
      r.module === 'leaky-bucket' || r.module === 'sliding-window'
    );
    // If no data, keep placeholder state (already in HTML)
    if (throughputResult && throughputResult.metrics) {
      const m = throughputResult.metrics;
      if (m.throughput) {
        const el = document.getElementById('metric-throughput-val');
        if (el) el.textContent = m.throughput;
      }
    }
  }
  updatePerformanceMetrics();

  /* ── 6. Quick action button nav ────────────────────────── */
  // Buttons are plain <a> tags — no JS needed for navigation.
  // This hook is available for future module status injection.
  SMARTNET.Integration.on('integration:ready', function () {
    console.log('[Dashboard] Integration layer ready.');
  });

});
