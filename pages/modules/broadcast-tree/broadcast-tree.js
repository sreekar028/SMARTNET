/**
 * SMARTNET — Broadcast Tree Simulation Module
 * pages/modules/broadcast-tree/broadcast-tree.js
 *
 * Implements Spanning Tree Construction and Broadcast Routing
 * on the SMARTNET Centralized Topology.
 * Member 5: Broadcast Tree & Leaky Bucket
 */

(function () {
  'use strict';

  const SMARTNET = window.SMARTNET || {};

  /* ── 1. Module Registration with Integration Layer ───────── */
  if (SMARTNET.Integration && typeof SMARTNET.Integration.registerModule === 'function') {
    SMARTNET.Integration.registerModule('broadcast-tree', {
      label: 'Broadcast Tree',
      category: 'Simulations',
      subCategory: 'Routing & Spanning Tree',
      status: 'ready',
      route: 'pages/modules/broadcast-tree/index.html',
      member: 'Member 5 (Ganjikunta Swapna)',
      version: '1.0.0'
    });
  }

  /* ── 2. Module State ─────────────────────────────────────── */
  const state = {
    topology: null,
    graph: {}, // Adjacency list: { nodeId: [{ neighbor, bandwidth, cost }] }
    nodeMap: {},
    allNodeIds: [],

    // Configuration
    rootNode: 'R3',
    scenario: 'normal', // 'normal' | 'partition' | 'loop'
    animationSpeed: 800, // ms per level

    // Computed Tree Data
    treeResult: null,

    // Animation Runtime
    isBroadcasting: false,
    animTimeouts: [],
    nodeStates: {}, // nodeId -> 'unvisited' | 'broadcasting' | 'received' | 'unreachable'

    // History of results
    lastPayload: null
  };

  /* ── 3. DOM Cache ────────────────────────────────────────── */
  const el = {};

  function initDOMElements() {
    el.rootSelect      = document.getElementById('bt-root-select');
    el.scenarioSelect  = document.getElementById('bt-scenario-select');
    el.speedSelect     = document.getElementById('bt-speed-select');
    el.btnBuild        = document.getElementById('btn-bt-build');
    el.btnBroadcast    = document.getElementById('btn-bt-broadcast');
    el.btnReset        = document.getElementById('btn-bt-reset');
    el.btnSaveResult   = document.getElementById('btn-bt-save-result');
    el.btnExportCsv    = document.getElementById('btn-bt-export-csv');
    el.btnExportJson   = document.getElementById('btn-bt-export-json');

    // Display areas
    el.svg             = document.getElementById('broadcast-tree-svg');
    el.eventTicker     = document.getElementById('bt-event-ticker');
    el.tableBody       = document.getElementById('bt-tree-tbody');
    el.validationAlert = document.getElementById('bt-validation-alert');
    el.toast           = document.getElementById('sn-toast');
    el.toastMsg        = document.getElementById('sn-toast-msg');

    // Result Stat Displays
    el.statRoot        = document.getElementById('stat-bt-root');
    el.statReached     = document.getElementById('stat-bt-reached');
    el.statEdges       = document.getElementById('stat-bt-edges');
    el.statStatus      = document.getElementById('stat-bt-status');
    el.statUnreachable = document.getElementById('stat-bt-unreachable');
    el.statEfficiency  = document.getElementById('stat-bt-efficiency');
  }

  /* ── 4. Graph Construction from Topology ─────────────────── */
  function buildGraphFromTopology() {
    if (!state.topology || !state.topology.nodes || !state.topology.links) {
      return { graph: {}, nodeMap: {}, allNodeIds: [] };
    }

    const nodeMap = {};
    const graph = {};
    const allNodeIds = [];

    state.topology.nodes.forEach(n => {
      nodeMap[n.id] = n;
      graph[n.id] = [];
      allNodeIds.push(n.id);
    });

    // Clone links to allow scenarios (e.g. partition or redundant link)
    let links = state.topology.links.map(l => Object.assign({}, l));

    if (state.scenario === 'partition') {
      // Simulate link failure: sever link between R3 and R2
      links = links.filter(l => !(
        (l.source === 'R3' && l.target === 'R2') ||
        (l.source === 'R2' && l.target === 'R3')
      ));
    } else if (state.scenario === 'loop') {
      // Add redundant link between R1 and R2 to demonstrate loop prevention/pruning
      links.push({
        source: 'R1',
        target: 'R2',
        bandwidth: '100Mbps',
        cost: 3,
        isRedundant: true
      });
    }

    // Populate undirected adjacency list
    links.forEach(l => {
      if (graph[l.source] && graph[l.target]) {
        graph[l.source].push({
          neighbor: l.target,
          bandwidth: l.bandwidth,
          cost: l.cost,
          isRedundant: !!l.isRedundant
        });
        graph[l.target].push({
          neighbor: l.source,
          bandwidth: l.bandwidth,
          cost: l.cost,
          isRedundant: !!l.isRedundant
        });
      }
    });

    return { graph, nodeMap, allNodeIds, activeLinks: links };
  }

  /* ── 5. CORE ALGORITHM: Broadcast Tree Construction ────────
     Pure algorithm logic (BFS-based spanning tree traversal)
     Separated from visualization logic (Rule 30)
  ─────────────────────────────────────────────────────────── */
  function buildBroadcastTree(graph, allNodeIds, root) {
    // Edge case: Empty graph or empty root
    if (!graph || Object.keys(graph).length === 0 || !allNodeIds || allNodeIds.length === 0) {
      return {
        valid: false,
        error: 'Topology is empty or uninitialized.',
        root: null,
        visitedNodes: [],
        treeEdges: [],
        nonTreeEdges: [],
        unreachableNodes: []
      };
    }

    // Edge case: Invalid root
    if (!root || !graph[root]) {
      return {
        valid: false,
        error: `Invalid root node: "${root}". Please select a valid node from the network topology.`,
        root: null,
        visitedNodes: [],
        treeEdges: [],
        nonTreeEdges: [],
        unreachableNodes: allNodeIds
      };
    }

    const queue = [root];
    const visited = new Set([root]);
    const treeEdges = [];
    const nonTreeEdges = [];
    const levels = { [root]: 0 };
    const parentMap = { [root]: null };
    const processedTreeEdgesSet = new Set();
    const processedNonTreeSet = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      const currentLevel = levels[current];
      const neighbors = graph[current] || [];

      for (let i = 0; i < neighbors.length; i++) {
        const item = neighbors[i];
        const neighbor = item.neighbor;

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          levels[neighbor] = currentLevel + 1;
          parentMap[neighbor] = current;

          const edgeObj = {
            parent: current,
            child: neighbor,
            level: currentLevel + 1,
            bandwidth: item.bandwidth || '10Mbps',
            cost: item.cost || 1,
            isRedundant: !!item.isRedundant
          };
          treeEdges.push(edgeObj);
          processedTreeEdgesSet.add(`${current}-${neighbor}`);
          processedTreeEdgesSet.add(`${neighbor}-${current}`);

          queue.push(neighbor);
        } else {
          // If already visited and not the immediate parent, it's a cycle edge (pruned for loop freedom)
          if (neighbor !== parentMap[current]) {
            const edgeKey = [current, neighbor].sort().join('--');
            if (!processedNonTreeSet.has(edgeKey) && !processedTreeEdgesSet.has(`${current}-${neighbor}`)) {
              processedNonTreeSet.add(edgeKey);
              nonTreeEdges.push({
                u: current,
                v: neighbor,
                bandwidth: item.bandwidth || '10Mbps',
                reason: 'Pruned to eliminate broadcast storm / routing loop'
              });
            }
          }
        }
      }
    }

    // Determine unreachable nodes (disconnected partition)
    const unreachableNodes = allNodeIds.filter(id => !visited.has(id));

    return {
      valid: true,
      root: root,
      visitedNodes: [...visited],
      treeEdges: treeEdges,
      nonTreeEdges: nonTreeEdges,
      unreachableNodes: unreachableNodes,
      levels: levels,
      parentMap: parentMap,
      nodesReachedCount: visited.size,
      treeEdgesCount: treeEdges.length,
      totalNodesCount: allNodeIds.length,
      maxDepth: Math.max(...Object.values(levels))
    };
  }

  /* ── 6. UI: Populate Root Selector ────────────────────────── */
  function populateRootSelector() {
    if (!el.rootSelect) return;
    const previous = el.rootSelect.value;
    el.rootSelect.innerHTML = '';

    state.allNodeIds.forEach(id => {
      const node = state.nodeMap[id];
      const opt = document.createElement('option');
      opt.value = id;
      const typeLabel = node && node.type ? ` (${node.type})` : '';
      opt.textContent = `${node ? node.label : id}${typeLabel}`;
      if (id === (previous || state.rootNode)) opt.selected = true;
      el.rootSelect.appendChild(opt);
    });

    state.rootNode = el.rootSelect.value || 'R3';
  }

  /* ── 7. UI: Render SVG Topology & Broadcast Tree ─────────── */
  function visualizeBroadcastTree() {
    if (!el.svg || !state.topology) return;

    const W = 740, H = 380;
    el.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const nodes = state.topology.nodes;
    const { activeLinks } = buildGraphFromTopology();

    // Coordinate scaling
    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const padX = 85, padY = 55;

    function scaleX(x) {
      if (maxX === minX) return W / 2;
      return padX + ((x - minX) / (maxX - minX)) * (W - padX * 2);
    }
    function scaleY(y) {
      if (maxY === minY) return H / 2;
      return padY + ((y - minY) / (maxY - minY)) * (H - padY * 2);
    }

    // Build fast lookup of tree edges
    const treeEdgeLookup = new Set();
    const treeEdgeDirLookup = {}; // "P-C" -> level
    if (state.treeResult && state.treeResult.valid) {
      state.treeResult.treeEdges.forEach(e => {
        treeEdgeLookup.add(`${e.parent}-${e.child}`);
        treeEdgeLookup.add(`${e.child}-${e.parent}`);
        treeEdgeDirLookup[`${e.parent}-${e.child}`] = e.level;
      });
    }

    let svgHTML = `
      <defs>
        <!-- Arrowhead for active broadcast links -->
        <marker id="bt-arrow-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#06d6a0" />
        </marker>
        <marker id="bt-arrow-fwd" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#38bdf8" />
        </marker>
        <filter id="glow-root" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    `;

    // ── Render Links ─────────────────────────────────────────
    svgHTML += '<g id="svg-links-group">';
    activeLinks.forEach((link, idx) => {
      const s = state.nodeMap[link.source];
      const t = state.nodeMap[link.target];
      if (!s || !t) return;

      const x1 = scaleX(s.x), y1 = scaleY(s.y);
      const x2 = scaleX(t.x), y2 = scaleY(t.y);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;

      const isTree = treeEdgeLookup.has(`${link.source}-${link.target}`);
      const linkClass = isTree ? 'link-tree' : 'link-non-tree';
      const linkId = `link-${link.source}-${link.target}`;

      let extraAttr = '';
      if (isTree) {
        extraAttr = 'marker-end="url(#bt-arrow-active)"';
      }

      svgHTML += `
        <line id="${linkId}" class="${linkClass}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${extraAttr}>
          <title>${link.source} ↔ ${link.target} | ${link.bandwidth} | ${isTree ? 'Active Tree Edge' : 'Pruned Non-Tree Edge'}</title>
        </line>
        <text class="link-badge-text" x="${mx}" y="${my - 6}">
          ${link.bandwidth}${link.isRedundant ? ' (Loop Check)' : ''}
        </text>
      `;
    });
    svgHTML += '</g>';

    // ── Dynamic Packet Flight Container ──────────────────────
    svgHTML += '<g id="svg-packets-group"></g>';

    // ── Render Nodes ─────────────────────────────────────────
    svgHTML += '<g id="svg-nodes-group">';
    nodes.forEach(node => {
      const cx = scaleX(node.x);
      const cy = scaleY(node.y);
      const r = node.type === 'server' ? 26 : node.type === 'router' ? 22 : 18;
      const isRoot = state.treeResult && state.treeResult.root === node.id;
      const currState = state.nodeStates[node.id] || 'unvisited';

      let stateClass = 'node-state-unvisited';
      if (currState === 'unreachable') stateClass = 'node-state-unreachable';
      else if (isRoot) stateClass = 'node-state-root';
      else if (currState === 'broadcasting') stateClass = 'node-state-broadcasting';
      else if (currState === 'received') stateClass = 'node-state-received';

      const icon = node.type === 'server' ? '🖥️' : node.type === 'router' ? '📡' : '💻';
      const level = state.treeResult && state.treeResult.levels ? state.treeResult.levels[node.id] : undefined;

      svgHTML += `
        <g class="bt-node-group" id="node-group-${node.id}" data-node-id="${node.id}" style="cursor:pointer;">
          ${isRoot ? `<circle cx="${cx}" cy="${cy}" r="${r + 7}" class="node-root-halo" />` : ''}
          <circle id="node-circle-${node.id}" cx="${cx}" cy="${cy}" r="${r}" class="node-circle ${stateClass}">
            <title>${node.label} (${node.type}) — State: ${currState}</title>
          </circle>
          <text class="node-text-id" x="${cx}" y="${cy}">${node.label}</text>
          <text class="node-text-type" x="${cx}" y="${cy + r + 13}">${icon} ${node.label}</text>
          ${level !== undefined ? `<text class="node-level-tag" x="${cx}" y="${cy - r - 6}">Hop ${level}</text>` : ''}
        </g>
      `;
    });
    svgHTML += '</g>';

    el.svg.innerHTML = svgHTML;

    // Attach click listener to nodes for quick root selection
    el.svg.querySelectorAll('.bt-node-group').forEach(group => {
      group.addEventListener('click', function () {
        const selectedId = this.dataset.nodeId;
        if (selectedId && el.rootSelect) {
          el.rootSelect.value = selectedId;
          onRootChanged();
        }
      });
    });
  }

  /* ── 8. UI: Populate Parent-Child Table ──────────────────── */
  function renderParentChildTable() {
    if (!el.tableBody) return;
    el.tableBody.innerHTML = '';

    if (!state.treeResult || !state.treeResult.valid || state.treeResult.treeEdges.length === 0) {
      el.tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-3">
            No broadcast tree constructed yet. Select a root node and click <strong>"Build Broadcast Tree"</strong>.
          </td>
        </tr>`;
      return;
    }

    state.treeResult.treeEdges.forEach(edge => {
      const tr = document.createElement('tr');
      const isReceived = state.nodeStates[edge.child] === 'received';
      const statusBadge = isReceived
        ? '<span class="sn-badge success"><span class="status-dot"></span> Broadcast Received</span>'
        : '<span class="sn-badge primary">Tree Link (Forwarding)</span>';

      tr.innerHTML = `
        <td class="text-mono"><strong>${edge.parent}</strong></td>
        <td class="text-mono"><strong style="color:var(--color-accent);">${edge.child}</strong></td>
        <td><span class="val-badge">Level ${edge.level}</span></td>
        <td><span class="text-muted text-mono">${edge.bandwidth}</span></td>
        <td>${statusBadge}</td>
      `;
      el.tableBody.appendChild(tr);
    });

    // Also display pruned non-tree links if any (loop prevention demonstration)
    if (state.treeResult.nonTreeEdges && state.treeResult.nonTreeEdges.length > 0) {
      state.treeResult.nonTreeEdges.forEach(edge => {
        const tr = document.createElement('tr');
        tr.style.opacity = '0.65';
        tr.innerHTML = `
          <td class="text-mono">${edge.u}</td>
          <td class="text-mono">${edge.v}</td>
          <td><span class="sn-badge warning">Pruned</span></td>
          <td><span class="text-muted text-mono">${edge.bandwidth}</span></td>
          <td><span class="sn-badge danger">🚫 Inactive (Loop Prevention)</span></td>
        `;
        el.tableBody.appendChild(tr);
      });
    }
  }

  /* ── 9. UI: Update Result Metrics Display ────────────────── */
  function updateResultsUI() {
    if (!state.treeResult) {
      if (el.statRoot) el.statRoot.textContent = '—';
      if (el.statReached) el.statReached.textContent = '0 / 0';
      if (el.statEdges) el.statEdges.textContent = '0';
      if (el.statStatus) el.statStatus.textContent = 'Idle';
      if (el.statUnreachable) el.statUnreachable.textContent = 'None';
      if (el.statEfficiency) el.statEfficiency.textContent = '100%';
      return;
    }

    const res = state.treeResult;

    if (el.statRoot) el.statRoot.textContent = res.root || '—';

    if (el.statReached) {
      const pct = res.totalNodesCount > 0 ? Math.round((res.nodesReachedCount / res.totalNodesCount) * 100) : 0;
      el.statReached.textContent = `${res.nodesReachedCount} / ${res.totalNodesCount} (${pct}%)`;
    }

    if (el.statEdges) {
      el.statEdges.textContent = res.treeEdgesCount;
    }

    if (el.statStatus) {
      if (!res.valid) {
        el.statStatus.textContent = 'Configuration Error';
      } else if (state.isBroadcasting) {
        el.statStatus.textContent = 'Broadcasting...';
      } else if (res.unreachableNodes.length > 0) {
        el.statStatus.textContent = 'Partial Reachability';
      } else {
        el.statStatus.textContent = 'Broadcast Completed';
      }
    }

    if (el.statUnreachable) {
      if (!res.unreachableNodes || res.unreachableNodes.length === 0) {
        el.statUnreachable.textContent = 'None (0)';
        el.statUnreachable.style.color = 'var(--text-primary)';
      } else {
        el.statUnreachable.textContent = `${res.unreachableNodes.join(', ')} (${res.unreachableNodes.length})`;
        el.statUnreachable.style.color = 'var(--color-danger)';
      }
    }

    if (el.statEfficiency) {
      // Loop-free spanning tree transmission: exactly N-1 edges for N nodes reached
      const expectedEdges = Math.max(0, res.nodesReachedCount - 1);
      const isOptimal = res.treeEdgesCount === expectedEdges;
      el.statEfficiency.textContent = isOptimal ? '100% (0 Loops)' : 'Non-optimal';
    }
  }

  /* ── 10. Live Event Ticker ───────────────────────────────── */
  function clearEventTicker() {
    if (el.eventTicker) el.eventTicker.innerHTML = '';
  }

  function logEvent(msg, type) {
    if (!el.eventTicker) return;
    const entry = document.createElement('div');
    entry.className = `event-ticker-entry ${type || ''}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="time-tag">[${timestamp}]</span> <span>${msg}</span>`;
    el.eventTicker.appendChild(entry);
    el.eventTicker.scrollTop = el.eventTicker.scrollHeight;
  }

  /* ── 11. Broadcast Packet Animation (Section 11) ─────────── */
  function startBroadcastAnimation() {
    if (!state.treeResult || !state.treeResult.valid) {
      buildTreeHandler();
      if (!state.treeResult || !state.treeResult.valid) return;
    }

    // Cancel any running animations
    stopAnimation();

    state.isBroadcasting = true;
    updateResultsUI();
    clearEventTicker();
    logEvent(`🚀 Root <strong>${state.treeResult.root}</strong> initiated network broadcast packet!`, 'highlight');

    // Group tree edges by level (hop depth)
    const levelsMap = {};
    state.treeResult.treeEdges.forEach(edge => {
      if (!levelsMap[edge.level]) levelsMap[edge.level] = [];
      levelsMap[edge.level].push(edge);
    });

    const maxLevel = state.treeResult.maxDepth || 1;

    // Reset node states
    state.allNodeIds.forEach(id => {
      state.nodeStates[id] = 'unvisited';
    });
    // Mark root as broadcasting
    state.nodeStates[state.treeResult.root] = 'broadcasting';
    visualizeBroadcastTree();

    let currentLevel = 1;

    function stepLevel() {
      if (currentLevel > maxLevel) {
        // Animation complete
        state.isBroadcasting = false;
        state.visitedNodes = state.treeResult.visitedNodes;
        state.treeResult.visitedNodes.forEach(id => {
          state.nodeStates[id] = 'received';
        });

        if (state.treeResult.unreachableNodes.length > 0) {
          state.treeResult.unreachableNodes.forEach(id => {
            state.nodeStates[id] = 'unreachable';
          });
          logEvent(`⚠️ Broadcast finished with ${state.treeResult.unreachableNodes.length} unreachable node(s): ${state.treeResult.unreachableNodes.join(', ')}`, 'warn');
        } else {
          logEvent(`✅ Broadcast successfully delivered to all ${state.treeResult.nodesReachedCount} nodes without duplicate transmission!`, 'highlight');
        }

        visualizeBroadcastTree();
        renderParentChildTable();
        updateResultsUI();
        showToast('Broadcast complete! Result ready for Dashboard.');
        return;
      }

      const edgesAtThisLevel = levelsMap[currentLevel] || [];

      // Highlight links and animate packet travel
      edgesAtThisLevel.forEach(edge => {
        animatePacket(edge.parent, edge.child, state.animationSpeed * 0.7);
        logEvent(`Packet forwarded: <strong>${edge.parent}</strong> ➔ <strong>${edge.child}</strong> (Hop ${edge.level})`);
      });

      const tId = setTimeout(() => {
        // Mark children as received & parents back to received
        edgesAtThisLevel.forEach(edge => {
          state.nodeStates[edge.parent] = 'received';
          state.nodeStates[edge.child] = (currentLevel === maxLevel) ? 'received' : 'broadcasting';
        });
        visualizeBroadcastTree();
        renderParentChildTable();

        currentLevel++;
        stepLevel();
      }, state.animationSpeed);

      state.animTimeouts.push(tId);
    }

    stepLevel();
  }

  function animatePacket(fromId, toId, duration) {
    const s = state.nodeMap[fromId];
    const t = state.nodeMap[toId];
    if (!s || !t || !el.svg) return;

    const W = 740, H = 380;
    const xs = state.topology.nodes.map(n => n.x);
    const ys = state.topology.nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const padX = 85, padY = 55;

    const x1 = padX + ((s.x - minX) / (maxX - minX)) * (W - padX * 2);
    const y1 = padY + ((s.y - minY) / (maxY - minY)) * (H - padY * 2);
    const x2 = padX + ((t.x - minX) / (maxX - minX)) * (W - padX * 2);
    const y2 = padY + ((t.y - minY) / (maxY - minY)) * (H - padY * 2);

    const packetGroup = el.svg.querySelector('#svg-packets-group');
    if (!packetGroup) return;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x1);
    circle.setAttribute('cy', y1);
    circle.setAttribute('r', '6');
    circle.setAttribute('class', 'packet-particle');
    packetGroup.appendChild(circle);

    const startTime = performance.now();

    function frame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const currX = x1 + (x2 - x1) * progress;
      const currY = y1 + (y2 - y1) * progress;

      circle.setAttribute('cx', currX);
      circle.setAttribute('cy', currY);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        if (circle.parentNode) circle.parentNode.removeChild(circle);
      }
    }
    requestAnimationFrame(frame);
  }

  function stopAnimation() {
    state.isBroadcasting = false;
    state.animTimeouts.forEach(t => clearTimeout(t));
    state.animTimeouts = [];
    const packetGroup = el.svg ? el.svg.querySelector('#svg-packets-group') : null;
    if (packetGroup) packetGroup.innerHTML = '';
  }

  /* ── 12. Handler: Build Broadcast Tree ────────────────────── */
  function buildTreeHandler() {
    stopAnimation();

    // Check edge case: empty topology
    if (!state.topology || !state.topology.nodes || state.topology.nodes.length === 0) {
      showValidationError('Error: Topology is empty. Unable to build broadcast tree.');
      return;
    }

    const root = el.rootSelect ? el.rootSelect.value : state.rootNode;
    state.rootNode = root;

    // Check edge case: invalid root
    if (!root || !state.graph[root]) {
      showValidationError(`Invalid root selected: "${root}". Please choose an active node from the network.`);
      return;
    }

    clearValidationError();

    const result = buildBroadcastTree(state.graph, state.allNodeIds, root);
    state.treeResult = result;

    // Reset node states
    state.allNodeIds.forEach(id => {
      state.nodeStates[id] = 'unvisited';
    });
    if (result.valid) {
      state.nodeStates[root] = 'broadcasting';
      if (result.unreachableNodes.length > 0) {
        result.unreachableNodes.forEach(id => {
          state.nodeStates[id] = 'unreachable';
        });
      }
    }

    visualizeBroadcastTree();
    renderParentChildTable();
    updateResultsUI();

    clearEventTicker();
    logEvent(`Broadcast Tree constructed for Root: <strong>${root}</strong> (${result.treeEdgesCount} spanning links).`);
    if (result.unreachableNodes.length > 0) {
      logEvent(`Unreachable nodes detected: ${result.unreachableNodes.join(', ')}`, 'warn');
    }
  }

  /* ── 13. Handler: Reset ──────────────────────────────────── */
  function resetHandler() {
    stopAnimation();
    clearValidationError();
    clearEventTicker();

    state.scenario = 'normal';
    if (el.scenarioSelect) el.scenarioSelect.value = 'normal';

    const { graph, nodeMap, allNodeIds } = buildGraphFromTopology();
    state.graph = graph;
    state.nodeMap = nodeMap;
    state.allNodeIds = allNodeIds;

    state.rootNode = 'R3';
    if (el.rootSelect) el.rootSelect.value = 'R3';

    state.treeResult = null;
    state.allNodeIds.forEach(id => {
      state.nodeStates[id] = 'unvisited';
    });

    visualizeBroadcastTree();
    renderParentChildTable();
    updateResultsUI();

    logEvent('Broadcast Tree simulation reset to initial state.');
    showToast('Simulation reset.');
  }

  /* ── 14. Handler: Save to Integration Layer (Section 23) ─── */
  function saveResultHandler() {
    if (!state.treeResult || !state.treeResult.valid) {
      showToast('Please build or run a broadcast tree simulation first.');
      return;
    }

    const res = state.treeResult;
    const efficiency = res.totalNodesCount > 0
      ? Math.round((res.nodesReachedCount / res.totalNodesCount) * 100)
      : 100;

    // Exact schema conforming to Section 23
    const payload = {
      experiment: 'Broadcast Tree',
      module: 'broadcast-tree',
      status: res.unreachableNodes.length === 0 ? 'Completed' : 'Partial Completed',
      inputs: {
        root: res.root,
        scenario: state.scenario
      },
      results: {
        visitedNodes: res.visitedNodes,
        treeEdges: res.treeEdges.map(e => ({ parent: e.parent, child: e.child })),
        unreachableNodes: res.unreachableNodes,
        nodesReachedCount: res.nodesReachedCount,
        treeEdgesCount: res.treeEdgesCount
      },
      metrics: {
        rootNode: res.root,
        nodesReached: `${res.nodesReachedCount} / ${res.totalNodesCount} (${efficiency}%)`,
        treeEdges: res.treeEdgesCount,
        unreachableCount: res.unreachableNodes.length,
        loopFree: true
      },
      timestamp: new Date().toISOString()
    };

    state.lastPayload = payload;

    if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
      SMARTNET.Integration.saveResult(payload);
      showToast('Broadcast Tree results saved to SMARTNET Dashboard!');
    } else {
      console.warn('[BroadcastTree] SMARTNET.Integration.saveResult not available, using localStorage fallback');
      try {
        const stored = JSON.parse(localStorage.getItem('smartnet_results') || '[]');
        stored.unshift(payload);
        localStorage.setItem('smartnet_results', JSON.stringify(stored));
        showToast('Saved to localStorage fallback!');
      } catch (err) {
        showToast('Error saving results: ' + err.message);
      }
    }
  }

  /* ── 15. Export CSV & JSON ───────────────────────────────── */
  function exportCSV() {
    if (!state.treeResult || !state.treeResult.valid) {
      showToast('No tree results to export.');
      return;
    }

    let csv = 'Parent,Child,HopLevel,Bandwidth,LinkType\n';
    state.treeResult.treeEdges.forEach(e => {
      csv += `${e.parent},${e.child},${e.level},${e.bandwidth},TreeEdge\n`;
    });
    if (state.treeResult.nonTreeEdges) {
      state.treeResult.nonTreeEdges.forEach(e => {
        csv += `${e.u},${e.v},Pruned,${e.bandwidth},NonTreePruned\n`;
      });
    }

    downloadBlob(csv, `smartnet_broadcast_tree_${state.rootNode}.csv`, 'text/csv;charset=utf-8;');
    showToast('Exported CSV file.');
  }

  function exportJSON() {
    if (!state.treeResult || !state.treeResult.valid) {
      showToast('No tree results to export.');
      return;
    }

    const data = {
      experiment: 'Broadcast Tree',
      module: 'broadcast-tree',
      inputs: {
        root: state.treeResult.root,
        scenario: state.scenario
      },
      results: {
        visitedNodes: state.treeResult.visitedNodes,
        treeEdges: state.treeResult.treeEdges,
        unreachableNodes: state.treeResult.unreachableNodes,
        nonTreeEdges: state.treeResult.nonTreeEdges,
        levels: state.treeResult.levels
      },
      exportedAt: new Date().toISOString()
    };

    downloadBlob(JSON.stringify(data, null, 2), `smartnet_broadcast_tree_${state.rootNode}.json`, 'application/json');
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

  /* ── 16. Error & Validation Helpers ──────────────────────── */
  function showValidationError(msg) {
    if (el.validationAlert) {
      el.validationAlert.textContent = msg;
      el.validationAlert.classList.remove('d-none');
    }
  }

  function clearValidationError() {
    if (el.validationAlert) {
      el.validationAlert.classList.add('d-none');
      el.validationAlert.textContent = '';
    }
  }

  function showToast(msg) {
    if (!el.toast || !el.toastMsg) return;
    el.toastMsg.textContent = msg;
    el.toast.classList.add('show');
    setTimeout(() => {
      el.toast.classList.remove('show');
    }, 2800);
  }

  /* ── 17. Event Listeners ─────────────────────────────────── */
  function onRootChanged() {
    state.rootNode = el.rootSelect.value;
    buildTreeHandler();
  }

  function onScenarioChanged() {
    state.scenario = el.scenarioSelect.value;
    const { graph, nodeMap, allNodeIds } = buildGraphFromTopology();
    state.graph = graph;
    state.nodeMap = nodeMap;
    state.allNodeIds = allNodeIds;
    buildTreeHandler();
  }

  function onSpeedChanged() {
    state.animationSpeed = parseInt(el.speedSelect.value, 10) || 800;
  }

  function attachEventListeners() {
    if (el.rootSelect) el.rootSelect.addEventListener('change', onRootChanged);
    if (el.scenarioSelect) el.scenarioSelect.addEventListener('change', onScenarioChanged);
    if (el.speedSelect) el.speedSelect.addEventListener('change', onSpeedChanged);

    if (el.btnBuild) el.btnBuild.addEventListener('click', buildTreeHandler);
    if (el.btnBroadcast) el.btnBroadcast.addEventListener('click', startBroadcastAnimation);
    if (el.btnReset) el.btnReset.addEventListener('click', resetHandler);
    if (el.btnSaveResult) el.btnSaveResult.addEventListener('click', saveResultHandler);
    if (el.btnExportCsv) el.btnExportCsv.addEventListener('click', exportCSV);
    if (el.btnExportJson) el.btnExportJson.addEventListener('click', exportJSON);

    window.addEventListener('resize', () => {
      visualizeBroadcastTree();
    });
  }

  /* ── 18. Initialization ──────────────────────────────────── */
  async function init() {
    initDOMElements();

    // Load common topology
    try {
      if (SMARTNET.Integration && typeof SMARTNET.Integration.getTopology === 'function') {
        const data = await SMARTNET.Integration.getTopology();
        state.topology = data.topology || data;
      }
    } catch (e) {
      console.warn('[BroadcastTree] Could not fetch topology via Integration layer:', e);
    }

    if (!state.topology) {
      // Fallback topology matching centralized data/topology.json
      state.topology = {
        nodes: [
          { id: 'SERVER', label: 'Server', type: 'server', x: 400, y: 30 },
          { id: 'R3',     label: 'R3',     type: 'router', x: 400, y: 120 },
          { id: 'R1',     label: 'R1',     type: 'router', x: 220, y: 220 },
          { id: 'R2',     label: 'R2',     type: 'router', x: 580, y: 220 },
          { id: 'PC1',    label: 'PC1',    type: 'host',   x: 100, y: 330 },
          { id: 'PC2',    label: 'PC2',    type: 'host',   x: 280, y: 330 },
          { id: 'PC3',    label: 'PC3',    type: 'host',   x: 460, y: 330 },
          { id: 'PC4',    label: 'PC4',    type: 'host',   x: 640, y: 330 }
        ],
        links: [
          { source: 'SERVER', target: 'R3', bandwidth: '1Gbps',   cost: 1 },
          { source: 'R3',     target: 'R1', bandwidth: '100Mbps', cost: 2 },
          { source: 'R3',     target: 'R2', bandwidth: '100Mbps', cost: 2 },
          { source: 'R1',     target: 'PC1',bandwidth: '10Mbps',  cost: 1 },
          { source: 'R1',     target: 'PC2',bandwidth: '10Mbps',  cost: 1 },
          { source: 'R2',     target: 'PC3',bandwidth: '10Mbps',  cost: 1 },
          { source: 'R2',     target: 'PC4',bandwidth: '10Mbps',  cost: 1 }
        ]
      };
    }

    const { graph, nodeMap, allNodeIds } = buildGraphFromTopology();
    state.graph = graph;
    state.nodeMap = nodeMap;
    state.allNodeIds = allNodeIds;

    populateRootSelector();
    attachEventListeners();

    // Default initial construction with Root = R3
    buildTreeHandler();

    console.log('[SMARTNET] Broadcast Tree module initialized successfully.');
  }

  // Bootstrap lifecycle
  document.addEventListener('DOMContentLoaded', function () {
    if (SMARTNET.Navigation && typeof SMARTNET.Navigation.init === 'function') {
      SMARTNET.Navigation.init('sn-nav-container');
    }
    if (SMARTNET.Integration && typeof SMARTNET.Integration.init === 'function') {
      SMARTNET.Integration.init();
    }
    init();
  });

  // Expose algorithm for testing and verification
  window.SMARTNET_BroadcastTree = {
    buildBroadcastTree,
    state
  };
  window.SMARTNET = SMARTNET;

})();
