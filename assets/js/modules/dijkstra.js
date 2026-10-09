/**
 * SMARTNET — modules/dijkstra.js
 * Dijkstra Shortest Path Routing Module (Member 4)
 *
 * Implements:
 *   - Link-state routing using Dijkstra's shortest path algorithm
 *   - Dynamic graph representation from shared data/topology.json
 *   - Customizable edge costs with live SVG updates
 *   - Interactive SVG visualization with step-by-step relaxation
 *   - Reconstructed optimal shortest path
 *   - SMARTNET Integration & Results Center persistence
 */

document.addEventListener('DOMContentLoaded', async function () {
  'use strict';

  /* ── 1. Boot Shared Layers ──────────────────────────────── */
  SMARTNET.Navigation.init('sn-nav-container');
  SMARTNET.Integration.init();

  SMARTNET.Integration.registerModule('dijkstra', {
    label: 'Dijkstra Routing',
    status: 'ready',
    member: 'Member 4',
  });

  /* ── 2. DOM Elements ────────────────────────────────────── */
  const sourceSelect   = document.getElementById('dijk-source-select');
  const destSelect     = document.getElementById('dijk-dest-select');
  const edgeSelect     = document.getElementById('dijk-edge-select');
  const edgeCostInput  = document.getElementById('dijk-edge-cost-input');
  const btnUpdateCost  = document.getElementById('btn-update-cost');

  const btnCompute     = document.getElementById('btn-dijk-compute');
  const btnStep        = document.getElementById('btn-dijk-step');
  const btnReset       = document.getElementById('btn-dijk-reset');

  const statusBadge    = document.getElementById('dijk-status-badge');
  const svg            = document.getElementById('dijk-svg');
  const resultCard     = document.getElementById('dijk-result-card');
  const pathDisplay    = document.getElementById('dijk-path-display');
  const costDisplay    = document.getElementById('dijk-cost-display');
  const stepTbody      = document.getElementById('dijk-step-tbody');

  /* ── 3. Graph Data Model ─────────────────────────────────── */
  // Default positions aligned with SMARTNET centralized topology
  const NODE_COORDS = {
    SERVER: { x: 370, y: 50,  label: 'Server', type: 'server' },
    R3:     { x: 370, y: 140, label: 'R3',     type: 'router' },
    R1:     { x: 200, y: 220, label: 'R1',     type: 'router' },
    R2:     { x: 540, y: 220, label: 'R2',     type: 'router' },
    PC1:    { x: 100, y: 320, label: 'PC1',    type: 'host'   },
    PC2:    { x: 260, y: 320, label: 'PC2',    type: 'host'   },
    PC3:    { x: 480, y: 320, label: 'PC3',    type: 'host'   },
    PC4:    { x: 640, y: 320, label: 'PC4',    type: 'host'   },
  };

  let links = [
    { u: 'SERVER', v: 'R3',  cost: 1 },
    { u: 'R3',     v: 'R1',  cost: 2 },
    { u: 'R3',     v: 'R2',  cost: 2 },
    { u: 'R1',     v: 'PC1', cost: 1 },
    { u: 'R1',     v: 'PC2', cost: 1 },
    { u: 'R2',     v: 'PC3', cost: 1 },
    { u: 'R2',     v: 'PC4', cost: 1 },
  ];

  // Try loading from shared topology
  try {
    const topoData = await SMARTNET.Integration.getTopology();
    if (topoData && topoData.topology && topoData.topology.links) {
      links = topoData.topology.links.map(l => ({
        u: l.source,
        v: l.target,
        cost: parseInt(l.cost, 10) || 1
      }));
    }
  } catch (err) {
    console.warn('[Dijkstra] Using default topology fallback:', err);
  }

  /* ── 4. State & Step Variables ───────────────────────────── */
  let steps = [];
  let currentStepIdx = -1;
  let finalPathEdges = [];
  let isRunning = false;

  /* ── 5. Render SVG Graph ─────────────────────────────────── */
  function renderGraph(highlightNode = null, visitedSet = new Set(), pathEdges = []) {
    svg.innerHTML = '';

    // Draw Links
    links.forEach(l => {
      const p1 = NODE_COORDS[l.u];
      const p2 = NODE_COORDS[l.v];
      if (!p1 || !p2) return;

      const isPathEdge = pathEdges.some(pe =>
        (pe.u === l.u && pe.v === l.v) || (pe.u === l.v && pe.v === l.u)
      );

      // Line
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', p1.x);
      line.setAttribute('y1', p1.y);
      line.setAttribute('x2', p2.x);
      line.setAttribute('y2', p2.y);
      line.setAttribute('class', `link-line ${isPathEdge ? 'path' : ''}`);
      svg.appendChild(line);

      // Cost badge
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', midX - 12);
      rect.setAttribute('y', midY - 10);
      rect.setAttribute('width', 24);
      rect.setAttribute('height', 20);
      rect.setAttribute('class', 'link-cost-bg');
      svg.appendChild(rect);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midX);
      text.setAttribute('y', midY + 4);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('fill', isPathEdge ? 'var(--color-accent)' : 'var(--text-muted)');
      text.setAttribute('font-size', '11');
      text.setAttribute('font-weight', '700');
      text.setAttribute('font-family', 'var(--font-mono)');
      text.textContent = l.cost;
      svg.appendChild(text);
    });

    // Draw Nodes
    Object.keys(NODE_COORDS).forEach(id => {
      const node = NODE_COORDS[id];
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      const isCur = (id === highlightNode);
      const isVisited = visitedSet.has(id);
      const inFinalPath = finalPathEdges.some(pe => pe.u === id || pe.v === id);

      let circleClass = 'node-circle';
      if (isCur) circleClass += ' current';
      else if (inFinalPath) circleClass += ' path';
      else if (isVisited) circleClass += ' visited';

      let fillColor = '#0f172a';
      let strokeColor = '#3b82f6';
      if (node.type === 'server') strokeColor = '#8b5cf6';
      if (node.type === 'router') strokeColor = '#3b82f6';
      if (node.type === 'host')   strokeColor = '#06d6a0';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);
      circle.setAttribute('r', 22);
      circle.setAttribute('fill', fillColor);
      circle.setAttribute('stroke', strokeColor);
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('class', circleClass);
      g.appendChild(circle);

      // Label
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', node.x);
      txt.setAttribute('y', node.y + 4);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('fill', '#fff');
      txt.setAttribute('font-size', '11');
      txt.setAttribute('font-weight', '700');
      txt.setAttribute('font-family', 'var(--font-mono)');
      txt.textContent = node.label;
      g.appendChild(txt);

      // Sub-label (type)
      const subTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      subTxt.setAttribute('x', node.x);
      subTxt.setAttribute('y', node.y + 36);
      subTxt.setAttribute('text-anchor', 'middle');
      subTxt.setAttribute('fill', 'var(--text-muted)');
      subTxt.setAttribute('font-size', '10');
      subTxt.textContent = node.type.toUpperCase();
      g.appendChild(subTxt);

      svg.appendChild(g);
    });
  }

  /* ── 6. Dijkstra Algorithm Engine ────────────────────────── */
  function computeDijkstra(source, dest) {
    const nodeIds = Object.keys(NODE_COORDS);
    const dist = {};
    const prev = {};
    const unvisited = new Set(nodeIds);
    const visited = new Set();
    const recordedSteps = [];

    // Initialize distances
    nodeIds.forEach(id => {
      dist[id] = Infinity;
      prev[id] = null;
    });
    dist[source] = 0;

    let stepNum = 1;

    while (unvisited.size > 0) {
      // Find unvisited node with smallest distance
      let current = null;
      let minDistance = Infinity;

      unvisited.forEach(id => {
        if (dist[id] < minDistance) {
          minDistance = dist[id];
          current = id;
        }
      });

      // All remaining unreachable or destination reached
      if (!current || minDistance === Infinity) break;

      unvisited.delete(current);
      visited.add(current);

      // Record snapshot before relaxing neighbors
      const stepSnapshot = {
        step: stepNum++,
        current: current,
        visitedSoFar: new Set(visited),
        distances: { ...dist },
        predecessors: { ...prev },
      };

      // Relax neighbors
      links.forEach(l => {
        let neighbor = null;
        if (l.u === current) neighbor = l.v;
        else if (l.v === current) neighbor = l.u;

        if (neighbor && unvisited.has(neighbor)) {
          const alt = dist[current] + l.cost;
          if (alt < dist[neighbor]) {
            dist[neighbor] = alt;
            prev[neighbor] = current;
          }
        }
      });

      recordedSteps.push(stepSnapshot);

      // Stop once destination is finalized
      if (current === dest) break;
    }

    // Reconstruct shortest path
    const path = [];
    let curr = dest;
    while (curr !== null) {
      path.unshift(curr);
      curr = prev[curr];
    }

    const pathEdges = [];
    if (path.length > 1 && path[0] === source) {
      for (let i = 0; i < path.length - 1; i++) {
        pathEdges.push({ u: path[i], v: path[i + 1] });
      }
    }

    return {
      source,
      dest,
      path: path[0] === source ? path : [],
      pathEdges,
      totalCost: dist[dest] === Infinity ? -1 : dist[dest],
      steps: recordedSteps,
    };
  }

  /* ── 7. UI Update & Execution ────────────────────────────── */
  function runFullAlgorithm() {
    const src  = sourceSelect.value;
    const dest = destSelect.value;

    if (src === dest) {
      alert('Source and destination cannot be the same node.');
      return;
    }

    const result = computeDijkstra(src, dest);
    steps = result.steps;
    finalPathEdges = result.pathEdges;

    // Display Result Banner
    resultCard.style.display = 'block';
    if (result.path.length > 0) {
      pathDisplay.textContent = result.path.join(' ➔ ');
      costDisplay.textContent = result.totalCost;
      statusBadge.textContent = 'Completed';
      statusBadge.className = 'sn-badge success';
    } else {
      pathDisplay.textContent = 'No Path Exists (Destination Unreachable)';
      costDisplay.textContent = '∞';
      statusBadge.textContent = 'Unreachable';
      statusBadge.className = 'sn-badge danger';
    }

    // Populate Table
    stepTbody.innerHTML = '';
    steps.forEach(s => {
      const tr = document.createElement('tr');
      const distStr = Object.keys(s.distances)
        .map(id => {
          const d = s.distances[id] === Infinity ? '∞' : s.distances[id];
          const p = s.predecessors[id] ? ` (${s.predecessors[id]})` : '';
          return `<span style="margin-right:8px;"><strong>${id}:</strong> ${d}${p}</span>`;
        })
        .join(' ');

      tr.innerHTML = `
        <td class="fw-bold">${s.step}</td>
        <td><span class="sn-badge primary">${s.current}</span></td>
        <td class="text-muted">{${Array.from(s.visitedSoFar).join(', ')}}</td>
        <td style="font-family:var(--font-mono);font-size:0.75rem;">${distStr}</td>
      `;
      stepTbody.appendChild(tr);
    });

    // Render Final Highlighted SVG Graph
    renderGraph(null, new Set(steps.map(s => s.current)), finalPathEdges);

    // Save to SMARTNET Results Center
    SMARTNET.Integration.saveResult({
      experiment: 'Dijkstra Routing',
      module: 'dijkstra',
      status: result.path.length > 0 ? 'Completed' : 'Failed',
      metrics: {
        source: src,
        destination: dest,
        path: result.path.join(' ➔ '),
        totalCost: result.totalCost,
        stepsCount: steps.length,
      },
      timestamp: new Date().toISOString()
    });
  }

  function stepThrough() {
    if (steps.length === 0) {
      const src  = sourceSelect.value;
      const dest = destSelect.value;
      const res = computeDijkstra(src, dest);
      steps = res.steps;
      finalPathEdges = res.pathEdges;
      currentStepIdx = 0;
      stepTbody.innerHTML = '';
      statusBadge.textContent = 'Stepping';
      statusBadge.className = 'sn-badge warning';
    } else if (currentStepIdx < steps.length - 1) {
      currentStepIdx++;
    } else {
      runFullAlgorithm();
      return;
    }

    const s = steps[currentStepIdx];
    renderGraph(s.current, s.visitedSoFar, currentStepIdx === steps.length - 1 ? finalPathEdges : []);

    const tr = document.createElement('tr');
    const distStr = Object.keys(s.distances)
      .map(id => {
        const d = s.distances[id] === Infinity ? '∞' : s.distances[id];
        const p = s.predecessors[id] ? ` (${s.predecessors[id]})` : '';
        return `<span style="margin-right:8px;">${id}:${d}${p}</span>`;
      })
      .join(' ');

    tr.innerHTML = `
      <td class="fw-bold">${s.step}</td>
      <td><span class="sn-badge primary">${s.current}</span></td>
      <td class="text-muted">{${Array.from(s.visitedSoFar).join(', ')}}</td>
      <td style="font-family:var(--font-mono);font-size:0.75rem;">${distStr}</td>
    `;
    stepTbody.appendChild(tr);
  }

  function resetState() {
    steps = [];
    currentStepIdx = -1;
    finalPathEdges = [];
    resultCard.style.display = 'none';
    statusBadge.textContent = 'Ready';
    statusBadge.className = 'sn-badge muted';
    stepTbody.innerHTML = `<tr><td colspan="4" class="text-muted text-center py-3">Press 'Run Dijkstra' to compute step-by-step distances.</td></tr>`;
    renderGraph();
  }

  /* ── 8. Event Handlers ──────────────────────────────────── */
  btnCompute.addEventListener('click', runFullAlgorithm);
  btnStep.addEventListener('click', stepThrough);
  btnReset.addEventListener('click', resetState);

  sourceSelect.addEventListener('change', resetState);
  destSelect.addEventListener('change', resetState);

  btnUpdateCost.addEventListener('click', function () {
    const val = edgeSelect.value.split('-');
    const newCost = parseInt(edgeCostInput.value, 10);
    if (isNaN(newCost) || newCost < 1) {
      alert('Cost must be a positive integer.');
      return;
    }

    const targetLink = links.find(l =>
      (l.u === val[0] && l.v === val[1]) || (l.u === val[1] && l.v === val[0])
    );

    if (targetLink) {
      targetLink.cost = newCost;
      resetState();
    }
  });

  // Initial Graph Render
  renderGraph();
});
