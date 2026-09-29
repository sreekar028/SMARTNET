/**
 * SMARTNET — navigation.js
 * Shared navigation component injected into every page.
 *
 * IMPORTANT (Integration Lead):
 *   Navigation keys, routes, and labels defined here are FIXED.
 *   Do NOT modify without Integration Lead approval.
 *   All modules must call SMARTNET.Navigation.init() to mount the navbar.
 */

var SMARTNET = window.SMARTNET || {};

SMARTNET.Navigation = (function () {
  'use strict';

  /* ── Route Map ────────────────────────────────────────────
     Single source of truth for ALL navigation paths.
     Other modules must reference these constants — never hard-code paths.
  ─────────────────────────────────────────────────────────── */
  const ROUTES = {
    dashboard:       'pages/dashboard.html',
    topology:        'pages/topology.html',
    simulations:     'pages/simulations.html',
    // Simulation sub-modules
    framing:         'pages/modules/framing/index.html',
    crc:             'pages/modules/crc/index.html',
    slidingWindow:   'pages/modules/sliding-window/index.html',
    goBackN:         'pages/modules/go-back-n/index.html',
    dijkstra:        'pages/modules/dijkstra/index.html',
    distanceVector:  'pages/modules/distance-vector/index.html',
    broadcastTree:   'pages/modules/broadcast-tree/index.html',
    encryption:      'pages/modules/encryption/index.html',
    leakyBucket:     'pages/modules/leaky-bucket/index.html',
    // Analysis Tools
    wireshark:       'pages/tools/wireshark/index.html',
    nmap:            'pages/tools/nmap/index.html',
    ns2:             'pages/tools/ns2/index.html',
    // Other pages
    results:         'pages/results.html',
    about:           'pages/about.html',
  };

  /**
   * Resolve a route relative to the current page location.
   * This ensures links work from pages at any directory depth.
   */
  function resolveRoute(route) {
    // Determine depth by counting slashes in pathname
    const depth = (window.location.pathname.match(/\//g) || []).length;
    // Pages at root-level (index.html) use the route directly.
    // Pages inside subdirs prepend '../' for each extra level.
    // For local file:// protocol, calculate relative to the known root.
    const rootPrefix = getRootPrefix();
    return rootPrefix + route;
  }

  function getRootPrefix() {
    // 1. Script tag src attribute provides exact relative path to assets/
    const scriptEl = document.currentScript || document.querySelector('script[src*="navigation.js"]');
    if (scriptEl) {
      const src = scriptEl.getAttribute('src') || '';
      const idx = src.indexOf('assets/');
      if (idx !== -1) {
        return src.substring(0, idx);
      }
    }

    // 2. Relative path based on directory depth in project structure
    const path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
    if (path.includes('/pages/modules/') || path.includes('/pages/tools/')) {
      return '../../../';
    }
    if (path.includes('/pages/')) {
      return '../';
    }
    return '';
  }

  /* ── Nav HTML Template ───────────────────────────────────
     Generates the full navbar HTML. Active page is set by
     matching data-page attribute set on <body>.
  ─────────────────────────────────────────────────────────── */
  function buildNavHTML(root) {
    const r = (key) => root + ROUTES[key];

    return `
<nav class="navbar navbar-expand-lg sn-navbar" id="sn-main-nav" aria-label="Main navigation">
  <div class="container-fluid px-3 px-lg-4">

    <!-- Brand -->
    <a class="navbar-brand" href="${r('dashboard')}" id="nav-brand">
      <div class="brand-icon" aria-hidden="true">🌐</div>
      <div>
        <div style="font-size:0.78rem;font-weight:800;letter-spacing:-0.01em;line-height:1;">SMARTNET</div>
        <div style="font-size:0.62rem;font-weight:400;color:var(--text-muted);line-height:1.2;">Network Analyzer</div>
      </div>
    </a>

    <!-- Toggler -->
    <button class="navbar-toggler" type="button"
            data-bs-toggle="collapse" data-bs-target="#snNavCollapse"
            aria-controls="snNavCollapse" aria-expanded="false"
            aria-label="Toggle navigation" id="nav-toggler">
      <span class="navbar-toggler-icon"></span>
    </button>

    <!-- Links -->
    <div class="collapse navbar-collapse" id="snNavCollapse">
      <ul class="navbar-nav me-auto mb-2 mb-lg-0 ms-lg-3 gap-1">

        <!-- Dashboard -->
        <li class="nav-item">
          <a class="nav-link" href="${r('dashboard')}"
             data-nav-key="dashboard" id="nav-link-dashboard"
             aria-label="Go to Dashboard">
            <span>📊</span> Dashboard
          </a>
        </li>

        <!-- Topology -->
        <li class="nav-item">
          <a class="nav-link" href="${r('topology')}"
             data-nav-key="topology" id="nav-link-topology"
             aria-label="View Network Topology">
            <span>🗺️</span> Topology
          </a>
        </li>

        <!-- Simulations dropdown -->
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#"
             id="nav-link-simulations" role="button"
             data-bs-toggle="dropdown" aria-expanded="false"
             data-nav-key="simulations">
            <span>⚗️</span> Simulations
          </a>
          <ul class="dropdown-menu" aria-labelledby="nav-link-simulations">
            <li><a class="dropdown-item" href="${r('framing')}"       data-nav-key="framing"        id="nav-item-framing">📦 Framing</a></li>
            <li><a class="dropdown-item" href="${r('crc')}"           data-nav-key="crc"            id="nav-item-crc">🔁 CRC Simulation</a></li>
            <li><a class="dropdown-item" href="${r('slidingWindow')}" data-nav-key="slidingWindow"  id="nav-item-sliding-window">🪟 Sliding Window</a></li>
            <li><a class="dropdown-item" href="${r('goBackN')}"       data-nav-key="goBackN"        id="nav-item-go-back-n">↩️ Go-Back-N</a></li>
            <li><hr class="dropdown-divider" style="border-color:var(--border-color)"></li>
            <li><a class="dropdown-item" href="${r('dijkstra')}"      data-nav-key="dijkstra"       id="nav-item-dijkstra">🗺️ Dijkstra</a></li>
            <li><a class="dropdown-item" href="${r('distanceVector')}" data-nav-key="distanceVector" id="nav-item-distance-vector">📡 Distance Vector</a></li>
            <li><a class="dropdown-item" href="${r('broadcastTree')}" data-nav-key="broadcastTree"  id="nav-item-broadcast-tree">🌳 Broadcast Tree</a></li>
            <li><hr class="dropdown-divider" style="border-color:var(--border-color)"></li>
            <li><a class="dropdown-item" href="${r('encryption')}"    data-nav-key="encryption"     id="nav-item-encryption">🔒 Encryption</a></li>
            <li><a class="dropdown-item" href="${r('leakyBucket')}"   data-nav-key="leakyBucket"    id="nav-item-leaky-bucket">🪣 Leaky Bucket</a></li>
          </ul>
        </li>

        <!-- Analysis Tools dropdown -->
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#"
             id="nav-link-analysis" role="button"
             data-bs-toggle="dropdown" aria-expanded="false"
             data-nav-key="analysis">
            <span>🔬</span> Analysis Tools
          </a>
          <ul class="dropdown-menu" aria-labelledby="nav-link-analysis">
            <li><a class="dropdown-item" href="${r('wireshark')}" data-nav-key="wireshark" id="nav-item-wireshark">🦈 Wireshark</a></li>
            <li><a class="dropdown-item" href="${r('nmap')}"      data-nav-key="nmap"      id="nav-item-nmap">🔍 Nmap</a></li>
            <li><a class="dropdown-item" href="${r('ns2')}"       data-nav-key="ns2"       id="nav-item-ns2">📈 NS2</a></li>
          </ul>
        </li>

        <!-- Results -->
        <li class="nav-item">
          <a class="nav-link" href="${r('results')}"
             data-nav-key="results" id="nav-link-results"
             aria-label="View Results">
            <span>📋</span> Results
          </a>
        </li>

        <!-- About -->
        <li class="nav-item">
          <a class="nav-link" href="${r('about')}"
             data-nav-key="about" id="nav-link-about"
             aria-label="About this project">
            <span>ℹ️</span> About
          </a>
        </li>

      </ul>

      <!-- Right side status -->
      <div class="d-flex align-items-center gap-2">
        <span class="sn-badge success">
          <span class="status-dot"></span> System Online
        </span>
      </div>
    </div>
  </div>
</nav>`;
  }

  /* ── Active State ────────────────────────────────────────── */
  function setActiveLink() {
    const pageKey = document.body.dataset.page || '';
    const links = document.querySelectorAll('[data-nav-key]');
    links.forEach(link => {
      link.classList.remove('active');
      if (link.dataset.navKey === pageKey) {
        link.classList.add('active');
        // Also mark parent dropdown as active
        const parentDropdown = link.closest('.dropdown');
        if (parentDropdown) {
          const toggle = parentDropdown.querySelector('.dropdown-toggle');
          if (toggle) toggle.classList.add('active');
        }
      }
    });
  }

  /* ── Public API ──────────────────────────────────────────── */
  function init(containerId) {
    const container = document.getElementById(containerId || 'sn-nav-container');
    if (!container) {
      console.warn('[SMARTNET.Navigation] Container not found. Pass a valid container ID or add <div id="sn-nav-container"></div>.');
      return;
    }
    const root = getRootPrefix();
    container.innerHTML = buildNavHTML(root);
    setActiveLink();

    // Ensure dropdowns toggle reliably across environments
    container.querySelectorAll('.dropdown-toggle').forEach(toggle => {
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        const menu = this.nextElementSibling;
        if (menu && menu.classList.contains('dropdown-menu')) {
          const isOpen = menu.classList.contains('show');
          // Close other open menus
          container.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
          container.querySelectorAll('.dropdown-toggle.show').forEach(t => {
            t.classList.remove('show');
            t.setAttribute('aria-expanded', 'false');
          });
          if (!isOpen) {
            menu.classList.add('show');
            this.classList.add('show');
            this.setAttribute('aria-expanded', 'true');
          }
        }
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.dropdown')) {
        container.querySelectorAll('.dropdown-menu.show').forEach(m => m.classList.remove('show'));
        container.querySelectorAll('.dropdown-toggle.show').forEach(t => {
          t.classList.remove('show');
          t.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  return {
    init,
    ROUTES,
    resolveRoute,
    getRootPrefix,
  };

}());

window.SMARTNET = SMARTNET;
