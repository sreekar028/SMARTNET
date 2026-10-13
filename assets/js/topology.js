/**
 * SMARTNET — topology.js
 * Interactive Organizational Network Topology Controller
 */

var SMARTNET = window.SMARTNET || {};

SMARTNET.Topology = (function () {
  'use strict';

  let topoData = null;
  let selectedNodeId = 'SERVER';
  let activePath = [];

  // Extended node metadata for organizational inspection
  const NODE_SPECS = {
    SERVER: {
      title: 'Enterprise Core Server',
      role: 'Central Application & Database Server',
      ip: '10.0.0.100',
      subnet: '10.0.0.0/24 (Backbone)',
      icon: '🖥️',
      modules: 'Dijkstra, Distance Vector, Wireshark, NS2'
    },
    R3: {
      title: 'Core Backbone Router (R3)',
      role: 'Autonomous Core Routing & Gateway',
      ip: '10.0.0.1',
      subnet: '10.0.0.0/24 (Backbone Gateway)',
      icon: '📡',
      modules: 'Dijkstra, Distance Vector, Broadcast Tree, NS2'
    },
    R1: {
      title: 'Distribution Router 1 (R1)',
      role: 'Subnet 1 Distribution Router',
      ip: '192.168.1.1',
      subnet: '192.168.1.0/24 (Subnet 1 Gateway)',
      icon: '📡',
      modules: 'Dijkstra, Distance Vector, Broadcast Tree, Leaky Bucket'
    },
    R2: {
      title: 'Distribution Router 2 (R2)',
      role: 'Subnet 2 Distribution Router',
      ip: '192.168.2.1',
      subnet: '192.168.2.0/24 (Subnet 2 Gateway)',
      icon: '📡',
      modules: 'Dijkstra, Distance Vector, Broadcast Tree'
    },
    PC1: {
      title: 'Workstation PC1',
      role: 'Client Host (Subnet 1)',
      ip: '192.168.1.10',
      subnet: '192.168.1.0/24',
      icon: '💻',
      modules: 'Framing, CRC, Sliding Window, Go-Back-N, Wireshark, NS2'
    },
    PC2: {
      title: 'Workstation PC2',
      role: 'Client Host (Subnet 1)',
      ip: '192.168.1.20',
      subnet: '192.168.1.0/24',
      icon: '💻',
      modules: 'Framing, CRC, Sliding Window, Broadcast Tree'
    },
    PC3: {
      title: 'Workstation PC3',
      role: 'Client Host (Subnet 2)',
      ip: '192.168.2.10',
      subnet: '192.168.2.0/24',
      icon: '💻',
      modules: 'Framing, CRC, Distance Vector, Broadcast Tree'
    },
    PC4: {
      title: 'Workstation PC4',
      role: 'Client Host (Subnet 2)',
      ip: '192.168.2.20',
      subnet: '192.168.2.0/24',
      icon: '💻',
      modules: 'Framing, CRC, Encryption, Broadcast Tree'
    }
  };

  /* ── 1. Load Topology ────────────────────────────────────── */
  async function loadTopology() {
    try {
      if (window.SMARTNET && window.SMARTNET.Integration && typeof window.SMARTNET.Integration.getTopology === 'function') {
        const raw = await window.SMARTNET.Integration.getTopology();
        topoData = raw.topology || raw;
      }
    } catch (e) {
      console.warn('[SMARTNET.Topology] Error loading topology:', e);
    }

    if (!topoData || !topoData.nodes || topoData.nodes.length === 0) {
      topoData = getFallbackTopology();
    }

    updateStats();
    populateSelects();
    renderGraph();
    inspectNode(selectedNodeId);
  }

  function getFallbackTopology() {
    return {
      name: 'SMARTNET Common Topology',
      nodes: [
        { id: 'SERVER', label: 'Server', type: 'server',  x: 400, y: 35  },
        { id: 'R3',     label: 'R3',     type: 'router',  x: 400, y: 130 },
        { id: 'R1',     label: 'R1',     type: 'router',  x: 230, y: 230 },
        { id: 'R2',     label: 'R2',     type: 'router',  x: 570, y: 230 },
        { id: 'PC1',    label: 'PC1',    type: 'host',    x: 120, y: 340 },
        { id: 'PC2',    label: 'PC2',    type: 'host',    x: 310, y: 340 },
        { id: 'PC3',    label: 'PC3',    type: 'host',    x: 490, y: 340 },
        { id: 'PC4',    label: 'PC4',    type: 'host',    x: 680, y: 340 }
      ],
      links: [
        { source: 'SERVER', target: 'R3',  bandwidth: '1Gbps',   cost: 1 },
        { source: 'R3',     target: 'R1',  bandwidth: '100Mbps', cost: 2 },
        { source: 'R3',     target: 'R2',  bandwidth: '100Mbps', cost: 2 },
        { source: 'R1',     target: 'PC1', bandwidth: '10Mbps',  cost: 1 },
        { source: 'R1',     target: 'PC2', bandwidth: '10Mbps',  cost: 1 },
        { source: 'R2',     target: 'PC3', bandwidth: '10Mbps',  cost: 1 },
        { source: 'R2',     target: 'PC4', bandwidth: '10Mbps',  cost: 1 }
      ]
    };
  }

  function updateStats() {
    const totalNodesEl = document.getElementById('stat-total-nodes');
    const routersEl = document.getElementById('stat-routers');
    const hostsEl = document.getElementById('stat-hosts');
    const serversEl = document.getElementById('stat-servers');
    const linksEl = document.getElementById('stat-links');

    if (topoData && topoData.nodes) {
      const routers = topoData.nodes.filter(n => n.type === 'router').length;
      const hosts = topoData.nodes.filter(n => n.type === 'host').length;
      const servers = topoData.nodes.filter(n => n.type === 'server').length;
      const links = topoData.links ? topoData.links.length : 7;

      if (totalNodesEl) totalNodesEl.textContent = topoData.nodes.length;
      if (routersEl) routersEl.textContent = routers;
      if (hostsEl) hostsEl.textContent = hosts;
      if (serversEl) serversEl.textContent = servers;
      if (linksEl) linksEl.textContent = links;
    }
  }

  function populateSelects() {
    const srcSelect = document.getElementById('route-src-select');
    const dstSelect = document.getElementById('route-dst-select');
    if (!srcSelect || !dstSelect || !topoData || !topoData.nodes) return;

    const optionsHtml = topoData.nodes.map(n => {
      const spec = NODE_SPECS[n.id] || { title: n.label, role: n.type };
      return `<option value="${n.id}">${n.label} (${spec.title})</option>`;
    }).join('');

    srcSelect.innerHTML = optionsHtml;
    dstSelect.innerHTML = optionsHtml;

    srcSelect.value = 'PC1';
    dstSelect.value = 'SERVER';
  }

  /* ── 2. SVG Network Graph Rendering ──────────────────────── */
  function renderGraph() {
    const svg = document.getElementById('interactive-topology-svg');
    if (!svg || !topoData) return;

    const W = 740, H = 400;
    const nodeMap = {};
    topoData.nodes.forEach(n => { nodeMap[n.id] = n; });

    let content = `<defs>
      <linearGradient id="grad-server" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#15803d" />
        <stop offset="100%" stop-color="#166534" />
      </linearGradient>
      <linearGradient id="grad-router" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#22c55e" />
        <stop offset="100%" stop-color="#16a34a" />
      </linearGradient>
      <linearGradient id="grad-host" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#475569" />
        <stop offset="100%" stop-color="#334155" />
      </linearGradient>
    </defs>`;

    // --- Draw Links ---
    topoData.links.forEach((link, idx) => {
      const s = nodeMap[link.source];
      const t = nodeMap[link.target];
      if (!s || !t) return;

      const isPathLink = isLinkInPath(link.source, link.target);
      const linkClass = isPathLink ? 'svg-topo-link topo-link highlighted-path' : 'svg-topo-link topo-link';
      const linkId = `link-${link.source}-${link.target}`;

      const mx = (s.x + t.x) / 2;
      const my = (s.y + t.y) / 2;

      content += `
        <g id="${linkId}">
          <line class="${linkClass}" x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}"
                data-source="${link.source}" data-target="${link.target}" data-cost="${link.cost}">
            <title>${link.source} ↔ ${link.target} | Bandwidth: ${link.bandwidth} | Cost: ${link.cost}</title>
          </line>
          <!-- Bandwidth Pill -->
          <rect class="link-badge-bg" x="${mx - 36}" y="${my - 10}" width="72" height="20" rx="4" ry="4" />
          <text class="link-badge-text" x="${mx}" y="${my}" dominant-baseline="central">
            ${link.bandwidth} (C:${link.cost})
          </text>
        </g>
      `;
    });

    // --- Draw Nodes ---
    topoData.nodes.forEach(n => {
      const r = n.type === 'server' ? 26 : n.type === 'router' ? 22 : 18;
      const isSelected = n.id === selectedNodeId;
      const isPathNode = activePath.includes(n.id);
      let nodeClass = `svg-topo-node topo-node-group bt-node-group`;
      if (isSelected) nodeClass += ' selected';
      if (isPathNode) nodeClass += ' path-node';

      let circleClass = `node-circle node-${n.type} topo-node-${n.type}`;
      if (isSelected) circleClass += ' node-selected';
      if (isPathNode) circleClass += ' node-path';

      const spec = NODE_SPECS[n.id] || { icon: '💻', title: n.label };

      content += `
        <g class="${nodeClass}" id="node-${n.id}" onclick="SMARTNET.Topology.inspectNode('${n.id}')"
           role="button" aria-label="${n.label}">
          <circle cx="${n.x}" cy="${n.y}" r="${r}" class="${circleClass}">
            <title>${n.label} — ${spec.title} (${spec.ip})</title>
          </circle>
          <text class="node-text-id topo-label" x="${n.x}" y="${n.y}" dominant-baseline="central">${n.label}</text>
          <text class="node-text-type topo-sublabel" x="${n.x}" y="${n.y + r + 13}">${spec.icon} ${n.label}</text>
        </g>
      `;
    });

    svg.innerHTML = content;
  }

  function isLinkInPath(u, v) {
    if (activePath.length < 2) return false;
    for (let i = 0; i < activePath.length - 1; i++) {
      if ((activePath[i] === u && activePath[i+1] === v) || (activePath[i] === v && activePath[i+1] === u)) {
        return true;
      }
    }
    return false;
  }

  /* ── 3. Node Details Inspector ───────────────────────────── */
  function inspectNode(nodeId) {
    selectedNodeId = nodeId;
    const spec = NODE_SPECS[nodeId] || { title: nodeId, role: 'Network Node', ip: 'Dynamic', subnet: 'N/A', icon: '🌐', modules: 'N/A' };

    const iconEl = document.getElementById('insp-icon');
    const titleEl = document.getElementById('insp-title');
    const roleEl = document.getElementById('insp-role');
    const idEl = document.getElementById('insp-id');
    const ipEl = document.getElementById('insp-ip');
    const subnetEl = document.getElementById('insp-subnet');
    const neighborsEl = document.getElementById('insp-neighbors');
    const modulesEl = document.getElementById('insp-modules');

    if (iconEl) iconEl.textContent = spec.icon;
    if (titleEl) titleEl.textContent = `${nodeId} (${spec.title})`;
    if (roleEl) roleEl.textContent = spec.role;
    if (idEl) idEl.textContent = nodeId;
    if (ipEl) ipEl.textContent = spec.ip;
    if (subnetEl) subnetEl.textContent = spec.subnet;
    if (modulesEl) modulesEl.textContent = spec.modules;

    // Find neighbors from links
    if (neighborsEl && topoData && topoData.links) {
      const neighbors = [];
      topoData.links.forEach(l => {
        if (l.source === nodeId) neighbors.push(`${l.target} [${l.bandwidth}, Cost:${l.cost}]`);
        else if (l.target === nodeId) neighbors.push(`${l.source} [${l.bandwidth}, Cost:${l.cost}]`);
      });
      neighborsEl.textContent = neighbors.join(' · ') || 'None';
    }

    renderGraph();
  }

  /* ── 4. Shortest Path Highlighting (Dijkstra) ─────────────── */
  function calculateRoute() {
    const src = document.getElementById('route-src-select')?.value || 'PC1';
    const dst = document.getElementById('route-dst-select')?.value || 'SERVER';

    if (src === dst) {
      alert('Source and destination nodes must be distinct.');
      return;
    }

    const pathData = runDijkstra(src, dst);
    if (!pathData || !pathData.path || pathData.path.length === 0) {
      alert(`No reachable path exists between ${src} and ${dst}.`);
      return;
    }

    activePath = pathData.path;
    renderGraph();

    // Render Path Results Card
    const box = document.getElementById('path-results-box');
    const seqText = document.getElementById('path-sequence-text');
    const costBadge = document.getElementById('path-cost-badge');
    const hopsEl = document.getElementById('path-hops-count');
    const minBwEl = document.getElementById('path-min-bw');
    const latEl = document.getElementById('path-est-latency');

    if (box) box.classList.remove('d-none');
    if (seqText) seqText.textContent = activePath.join(' → ');
    if (costBadge) costBadge.textContent = `Total Cost: ${pathData.totalCost}`;
    if (hopsEl) hopsEl.textContent = `${activePath.length - 1}`;
    if (minBwEl) minBwEl.textContent = pathData.minBw;
    if (latEl) latEl.textContent = `~${(activePath.length - 1) * 2.5} ms`;
  }

  function runDijkstra(src, dst) {
    if (!topoData || !topoData.nodes || !topoData.links) return null;

    // Build Adjacency Graph
    const adj = {};
    topoData.nodes.forEach(n => { adj[n.id] = []; });
    topoData.links.forEach(l => {
      adj[l.source].push({ node: l.target, cost: l.cost, bw: l.bandwidth });
      adj[l.target].push({ node: l.source, cost: l.cost, bw: l.bandwidth });
    });

    const dist = {};
    const prev = {};
    const linkUsed = {};
    const unvisited = new Set();

    topoData.nodes.forEach(n => {
      dist[n.id] = Infinity;
      prev[n.id] = null;
      unvisited.add(n.id);
    });

    dist[src] = 0;

    while (unvisited.size > 0) {
      // Find min distance unvisited
      let curr = null;
      let minD = Infinity;
      unvisited.forEach(nodeId => {
        if (dist[nodeId] < minD) {
          minD = dist[nodeId];
          curr = nodeId;
        }
      });

      if (curr === null || minD === Infinity) break;
      if (curr === dst) break;

      unvisited.delete(curr);

      adj[curr].forEach(edge => {
        if (!unvisited.has(edge.node)) return;
        const alt = dist[curr] + edge.cost;
        if (alt < dist[edge.node]) {
          dist[edge.node] = alt;
          prev[edge.node] = curr;
          linkUsed[`${curr}-${edge.node}`] = edge.bw;
          linkUsed[`${edge.node}-${curr}`] = edge.bw;
        }
      });
    }

    if (dist[dst] === Infinity) return null;

    // Reconstruct path
    const path = [];
    let curr = dst;
    while (curr !== null) {
      path.unshift(curr);
      curr = prev[curr];
    }

    // Determine bottleneck bandwidth
    const bwHierarchy = { '10Mbps': 10, '100Mbps': 100, '1Gbps': 1000 };
    let minVal = Infinity;
    let minBwStr = '100Mbps';

    for (let i = 0; i < path.length - 1; i++) {
      const u = path[i], v = path[i+1];
      const link = topoData.links.find(l => (l.source === u && l.target === v) || (l.source === v && l.target === u));
      if (link && link.bandwidth) {
        const val = bwHierarchy[link.bandwidth] || 50;
        if (val < minVal) {
          minVal = val;
          minBwStr = link.bandwidth;
        }
      }
    }

    return {
      path,
      totalCost: dist[dst],
      minBw: minBwStr
    };
  }

  function clearRoute() {
    activePath = [];
    document.getElementById('path-results-box')?.classList.add('d-none');
    renderGraph();
  }

  function resetView() {
    clearRoute();
    inspectNode('SERVER');
  }

  /* ── 5. Initialization ───────────────────────────────────── */
  function init() {
    if (window.SMARTNET && window.SMARTNET.Navigation && typeof window.SMARTNET.Navigation.init === 'function') {
      window.SMARTNET.Navigation.init('sn-nav-container');
    }
    if (window.SMARTNET && window.SMARTNET.Integration && typeof window.SMARTNET.Integration.init === 'function') {
      window.SMARTNET.Integration.init();
    }

    document.getElementById('btn-calculate-path')?.addEventListener('click', calculateRoute);
    document.getElementById('btn-clear-path')?.addEventListener('click', clearRoute);
    document.getElementById('btn-reset-view')?.addEventListener('click', resetView);

    loadTopology();
  }

  return {
    init,
    inspectNode,
    calculateRoute,
    clearRoute,
    resetView
  };
})();

// Auto-boot on DOM ready
document.addEventListener('DOMContentLoaded', function () {
  SMARTNET.Topology.init();
});
