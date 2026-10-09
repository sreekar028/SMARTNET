/**
 * SMARTNET — modules/go-back-n.js
 * Go-Back-N (GBN) ARQ Simulation (Member 3)
 *
 * Implements:
 *   - Sender window of size N with pipelined transmissions
 *   - In-order receiver logic (expectedSeq)
 *   - Automatic discard of out-of-order frames
 *   - Cumulative ACK generation and processing
 *   - Deterministic fault injection (frame drop & ACK drop)
 *   - Timeout handling and Go-Back-N bulk retransmissions
 *   - SMARTNET Integration & Results Center persistence
 */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  /* ── 1. Boot Shared Layers ──────────────────────────────── */
  SMARTNET.Navigation.init('sn-nav-container');
  SMARTNET.Integration.init();

  SMARTNET.Integration.registerModule('goBackN', {
    label: 'Go-Back-N ARQ',
    status: 'ready',
    member: 'Member 3',
  });

  /* ── 2. DOM Elements ────────────────────────────────────── */
  const totalFramesIn  = document.getElementById('gbn-total-frames');
  const windowSizeIn   = document.getElementById('gbn-window-size');
  const scenarioSelect = document.getElementById('gbn-loss-scenario');
  const speedSelect    = document.getElementById('gbn-speed-select');
  const valFramesEl    = document.getElementById('gbn-val-frames');
  const valWindowEl    = document.getElementById('gbn-val-window');

  const btnStart       = document.getElementById('btn-gbn-start');
  const btnStep        = document.getElementById('btn-gbn-step');
  const btnReset       = document.getElementById('btn-gbn-reset');
  const btnClearLog    = document.getElementById('btn-gbn-clear-log');

  const statusBadge    = document.getElementById('gbn-status-badge');
  const frameTrack     = document.getElementById('gbn-frame-track');
  const flightLayer    = document.getElementById('gbn-flight-layer');
  const logBox         = document.getElementById('gbn-log-box');
  const rxExpectedEl   = document.getElementById('gbn-rx-expected');
  const timerLabelEl   = document.getElementById('gbn-sender-timer-label');

  // Metrics
  const mWindow    = document.getElementById('m-gbn-window');
  const mExpected  = document.getElementById('m-gbn-expected');
  const mAttempts  = document.getElementById('m-gbn-attempts');
  const mRetrans   = document.getElementById('m-gbn-retrans');
  const mDiscarded = document.getElementById('m-gbn-discarded');
  const mAcks      = document.getElementById('m-gbn-acks');

  /* ── 3. Simulation State ─────────────────────────────────── */
  let totalFrames = parseInt(totalFramesIn.value, 10);
  let windowSize  = parseInt(windowSizeIn.value, 10);
  let base        = 0;
  let nextSeqNum  = 0;
  let expectedSeq = 0;
  let frames      = [];

  let attemptsCount    = 0;
  let retransCount     = 0;
  let discardedCount   = 0;
  let cumulativeAckCount = 0;

  let hasDroppedFrame  = false;
  let hasDroppedAck    = false;

  let isRunning   = false;
  let isPaused    = false;
  let timerId     = null;
  let timeoutTimer= null;
  let startTime   = null;

  /* ── 4. Init & Render ───────────────────────────────────── */
  function initSimulation() {
    clearTimeout(timerId);
    clearTimeout(timeoutTimer);
    timerId = null;
    timeoutTimer = null;

    isRunning = false;
    isPaused = false;
    startTime = Date.now();

    totalFrames = parseInt(totalFramesIn.value, 10);
    windowSize  = parseInt(windowSizeIn.value, 10);
    base = 0;
    nextSeqNum = 0;
    expectedSeq = 0;

    attemptsCount = 0;
    retransCount = 0;
    discardedCount = 0;
    cumulativeAckCount = 0;

    hasDroppedFrame = false;
    hasDroppedAck = false;

    frames = [];
    for (let i = 0; i < totalFrames; i++) {
      frames.push({ seq: i, status: 'waiting' });
    }

    btnStart.textContent = '▶ Start GBN';
    statusBadge.textContent = 'Ready';
    statusBadge.className = 'sn-badge muted';
    timerLabelEl.textContent = 'Timer: Off';
    rxExpectedEl.textContent = 'Expected: #0';

    flightLayer.innerHTML = '';
    renderFrameTrack();
    updateMetrics();
  }

  function renderFrameTrack() {
    frameTrack.innerHTML = '';
    frames.forEach((f, idx) => {
      const card = document.createElement('div');
      card.className = 'gbn-frame-card';

      const inWindow = idx >= base && idx < base + windowSize;
      if (f.status === 'acked') {
        card.classList.add('acked');
      } else if (f.status === 'lost') {
        card.classList.add('lost');
      } else if (f.status === 'discarded') {
        card.classList.add('discarded');
      } else if (f.status === 'in-flight') {
        card.classList.add('in-flight');
      } else if (inWindow) {
        card.classList.add('in-window');
      }

      card.innerHTML = `
        <div style="font-size:0.7rem;color:var(--text-muted);">Frame</div>
        <div style="font-size:1.1rem;font-weight:700;">#${f.seq}</div>
        <div style="font-size:0.65rem;" class="${inWindow ? 'text-warning' : 'text-muted'}">
          ${f.status.toUpperCase()}
        </div>
      `;
      frameTrack.appendChild(card);
    });
  }

  function updateMetrics() {
    mWindow.textContent    = `[${base}, ${nextSeqNum}]`;
    mExpected.textContent  = `#${expectedSeq}`;
    mAttempts.textContent  = attemptsCount;
    mRetrans.textContent   = retransCount;
    mDiscarded.textContent = discardedCount;
    mAcks.textContent      = cumulativeAckCount;
    rxExpectedEl.textContent = `Expected: #${expectedSeq}`;
  }

  function logEvent(text) {
    const elapsed = ((Date.now() - (startTime || Date.now())) / 1000).toFixed(1);
    const div = document.createElement('div');
    div.className = 'gbn-log-entry';
    div.innerHTML = `<span class="gbn-log-time">+${elapsed}s</span> <span>${text}</span>`;
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
    const scenario = scenarioSelect.value;

    // Send next frame in window if available
    if (nextSeqNum < base + windowSize && nextSeqNum < totalFrames) {
      const seq = nextSeqNum;
      attemptsCount++;
      frames[seq].status = 'in-flight';
      renderFrameTrack();
      updateMetrics();

      // Check if this frame should be dropped
      let shouldDrop = false;
      if (!hasDroppedFrame) {
        if (scenario === 'frame-2' && seq === 2) shouldDrop = true;
        if (scenario === 'frame-4' && seq === 4) shouldDrop = true;
      }

      logEvent(`Sender ➔ Transmitted <strong>Frame #${seq}</strong> (Window [${base}, ${base + windowSize - 1}])`);

      if (shouldDrop) {
        hasDroppedFrame = true;
        frames[seq].status = 'lost';
        logEvent(`⚡ <span class="text-danger">Channel Error: Frame #${seq} was DROPPED in transit!</span>`);
        animatePacket(seq, 'lost', speed, () => {
          renderFrameTrack();
        });
      } else {
        // Frame arrives at receiver
        animatePacket(seq, 'frame', speed, () => {
          handleFrameArrival(seq, speed, scenario);
        });
      }

      // Start sender timeout timer if not running
      if (!timeoutTimer) {
        timerLabelEl.textContent = 'Timer: Active';
        timeoutTimer = setTimeout(() => {
          handleTimeout();
        }, speed * 2.8);
      }

      nextSeqNum++;
    }

    if (isRunning && !isPaused && base < totalFrames) {
      timerId = setTimeout(stepSimulation, speed);
    }
  }

  function handleFrameArrival(seq, speed, scenario) {
    if (seq === expectedSeq) {
      // In-order frame received!
      expectedSeq++;
      logEvent(`Receiver accepted in-order <strong>Frame #${seq}</strong>. Expected now: #${expectedSeq}`);

      // Check if ACK should be dropped
      let dropAck = false;
      if (!hasDroppedAck && scenario === 'ack-lost' && seq === 2) {
        dropAck = true;
        hasDroppedAck = true;
      }

      if (dropAck) {
        logEvent(`⚡ <span class="text-danger">Channel Error: Cumulative ACK #${seq} was LOST!</span>`);
      } else {
        cumulativeAckCount++;
        logEvent(`Receiver ⬅ Generating <strong>Cumulative ACK #${seq}</strong>`);
        animatePacket(seq, 'ack', speed, () => {
          handleAckArrival(seq);
        });
      }
    } else {
      // Out of order frame! Receiver DISCARDS it in GBN!
      discardedCount++;
      frames[seq].status = 'discarded';
      logEvent(`⚠️ Receiver: Frame #${seq} is OUT OF ORDER (expected #${expectedSeq}) ➔ <strong class="text-danger">DISCARDED</strong>`);
      renderFrameTrack();
      updateMetrics();

      // Send duplicate ACK for highest in-order frame
      const ackVal = expectedSeq - 1;
      if (ackVal >= 0) {
        logEvent(`Receiver ⬅ Resending Duplicate Cumulative ACK #${ackVal}`);
        animatePacket(ackVal, 'ack', speed, () => {});
      }
    }
  }

  function handleAckArrival(ackSeq) {
    logEvent(`Sender received <strong>Cumulative ACK #${ackSeq}</strong>.`);
    // Cumulative ACK acknowledges all frames up to ackSeq
    for (let i = base; i <= ackSeq; i++) {
      if (frames[i]) frames[i].status = 'acked';
    }

    base = ackSeq + 1;
    logEvent(`Window base advanced to #${base}`);
    renderFrameTrack();
    updateMetrics();

    // Reset timer
    clearTimeout(timeoutTimer);
    if (base < nextSeqNum) {
      const speed = parseInt(speedSelect.value, 10);
      timeoutTimer = setTimeout(handleTimeout, speed * 2.8);
      timerLabelEl.textContent = 'Timer: Active';
    } else {
      timeoutTimer = null;
      timerLabelEl.textContent = 'Timer: Off';
    }

    if (base >= totalFrames) {
      completeSimulation();
    }
  }

  function handleTimeout() {
    timeoutTimer = null;
    timerLabelEl.textContent = 'Timer: EXPIRED!';
    logEvent(`⏱️ <span class="text-warning"><strong>TIMEOUT EXPIRED!</strong> No ACK received for Frame #${base}.</span>`);
    logEvent(`🔄 <strong>GO-BACK-N IN ACTION:</strong> Retransmitting all outstanding frames from #${base} to #${nextSeqNum - 1}!`);

    retransCount += (nextSeqNum - base);
    nextSeqNum = base; // Reset nextSeqNum back to base (Go-Back-N!)

    for (let i = base; i < totalFrames; i++) {
      if (frames[i].status !== 'acked') {
        frames[i].status = 'waiting';
      }
    }

    renderFrameTrack();
    updateMetrics();

    if (isRunning && !isPaused) {
      const speed = parseInt(speedSelect.value, 10);
      timerId = setTimeout(stepSimulation, speed);
    }
  }

  function animatePacket(seq, type, duration, onComplete) {
    const el = document.createElement('div');
    el.className = 'gbn-transit-item';

    if (type === 'frame') {
      el.className += ' gbn-transit-frame';
      el.innerHTML = `📦 Frame #${seq} ➔`;
    } else if (type === 'lost') {
      el.className += ' gbn-transit-lost';
      el.innerHTML = `❌ Frame #${seq} [DROPPED]`;
    } else if (type === 'ack') {
      el.className += ' gbn-transit-ack';
      el.innerHTML = `✓ Cum-ACK #${seq} ⬅`;
    }

    const isEast = (type === 'frame' || type === 'lost');
    el.style.left = isEast ? '5%' : '80%';
    el.style.top  = isEast ? '12px' : '36px';
    flightLayer.appendChild(el);

    const targetLeft = type === 'lost' ? '45%' : (isEast ? '80%' : '5%');

    requestAnimationFrame(() => {
      el.style.transition = `left ${duration * 0.8}ms ease-in-out, opacity 0.4s ease`;
      el.style.left = targetLeft;
    });

    setTimeout(() => {
      if (type === 'lost') {
        el.style.transform = 'scale(1.4)';
        el.style.opacity = '0';
      } else {
        el.style.opacity = '0';
      }
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
    clearTimeout(timeoutTimer);
    timerId = null;
    timeoutTimer = null;

    btnStart.textContent = '▶ Start GBN';
    statusBadge.textContent = 'Completed';
    statusBadge.className = 'sn-badge success';
    timerLabelEl.textContent = 'Timer: Off';
    logEvent(`🎉 <strong>Go-Back-N Finished:</strong> All ${totalFrames} frames delivered in order!`);

    SMARTNET.Integration.saveResult({
      experiment: 'Go-Back-N ARQ',
      module: 'goBackN',
      status: 'Completed',
      metrics: {
        totalFrames: totalFrames,
        windowSize: windowSize,
        transmissions: attemptsCount,
        retransmissions: retransCount,
        discarded: discardedCount,
        scenario: scenarioSelect.value,
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
      logEvent('Go-Back-N simulation started.');
      stepSimulation();
    } else if (isPaused) {
      isPaused = false;
      btnStart.textContent = '⏸ Pause';
      statusBadge.textContent = 'Running';
      statusBadge.className = 'sn-badge primary';
      logEvent('Go-Back-N simulation resumed.');
      stepSimulation();
    } else {
      isPaused = true;
      btnStart.textContent = '▶ Resume';
      statusBadge.textContent = 'Paused';
      statusBadge.className = 'sn-badge warning';
      clearTimeout(timerId);
      logEvent('Go-Back-N simulation paused.');
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

  scenarioSelect.addEventListener('change', initSimulation);

  initSimulation();
});
