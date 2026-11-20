/**
 * SMARTNET — modules/sliding-window.js
 * Sliding Window Protocol Simulation (Member 3)
 *
 * Implements:
 *   - Flow Control with finite sender window (W)
 *   - Pipelined frame transmissions
 *   - Selective ACK processing and sender window advancement
 *   - Channel propagation animation
 *   - Real-time utilization calculation & event log
 *   - SMARTNET Integration & Results Center persistence
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ── 1. Boot Shared Layers ──────────────────────────────── */
  SMARTNET.Navigation.init('sn-nav-container');
  SMARTNET.Integration.init();

  SMARTNET.Integration.registerModule('slidingWindow', {
    label: 'Sliding Window',
    status: 'ready',
    member: '',
  });

  /* ── 2. DOM Elements ────────────────────────────────────── */
  const senderSelect   = document.getElementById('sw-sender-select');
  const receiverSelect = document.getElementById('sw-receiver-select');
  const totalFramesIn  = document.getElementById('sw-total-frames');
  const windowSizeIn   = document.getElementById('sw-window-size');
  const speedSelect    = document.getElementById('sw-speed-select');
  const valFramesEl    = document.getElementById('sw-val-frames');
  const valWindowEl    = document.getElementById('sw-val-window');

  const btnStart       = document.getElementById('btn-sw-start');
  const btnStep        = document.getElementById('btn-sw-step');
  const btnReset       = document.getElementById('btn-sw-reset');
  const btnClearLog    = document.getElementById('btn-sw-clear-log');

  const statusBadge    = document.getElementById('sw-status-badge');
  const validationAlert= document.getElementById('sw-validation-alert');
  const frameTrack     = document.getElementById('sw-frame-track');
  const flightLayer    = document.getElementById('sw-flight-layer');
  const logBox         = document.getElementById('sw-log-box');
  const senderNameEl   = document.getElementById('sw-sender-name');
  const receiverNameEl = document.getElementById('sw-receiver-name');

  // Metrics
  const mWindow = document.getElementById('m-sw-window');
  const mSent   = document.getElementById('m-sw-sent');
  const mAcked  = document.getElementById('m-sw-acked');
  const mUtil   = document.getElementById('m-sw-util');
  const mState  = document.getElementById('m-sw-state');

  /* ── 3. Simulation State ─────────────────────────────────── */
  let totalFrames = parseInt(totalFramesIn.value, 10) || 8;
  let windowSize  = parseInt(windowSizeIn.value, 10) || 4;
  let base        = 0;  // Oldest unacknowledged frame
  let nextSeqNum  = 0;  // Next frame to transmit
  let frames      = []; // Array of { seq, status: 'waiting'|'in-flight'|'acked' }

  let isRunning   = false;
  let isPaused    = false;
  let timerId     = null;
  let startTime   = null;
  let currentRunId = 0; // Generation token to cancel stale animations on reset/re-run

  /* ── 4. Validation ──────────────────────────────────────── */
  function showValidationError(msg) {
    if (validationAlert) {
      validationAlert.textContent = msg;
      validationAlert.classList.remove('d-none');
    }
    statusBadge.textContent = 'Validation Error';
    statusBadge.className = 'sn-badge danger';
    mState.textContent = 'ERROR';
    logEvent(`⚠️ <span class="text-danger">Validation Error: ${msg}</span>`);
  }

  function clearValidationError() {
    if (validationAlert) {
      validationAlert.textContent = '';
      validationAlert.classList.add('d-none');
    }
    totalFramesIn.classList.remove('is-invalid');
    windowSizeIn.classList.remove('is-invalid');
  }

  function validateInputs() {
    clearValidationError();
    const s = senderSelect.value;
    const r = receiverSelect.value;
    if (s === r) {
      showValidationError(`Sender and Receiver cannot both be "${s}".`);
      return false;
    }

    const rawTf = totalFramesIn.value.trim();
    if (rawTf === '' || isNaN(rawTf)) {
      totalFramesIn.classList.add('is-invalid');
      showValidationError('Total frames is required and must be an integer between 4 and 16.');
      return false;
    }
    const tf = Number(rawTf);
    if (!Number.isInteger(tf) || tf < 4 || tf > 16) {
      totalFramesIn.classList.add('is-invalid');
      showValidationError('Total frames must be an integer between 4 and 16.');
      return false;
    }

    const rawWin = windowSizeIn.value.trim();
    if (rawWin === '' || isNaN(rawWin)) {
      windowSizeIn.classList.add('is-invalid');
      showValidationError('Window size is required and must be an integer between 1 and 8.');
      return false;
    }
    const win = Number(rawWin);
    if (!Number.isInteger(win) || win < 1 || win > 8) {
      windowSizeIn.classList.add('is-invalid');
      showValidationError('Window size must be an integer between 1 and 8.');
      return false;
    }

    if (win > tf) {
      windowSizeIn.classList.add('is-invalid');
      showValidationError(`Window size (${win}) cannot exceed total frames (${tf}).`);
      return false;
    }

    return true;
  }

  /* ── 5. Initialization & Render ─────────────────────────── */
  function initSimulation() {
    currentRunId++; // Invalidate any scheduled flight callbacks from previous runs
    clearTimeout(timerId);
    timerId = null;
    isRunning = false;
    isPaused = false;
    startTime = Date.now();

    const tfParsed = parseInt(totalFramesIn.value, 10);
    totalFrames = isNaN(tfParsed) ? 8 : Math.max(4, Math.min(16, tfParsed));
    const winParsed = parseInt(windowSizeIn.value, 10);
    windowSize = isNaN(winParsed) ? 4 : Math.max(1, Math.min(8, Math.min(winParsed, totalFrames)));

    valFramesEl.textContent = totalFrames;
    valWindowEl.textContent = windowSize;

    base = 0;
    nextSeqNum = 0;

    frames = [];
    for (let i = 0; i < totalFrames; i++) {
      frames.push({ seq: i, status: 'waiting' });
    }

    senderNameEl.textContent = senderSelect.value;
    receiverNameEl.textContent = receiverSelect.value;
    btnStart.textContent = '▶ Start';
    btnStart.disabled = false;
    statusBadge.textContent = 'Ready';
    statusBadge.className = 'sn-badge muted';
    mState.textContent = 'READY';

    flightLayer.innerHTML = '';
    renderFrameTrack();
    updateMetrics();
  }

  function renderFrameTrack() {
    frameTrack.innerHTML = '';
    frames.forEach((f, idx) => {
      const card = document.createElement('div');
      card.className = 'sw-frame-card';

      const inWindow = idx >= base && idx < base + windowSize;
      if (inWindow && f.status === 'waiting') {
        card.classList.add('in-window');
      } else if (f.status === 'in-flight') {
        card.classList.add('in-flight');
      } else if (f.status === 'acked') {
        card.classList.add('acked');
      }

      card.innerHTML = `
        <div style="font-size:0.7rem;color:var(--text-muted);">Frame</div>
        <div style="font-size:1.1rem;font-weight:700;">#${f.seq}</div>
        <div class="sw-window-indicator ${inWindow ? 'text-primary' : 'text-muted'}" style="font-size:0.65rem;">
          ${f.status.toUpperCase()}
        </div>
      `;
      frameTrack.appendChild(card);
    });
  }

  function updateMetrics() {
    const endWindow = Math.min(base + windowSize - 1, totalFrames - 1);
    mWindow.textContent = `[${base}, ${Math.max(base, endWindow)}]`;
    mSent.textContent   = `${nextSeqNum} / ${totalFrames}`;
    const ackedCount = frames.filter(f => f.status === 'acked').length;
    mAcked.textContent  = `${ackedCount} / ${totalFrames}`;

    // Efficiency: W / (1 + 2a), assuming propagation factor a ~ 1.5
    const a = 1.2;
    const theoretical = Math.min(100, Math.round((windowSize / (1 + 2 * a)) * 100));
    mUtil.textContent   = `${theoretical}%`;
  }

  function logEvent(text) {
    const elapsed = ((Date.now() - (startTime || Date.now())) / 1000).toFixed(1);
    const div = document.createElement('div');
    div.className = 'sw-log-entry';
    div.innerHTML = `<span class="sw-log-time">+${elapsed}s</span> <span>${text}</span>`;
    logBox.appendChild(div);
    logBox.scrollTop = logBox.scrollHeight;
  }

  /* ── 6. Protocol Engine ─────────────────────────────────── */
  function stepSimulation() {
    const runId = currentRunId;

    if (base >= totalFrames) {
      completeSimulation();
      return;
    }

    const speed = parseInt(speedSelect.value, 10);

    // Can we send a new frame in current window?
    if (nextSeqNum < base + windowSize && nextSeqNum < totalFrames) {
      const frameIndex = nextSeqNum;
      frames[frameIndex].status = 'in-flight';
      renderFrameTrack();
      updateMetrics();

      logEvent(`Sender transmitted <strong>Frame #${frameIndex}</strong> (Window [${base}, ${base + windowSize - 1}])`);
      animateFlight(frameIndex, 'frame', speed, () => {
        if (runId !== currentRunId) return;
        // Frame received at destination
        logEvent(`Receiver accepted <strong>Frame #${frameIndex}</strong>. Generating ACK #${frameIndex}...`);
        animateFlight(frameIndex, 'ack', speed, () => {
          if (runId !== currentRunId) return;
          // ACK received by sender
          frames[frameIndex].status = 'acked';
          logEvent(`Sender received <strong>ACK #${frameIndex}</strong>.`);

          // Slide window forward if ACK matches base
          while (base < totalFrames && frames[base].status === 'acked') {
            logEvent(`Window advanced forward: base moved from ${base} to ${base + 1}`);
            base++;
          }

          renderFrameTrack();
          updateMetrics();

          if (base >= totalFrames) {
            completeSimulation();
          }
        });
      });

      nextSeqNum++;
    }

    if (isRunning && !isPaused && base < totalFrames) {
      clearTimeout(timerId);
      timerId = setTimeout(() => {
        if (runId === currentRunId) {
          stepSimulation();
        }
      }, speed);
    }
  }

  function animateFlight(frameSeq, type, duration, onComplete) {
    const runId = currentRunId;
    const el = document.createElement('div');
    el.className = `sw-transit-item ${type === 'frame' ? 'sw-transit-frame' : 'sw-transit-ack'}`;
    el.innerHTML = type === 'frame' ? `📦 Frame #${frameSeq} ➔` : `✓ ACK #${frameSeq} ⬅`;

    const isFrame = type === 'frame';
    el.style.left = isFrame ? '5%' : '80%';
    el.style.top = isFrame ? '12px' : '36px';
    flightLayer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transition = `left ${duration * 0.8}ms ease-in-out, opacity 0.3s ease`;
      el.style.left = isFrame ? '80%' : '5%';
    });

    setTimeout(() => {
      if (runId !== currentRunId) {
        if (el.parentNode) el.parentNode.removeChild(el);
        return;
      }
      el.style.opacity = '0';
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (runId === currentRunId && onComplete) onComplete();
      }, 300);
    }, duration * 0.8);
  }

  function completeSimulation() {
    isRunning = false;
    isPaused = false;
    clearTimeout(timerId);
    timerId = null;

    btnStart.textContent = '▶ Start';
    btnStart.disabled = false;
    statusBadge.textContent = 'Completed';
    statusBadge.className = 'sn-badge success';
    mState.textContent = 'COMPLETED';
    logEvent(`🎉 <strong>Simulation Finished</strong>: All ${totalFrames} frames transmitted and acknowledged!`);

    // Persist result in Results Center
    SMARTNET.Integration.saveResult({
      experiment: 'Sliding Window',
      module: 'slidingWindow',
      status: 'Completed',
      metrics: {
        sender: senderSelect.value,
        receiver: receiverSelect.value,
        totalFrames: totalFrames,
        windowSize: windowSize,
        utilization: mUtil.textContent,
        allFramesDelivered: true,
      },
      timestamp: new Date().toISOString()
    });
  }

  /* ── 7. Event Handlers ──────────────────────────────────── */
  btnStart.addEventListener('click', function () {
    if (!validateInputs()) return;

    if (base >= totalFrames) {
      initSimulation();
    }

    if (!isRunning) {
      isRunning = true;
      isPaused = false;
      btnStart.textContent = '⏸ Pause';
      statusBadge.textContent = 'Running';
      statusBadge.className = 'sn-badge primary';
      mState.textContent = 'TRANSMITTING';
      logEvent('Simulation started.');
      stepSimulation();
    } else if (isPaused) {
      isPaused = false;
      btnStart.textContent = '⏸ Pause';
      statusBadge.textContent = 'Running';
      statusBadge.className = 'sn-badge primary';
      mState.textContent = 'RESUMED';
      logEvent('Simulation resumed.');
      stepSimulation();
    } else {
      isPaused = true;
      btnStart.textContent = '▶ Resume';
      statusBadge.textContent = 'Paused';
      statusBadge.className = 'sn-badge warning';
      mState.textContent = 'PAUSED';
      clearTimeout(timerId);
      logEvent('Simulation paused.');
    }
  });

  btnStep.addEventListener('click', function () {
    if (!validateInputs()) return;

    if (base >= totalFrames) {
      initSimulation();
    }
    if (!isRunning) {
      isRunning = true;
      isPaused = true;
      btnStart.textContent = '▶ Resume';
    }
    stepSimulation();
  });

  btnReset.addEventListener('click', function () {
    totalFramesIn.value = '8';
    windowSizeIn.value = '4';
    clearValidationError();
    initSimulation();
    logEvent('Simulation reset to defaults (8 frames, window size 4).');
  });

  btnClearLog.addEventListener('click', function () {
    logBox.innerHTML = '';
  });

  function handleParamChange() {
    if (validateInputs()) {
      valFramesEl.textContent = totalFramesIn.value;
      valWindowEl.textContent = windowSizeIn.value;
      if (!isRunning) initSimulation();
    }
  }

  totalFramesIn.addEventListener('input', handleParamChange);
  totalFramesIn.addEventListener('change', handleParamChange);
  windowSizeIn.addEventListener('input', handleParamChange);
  windowSizeIn.addEventListener('change', handleParamChange);

  senderSelect.addEventListener('change', function () {
    if (validateInputs() && !isRunning) initSimulation();
  });
  receiverSelect.addEventListener('change', function () {
    if (validateInputs() && !isRunning) initSimulation();
  });

  // Initialize on page load
  initSimulation();
});
