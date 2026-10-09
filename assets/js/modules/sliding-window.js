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
    member: 'Member 3',
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
  let totalFrames = parseInt(totalFramesIn.value, 10);
  let windowSize  = parseInt(windowSizeIn.value, 10);
  let base        = 0;  // Oldest unacknowledged frame
  let nextSeqNum  = 0;  // Next frame to transmit
  let frames      = []; // Array of { seq, status: 'waiting'|'in-flight'|'acked' }

  let isRunning   = false;
  let isPaused    = false;
  let timerId     = null;
  let startTime   = null;

  /* ── 4. Initialization & Render ─────────────────────────── */
  function initSimulation() {
    clearTimeout(timerId);
    timerId = null;
    isRunning = false;
    isPaused = false;
    startTime = Date.now();

    totalFrames = parseInt(totalFramesIn.value, 10);
    windowSize  = parseInt(windowSizeIn.value, 10);
    base = 0;
    nextSeqNum = 0;

    frames = [];
    for (let i = 0; i < totalFrames; i++) {
      frames.push({ seq: i, status: 'waiting' });
    }

    senderNameEl.textContent = senderSelect.value;
    receiverNameEl.textContent = receiverSelect.value;
    btnStart.textContent = '▶ Start';
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

  /* ── 5. Protocol Engine ─────────────────────────────────── */
  function stepSimulation() {
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
        // Frame received at destination
        logEvent(`Receiver accepted <strong>Frame #${frameIndex}</strong>. Generating ACK #${frameIndex}...`);
        animateFlight(frameIndex, 'ack', speed, () => {
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
      timerId = setTimeout(stepSimulation, speed);
    }
  }

  function animateFlight(frameSeq, type, duration, onComplete) {
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
      el.style.opacity = '0';
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (onComplete) onComplete();
      }, 300);
    }, duration * 0.8);
  }

  function completeSimulation() {
    isRunning = false;
    isPaused = false;
    clearTimeout(timerId);
    timerId = null;

    btnStart.textContent = '▶ Start';
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

  /* ── 6. Event Handlers ──────────────────────────────────── */
  btnStart.addEventListener('click', function () {
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
    if (!isRunning) {
      isRunning = true;
      isPaused = true;
      btnStart.textContent = '▶ Resume';
    }
    stepSimulation();
  });

  btnReset.addEventListener('click', function () {
    initSimulation();
    logEvent('Simulation reset.');
  });

  btnClearLog.addEventListener('click', function () {
    logBox.innerHTML = '';
  });

  totalFramesIn.addEventListener('input', function () {
    valFramesEl.textContent = this.value;
    if (!isRunning) initSimulation();
  });

  windowSizeIn.addEventListener('input', function () {
    valWindowEl.textContent = this.value;
    if (!isRunning) initSimulation();
  });

  senderSelect.addEventListener('change', initSimulation);
  receiverSelect.addEventListener('change', initSimulation);

  // Initialize on page load
  initSimulation();
});
