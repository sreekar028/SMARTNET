/**
 * SMARTNET — modules/distance-vector.js
 * Distance Vector (Bellman-Ford) Routing Module (Member 4)
 *
 * Implements:
 *   - Distributed routing table construction
 *   - Iterative distance vector exchange: D_x(y) = min_v { c(x,v) + D_v(y) }
 *   - Convergence detection across all network nodes
 *   - Link failure fault injection & route adaptation
 *   - Interactive routing table inspection & global cost matrix
 *   - SMARTNET Integration & Results Center persistence
 */

document.addEventListener('DOMContentLoaded', async function () {
  'use strict';

  /* ── 1. Boot Shared Layers ──────────────────────────────── */
  SMARTNET.Navigation.init('sn-nav-container');
  SMARTNET.Integration.init();

  SMARTNET.Integration.registerModule('distanceVector', {
    label: 'Distance Vector',
    status: 'ready',
    member: '',
  });

  /* ── 2. DOM Elements ────────────────────────────────────── */
  const inspectSelect   = document.getElementById('dv-inspect-node');
  const failureSelect   = document.getElementById('dv-failure-select');
  const btnConverge     = document.getElementById('btn-dv-converge');
  const btnStep         = document.getElementById('btn-dv-step');
  const btnReset        = document.getElementById('btn-dv-reset');

  const curIterBadge    = document.getElementById('dv-current-iter');
  const convergeBadge   = document.getElementById('dv-converge-badge');
  const updateSummary   = document.getElementById('dv-update-summary');
  const totalStepsEl    = document.getElementById('dv-total-steps');
  const nodeTitleEl     = document.getElementById('dv-node-title');
  const tbodyInspected  = document.getElementById('dv-tbody-inspected');
  const matrixTable     = document.getElementById('dv-matrix-table');
  const svg             = document.getElementById('dv-svg');

  /* ── 3. Graph Model ─────────────────────────────────────── */
  const NODES = ['SERVER', 'R3', 'R1', 'R2', 'PC1', 'PC2', 'PC3', 'PC4'];

  const BASE_LINKS = [
    { u: 'SERVER', v: 'R3',  cost: 1 },
    { u: 'R3',     v: 'R1',  cost: 2 },
    { u: 'R3',     v: 'R2',  cost: 2 },
    { u: 'R1',     v: 'PC1', cost: 1 },
    { u: 'R1',     v: 'PC2', cost: 1 },
    { u: 'R2',     v: 'PC3', cost: 1 },
    { u: 'R2',     v: 'PC4', cost: 1 },
  ];

  const COORDS = {
    SERVER: { x: 200, y: 30  },
    R3:     { x: 200, y: 80  },
    R1:     { x: 100, y: 140 },
    R2:     { x: 300, y: 140 },
    PC1:    { x: 50,  y: 200 },
    PC2:    { x: 150, y: 200 },
    PC3:    { x: 250, y: 200 },
    PC4:    { x: 350, y: 200 },
  };

  /* ── 4. State Variables ──────────────────────────────────── */
  let currentIteration = 0;
  let isConverged = false;
  let routingTables = {}; // { node: { dest: { cost, nextHop, updated } } }
  let activeLinks = [];

  /* ── 5. Algorithm Engine ─────────────────────────────────── */
  function getActiveLinks() {
    const failed = failureSelect.value;
    if (failed === 'none') return [...BASE_LINKS];
    const parts = failed.split('-');
    return BASE_LINKS.filter(l => !(
      (l.u === parts[0] && l.v === parts[1]) ||
      (l.u === parts[1] && l.v === parts[0])
    ));
  }

  function initTables() {
    activeLinks = getActiveLinks();
    routingTables = {};
    currentIteration = 0;
    isConverged = false;

    NODES.forEach(n => {
      routingTables[n] = {};
      NODES.forEach(dest => {
        if (n === dest) {
          routingTables[n][dest] = { cost: 0, nextHop: n, updated: false };
        } else {
          // Direct neighbor check
          const link = activeLinks.find(l =>
            (l.u === n && l.v === dest) || (l.u === dest && l.v === n)
          );
          if (link) {
            routingTables[n][dest] = { cost: link.cost, nextHop: dest, updated: false };
          } else {
            routingTables[n][dest] = { cost: Infinity, nextHop: '—', updated: false };
          }
        }
      });
    });

    renderUI();
  }

  function iterateBellmanFord() {
    if (isConverged) return;

    let anyChange = false;
    const nextTables = JSON.parse(JSON.stringify(routingTables));

    // Clear previous update highlights
    NODES.forEach(n => {
      NODES.forEach(dest => {
        nextTables[n][dest].updated = false;
      });
    });

    // Each node calculates new distance vector using neighbors' vectors
    NODES.forEach(x => {
      // Find neighbors of x
      const neighbors = activeLinks
        .filter(l => l.u === x || l.v === x)
        .map(l => (l.u === x ? { node: l.v, cost: l.cost } : { node: l.u, cost: l.cost }));

      NODES.forEach(y => {
        if (x === y) return;

        let minCost = routingTables[x][y].cost;
        let bestHop = routingTables[x][y].nextHop;

        neighbors.forEach(nbr => {
          const neighborEst = routingTables[nbr.node][y].cost;
          if (neighborEst !== Infinity) {
            const costThroughNbr = nbr.cost + neighborEst;
            if (costThroughNbr < minCost) {
              minCost = costThroughNbr;
              bestHop = nbr.node;
            }
          }
        });

        if (minCost !== routingTables[x][y].cost || bestHop !== routingTables[x][y].nextHop) {
          nextTables[x][y].cost = minCost;
          nextTables[x][y].nextHop = bestHop;
          nextTables[x][y].updated = true;
          anyChange = true;
        }
      });
    });

    routingTables = nextTables;
    currentIteration++;

    if (!anyChange || currentIteration >= 12) {
      isConverged = true;
      completeSimulation();
    }

    renderUI(anyChange);
  }

  function completeSimulation() {
    convergeBadge.textContent = 'Converged';
    convergeBadge.className = 'sn-badge success';

    SMARTNET.Integration.saveResult({
      experiment: 'Distance Vector',
      module: 'distanceVector',
      status: 'Completed',
      metrics: {
        convergedIterations: currentIteration,
        failureScenario: failureSelect.value,
        totalNodes: NODES.length,
      },
      timestamp: new Date().toISOString()
    });
  }

  /* ── 6. UI Rendering ────────────────────────────────────── */
  function renderUI(lastHadChanges = false) {
    const inspected = inspectSelect.value;
    nodeTitleEl.textContent = inspected;
    totalStepsEl.textContent = currentIteration;
    curIterBadge.textContent = `Iteration ${currentIteration}`;

    if (isConverged) {
      convergeBadge.textContent = 'Converged';
      convergeBadge.className = 'sn-badge success';
      updateSummary.textContent = `Routing tables stabilized in ${currentIteration} iterations.`;
    } else if (currentIteration === 0) {
      convergeBadge.textContent = 'Initialized';
      convergeBadge.className = 'sn-badge muted';
      updateSummary.textContent = 'Direct neighbor vectors loaded. Ready to run Bellman-Ford exchanges.';
    } else {
      convergeBadge.textContent = lastHadChanges ? 'Updating' : 'Stable';
      convergeBadge.className = 'sn-badge warning';
      updateSummary.textContent = lastHadChanges ? 'Routing table updates exchanged.' : 'No further cost reductions.';
    }

    // Render Table for Inspected Node
    tbodyInspected.innerHTML = '';
    const table = routingTables[inspected] || {};
    NODES.forEach(dest => {
      const entry = table[dest] || { cost: Infinity, nextHop: '—', updated: false };
      const tr = document.createElement('tr');
      const isReachable = entry.cost !== Infinity;
      const costStr = isReachable ? entry.cost : '∞ (Unreachable)';
      const statusBadge = isReachable
        ? `<span class="sn-badge success" style="font-size:0.68rem;">Reachable</span>`
        : `<span class="sn-badge danger" style="font-size:0.68rem;">Unreachable</span>`;

      tr.innerHTML = `
        <td class="fw-bold">${dest}</td>
        <td class="${entry.updated ? 'dv-updated-cell' : ''}">${costStr}</td>
        <td><code>${entry.nextHop}</code></td>
        <td>${statusBadge}</td>
      `;
      tbodyInspected.appendChild(tr);
    });

    // Render Global Cost Matrix
    let matrixHtml = `<thead><tr><th>From \\ To</th>`;
    NODES.forEach(n => matrixHtml += `<th>${n}</th>`);
    matrixHtml += `</tr></thead><tbody>`;

    NODES.forEach(src => {
      matrixHtml += `<tr><td class="fw-bold text-start ps-2">${src}</td>`;
      NODES.forEach(dst => {
        const c = routingTables[src][dst].cost;
        const val = c === Infinity ? '<span class="text-danger">∞</span>' : (src === dst ? '<span class="text-muted">0</span>' : c);
        matrixHtml += `<td>${val}</td>`;
      });
      matrixHtml += `</tr>`;
    });
    matrixHtml += `</tbody>`;
    matrixTable.innerHTML = matrixHtml;

    // Render Mini SVG
    renderSVG();
  }

  function renderSVG() {
    svg.innerHTML = '';

    const linksGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    linksGroup.setAttribute('class', 'links-layer');
    svg.appendChild(linksGroup);

    const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodesGroup.setAttribute('class', 'nodes-layer');
    svg.appendChild(nodesGroup);

    // Links
    BASE_LINKS.forEach(l => {
      const p1 = COORDS[l.u];
      const p2 = COORDS[l.v];
      if (!p1 || !p2) return;

      const isUp = activeLinks.some(al =>
        (al.u === l.u && al.v === l.v) || (al.u === l.v && al.v === l.u)
      );

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1.x);
      line.setAttribute('y1', p1.y);
      line.setAttribute('x2', p2.x);
      line.setAttribute('y2', p2.y);
      line.setAttribute('class', `link-line topo-link ${isUp ? '' : 'link-failed'}`);
      if (!isUp) {
        line.setAttribute('stroke', '#ef4444');
        line.setAttribute('stroke-dasharray', '4,4');
        line.setAttribute('stroke-width', '2.5');
      }
      linksGroup.appendChild(line);

      // Link Cost Badge
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', mx - 10);
      rect.setAttribute('y', my - 8);
      rect.setAttribute('width', 20);
      rect.setAttribute('height', 16);
      rect.setAttribute('rx', 3);
      rect.setAttribute('ry', 3);
      rect.setAttribute('class', 'link-badge-bg');
      linksGroup.appendChild(rect);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', mx);
      text.setAttribute('y', my);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('class', 'link-badge-text');
      text.setAttribute('style', 'font-size:9px;');
      text.textContent = l.cost;
      linksGroup.appendChild(text);
    });

    // Nodes
    NODES.forEach(id => {
      const p = COORDS[id];
      const isCur = (id === inspectSelect.value);
      const type = id === 'SERVER' ? 'server' : id.startsWith('R') ? 'router' : 'host';
      const r = type === 'server' ? 18 : type === 'router' ? 15 : 12;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'topo-node-group bt-node-group');
      g.style.cursor = 'pointer';
      g.addEventListener('click', () => {
        inspectSelect.value = id;
        renderUI();
      });

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', p.x);
      circle.setAttribute('cy', p.y);
      circle.setAttribute('r', isCur ? r + 3 : r);
      circle.setAttribute('class', `node-circle node-${type} topo-node-${type} ${isCur ? 'node-selected' : ''}`);
      g.appendChild(circle);

      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', p.x);
      txt.setAttribute('y', p.y);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'central');
      txt.setAttribute('class', 'node-text-id topo-label');
      txt.setAttribute('style', 'font-size:9px;');
      txt.textContent = id;
      g.appendChild(txt);

      nodesGroup.appendChild(g);
    });
  }

  /* ── 7. Event Handlers ──────────────────────────────────── */
  btnStep.addEventListener('click', function () {
    if (isConverged) {
      initTables();
    }
    iterateBellmanFord();
  });

  btnConverge.addEventListener('click', function () {
    if (isConverged) {
      initTables();
    }
    let loop = 0;
    while (!isConverged && loop < 15) {
      iterateBellmanFord();
      loop++;
    }
  });

  btnReset.addEventListener('click', initTables);
  failureSelect.addEventListener('change', initTables);
  inspectSelect.addEventListener('change', () => renderUI());

  initTables();
});
