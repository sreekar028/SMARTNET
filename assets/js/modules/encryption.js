/**
 * SMARTNET — assets/js/modules/encryption.js
 * Classical Encryption & Decryption Simulation Module (Member 5)
 *
 * Implements:
 *   1. Caesar Cipher (Shift Cipher)
 *      - Configurable shift key (-25 to +25, wrapped modulo 26)
 *      - Character-by-character transformation visualizer
 *      - Case preservation and non-alphabetic character preservation
 *      - Step-by-step mathematical demonstration: E(x) = (x + k) mod 26, D(x) = (x - k) mod 26
 *
 *   2. Monoalphabetic Substitution Cipher
 *      - 26-character permutation key validation (A–Z, no duplicates, length 26)
 *      - Forward mapping for encryption, reverse mapping for decryption
 *      - Case preservation and non-alphabetic character preservation
 *      - Mapping matrix visualizer and character transformation table
 *      - Preset keys: Random Key Generator, QWERTY, Reverse Alphabet
 *
 *   3. Columnar Transposition Cipher
 *      - Numerical column size key (2 to 20 columns)
 *      - Row-by-row matrix filling, column-by-column reading for encryption
 *      - Column length calculation & grid reconstruction for decryption
 *      - Complete handling of incomplete final rows
 *      - Exact preservation of spaces, digits, and punctuation for lossless recovery
 *      - Visual transposition grid architecture display
 *
 * Results are safely recorded to SMARTNET.Integration.saveResult().
 */

var SMARTNET = window.SMARTNET || {};

SMARTNET.Encryption = (function () {
  'use strict';

  /* ── 1. Caesar Cipher Engine (Classical) ──────────────────── */
  const Caesar = {
    encrypt: function (plaintext, shift) {
      shift = ((Number(shift) % 26) + 26) % 26;
      const steps = [];
      let ciphertext = '';

      for (let i = 0; i < plaintext.length; i++) {
        const char = plaintext[i];
        const code = char.charCodeAt(0);

        if (code >= 65 && code <= 90) {
          // Uppercase A-Z
          const origIdx = code - 65;
          const newIdx = (origIdx + shift) % 26;
          const encChar = String.fromCharCode(65 + newIdx);
          ciphertext += encChar;
          steps.push({
            char,
            origCode: code,
            origIdx,
            shift,
            calc: `(${origIdx} + ${shift}) % 26 = ${newIdx}`,
            resultChar: encChar,
            isAlpha: true,
            caseType: 'upper'
          });
        } else if (code >= 97 && code <= 122) {
          // Lowercase a-z
          const origIdx = code - 97;
          const newIdx = (origIdx + shift) % 26;
          const encChar = String.fromCharCode(97 + newIdx);
          ciphertext += encChar;
          steps.push({
            char,
            origCode: code,
            origIdx,
            shift,
            calc: `(${origIdx} + ${shift}) % 26 = ${newIdx}`,
            resultChar: encChar,
            isAlpha: true,
            caseType: 'lower'
          });
        } else {
          // Non-alphabetic character preserved as-is
          ciphertext += char;
          steps.push({
            char,
            origCode: code,
            origIdx: null,
            shift: 0,
            calc: 'Preserved as-is (non-alphabetic)',
            resultChar: char,
            isAlpha: false
          });
        }
      }

      return {
        ciphertext,
        steps,
        shift
      };
    },

    decrypt: function (ciphertext, shift) {
      shift = ((Number(shift) % 26) + 26) % 26;
      const steps = [];
      let plaintext = '';

      for (let i = 0; i < ciphertext.length; i++) {
        const char = ciphertext[i];
        const code = char.charCodeAt(0);

        if (code >= 65 && code <= 90) {
          const origIdx = code - 65;
          const newIdx = (origIdx - shift + 26) % 26;
          const decChar = String.fromCharCode(65 + newIdx);
          plaintext += decChar;
          steps.push({
            char,
            origCode: code,
            origIdx,
            shift,
            calc: `(${origIdx} - ${shift} + 26) % 26 = ${newIdx}`,
            resultChar: decChar,
            isAlpha: true,
            caseType: 'upper'
          });
        } else if (code >= 97 && code <= 122) {
          const origIdx = code - 97;
          const newIdx = (origIdx - shift + 26) % 26;
          const decChar = String.fromCharCode(97 + newIdx);
          plaintext += decChar;
          steps.push({
            char,
            origCode: code,
            origIdx,
            shift,
            calc: `(${origIdx} - ${shift} + 26) % 26 = ${newIdx}`,
            resultChar: decChar,
            isAlpha: true,
            caseType: 'lower'
          });
        } else {
          plaintext += char;
          steps.push({
            char,
            origCode: code,
            origIdx: null,
            shift: 0,
            calc: 'Preserved as-is (non-alphabetic)',
            resultChar: char,
            isAlpha: false
          });
        }
      }

      return {
        plaintext,
        steps,
        shift
      };
    }
  };

  /* ── 2. Monoalphabetic Substitution Cipher ────────────────── */
  const Substitution = {
    validateKey: function (rawKey) {
      if (typeof rawKey !== 'string') {
        return { valid: false, error: 'Substitution key must be a 26-letter string.' };
      }
      const cleanKey = rawKey.trim().toUpperCase();
      if (cleanKey.length !== 26) {
        return {
          valid: false,
          error: `Substitution key must contain exactly 26 letters (currently has ${cleanKey.length}).`
        };
      }
      if (!/^[A-Z]{26}$/.test(cleanKey)) {
        return {
          valid: false,
          error: 'Substitution key must contain only alphabetic letters (A–Z) with no numbers or special symbols.'
        };
      }
      const uniqueLetters = new Set(cleanKey.split(''));
      if (uniqueLetters.size !== 26) {
        return {
          valid: false,
          error: 'Substitution key cannot contain duplicate letters. Every letter from A to Z must appear exactly once.'
        };
      }
      return { valid: true, key: cleanKey };
    },

    encrypt: function (plaintext, key) {
      const validation = this.validateKey(key);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      const k = validation.key;
      const steps = [];
      let ciphertext = '';

      for (let i = 0; i < plaintext.length; i++) {
        const char = plaintext[i];
        const code = char.charCodeAt(0);

        if (code >= 65 && code <= 90) {
          // Uppercase
          const idx = code - 65;
          const encChar = k[idx];
          ciphertext += encChar;
          steps.push({
            char,
            origIdx: idx,
            calc: `'${char}' (pos ${idx + 1}) ➔ '${encChar}'`,
            resultChar: encChar,
            isAlpha: true,
            caseType: 'upper'
          });
        } else if (code >= 97 && code <= 122) {
          // Lowercase
          const idx = code - 97;
          const encChar = k[idx].toLowerCase();
          ciphertext += encChar;
          steps.push({
            char,
            origIdx: idx,
            calc: `'${char}' (pos ${idx + 1}) ➔ '${encChar}'`,
            resultChar: encChar,
            isAlpha: true,
            caseType: 'lower'
          });
        } else {
          // Non-alphabetic character preserved as-is
          ciphertext += char;
          steps.push({
            char,
            origIdx: null,
            calc: 'Preserved as-is (non-alphabetic)',
            resultChar: char,
            isAlpha: false
          });
        }
      }

      return {
        ciphertext,
        steps,
        key: k
      };
    },

    decrypt: function (ciphertext, key) {
      const validation = this.validateKey(key);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      const k = validation.key;

      // Reverse lookup map
      const revMap = {};
      for (let i = 0; i < 26; i++) {
        revMap[k[i]] = String.fromCharCode(65 + i);
      }

      const steps = [];
      let plaintext = '';

      for (let i = 0; i < ciphertext.length; i++) {
        const char = ciphertext[i];
        const code = char.charCodeAt(0);

        if (code >= 65 && code <= 90) {
          const decChar = revMap[char];
          plaintext += decChar;
          steps.push({
            char,
            calc: `'${char}' ➔ '${decChar}'`,
            resultChar: decChar,
            isAlpha: true,
            caseType: 'upper'
          });
        } else if (code >= 97 && code <= 122) {
          const decChar = revMap[char.toUpperCase()].toLowerCase();
          plaintext += decChar;
          steps.push({
            char,
            calc: `'${char}' ➔ '${decChar}'`,
            resultChar: decChar,
            isAlpha: true,
            caseType: 'lower'
          });
        } else {
          plaintext += char;
          steps.push({
            char,
            calc: 'Preserved as-is (non-alphabetic)',
            resultChar: char,
            isAlpha: false
          });
        }
      }

      return {
        plaintext,
        steps,
        key: k
      };
    }
  };

  /* ── 3. Columnar Transposition Cipher ─────────────────────── */
  const Transposition = {
    validateColumns: function (rawCols, textLength) {
      const trimmed = String(rawCols).trim();
      if (trimmed === '' || isNaN(trimmed)) {
        return { valid: false, error: 'Column key size is required and must be an integer.' };
      }
      const cols = Number(trimmed);
      if (!Number.isInteger(cols) || cols < 2) {
        return { valid: false, error: 'Column key size must be an integer greater than or equal to 2.' };
      }
      if (typeof textLength === 'number' && textLength > 0 && cols > textLength) {
        return { valid: false, error: `Column count (${cols}) cannot exceed message length (${textLength}).` };
      }
      return { valid: true, cols };
    },

    encrypt: function (plaintext, rawCols) {
      const validation = this.validateColumns(rawCols, plaintext.length);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      const cols = validation.cols;
      const L = plaintext.length;
      if (L === 0) {
        return { ciphertext: '', grid: [], rows: 0, cols, length: 0 };
      }

      const rows = Math.ceil(L / cols);
      const grid = [];

      for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          grid[r][c] = idx < L ? plaintext[idx] : null;
        }
      }

      let ciphertext = '';
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (grid[r][c] !== null) {
            ciphertext += grid[r][c];
          }
        }
      }

      return {
        ciphertext,
        grid,
        rows,
        cols,
        length: L
      };
    },

    decrypt: function (ciphertext, rawCols) {
      const validation = this.validateColumns(rawCols, ciphertext.length);
      if (!validation.valid) {
        throw new Error(validation.error);
      }
      const cols = validation.cols;
      const L = ciphertext.length;
      if (L === 0) {
        return { plaintext: '', grid: [], rows: 0, cols, length: 0 };
      }

      const rows = Math.ceil(L / cols);
      const rem = L % cols;

      // Calculate length of each column in the grid
      const colLengths = [];
      for (let c = 0; c < cols; c++) {
        colLengths[c] = (rem === 0 || c < rem) ? rows : rows - 1;
      }

      // Slice ciphertext into columns
      let ptr = 0;
      const colChars = [];
      for (let c = 0; c < cols; c++) {
        const len = colLengths[c];
        colChars[c] = ciphertext.slice(ptr, ptr + len);
        ptr += len;
      }

      // Reconstruct original grid
      const grid = [];
      for (let r = 0; r < rows; r++) {
        grid[r] = [];
        for (let c = 0; c < cols; c++) {
          grid[r][c] = r < colLengths[c] ? colChars[c][r] : null;
        }
      }

      // Read plaintext row by row
      let plaintext = '';
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r][c] !== null) {
            plaintext += grid[r][c];
          }
        }
      }

      return {
        plaintext,
        grid,
        rows,
        cols,
        length: L
      };
    }
  };

  return {
    Caesar,
    Substitution,
    Transposition
  };
})();

/* ── DOM Controller ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  // Boot shared navigation and integration
  if (SMARTNET.Navigation && typeof SMARTNET.Navigation.init === 'function') {
    SMARTNET.Navigation.init('sn-nav-container');
  }
  if (SMARTNET.Integration && typeof SMARTNET.Integration.init === 'function') {
    SMARTNET.Integration.init();
    SMARTNET.Integration.registerModule('encryption', {
      label: 'Encryption Simulation',
      status: 'ready',
      member: 'Member 5'
    });
  }

  /* ── DOM Elements ────────────────────────────────────────── */
  const algoTabs = document.querySelectorAll('.enc-algo-tab');
  const panelCaesar = document.getElementById('panel-caesar');
  const panelSubstitution = document.getElementById('panel-substitution');
  const panelTransposition = document.getElementById('panel-transposition');

  // 1. Caesar elements
  const caesarPlaintext = document.getElementById('caesar-plaintext');
  const caesarShift = document.getElementById('caesar-shift');
  const caesarShiftVal = document.getElementById('caesar-shift-val');
  const btnCaesarEncrypt = document.getElementById('btn-caesar-encrypt');
  const btnCaesarDecrypt = document.getElementById('btn-caesar-decrypt');
  const btnCaesarReset = document.getElementById('btn-caesar-reset');
  const caesarOutputSection = document.getElementById('caesar-output-section');
  const caesarCiphertextOutput = document.getElementById('caesar-ciphertext-output');
  const caesarStepsContainer = document.getElementById('caesar-steps-container');
  const btnCaesarCopy = document.getElementById('btn-caesar-copy');
  const caesarError = document.getElementById('caesar-error');
  const caesarEmptyPlaceholder = document.getElementById('caesar-empty-placeholder');

  // 2. Substitution elements
  const subPlaintext = document.getElementById('sub-plaintext');
  const subKey = document.getElementById('sub-key');
  const subKeyCounter = document.getElementById('sub-key-counter');
  const btnSubEncrypt = document.getElementById('btn-sub-encrypt');
  const btnSubDecrypt = document.getElementById('btn-sub-decrypt');
  const btnSubReset = document.getElementById('btn-sub-reset');
  const subOutputSection = document.getElementById('sub-output-section');
  const subCiphertextOutput = document.getElementById('sub-ciphertext-output');
  const subStepsContainer = document.getElementById('sub-steps-container');
  const btnSubCopy = document.getElementById('btn-sub-copy');
  const subError = document.getElementById('sub-error');
  const subEmptyPlaceholder = document.getElementById('sub-empty-placeholder');
  const btnSubKeyRandom = document.getElementById('btn-sub-key-random');
  const btnSubKeyQwerty = document.getElementById('btn-sub-key-qwerty');
  const btnSubKeyReverse = document.getElementById('btn-sub-key-reverse');

  // 3. Transposition elements
  const transPlaintext = document.getElementById('trans-plaintext');
  const transKey = document.getElementById('trans-key');
  const btnTransEncrypt = document.getElementById('btn-trans-encrypt');
  const btnTransDecrypt = document.getElementById('btn-trans-decrypt');
  const btnTransReset = document.getElementById('btn-trans-reset');
  const transOutputSection = document.getElementById('trans-output-section');
  const transCiphertextOutput = document.getElementById('trans-ciphertext-output');
  const transGridContainer = document.getElementById('trans-grid-container');
  const btnTransCopy = document.getElementById('btn-trans-copy');
  const transError = document.getElementById('trans-error');
  const transEmptyPlaceholder = document.getElementById('trans-empty-placeholder');

  /* ── Algorithm Tab Switching ─────────────────────────────── */
  algoTabs.forEach(tab => {
    tab.addEventListener('click', function () {
      algoTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      this.classList.add('active');
      this.setAttribute('aria-selected', 'true');

      const target = this.getAttribute('data-algo');
      if (panelCaesar) panelCaesar.style.display = (target === 'caesar') ? 'block' : 'none';
      if (panelSubstitution) panelSubstitution.style.display = (target === 'substitution') ? 'block' : 'none';
      if (panelTransposition) panelTransposition.style.display = (target === 'transposition') ? 'block' : 'none';
    });
  });

  /* ═══════════════════════════════════════════════════════════
       1. CAESAR CIPHER CONTROLLER
  ══════════════════════════════════════════════════════════════ */
  function showCaesarError(msg) {
    if (caesarError) {
      caesarError.textContent = msg;
      caesarError.style.display = 'block';
    }
  }

  function hideCaesarError() {
    if (caesarError) {
      caesarError.textContent = '';
      caesarError.style.display = 'none';
    }
    if (caesarShift) caesarShift.classList.remove('is-invalid');
  }

  function validateCaesarShift() {
    if (!caesarShift) return 3;
    const raw = (caesarShift.value || '').trim();
    if (raw === '' || isNaN(raw)) {
      caesarShift.classList.add('is-invalid');
      showCaesarError('Shift key is required and must be an integer between 1 and 25.');
      return null;
    }
    const val = Number(raw);
    if (!Number.isInteger(val) || val < 1 || val > 25) {
      caesarShift.classList.add('is-invalid');
      showCaesarError('Shift key must be an integer between 1 and 25.');
      return null;
    }
    caesarShift.classList.remove('is-invalid');
    if (caesarShiftVal) caesarShiftVal.textContent = val;
    return val;
  }

  if (caesarShift) {
    const handleShiftChange = function () {
      const val = validateCaesarShift();
      if (val !== null) {
        hideCaesarError();
      }
    };
    caesarShift.addEventListener('input', handleShiftChange);
    caesarShift.addEventListener('change', handleShiftChange);
  }

  if (btnCaesarEncrypt) {
    btnCaesarEncrypt.addEventListener('click', function () {
      hideCaesarError();
      const text = caesarPlaintext ? caesarPlaintext.value : '';
      if (!text || text.trim().length === 0) {
        showCaesarError('Please enter plaintext in the input box to encrypt.');
        return;
      }
      const shift = validateCaesarShift();
      if (shift === null) return;

      const res = SMARTNET.Encryption.Caesar.encrypt(text, shift);
      if (caesarCiphertextOutput) caesarCiphertextOutput.textContent = res.ciphertext;
      renderCaesarSteps(res.steps, 'encrypt', shift);
      if (caesarOutputSection) caesarOutputSection.style.display = 'block';
      if (caesarEmptyPlaceholder) caesarEmptyPlaceholder.style.display = 'none';

      // Record to integration
      if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
        SMARTNET.Integration.saveResult({
          experiment: 'Caesar Cipher Encryption',
          module: 'encryption',
          status: 'Completed',
          parameters: { algorithm: 'Caesar Cipher', shift: shift, charCount: text.length },
          metrics: { operation: 'Encrypt', shift: shift, outputLength: res.ciphertext.length, algorithmFamily: 'Substitution (Classical)' },
          notes: 'Character shift modulo 26.'
        });
      }
    });
  }

  if (btnCaesarDecrypt) {
    btnCaesarDecrypt.addEventListener('click', function () {
      hideCaesarError();
      const text = caesarPlaintext ? caesarPlaintext.value : '';
      if (!text || text.trim().length === 0) {
        showCaesarError('Please enter ciphertext in the input box to decrypt.');
        return;
      }
      const shift = validateCaesarShift();
      if (shift === null) return;

      const res = SMARTNET.Encryption.Caesar.decrypt(text, shift);
      if (caesarCiphertextOutput) caesarCiphertextOutput.textContent = res.plaintext;
      renderCaesarSteps(res.steps, 'decrypt', shift);
      if (caesarOutputSection) caesarOutputSection.style.display = 'block';
      if (caesarEmptyPlaceholder) caesarEmptyPlaceholder.style.display = 'none';

      // Record to integration
      if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
        SMARTNET.Integration.saveResult({
          experiment: 'Caesar Cipher Decryption',
          module: 'encryption',
          status: 'Completed',
          parameters: { algorithm: 'Caesar Cipher', shift: shift, charCount: text.length },
          metrics: { operation: 'Decrypt', shift: shift, outputLength: res.plaintext.length, algorithmFamily: 'Substitution (Classical)' },
          notes: 'Reverse character shift modulo 26.'
        });
      }
    });
  }

  function renderCaesarSteps(steps, mode, shift) {
    if (!caesarStepsContainer) return;
    caesarStepsContainer.innerHTML = '';

    if (steps.length === 0) {
      caesarStepsContainer.innerHTML = '<div class="text-muted small">No characters to process.</div>';
      return;
    }

    const header = document.createElement('div');
    header.className = 'mb-2 text-muted small fw-semibold';
    header.innerHTML = mode === 'encrypt'
      ? `Mathematical mapping: E(x) = (x + ${shift}) mod 26`
      : `Mathematical reverse mapping: D(x) = (x - ${shift} + 26) mod 26`;
    caesarStepsContainer.appendChild(header);

    const table = document.createElement('div');
    table.className = 'table-responsive';
    let html = `
      <table class="table table-sm table-bordered font-monospace small mb-0 align-middle">
        <thead>
          <tr style="background:var(--bg-surface);">
            <th style="width:40px;">#</th>
            <th>Input Char</th>
            <th>Index</th>
            <th>Calculation</th>
            <th>Output Char</th>
          </tr>
        </thead>
        <tbody>
    `;

    const limit = Math.min(steps.length, 50);
    for (let i = 0; i < limit; i++) {
      const s = steps[i];
      const charDisplay = s.char === ' ' ? '<span class="text-muted">[Space]</span>' : escapeHtml(s.char);
      const resDisplay = s.resultChar === ' ' ? '<span class="text-muted">[Space]</span>' : escapeHtml(s.resultChar);
      html += `
        <tr>
          <td class="text-muted">${i + 1}</td>
          <td><strong>${charDisplay}</strong></td>
          <td>${s.origIdx !== null ? s.origIdx : '—'}</td>
          <td><code>${escapeHtml(s.calc)}</code></td>
          <td class="text-primary fw-bold">${resDisplay}</td>
        </tr>
      `;
    }

    if (steps.length > limit) {
      html += `<tr><td colspan="5" class="text-muted text-center py-2">… and ${steps.length - limit} more characters transformed similarly</td></tr>`;
    }

    html += `</tbody></table>`;
    table.innerHTML = html;
    caesarStepsContainer.appendChild(table);
  }

  if (btnCaesarReset) {
    btnCaesarReset.addEventListener('click', function () {
      if (caesarPlaintext) caesarPlaintext.value = '';
      if (caesarShift) {
        caesarShift.value = '3';
        caesarShift.classList.remove('is-invalid');
      }
      if (caesarShiftVal) caesarShiftVal.textContent = '3';
      if (caesarOutputSection) caesarOutputSection.style.display = 'none';
      if (caesarEmptyPlaceholder) caesarEmptyPlaceholder.style.display = 'block';
      hideCaesarError();
    });
  }

  if (btnCaesarCopy) {
    btnCaesarCopy.addEventListener('click', function () {
      copyToClipboard(caesarCiphertextOutput ? caesarCiphertextOutput.textContent : '', btnCaesarCopy);
    });
  }

  /* ═══════════════════════════════════════════════════════════
       2. SUBSTITUTION CIPHER CONTROLLER
  ══════════════════════════════════════════════════════════════ */
  function showSubError(msg) {
    if (subError) {
      subError.textContent = msg;
      subError.style.display = 'block';
    }
  }

  function hideSubError() {
    if (subError) {
      subError.textContent = '';
      subError.style.display = 'none';
    }
    if (subKey) subKey.classList.remove('is-invalid');
  }

  function updateSubKeyCounter() {
    if (!subKey || !subKeyCounter) return;
    const len = (subKey.value || '').trim().length;
    subKeyCounter.textContent = `${len}/26`;
    if (len === 26) {
      subKeyCounter.className = 'badge bg-success font-monospace';
    } else {
      subKeyCounter.className = 'badge bg-secondary font-monospace';
    }
  }

  if (subKey) {
    subKey.addEventListener('input', function () {
      this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '');
      updateSubKeyCounter();
      const val = SMARTNET.Encryption.Substitution.validateKey(this.value);
      if (val.valid) {
        hideSubError();
      }
    });
    updateSubKeyCounter();
  }

  // Key presets
  if (btnSubKeyRandom) {
    btnSubKeyRandom.addEventListener('click', function () {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = letters[i];
        letters[i] = letters[j];
        letters[j] = temp;
      }
      const randKey = letters.join('');
      if (subKey) {
        subKey.value = randKey;
        updateSubKeyCounter();
        hideSubError();
      }
    });
  }

  if (btnSubKeyQwerty) {
    btnSubKeyQwerty.addEventListener('click', function () {
      if (subKey) {
        subKey.value = 'QWERTYUIOPASDFGHJKLZXCVBNM';
        updateSubKeyCounter();
        hideSubError();
      }
    });
  }

  if (btnSubKeyReverse) {
    btnSubKeyReverse.addEventListener('click', function () {
      if (subKey) {
        subKey.value = 'ZYXWVUTSRQPONMLKJIHGFEDCBA';
        updateSubKeyCounter();
        hideSubError();
      }
    });
  }

  if (btnSubEncrypt) {
    btnSubEncrypt.addEventListener('click', function () {
      hideSubError();
      const text = subPlaintext ? subPlaintext.value : '';
      if (!text || text.trim().length === 0) {
        showSubError('Please enter plaintext in the input box to encrypt.');
        return;
      }
      const keyVal = subKey ? subKey.value : '';
      const validation = SMARTNET.Encryption.Substitution.validateKey(keyVal);
      if (!validation.valid) {
        if (subKey) subKey.classList.add('is-invalid');
        showSubError(validation.error);
        return;
      }

      const res = SMARTNET.Encryption.Substitution.encrypt(text, validation.key);
      if (subCiphertextOutput) subCiphertextOutput.textContent = res.ciphertext;
      renderSubMapping(validation.key, res.steps, 'encrypt');
      if (subOutputSection) subOutputSection.style.display = 'block';
      if (subEmptyPlaceholder) subEmptyPlaceholder.style.display = 'none';

      // Record to integration
      if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
        SMARTNET.Integration.saveResult({
          experiment: 'Substitution Cipher Encryption',
          module: 'encryption',
          status: 'Completed',
          parameters: { algorithm: 'Substitution Cipher', key: validation.key, charCount: text.length },
          metrics: { operation: 'Encrypt', outputLength: res.ciphertext.length, algorithmFamily: 'Substitution (Classical)' },
          notes: 'Monoalphabetic letter mapping.'
        });
      }
    });
  }

  if (btnSubDecrypt) {
    btnSubDecrypt.addEventListener('click', function () {
      hideSubError();
      const text = subPlaintext ? subPlaintext.value : '';
      if (!text || text.trim().length === 0) {
        showSubError('Please enter ciphertext in the input box to decrypt.');
        return;
      }
      const keyVal = subKey ? subKey.value : '';
      const validation = SMARTNET.Encryption.Substitution.validateKey(keyVal);
      if (!validation.valid) {
        if (subKey) subKey.classList.add('is-invalid');
        showSubError(validation.error);
        return;
      }

      const res = SMARTNET.Encryption.Substitution.decrypt(text, validation.key);
      if (subCiphertextOutput) subCiphertextOutput.textContent = res.plaintext;
      renderSubMapping(validation.key, res.steps, 'decrypt');
      if (subOutputSection) subOutputSection.style.display = 'block';
      if (subEmptyPlaceholder) subEmptyPlaceholder.style.display = 'none';

      // Record to integration
      if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
        SMARTNET.Integration.saveResult({
          experiment: 'Substitution Cipher Decryption',
          module: 'encryption',
          status: 'Completed',
          parameters: { algorithm: 'Substitution Cipher', key: validation.key, charCount: text.length },
          metrics: { operation: 'Decrypt', outputLength: res.plaintext.length, algorithmFamily: 'Substitution (Classical)' },
          notes: 'Reverse monoalphabetic letter mapping.'
        });
      }
    });
  }

  function renderSubMapping(key, steps, mode) {
    if (!subStepsContainer) return;
    subStepsContainer.innerHTML = '';

    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const mappingBox = document.createElement('div');
    mappingBox.className = 'table-responsive mb-3';

    let mapHtml = `
      <table class="table table-sm table-bordered text-center font-monospace small mb-0 align-middle">
        <thead>
          <tr style="background:var(--bg-surface);">
            <th style="font-size:0.75rem;">Plain</th>
    `;
    for (let i = 0; i < 26; i++) {
      mapHtml += `<th>${alpha[i]}</th>`;
    }
    mapHtml += `
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="fw-bold text-primary" style="font-size:0.75rem;">Cipher</td>
    `;
    for (let i = 0; i < 26; i++) {
      mapHtml += `<td class="fw-bold text-success">${key[i]}</td>`;
    }
    mapHtml += `
          </tr>
        </tbody>
      </table>
    `;
    mappingBox.innerHTML = mapHtml;
    subStepsContainer.appendChild(mappingBox);

    // Transformation log
    const logBox = document.createElement('div');
    logBox.className = 'table-responsive';
    let logHtml = `
      <div class="small fw-semibold text-muted mb-1">Character Transformation Details (${mode === 'encrypt' ? 'Plain ➔ Cipher' : 'Cipher ➔ Plain'}):</div>
      <table class="table table-sm table-bordered font-monospace small mb-0 align-middle">
        <thead>
          <tr style="background:var(--bg-surface);">
            <th style="width:40px;">#</th>
            <th>Input</th>
            <th>Substitution Mapping</th>
            <th>Output</th>
          </tr>
        </thead>
        <tbody>
    `;

    const limit = Math.min(steps.length, 50);
    for (let i = 0; i < limit; i++) {
      const s = steps[i];
      const charDisplay = s.char === ' ' ? '<span class="text-muted">[Space]</span>' : escapeHtml(s.char);
      const resDisplay = s.resultChar === ' ' ? '<span class="text-muted">[Space]</span>' : escapeHtml(s.resultChar);
      logHtml += `
        <tr>
          <td class="text-muted">${i + 1}</td>
          <td><strong>${charDisplay}</strong></td>
          <td><code>${escapeHtml(s.calc)}</code></td>
          <td class="text-primary fw-bold">${resDisplay}</td>
        </tr>
      `;
    }
    if (steps.length > limit) {
      logHtml += `<tr><td colspan="4" class="text-muted text-center py-2">… and ${steps.length - limit} more characters transformed similarly</td></tr>`;
    }
    logHtml += `</tbody></table>`;
    logBox.innerHTML = logHtml;
    subStepsContainer.appendChild(logBox);
  }

  if (btnSubReset) {
    btnSubReset.addEventListener('click', function () {
      if (subPlaintext) subPlaintext.value = '';
      if (subKey) {
        subKey.value = 'QWERTYUIOPASDFGHJKLZXCVBNM';
        subKey.classList.remove('is-invalid');
      }
      updateSubKeyCounter();
      if (subOutputSection) subOutputSection.style.display = 'none';
      if (subEmptyPlaceholder) subEmptyPlaceholder.style.display = 'block';
      hideSubError();
    });
  }

  if (btnSubCopy) {
    btnSubCopy.addEventListener('click', function () {
      copyToClipboard(subCiphertextOutput ? subCiphertextOutput.textContent : '', btnSubCopy);
    });
  }

  /* ═══════════════════════════════════════════════════════════
       3. TRANSPOSITION CIPHER CONTROLLER
  ══════════════════════════════════════════════════════════════ */
  function showTransError(msg) {
    if (transError) {
      transError.textContent = msg;
      transError.style.display = 'block';
    }
  }

  function hideTransError() {
    if (transError) {
      transError.textContent = '';
      transError.style.display = 'none';
    }
    if (transKey) transKey.classList.remove('is-invalid');
  }

  function validateTransKey(textLength) {
    if (!transKey) return 4;
    const raw = (transKey.value || '').trim();
    const val = SMARTNET.Encryption.Transposition.validateColumns(raw, textLength);
    if (!val.valid) {
      transKey.classList.add('is-invalid');
      showTransError(val.error);
      return null;
    }
    transKey.classList.remove('is-invalid');
    return val.cols;
  }

  if (transKey) {
    transKey.addEventListener('input', function () {
      const textLen = (transPlaintext && transPlaintext.value) ? transPlaintext.value.length : 0;
      if (validateTransKey(textLen) !== null) {
        hideTransError();
      }
    });
  }

  if (btnTransEncrypt) {
    btnTransEncrypt.addEventListener('click', function () {
      hideTransError();
      const text = transPlaintext ? transPlaintext.value : '';
      if (!text || text.trim().length === 0) {
        showTransError('Please enter plaintext in the input box to encrypt.');
        return;
      }
      const cols = validateTransKey(text.length);
      if (cols === null) return;

      const res = SMARTNET.Encryption.Transposition.encrypt(text, cols);
      if (transCiphertextOutput) transCiphertextOutput.textContent = res.ciphertext;
      renderTransGrid(res.grid, res.rows, res.cols, 'encrypt', text.length);
      if (transOutputSection) transOutputSection.style.display = 'block';
      if (transEmptyPlaceholder) transEmptyPlaceholder.style.display = 'none';

      // Record to integration
      if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
        SMARTNET.Integration.saveResult({
          experiment: 'Transposition Cipher Encryption',
          module: 'encryption',
          status: 'Completed',
          parameters: { algorithm: 'Columnar Transposition', columns: cols, charCount: text.length },
          metrics: { operation: 'Encrypt', columns: cols, rows: res.rows, outputLength: res.ciphertext.length, algorithmFamily: 'Permutation (Classical)' },
          notes: 'Column-by-column permutation readout.'
        });
      }
    });
  }

  if (btnTransDecrypt) {
    btnTransDecrypt.addEventListener('click', function () {
      hideTransError();
      const text = transPlaintext ? transPlaintext.value : '';
      if (!text || text.trim().length === 0) {
        showTransError('Please enter ciphertext in the input box to decrypt.');
        return;
      }
      const cols = validateTransKey(text.length);
      if (cols === null) return;

      const res = SMARTNET.Encryption.Transposition.decrypt(text, cols);
      if (transCiphertextOutput) transCiphertextOutput.textContent = res.plaintext;
      renderTransGrid(res.grid, res.rows, res.cols, 'decrypt', text.length);
      if (transOutputSection) transOutputSection.style.display = 'block';
      if (transEmptyPlaceholder) transEmptyPlaceholder.style.display = 'none';

      // Record to integration
      if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
        SMARTNET.Integration.saveResult({
          experiment: 'Transposition Cipher Decryption',
          module: 'encryption',
          status: 'Completed',
          parameters: { algorithm: 'Columnar Transposition', columns: cols, charCount: text.length },
          metrics: { operation: 'Decrypt', columns: cols, rows: res.rows, outputLength: res.plaintext.length, algorithmFamily: 'Permutation (Classical)' },
          notes: 'Column length reconstruction and row-by-row readout.'
        });
      }
    });
  }

  function renderTransGrid(grid, rows, cols, mode, totalChars) {
    if (!transGridContainer) return;
    transGridContainer.innerHTML = '';

    const summary = document.createElement('div');
    summary.className = 'small text-muted mb-2';
    summary.innerHTML = `<strong>Matrix Dimension:</strong> ${rows} Rows × ${cols} Columns (${totalChars} Total Characters). ${mode === 'encrypt' ? 'Read columns left-to-right (Col 1 ➔ Col ' + cols + ').' : 'Reconstructed matrix read row-by-row.'}`;
    transGridContainer.appendChild(summary);

    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-responsive';

    let html = `
      <table class="table table-sm table-bordered text-center font-monospace small mb-0 align-middle">
        <thead>
          <tr style="background:var(--bg-surface);">
            <th style="width:60px;">Row \\ Col</th>
    `;
    for (let c = 0; c < cols; c++) {
      html += `<th class="text-primary">Col ${c + 1}</th>`;
    }
    html += `</tr></thead><tbody>`;

    for (let r = 0; r < rows; r++) {
      html += `<tr><td class="text-muted fw-bold">Row ${r + 1}</td>`;
      for (let c = 0; c < cols; c++) {
        const val = grid[r] ? grid[r][c] : null;
        if (val === null || val === undefined) {
          html += `<td class="text-muted" style="background:rgba(0,0,0,0.04); font-size:0.75rem;">[empty]</td>`;
        } else if (val === ' ') {
          html += `<td class="text-muted fw-bold" style="background:rgba(79,142,247,0.06);">[␣]</td>`;
        } else {
          html += `<td class="fw-bold" style="font-size:0.95rem;">${escapeHtml(val)}</td>`;
        }
      }
      html += `</tr>`;
    }

    html += `</tbody></table>`;
    tableWrapper.innerHTML = html;
    transGridContainer.appendChild(tableWrapper);
  }

  if (btnTransReset) {
    btnTransReset.addEventListener('click', function () {
      if (transPlaintext) transPlaintext.value = '';
      if (transKey) {
        transKey.value = '4';
        transKey.classList.remove('is-invalid');
      }
      if (transOutputSection) transOutputSection.style.display = 'none';
      if (transEmptyPlaceholder) transEmptyPlaceholder.style.display = 'block';
      hideTransError();
    });
  }

  if (btnTransCopy) {
    btnTransCopy.addEventListener('click', function () {
      copyToClipboard(transCiphertextOutput ? transCiphertextOutput.textContent : '', btnTransCopy);
    });
  }

  /* ── Utilities ───────────────────────────────────────────── */
  function copyToClipboard(text, btnElement) {
    if (!text) return;
    if (!navigator.clipboard) {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      flashBtn(btnElement);
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      flashBtn(btnElement);
    }).catch(err => {
      console.warn('Clipboard write error:', err);
    });
  }

  function flashBtn(btn) {
    if (!btn) return;
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Copied!';
    btn.classList.add('btn-success');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove('btn-success');
    }, 2000);
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

});
