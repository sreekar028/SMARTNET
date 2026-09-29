/**
 * SMARTNET — modules/crc.js
 * CRC Simulation module (Member 2)
 *
 * Implements Cyclic Redundancy Check:
 *   - Modulo-2 binary division (XOR-based)
 *   - Step-by-step visualization of the division process
 *   - CRC remainder computation
 *   - Codeword construction
 *   - Error detection / verification mode
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
  SMARTNET.Integration.registerModule('crc', {
    label: 'CRC Simulation',
    status: 'ready',
    member: 'Member 2',
  });

  /* ── 2. DOM References ──────────────────────────────────── */
  // Mode tabs
  const tabCalculate = document.getElementById('crc-tab-calculate');
  const tabVerify    = document.getElementById('crc-tab-verify');

  // Calculate mode
  const calcInputCard   = document.getElementById('crc-calc-input-card');
  const dataInput       = document.getElementById('crc-data-input');
  const generatorInput  = document.getElementById('crc-generator-input');
  const dataError       = document.getElementById('crc-data-error');
  const generatorError  = document.getElementById('crc-generator-error');
  const btnCalculate    = document.getElementById('btn-calculate-crc');
  const btnResetCalc    = document.getElementById('btn-reset-crc');

  // Verify mode
  const verifyInputCard     = document.getElementById('crc-verify-input-card');
  const verifyCwInput       = document.getElementById('crc-verify-codeword');
  const verifyGenInput      = document.getElementById('crc-verify-generator');
  const verifyCwError       = document.getElementById('crc-verify-codeword-error');
  const verifyGenError      = document.getElementById('crc-verify-generator-error');
  const btnVerify           = document.getElementById('btn-verify-crc');
  const btnResetVerify      = document.getElementById('btn-reset-verify');

  // Output
  const emptyState       = document.getElementById('crc-empty-state');
  const calcOutput       = document.getElementById('crc-calc-output');
  const verifyOutput     = document.getElementById('crc-verify-output');
  const statusBadge      = document.getElementById('crc-status-badge');
  const outputTitle      = document.getElementById('crc-output-title');
  const appendedDataEl   = document.getElementById('crc-appended-data');
  const divisionStepsEl  = document.getElementById('crc-division-steps');
  const remainderDisplay = document.getElementById('crc-remainder-display');
  const codewordDisplay  = document.getElementById('crc-codeword-display');
  const resultsCard      = document.getElementById('crc-results-card');

  // Verify output
  const verifyReceivedEl  = document.getElementById('crc-verify-received');
  const verifyStepsEl     = document.getElementById('crc-verify-steps');
  const verifyRemainderEl = document.getElementById('crc-verify-remainder');
  const verifyVerdictEl   = document.getElementById('crc-verify-verdict');

  // Results summary
  const resCrcStatus    = document.getElementById('res-crc-status');
  const resCrcData      = document.getElementById('res-crc-data');
  const resCrcGenerator = document.getElementById('res-crc-generator');
  const resCrcAppended  = document.getElementById('res-crc-appended');
  const resCrcRemainder = document.getElementById('res-crc-remainder');
  const resCrcCodeword  = document.getElementById('res-crc-codeword');

  /* ── 3. Mode Switching ──────────────────────────────────── */
  let currentMode = 'calculate';

  function switchMode(mode) {
    currentMode = mode;
    // Update tabs
    tabCalculate.classList.toggle('active', mode === 'calculate');
    tabVerify.classList.toggle('active', mode === 'verify');
    // Show/hide input cards
    calcInputCard.style.display   = mode === 'calculate' ? 'block' : 'none';
    verifyInputCard.style.display = mode === 'verify'    ? 'block' : 'none';
    // Update output title
    outputTitle.textContent = mode === 'calculate' ? 'Calculation Output' : 'Verification Output';
    // Reset output
    resetOutput();
  }

  tabCalculate.addEventListener('click', function () { switchMode('calculate'); });
  tabVerify.addEventListener('click', function () { switchMode('verify'); });

  /* ── 4. Validation ──────────────────────────────────────── */
  function clearValidation() {
    [dataInput, generatorInput, verifyCwInput, verifyGenInput].forEach(function (el) {
      el.classList.remove('is-invalid');
    });
    [dataError, generatorError, verifyCwError, verifyGenError].forEach(function (el) {
      el.textContent = '';
    });
  }

  function validateBinary(input, errorEl, fieldName) {
    const val = input.value.trim();
    if (!val) {
      input.classList.add('is-invalid');
      errorEl.textContent = 'Please enter ' + fieldName + '.';
      return false;
    }
    if (!/^[01]+$/.test(val)) {
      input.classList.add('is-invalid');
      errorEl.textContent = fieldName.charAt(0).toUpperCase() + fieldName.slice(1) +
        ' must contain only binary digits (0 and 1).';
      return false;
    }
    return true;
  }

  function validateGenerator(input, errorEl) {
    const val = input.value.trim();
    if (!validateBinary(input, errorEl, 'generator polynomial')) return false;

    if (val.length < 2) {
      input.classList.add('is-invalid');
      errorEl.textContent = 'Generator must have at least 2 digits.';
      return false;
    }
    if (val[0] !== '1') {
      input.classList.add('is-invalid');
      errorEl.textContent = 'Generator must start with 1 (leading bit must be 1).';
      return false;
    }
    if (!/1/.test(val)) {
      input.classList.add('is-invalid');
      errorEl.textContent = 'Generator must contain at least one 1.';
      return false;
    }
    return true;
  }

  function validateCalcInputs() {
    clearValidation();
    const dataOk = validateBinary(dataInput, dataError, 'data bits');
    const genOk  = validateGenerator(generatorInput, generatorError);

    if (dataOk && genOk) {
      const data = dataInput.value.trim();
      const gen  = generatorInput.value.trim();
      if (gen.length > data.length + 1) {
        generatorInput.classList.add('is-invalid');
        generatorError.textContent = 'Generator length should not exceed data length + 1.';
        return false;
      }
    }

    return dataOk && genOk;
  }

  function validateVerifyInputs() {
    clearValidation();
    const cwOk  = validateBinary(verifyCwInput, verifyCwError, 'received codeword');
    const genOk = validateGenerator(verifyGenInput, verifyGenError);

    if (cwOk && genOk) {
      const cw  = verifyCwInput.value.trim();
      const gen = verifyGenInput.value.trim();
      if (cw.length < gen.length) {
        verifyCwInput.classList.add('is-invalid');
        verifyCwError.textContent = 'Codeword must be at least as long as the generator.';
        return false;
      }
    }

    return cwOk && genOk;
  }

  /* ═══════════════════════════════════════════════════════════
     5. CRC ALGORITHM (pure logic — no DOM)
  ═══════════════════════════════════════════════════════════ */

  /**
   * Perform modulo-2 binary division.
   * @param {string} dividend - Binary string (data + appended zeros)
   * @param {string} divisor  - Binary generator polynomial
   * @returns {{ remainder: string, steps: Array<{dividend: string, divisor: string, result: string, position: number}> }}
   */
  function modulo2Divide(dividend, divisor) {
    const n = divisor.length;
    let current = dividend.split('').map(Number);
    const div   = divisor.split('').map(Number);
    const steps = [];

    for (let i = 0; i <= current.length - n; i++) {
      // Skip if the leading bit is 0 (use zeros instead of divisor)
      if (current[i] === 0) continue;

      // Record the step before XOR
      const stepDividend = current.slice(i, i + n).join('');
      const stepDivisor  = divisor;

      // Perform XOR
      for (let j = 0; j < n; j++) {
        current[i + j] = current[i + j] ^ div[j];
      }

      const stepResult = current.slice(i, i + n).join('');

      steps.push({
        dividend: stepDividend,
        divisor: stepDivisor,
        result: stepResult,
        position: i,
      });
    }

    // The remainder is the last (n-1) bits
    const remainder = current.slice(current.length - (n - 1)).join('');

    return { remainder, steps };
  }

  /**
   * Calculate CRC for given data and generator.
   * @param {string} data      - Binary data string
   * @param {string} generator - Binary generator polynomial
   * @returns {{ data, generator, appendedData, remainder, codeword, steps }}
   */
  function calculateCRC(data, generator) {
    const crcLen = generator.length - 1;
    const appendedData = data + '0'.repeat(crcLen);
    const { remainder, steps } = modulo2Divide(appendedData, generator);

    // Ensure remainder has correct length (pad with leading zeros)
    const paddedRemainder = remainder.padStart(crcLen, '0');
    const codeword = data + paddedRemainder;

    return {
      data: data,
      generator: generator,
      appendedData: appendedData,
      remainder: paddedRemainder,
      codeword: codeword,
      steps: steps,
    };
  }

  /**
   * Verify a received codeword using CRC.
   * @param {string} codeword  - Received binary codeword
   * @param {string} generator - Binary generator polynomial
   * @returns {{ codeword, generator, remainder, isValid, steps }}
   */
  function verifyCRC(codeword, generator) {
    const { remainder, steps } = modulo2Divide(codeword, generator);
    const crcLen = generator.length - 1;
    const paddedRemainder = remainder.padStart(crcLen, '0');
    const isValid = /^0+$/.test(paddedRemainder);

    return {
      codeword: codeword,
      generator: generator,
      remainder: paddedRemainder,
      isValid: isValid,
      steps: steps,
    };
  }

  /* ═══════════════════════════════════════════════════════════
     6. VISUALIZATION (DOM rendering)
  ═══════════════════════════════════════════════════════════ */

  function renderDivisionSteps(steps, container) {
    if (steps.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:0.82rem;text-align:center;padding:var(--space-md);">No XOR steps needed (data is all zeros relative to generator).</div>';
      return;
    }

    let html = '';
    steps.forEach(function (step, i) {
      html += `
        <div class="crc-step">
          <div class="crc-step-label">Step ${i + 1} — Position ${step.position}</div>
          <div class="crc-step-row">
            ${renderBits(step.dividend, 'crc-bit-data')}
            <span style="margin-left:12px;font-size:0.72rem;color:var(--text-muted);">← Dividend</span>
          </div>
          <div class="crc-step-row">
            ${renderBits(step.divisor, 'crc-bit-xor')}
            <span style="margin-left:12px;font-size:0.72rem;color:var(--text-muted);">← XOR with Generator</span>
          </div>
          <div class="crc-divider-line" style="width:${step.divisor.length * 24}px;"></div>
          <div class="crc-step-row">
            ${renderBits(step.result, 'crc-bit-result')}
            <span style="margin-left:12px;font-size:0.72rem;color:var(--text-muted);">← Result</span>
          </div>
        </div>`;
    });

    container.innerHTML = html;
  }

  function renderBits(bits, className) {
    return bits.split('').map(function (b) {
      return '<span class="crc-bit ' + className + '">' + b + '</span>';
    }).join('');
  }

  function renderCodeword(data, crc, container) {
    container.innerHTML =
      '<span class="cw-data">' + data + '</span>' +
      '<span class="cw-crc">' + crc + '</span>';
  }

  /* ═══════════════════════════════════════════════════════════
     7. CALCULATE HANDLER
  ═══════════════════════════════════════════════════════════ */

  function runCalculation() {
    if (!validateCalcInputs()) return;

    const data      = dataInput.value.trim();
    const generator = generatorInput.value.trim();
    const result    = calculateCRC(data, generator);

    // Update UI
    emptyState.style.display   = 'none';
    calcOutput.style.display   = 'block';
    verifyOutput.style.display = 'none';
    resultsCard.style.display  = 'block';

    statusBadge.textContent = 'Completed';
    statusBadge.className   = 'sn-badge success';

    // Render appended data with highlighting
    appendedDataEl.innerHTML =
      '<span style="color:var(--color-primary);">' + data + '</span>' +
      '<span style="color:var(--text-muted);">' + '0'.repeat(generator.length - 1) + '</span>';

    // Render division steps
    renderDivisionSteps(result.steps, divisionStepsEl);

    // Render remainder
    remainderDisplay.textContent = result.remainder;

    // Render codeword
    renderCodeword(result.data, result.remainder, codewordDisplay);

    // Populate results summary
    resCrcStatus.innerHTML     = '<span class="sn-badge success">CRC Calculation Completed</span>';
    resCrcData.textContent     = data;
    resCrcGenerator.textContent= generator;
    resCrcAppended.textContent = result.appendedData;
    resCrcRemainder.textContent= result.remainder;
    resCrcCodeword.textContent = result.codeword;

    // Save to integration layer
    SMARTNET.Integration.saveResult({
      experiment: 'CRC Simulation',
      module: 'crc',
      status: 'Completed',
      metrics: {
        dataWord: data,
        generator: generator,
        crc: result.remainder,
        codeword: result.codeword,
        errorDetected: false,
      },
    });
  }

  /* ═══════════════════════════════════════════════════════════
     8. VERIFY HANDLER
  ═══════════════════════════════════════════════════════════ */

  function runVerification() {
    if (!validateVerifyInputs()) return;

    const codeword  = verifyCwInput.value.trim();
    const generator = verifyGenInput.value.trim();
    const result    = verifyCRC(codeword, generator);

    // Update UI
    emptyState.style.display   = 'none';
    calcOutput.style.display   = 'none';
    verifyOutput.style.display = 'block';
    resultsCard.style.display  = 'none';

    statusBadge.textContent = result.isValid ? 'Valid' : 'Error Detected';
    statusBadge.className   = 'sn-badge ' + (result.isValid ? 'success' : 'danger');

    // Render received codeword
    verifyReceivedEl.textContent = codeword;

    // Render division steps
    renderDivisionSteps(result.steps, verifyStepsEl);

    // Render remainder
    verifyRemainderEl.textContent = result.remainder;
    verifyRemainderEl.style.color = result.isValid ? 'var(--color-accent)' : 'var(--color-danger)';

    // Verdict
    if (result.isValid) {
      verifyVerdictEl.innerHTML =
        '<div class="crc-verify-result valid">' +
          '✅ No Error Detected — Remainder is all zeros. The received codeword is valid.' +
        '</div>';
    } else {
      verifyVerdictEl.innerHTML =
        '<div class="crc-verify-result invalid">' +
          '❌ Error Detected — Non-zero remainder <strong>(' + result.remainder + ')</strong>. ' +
          'The received codeword contains an error.' +
        '</div>';
    }

    // Save verification result to integration layer
    SMARTNET.Integration.saveResult({
      experiment: 'CRC Verification',
      module: 'crc',
      status: 'Completed',
      metrics: {
        codeword: codeword,
        generator: generator,
        remainder: result.remainder,
        errorDetected: !result.isValid,
      },
    });
  }

  /* ── 9. Reset ───────────────────────────────────────────── */
  function resetOutput() {
    emptyState.style.display   = 'block';
    calcOutput.style.display   = 'none';
    verifyOutput.style.display = 'none';
    resultsCard.style.display  = 'none';
    statusBadge.textContent    = 'Waiting';
    statusBadge.className      = 'sn-badge muted';
  }

  function resetCalculate() {
    clearValidation();
    dataInput.value = '';
    generatorInput.value = '';
    resetOutput();
  }

  function resetVerify() {
    clearValidation();
    verifyCwInput.value = '';
    verifyGenInput.value = '';
    resetOutput();
  }

  /* ── 10. Event listeners ────────────────────────────────── */
  btnCalculate.addEventListener('click', runCalculation);
  btnResetCalc.addEventListener('click', resetCalculate);
  btnVerify.addEventListener('click', runVerification);
  btnResetVerify.addEventListener('click', resetVerify);

  // Allow Enter key to run
  dataInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); runCalculation(); }
  });
  generatorInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); runCalculation(); }
  });
  verifyCwInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); runVerification(); }
  });
  verifyGenInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); runVerification(); }
  });

  // Clear validation on input change
  [dataInput, generatorInput, verifyCwInput, verifyGenInput].forEach(function (el) {
    el.addEventListener('input', clearValidation);
  });

  // Back to Dashboard navigation handler
  const btnBack = document.getElementById('btn-back-dashboard') || document.getElementById('btn-back-simulations');
  if (btnBack) {
    btnBack.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = '../../dashboard.html';
    });
  }

});
