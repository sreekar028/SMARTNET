/**
 * SMARTNET — integration.js
 * Central integration layer connecting the Dashboard with all modules.
 *
 * Purpose:
 *   - Loads topology data from data/topology.json
 *   - Loads/saves simulation results from data/simulation-results.json
 *   - Broadcasts events between the Dashboard and individual modules
 *   - Provides a shared API that any module can use
 *
 * Usage (from any module):
 *   SMARTNET.Integration.getResults()     → returns stored results array
 *   SMARTNET.Integration.saveResult(obj) → persists a new result
 *   SMARTNET.Integration.getTopology()   → returns topology data
 *   SMARTNET.Integration.onResult(fn)    → subscribe to new results
 */

const SMARTNET = window.SMARTNET || {};

SMARTNET.Integration = (function () {
  'use strict';

  /* ── Internal State ──────────────────────────────────────── */
  let _topology = null;
  let _results  = [];
  const _listeners = [];

  /* ── Storage Key (localStorage fallback) ─────────────────── */
  const STORAGE_KEY_RESULTS  = 'smartnet_results';
  const STORAGE_KEY_TOPOLOGY = 'smartnet_topology';

  /* ── Resolve root-relative paths ─────────────────────────── */
  function _rootPath(relativePath) {
    const root = (window.SMARTNET && window.SMARTNET.Navigation)
      ? window.SMARTNET.Navigation.getRootPrefix()
      : '';
    return root + relativePath;
  }

  /* ── Topology ─────────────────────────────────────────────
     Load topology.json once and cache it.
  ─────────────────────────────────────────────────────────── */
  async function getTopology() {
    if (_topology) return _topology;

    // Try localStorage cache first (for offline/file:// use)
    try {
      const cached = localStorage.getItem(STORAGE_KEY_TOPOLOGY);
      if (cached) {
        _topology = JSON.parse(cached);
        return _topology;
      }
    } catch (_) { /* ignore */ }

    // Try fetching from file
    try {
      const res = await fetch(_rootPath('data/topology.json'));
      if (!res.ok) throw new Error('Fetch failed');
      _topology = await res.json();
      try { localStorage.setItem(STORAGE_KEY_TOPOLOGY, JSON.stringify(_topology)); } catch(_) {}
      return _topology;
    } catch (e) {
      console.warn('[SMARTNET.Integration] Could not load topology.json:', e.message);
      // Return minimal built-in fallback so pages don't break
      _topology = _fallbackTopology();
      return _topology;
    }
  }

  function _fallbackTopology() {
    return {
      topology: {
        name: 'SMARTNET Common Topology',
        nodes: [
          { id: 'SERVER', label: 'Server', type: 'server',  x: 400, y: 30  },
          { id: 'R3',     label: 'R3',     type: 'router',  x: 400, y: 120 },
          { id: 'R1',     label: 'R1',     type: 'router',  x: 220, y: 220 },
          { id: 'R2',     label: 'R2',     type: 'router',  x: 580, y: 220 },
          { id: 'PC1',    label: 'PC1',    type: 'host',    x: 100, y: 330 },
          { id: 'PC2',    label: 'PC2',    type: 'host',    x: 280, y: 330 },
          { id: 'PC3',    label: 'PC3',    type: 'host',    x: 460, y: 330 },
          { id: 'PC4',    label: 'PC4',    type: 'host',    x: 640, y: 330 },
        ],
        links: [
          { source: 'SERVER', target: 'R3',  bandwidth: '1Gbps',   cost: 1 },
          { source: 'R3',     target: 'R1',  bandwidth: '100Mbps', cost: 2 },
          { source: 'R3',     target: 'R2',  bandwidth: '100Mbps', cost: 2 },
          { source: 'R1',     target: 'PC1', bandwidth: '10Mbps',  cost: 1 },
          { source: 'R1',     target: 'PC2', bandwidth: '10Mbps',  cost: 1 },
          { source: 'R2',     target: 'PC3', bandwidth: '10Mbps',  cost: 1 },
          { source: 'R2',     target: 'PC4', bandwidth: '10Mbps',  cost: 1 },
        ],
        stats: { totalNodes: 8, routers: 3, hosts: 4, servers: 1, totalLinks: 7 },
      },
    };
  }

  /* ── Results ──────────────────────────────────────────────
     Results are stored in localStorage so they persist across
     page navigations without a backend.
     Any module can save a result and the Dashboard will reflect it.
  ─────────────────────────────────────────────────────────── */
  function _loadResults() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RESULTS);
      _results = stored ? JSON.parse(stored) : [];
    } catch (_) {
      _results = [];
    }
    return _results;
  }

  function _saveResults() {
    try {
      localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(_results));
    } catch (_) { /* storage full or unavailable */ }
  }

  function getResults() {
    return _loadResults();
  }

  /**
   * Save a simulation/analysis result.
   * Schema: { experiment, module, status, metrics:{}, timestamp }
   * @param {object} result
   */
  function saveResult(result) {
    if (!result || typeof result !== 'object') {
      console.error('[SMARTNET.Integration] saveResult: invalid result object');
      return;
    }
    _loadResults();
    const entry = Object.assign({
      experiment: 'Unknown',
      module:     'unknown',
      status:     'Completed',
      metrics:    {},
      timestamp:  new Date().toISOString(),
    }, result);

    // Insert at front (newest first)
    _results.unshift(entry);

    // Cap at 50 entries
    if (_results.length > 50) _results = _results.slice(0, 50);

    _saveResults();

    // Notify subscribers
    _listeners.forEach(fn => { try { fn(entry, _results); } catch(_) {} });

    return entry;
  }

  /**
   * Clear all stored results.
   */
  function clearResults() {
    _results = [];
    _saveResults();
  }

  /**
   * Subscribe to new result events.
   * @param {function} fn  Called with (newResult, allResults)
   */
  function onResult(fn) {
    if (typeof fn === 'function') _listeners.push(fn);
  }

  /* ── Module Registry ──────────────────────────────────────
     Modules can register themselves here so the Dashboard
     can discover their status dynamically.
  ─────────────────────────────────────────────────────────── */
  const _moduleRegistry = {};

  /**
   * Register a module (called by each module's own JS).
   * @param {string} key      e.g. 'crc'
   * @param {object} meta     { label, status, route, member }
   */
  function registerModule(key, meta) {
    _moduleRegistry[key] = Object.assign({ label: key, status: 'ready', member: '' }, meta);
    console.log(`[SMARTNET.Integration] Module registered: ${key}`);
  }

  function getModules() {
    return Object.assign({}, _moduleRegistry);
  }

  /* ── Event Bus ────────────────────────────────────────────
     Lightweight publish/subscribe for cross-module communication.
  ─────────────────────────────────────────────────────────── */
  const _bus = {};

  function emit(event, data) {
    (_bus[event] || []).forEach(fn => { try { fn(data); } catch(_) {} });
  }

  function on(event, fn) {
    if (!_bus[event]) _bus[event] = [];
    _bus[event].push(fn);
  }

  function off(event, fn) {
    if (!_bus[event]) return;
    _bus[event] = _bus[event].filter(f => f !== fn);
  }

  /* ── Init ─────────────────────────────────────────────────
     Called once per page load.
  ─────────────────────────────────────────────────────────── */
  function init() {
    _loadResults();
    console.log('[SMARTNET.Integration] Integration layer initialized.');
    emit('integration:ready', { results: _results });
  }

  /* ── Public API ──────────────────────────────────────────── */
  return {
    init,
    getTopology,
    getResults,
    saveResult,
    clearResults,
    onResult,
    registerModule,
    getModules,
    emit,
    on,
    off,
  };

}());

window.SMARTNET = SMARTNET;
