/**
 * SMARTNET — modules/framing.js
 * Framing Simulation module (Member 2)
 *
 * Implements three Data Link Layer framing techniques:
 *   1. Character Count
 *   2. Byte Stuffing (with ESC / FLAG delimiters)
 *   3. Bit Stuffing (zero-insertion after five consecutive 1s)
 *
 * Algorithm logic is separated from DOM manipulation.
 * Results are saved via SMARTNET.Integration.saveResult().
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ── 1. Boot shared layers ──────────────────────────────── */
  SMARTNET.Navigation.init('sn-nav-container');
  SMARTNET.Integration.init();

  /* Register this module with the integration layer */
  SMARTNET.Integration.registerModule('framing', {
    label: 'Framing Simulation',
    status: 'ready',
    member: 'Member 2',
  });

  /* ── 2. DOM References ──────────────────────────────────── */
  const dataInput        = document.getElementById('framing-data-input');
  const methodSelect     = document.getElementById('framing-method-select');
  const frameSizeInput   = document.getElementById('framing-frame-size');
  const frameSizeGroup   = document.getElementById('framing-frame-size-group');
  const btnRun           = document.getElementById('btn-run-framing');
  const btnReset         = document.getElementById('btn-reset-framing');
  const dataError        = document.getElementById('framing-data-error');
  const frameSizeError   = document.getElementById('framing-frame-size-error');
  const emptyState       = document.getElementById('framing-empty-state');
  const outputContent    = document.getElementById('framing-output-content');
  const statusBadge      = document.getElementById('framing-status-badge');
  const originalDataEl   = document.getElementById('framing-original-data');
  const legendEl         = document.getElementById('framing-legend');
  const framesContainer  = document.getElementById('framing-frames-container');
  const encodedDataEl    = document.getElementById('framing-encoded-data');
  const resultsCard      = document.getElementById('framing-results-card');
  const methodDescription= document.getElementById('framing-method-description');

  // Results summary cells
  const resStatus   = document.getElementById('res-framing-status');
  const resOriginal = document.getElementById('res-framing-original');
  const resMethod   = document.getElementById('res-framing-method');
  const resCount    = document.getElementById('res-framing-count');
  const resEncoded  = document.getElementById('res-framing-encoded');

  /* ── 3. Method descriptions ─────────────────────────────── */
  const METHOD_INFO = {
    'character-count': '<strong style="color:var(--color-primary);">Character Count:</strong> ' +
      'Each frame starts with a count field indicating the total number of characters in the frame ' +
      '(including the count field itself). The receiver reads the count, extracts that many characters, ' +
      'and repeats for the next frame.',
    'byte-stuffing': '<strong style="color:var(--color-accent);">Byte Stuffing:</strong> ' +
      'Frames are delimited by a special FLAG byte. If the FLAG or ESC byte appears within the data, ' +
      'an ESC byte is inserted before it (stuffing). The receiver removes the escape bytes to recover ' +
      'the original data. This module uses <code>FLAG</code> and <code>ESC</code> as delimiters.',
    'bit-stuffing': '<strong style="color:var(--color-warning);">Bit Stuffing:</strong> ' +
      'Each frame is delimited by the flag pattern <code>01111110</code>. To prevent the flag from ' +
      'appearing in the data, a <code>0</code> is inserted after every sequence of five consecutive ' +
      '<code>1</code>s. The receiver removes the stuffed bits to recover the original data.',
  };

  /* ── 4. UI state management ─────────────────────────────── */
  function updateMethodUI() {
    const method = methodSelect.value;
    // Show frame-size input only for character-count
    frameSizeGroup.style.display = method === 'character-count' ? 'block' : 'none';
    // Update description
    methodDescription.innerHTML = METHOD_INFO[method] || '';
    // Update placeholder
    if (method === 'bit-stuffing') {
      dataInput.placeholder = 'e.g. 101100111010 (binary only)';
    } else {
      dataInput.placeholder = 'e.g. HELLO WORLD or any text';
    }
  }

  methodSelect.addEventListener('change', updateMethodUI);
  updateMethodUI();

  /* ── 5. Validation ──────────────────────────────────────── */
  function clearValidation() {
    dataInput.classList.remove('is-invalid');
    frameSizeInput.classList.remove('is-invalid');
    dataError.textContent = '';
    frameSizeError.textContent = '';
  }

  function validateInput() {
    clearValidation();
    const data = dataInput.value.trim();
    const method = methodSelect.value;
    let valid = true;

    if (!data) {
      dataInput.classList.add('is-invalid');
      dataError.textContent = 'Please enter data before running the simulation.';
      valid = false;
    } else if (method === 'bit-stuffing' && !/^[01]+$/.test(data)) {
      dataInput.classList.add('is-invalid');
      dataError.textContent = 'Bit Stuffing requires binary data (0s and 1s only).';
      valid = false;
    }

    if (method === 'character-count') {
      const size = parseInt(frameSizeInput.value, 10);
      if (isNaN(size) || size < 1) {
        frameSizeInput.classList.add('is-invalid');
        frameSizeError.textContent = 'Frame size must be at least 1.';
        valid = false;
      }
    }

    return valid;
  }

  /* ═══════════════════════════════════════════════════════════
     6. FRAMING ALGORITHMS (pure logic — no DOM)
  ═══════════════════════════════════════════════════════════ */

  /**
   * Character Count framing.
   * Each frame = [count][data chars], where count = data length + 1.
   * @param {string} data  - Input data string
   * @param {number} charsPerFrame - Data characters per frame
   * @returns {{ frames: Array<{count: number, data: string}>, encoded: string }}
   */
  function framingCharacterCount(data, charsPerFrame) {
    const frames = [];
    for (let i = 0; i < data.length; i += charsPerFrame) {
      const chunk = data.substring(i, i + charsPerFrame);
      const count = chunk.length + 1; // count field itself counts
      frames.push({ count: count, data: chunk });
    }
    const encoded = frames.map(f => f.count + f.data).join('');
    return { frames, encoded };
  }

  /**
   * Byte Stuffing framing.
   * FLAG = 'F', ESC = 'E' (symbolic). Data is wrapped in FLAG…FLAG.
   * Any occurrence of FLAG or ESC in data is escaped with ESC.
   * @param {string} data
   * @returns {{ frames: Array<{original: string, stuffed: string, segments: Array}>, encoded: string }}
   */
  function framingByteStuffing(data) {
    // We treat the entire data as a single frame for byte stuffing
    // In practice, data may be split into fixed-size chunks for multiple frames
    const FLAG = 'FLAG';
    const ESC  = 'ESC';

    // Split data into chunks of ~8 chars for better visualization
    const chunkSize = Math.max(4, Math.min(8, Math.ceil(data.length / 3)));
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.substring(i, i + chunkSize));
    }

    const frames = [];
    let fullEncoded = '';

    chunks.forEach(chunk => {
      const segments = [];
      let stuffedContent = '';

      segments.push({ type: 'flag', value: FLAG });

      for (let i = 0; i < chunk.length; i++) {
        const ch = chunk[i];
        // If character matches our FLAG or ESC indicator letters, stuff it
        if (ch === 'F' || ch === 'E') {
          segments.push({ type: 'esc', value: ESC });
          segments.push({ type: 'stuffed', value: ch });
          stuffedContent += ESC + ch;
        } else {
          segments.push({ type: 'data', value: ch });
          stuffedContent += ch;
        }
      }

      segments.push({ type: 'flag', value: FLAG });

      frames.push({
        original: chunk,
        stuffed: FLAG + stuffedContent + FLAG,
        segments: segments,
      });

      fullEncoded += FLAG + stuffedContent + FLAG + ' ';
    });

    return { frames, encoded: fullEncoded.trim() };
  }

  /**
   * Bit Stuffing framing.
   * Flag pattern = 01111110. After every 5 consecutive 1s in data, insert a 0.
   * @param {string} data - Binary string (0s and 1s)
   * @returns {{ frames: Array<{original: string, stuffed: string, segments: Array}>, encoded: string }}
   */
  function framingBitStuffing(data) {
    const FLAG = '01111110';

    // Split data into chunks for multiple frames
    const chunkSize = Math.max(8, Math.min(16, Math.ceil(data.length / 3)));
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.substring(i, i + chunkSize));
    }

    const frames = [];
    let fullEncoded = '';

    chunks.forEach(chunk => {
      const stuffResult = bitStuffData(chunk);
      const segments = [];

      segments.push({ type: 'flag', value: FLAG });

      // Build segments marking stuffed bits
      let idx = 0;
      for (let i = 0; i < stuffResult.output.length; i++) {
        if (stuffResult.stuffedPositions.includes(i)) {
          segments.push({ type: 'stuffed', value: '0' });
        } else {
          segments.push({ type: 'data', value: stuffResult.output[i] });
          idx++;
        }
      }

      segments.push({ type: 'flag', value: FLAG });

      frames.push({
        original: chunk,
        stuffed: FLAG + stuffResult.output + FLAG,
        segments: segments,
      });

      fullEncoded += FLAG + stuffResult.output + FLAG + ' ';
    });

    return { frames, encoded: fullEncoded.trim() };
  }

  /**
   * Core bit-stuffing algorithm: insert 0 after five consecutive 1s.
   * @param {string} bits - Binary string
   * @returns {{ output: string, stuffedPositions: number[] }}
   */
  function bitStuffData(bits) {
    let output = '';
    let consecutiveOnes = 0;
    const stuffedPositions = [];

    for (let i = 0; i < bits.length; i++) {
      output += bits[i];
      if (bits[i] === '1') {
        consecutiveOnes++;
        if (consecutiveOnes === 5) {
          stuffedPositions.push(output.length);
          output += '0'; // stuff a zero
          consecutiveOnes = 0;
        }
      } else {
        consecutiveOnes = 0;
      }
    }

    return { output, stuffedPositions };
  }

  /**
   * Dispatch to the correct framing method.
   * @param {string} data
   * @param {string} method
   * @param {number} frameSize
   * @returns {object} result with frames and encoded string
   */
  function applyFraming(data, method, frameSize) {
    switch (method) {
      case 'character-count':
        return framingCharacterCount(data, frameSize);
      case 'byte-stuffing':
        return framingByteStuffing(data);
      case 'bit-stuffing':
        return framingBitStuffing(data);
      default:
        throw new Error('Unknown framing method: ' + method);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     7. VISUALIZATION (DOM rendering)
  ═══════════════════════════════════════════════════════════ */

  function renderLegend(method) {
    let html = '';
    if (method === 'character-count') {
      html = `
        <div class="framing-legend-item"><div class="legend-swatch" style="background:rgba(79,142,247,0.4);"></div> Count Field</div>
        <div class="framing-legend-item"><div class="legend-swatch" style="background:rgba(6,214,160,0.3);"></div> Data</div>
      `;
    } else if (method === 'byte-stuffing') {
      html = `
        <div class="framing-legend-item"><div class="legend-swatch" style="background:rgba(245,158,11,0.4);"></div> FLAG</div>
        <div class="framing-legend-item"><div class="legend-swatch" style="background:rgba(6,214,160,0.3);"></div> Data</div>
        <div class="framing-legend-item"><div class="legend-swatch" style="background:rgba(168,85,247,0.4);"></div> ESC</div>
        <div class="framing-legend-item"><div class="legend-swatch" style="background:rgba(239,68,68,0.3);"></div> Stuffed</div>
      `;
    } else if (method === 'bit-stuffing') {
      html = `
        <div class="framing-legend-item"><div class="legend-swatch" style="background:rgba(245,158,11,0.4);"></div> Flag (01111110)</div>
        <div class="framing-legend-item"><div class="legend-swatch" style="background:rgba(6,214,160,0.3);"></div> Data</div>
        <div class="framing-legend-item"><div class="legend-swatch" style="background:rgba(239,68,68,0.3);"></div> Stuffed Bit</div>
      `;
    }
    legendEl.innerHTML = html;
  }

  function renderFramesCharacterCount(result) {
    let html = '';
    result.frames.forEach(function (frame, i) {
      html += `
        <div class="framing-frame-block">
          <div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">
            Frame ${i + 1}
          </div>
          <div class="framing-frame-diagram">
            <div class="frame-segment frame-seg-header" title="Count field: ${frame.count}">${frame.count}</div>
            <div class="frame-segment frame-seg-data" title="Data: ${escHtml(frame.data)}">${escHtml(frame.data)}</div>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:6px;font-family:var(--font-mono);">
            Encoded: <span style="color:var(--color-primary);">${frame.count}</span><span style="color:var(--color-accent);">${escHtml(frame.data)}</span>
          </div>
        </div>`;
    });
    framesContainer.innerHTML = html;
  }

  function renderFramesByteStuffing(result) {
    let html = '';
    result.frames.forEach(function (frame, i) {
      let segHtml = '';
      frame.segments.forEach(function (seg) {
        const cls = seg.type === 'flag' ? 'frame-seg-flag'
                  : seg.type === 'esc'  ? 'frame-seg-esc'
                  : seg.type === 'stuffed' ? 'frame-seg-stuffed'
                  : 'frame-seg-data';
        const label = seg.type === 'flag' ? 'FLAG'
                    : seg.type === 'esc' ? 'ESC'
                    : seg.type === 'stuffed' ? seg.value + ' (stuffed)'
                    : seg.value;
        segHtml += `<div class="frame-segment ${cls}" title="${escHtml(label)}">${escHtml(seg.value)}</div>`;
      });

      html += `
        <div class="framing-frame-block">
          <div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">
            Frame ${i + 1}
          </div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:8px;font-family:var(--font-mono);">
            Original: <span style="color:var(--text-primary);">${escHtml(frame.original)}</span>
          </div>
          <div class="framing-frame-diagram">${segHtml}</div>
        </div>`;
    });
    framesContainer.innerHTML = html;
  }

  function renderFramesBitStuffing(result) {
    let html = '';
    result.frames.forEach(function (frame, i) {
      let segHtml = '';
      frame.segments.forEach(function (seg) {
        const cls = seg.type === 'flag' ? 'frame-seg-flag'
                  : seg.type === 'stuffed' ? 'frame-seg-stuffed'
                  : 'frame-seg-data';
        const title = seg.type === 'flag' ? 'Flag pattern'
                    : seg.type === 'stuffed' ? 'Stuffed 0'
                    : 'Data bit';
        segHtml += `<div class="frame-segment ${cls}" title="${title}" style="min-width:28px;padding:8px 6px;">${seg.value}</div>`;
      });

      html += `
        <div class="framing-frame-block">
          <div style="font-size:0.72rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">
            Frame ${i + 1}
          </div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:8px;font-family:var(--font-mono);">
            Original: <span style="color:var(--text-primary);">${frame.original}</span>
          </div>
          <div class="framing-frame-diagram" style="gap:1px;">${segHtml}</div>
        </div>`;
    });
    framesContainer.innerHTML = html;
  }

  function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ═══════════════════════════════════════════════════════════
     8. MAIN SIMULATION HANDLER
  ═══════════════════════════════════════════════════════════ */

  function runSimulation() {
    if (!validateInput()) return;

    const data = dataInput.value.trim();
    const method = methodSelect.value;
    const frameSize = parseInt(frameSizeInput.value, 10) || 4;

    // Run algorithm
    const result = applyFraming(data, method, frameSize);

    // Update UI
    emptyState.style.display = 'none';
    outputContent.style.display = 'block';
    resultsCard.style.display = 'block';

    statusBadge.textContent = 'Completed';
    statusBadge.className = 'sn-badge success';

    originalDataEl.textContent = data;
    encodedDataEl.textContent = result.encoded;

    // Render legend
    renderLegend(method);

    // Render frames based on method
    if (method === 'character-count') {
      renderFramesCharacterCount(result);
    } else if (method === 'byte-stuffing') {
      renderFramesByteStuffing(result);
    } else if (method === 'bit-stuffing') {
      renderFramesBitStuffing(result);
    }

    // Populate results summary table
    const methodLabel = methodSelect.options[methodSelect.selectedIndex].text;
    resStatus.innerHTML = '<span class="sn-badge success">Simulation Completed</span>';
    resOriginal.textContent = data;
    resMethod.textContent = methodLabel;
    resCount.textContent = result.frames.length;
    resEncoded.textContent = result.encoded;

    // Save result to integration layer
    SMARTNET.Integration.saveResult({
      experiment: 'Framing Simulation',
      module: 'framing',
      status: 'Completed',
      metrics: {
        method: methodLabel,
        inputLength: data.length,
        frameCount: result.frames.length,
        framedData: result.encoded,
      },
    });
  }

  /* ── 9. Reset ───────────────────────────────────────────── */
  function resetSimulation() {
    clearValidation();
    dataInput.value = '';
    frameSizeInput.value = '4';
    emptyState.style.display = 'block';
    outputContent.style.display = 'none';
    resultsCard.style.display = 'none';
    statusBadge.textContent = 'Waiting';
    statusBadge.className = 'sn-badge muted';
    framesContainer.innerHTML = '';
    originalDataEl.textContent = '';
    encodedDataEl.textContent = '';
  }

  /* ── 10. Event listeners ────────────────────────────────── */
  btnRun.addEventListener('click', runSimulation);
  btnReset.addEventListener('click', resetSimulation);

  // Allow Enter key to run
  dataInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSimulation();
    }
  });

  // Clear validation on input change
  dataInput.addEventListener('input', clearValidation);
  frameSizeInput.addEventListener('input', clearValidation);

  // Back to Dashboard navigation handler
  const btnBack = document.getElementById('btn-back-dashboard') || document.getElementById('btn-back-simulations');
  if (btnBack) {
    btnBack.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = '../../dashboard.html';
    });
  }

});
