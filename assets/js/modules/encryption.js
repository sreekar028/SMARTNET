/**
 * SMARTNET — assets/js/modules/encryption.js
 * Encryption & Decryption Simulation Module (Member 5)
 *
 * Implements:
 *   1. Caesar Cipher (Educational / Historical Demonstration)
 *      - Configurable shift key (-25 to +25)
 *      - Character-by-character transformation visualizer
 *      - Case preservation and non-alphabetic character handling
 *      - Step-by-step mathematical demonstration: E(x) = (x + k) mod 26, D(x) = (x - k) mod 26
 *
 *   2. AES-GCM (Modern Authenticated Symmetric Encryption)
 *      - Web Crypto API (SubtleCrypto: AES-GCM, 128/256-bit keys)
 *      - Cryptographically secure 96-bit fresh Nonce / IV generated per encryption
 *      - PBKDF2 key derivation from passphrase (100,000 iterations SHA-256) or raw 256-bit key
 *      - Ciphertext + 128-bit Authentication Tag handling
 *      - Tamper detection and authentication failure handling
 *      - Zero hardcoded keys, zero logging of keys or plaintext
 *
 * Results are safely recorded to SMARTNET.Integration.saveResult()
 * without logging secret keys or confidential plaintext.
 */

var SMARTNET = window.SMARTNET || {};

SMARTNET.Encryption = (function () {
  'use strict';

  /* ── 1. Caesar Cipher Engine (Educational) ───────────────── */
  const Caesar = {
    encrypt: function (plaintext, shift) {
      shift = ((shift % 26) + 26) % 26;
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
      shift = ((shift % 26) + 26) % 26;
      // Decrypt is encrypt with 26 - shift
      const decShift = (26 - shift) % 26;
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

  /* ── 2. Modern AES-GCM Engine (Web Crypto API) ───────────── */
  const AesGcm = {
    isSupported: function () {
      return typeof window !== 'undefined' &&
             window.crypto &&
             window.crypto.subtle &&
             typeof window.crypto.subtle.encrypt === 'function';
    },

    // Convert Buffer to Hex string
    bufToHex: function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (x) {
        return ('00' + x.toString(16)).slice(-2);
      }).join('');
    },

    // Convert Hex string to Uint8Array
    hexToBuf: function (hexString) {
      const cleanHex = hexString.replace(/[^0-9a-fA-F]/g, '');
      if (cleanHex.length % 2 !== 0) {
        throw new Error('Hex string must have an even length.');
      }
      const bytes = new Uint8Array(cleanHex.length / 2);
      for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
      }
      return bytes;
    },

    // Convert Buffer to Base64
    bufToBase64: function (buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    },

    // Convert Base64 to Uint8Array
    base64ToBuf: function (base64) {
      const binary_string = window.atob(base64.trim());
      const len = binary_string.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes;
    },

    // Derive AES-GCM CryptoKey from user passphrase via PBKDF2 (100,000 rounds SHA-256)
    deriveKey: async function (passphrase, saltBytes, keyLengthBits) {
      const enc = new TextEncoder();
      const passKey = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(passphrase),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      return await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBytes,
          iterations: 100000,
          hash: 'SHA-256'
        },
        passKey,
        { name: 'AES-GCM', length: keyLengthBits },
        false,
        ['encrypt', 'decrypt']
      );
    },

    // Generate fresh random Nonce / IV (96-bit standard for GCM)
    generateNonce: function () {
      const iv = new Uint8Array(12); // 96 bits
      window.crypto.getRandomValues(iv);
      return iv;
    },

    // Generate random Salt (128-bit)
    generateSalt: function () {
      const salt = new Uint8Array(16); // 128 bits
      window.crypto.getRandomValues(salt);
      return salt;
    },

    /**
     * Encrypt Plaintext using AES-GCM
     * Output format:
     * Structured JSON package: { v: 1, alg: "AES-GCM", keyBits, saltHex, nonceHex, ciphertextHex, tagHex }
     */
    encrypt: async function (plaintext, passphrase, keyLengthBits = 256) {
      if (!this.isSupported()) {
        throw new Error('Web Crypto API (AES-GCM) is not supported in this browser environment.');
      }
      if (!passphrase || passphrase.length < 1) {
        throw new Error('A secret passphrase/key is required for AES-GCM encryption.');
      }

      const enc = new TextEncoder();
      const data = enc.encode(plaintext);

      // 1. Generate fresh salt and IV/nonce
      const salt = this.generateSalt();
      const iv = this.generateNonce();

      // 2. Derive key
      const key = await this.deriveKey(passphrase, salt, keyLengthBits);

      // 3. Encrypt with AES-GCM (tagLength 128 bits)
      // Web Crypto appends the 16-byte authentication tag to the end of ciphertext buffer
      const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          tagLength: 128
        },
        key,
        data
      );

      const encArray = new Uint8Array(encryptedBuffer);
      const tagLengthBytes = 16;
      const cipherBytes = encArray.slice(0, encArray.length - tagLengthBytes);
      const tagBytes = encArray.slice(encArray.length - tagLengthBytes);

      const saltHex = this.bufToHex(salt);
      const ivHex = this.bufToHex(iv);
      const cipherHex = this.bufToHex(cipherBytes);
      const tagHex = this.bufToHex(tagBytes);
      const combinedHex = this.bufToHex(encArray);

      // Package for portable exchange/decryption
      const packageObj = {
        v: 1,
        alg: 'AES-GCM',
        keyBits: keyLengthBits,
        saltHex: saltHex,
        nonceHex: ivHex,
        ciphertextHex: cipherHex,
        authTagHex: tagHex
      };

      return {
        packageJson: JSON.stringify(packageObj, null, 2),
        packageBase64: this.bufToBase64(new TextEncoder().encode(JSON.stringify(packageObj))),
        saltHex,
        ivHex,
        cipherHex,
        tagHex,
        combinedHex,
        plainBytes: data.length,
        cipherBytes: cipherBytes.length,
        tagBytes: tagBytes.length,
        nonceBytes: iv.length
      };
    },

    /**
     * Decrypt AES-GCM package or separate parameters
     */
    decrypt: async function (packageInput, passphrase) {
      if (!this.isSupported()) {
        throw new Error('Web Crypto API (AES-GCM) is not supported in this browser environment.');
      }
      if (!passphrase || passphrase.length < 1) {
        throw new Error('Passphrase is required for decryption.');
      }

      let parsed;
      if (typeof packageInput === 'string') {
        let trimmed = packageInput.trim();
        // Check if Base64 encoded JSON
        if (trimmed.startsWith('{')) {
          parsed = JSON.parse(trimmed);
        } else {
          try {
            const decodedStr = new TextDecoder().decode(this.base64ToBuf(trimmed));
            parsed = JSON.parse(decodedStr);
          } catch (_) {
            throw new Error('Invalid input format. Please provide valid AES-GCM JSON package or Base64 bundle.');
          }
        }
      } else {
        parsed = packageInput;
      }

      if (!parsed.saltHex || !parsed.nonceHex || !parsed.ciphertextHex || !parsed.authTagHex) {
        throw new Error('Missing required cryptographic components (saltHex, nonceHex, ciphertextHex, or authTagHex).');
      }

      const salt = this.hexToBuf(parsed.saltHex);
      const iv = this.hexToBuf(parsed.nonceHex);
      const cipher = this.hexToBuf(parsed.ciphertextHex);
      const tag = this.hexToBuf(parsed.authTagHex);
      const keyLengthBits = parsed.keyBits || 256;

      // Reconstruct combined ciphertext + tag as Web Crypto expects
      const combined = new Uint8Array(cipher.length + tag.length);
      combined.set(cipher, 0);
      combined.set(tag, cipher.length);

      // Derive key with supplied passphrase & stored salt
      const key = await this.deriveKey(passphrase, salt, keyLengthBits);

      try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv,
            tagLength: 128
          },
          key,
          combined
        );

        const dec = new TextDecoder();
        const plaintext = dec.decode(decryptedBuffer);

        return {
          plaintext,
          verified: true,
          keyBits: keyLengthBits,
          nonceHex: parsed.nonceHex,
          tagHex: parsed.authTagHex
        };
      } catch (err) {
        // Tag mismatch or wrong key throws OperationError in Web Crypto
        throw new Error('Decryption Failed: Authentication Tag verification failed or incorrect passphrase. The ciphertext may have been tampered with.');
      }
    }
  };

  return {
    Caesar,
    AesGcm
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
  const caesarPanel = document.getElementById('panel-caesar');
  const aesPanel = document.getElementById('panel-aes');

  // Caesar elements
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

  // AES elements
  const aesModeEncrypt = document.getElementById('aes-mode-encrypt');
  const aesModeDecrypt = document.getElementById('aes-mode-decrypt');
  const aesEncryptControls = document.getElementById('aes-encrypt-controls');
  const aesDecryptControls = document.getElementById('aes-decrypt-controls');
  const aesKeyLength = document.getElementById('aes-key-length');
  const aesPassphrase = document.getElementById('aes-passphrase');
  const aesPassphraseDec = document.getElementById('aes-passphrase-dec');
  const aesPlaintext = document.getElementById('aes-plaintext');
  const aesCiphertextInput = document.getElementById('aes-ciphertext-input');
  const btnAesEncrypt = document.getElementById('btn-aes-encrypt');
  const btnAesDecrypt = document.getElementById('btn-aes-decrypt');
  const btnAesReset = document.getElementById('btn-aes-reset');
  const aesOutputSection = document.getElementById('aes-output-section');
  const aesResultCard = document.getElementById('aes-result-card');
  const aesError = document.getElementById('aes-error');
  const btnAesCopy = document.getElementById('btn-aes-copy');
  const btnAesPasteToDec = document.getElementById('btn-aes-paste-to-dec');
  const btnAesTamperTest = document.getElementById('btn-aes-tamper-test');

  // Algorithm Switching
  algoTabs.forEach(tab => {
    tab.addEventListener('click', function () {
      algoTabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const target = this.getAttribute('data-algo');
      if (target === 'caesar') {
        caesarPanel.style.display = 'block';
        aesPanel.style.display = 'none';
      } else {
        caesarPanel.style.display = 'none';
        aesPanel.style.display = 'block';
      }
    });
  });

  /* ── Caesar Handlers ─────────────────────────────────────── */
  if (caesarShift && caesarShiftVal) {
    caesarShift.addEventListener('input', function () {
      caesarShiftVal.textContent = this.value;
    });
  }

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
  }

  if (btnCaesarEncrypt) {
    btnCaesarEncrypt.addEventListener('click', function () {
      hideCaesarError();
      const text = caesarPlaintext.value;
      if (!text || text.trim().length === 0) {
        showCaesarError('Please enter plaintext to encrypt.');
        return;
      }
      const shift = parseInt(caesarShift.value, 10) || 3;
      const res = SMARTNET.Encryption.Caesar.encrypt(text, shift);

      caesarCiphertextOutput.textContent = res.ciphertext;
      renderCaesarSteps(res.steps, 'encrypt', shift);
      caesarOutputSection.style.display = 'block';
      const emptyPl = document.getElementById('caesar-empty-placeholder');
      if (emptyPl) emptyPl.style.display = 'none';

      // Save to results center
      if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
        SMARTNET.Integration.saveResult({
          experiment: 'Caesar Cipher Encryption',
          module: 'encryption',
          status: 'Completed',
          parameters: { algorithm: 'Caesar Cipher', shift: shift, charCount: text.length },
          metrics: { operation: 'Encrypt', shift: shift, outputLength: res.ciphertext.length, algorithmFamily: 'Substitution (Historical)' },
          notes: 'Educational demonstration only. Caesar shift is not secure for production use.'
        });
      }
    });
  }

  if (btnCaesarDecrypt) {
    btnCaesarDecrypt.addEventListener('click', function () {
      hideCaesarError();
      const text = caesarPlaintext.value;
      if (!text || text.trim().length === 0) {
        showCaesarError('Please enter ciphertext in the input box to decrypt.');
        return;
      }
      const shift = parseInt(caesarShift.value, 10) || 3;
      const res = SMARTNET.Encryption.Caesar.decrypt(text, shift);

      caesarCiphertextOutput.textContent = res.plaintext;
      renderCaesarSteps(res.steps, 'decrypt', shift);
      caesarOutputSection.style.display = 'block';

      // Save to results center
      if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
        SMARTNET.Integration.saveResult({
          experiment: 'Caesar Cipher Decryption',
          module: 'encryption',
          status: 'Completed',
          parameters: { algorithm: 'Caesar Cipher', shift: shift, charCount: text.length },
          metrics: { operation: 'Decrypt', shift: shift, outputLength: res.plaintext.length, algorithmFamily: 'Substitution (Historical)' },
          notes: 'Decrypted message via reverse Caesar shift.'
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
      ? `Step-by-step transformation: E(x) = (x + ${shift}) mod 26`
      : `Step-by-step reverse transformation: D(x) = (x - ${shift} + 26) mod 26`;
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

    // Limit step display to first 40 characters for smooth UI performance
    const displaySteps = steps.slice(0, 40);
    displaySteps.forEach((st, idx) => {
      html += `
        <tr>
          <td class="text-muted">${idx + 1}</td>
          <td><span class="badge ${st.isAlpha ? 'bg-primary' : 'bg-secondary'}">${st.char === ' ' ? 'SPACE' : escapeHtml(st.char)}</span></td>
          <td>${st.isAlpha ? st.origIdx : '—'}</td>
          <td><code>${escapeHtml(st.calc)}</code></td>
          <td><span class="badge ${st.isAlpha ? 'bg-success' : 'bg-secondary'}">${st.resultChar === ' ' ? 'SPACE' : escapeHtml(st.resultChar)}</span></td>
        </tr>
      `;
    });

    if (steps.length > 40) {
      html += `<tr><td colspan="5" class="text-muted text-center py-2">… and ${steps.length - 40} more characters transformed similarly</td></tr>`;
    }

    html += `</tbody></table>`;
    table.innerHTML = html;
    caesarStepsContainer.appendChild(table);
  }

  if (btnCaesarReset) {
    btnCaesarReset.addEventListener('click', function () {
      caesarPlaintext.value = '';
      caesarShift.value = 3;
      caesarShiftVal.textContent = '3';
      caesarOutputSection.style.display = 'none';
      hideCaesarError();
    });
  }

  if (btnCaesarCopy) {
    btnCaesarCopy.addEventListener('click', function () {
      copyToClipboard(caesarCiphertextOutput.textContent, btnCaesarCopy);
    });
  }

  /* ── AES Handlers ────────────────────────────────────────── */
  if (aesModeEncrypt && aesModeDecrypt) {
    aesModeEncrypt.addEventListener('click', function () {
      aesModeEncrypt.classList.add('active');
      aesModeDecrypt.classList.remove('active');
      aesEncryptControls.style.display = 'block';
      aesDecryptControls.style.display = 'none';
      hideAesError();
      aesOutputSection.style.display = 'none';
    });

    aesModeDecrypt.addEventListener('click', function () {
      aesModeDecrypt.classList.add('active');
      aesModeEncrypt.classList.remove('active');
      aesEncryptControls.style.display = 'none';
      aesDecryptControls.style.display = 'block';
      hideAesError();
      aesOutputSection.style.display = 'none';
    });
  }

  function showAesError(msg) {
    if (aesError) {
      aesError.textContent = msg;
      aesError.style.display = 'block';
    }
  }

  function hideAesError() {
    if (aesError) {
      aesError.textContent = '';
      aesError.style.display = 'none';
    }
  }

  let latestAesPackage = null;

  if (btnAesEncrypt) {
    btnAesEncrypt.addEventListener('click', async function () {
      hideAesError();
      const text = aesPlaintext.value;
      const pass = aesPassphrase.value;
      const keyBits = parseInt(aesKeyLength.value, 10) || 256;

      if (!text || text.trim().length === 0) {
        showAesError('Please enter plaintext to encrypt.');
        return;
      }
      if (!pass || pass.length < 1) {
        showAesError('Please enter a secret passphrase/key.');
        return;
      }

      btnAesEncrypt.disabled = true;
      btnAesEncrypt.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Encrypting…';

      try {
        const res = await SMARTNET.Encryption.AesGcm.encrypt(text, pass, keyBits);
        latestAesPackage = res.packageJson;

        renderAesEncryptOutput(res, keyBits);
        aesOutputSection.style.display = 'block';
        const emptyPl = document.getElementById('aes-empty-placeholder');
        if (emptyPl) emptyPl.style.display = 'none';

        // Safe record to results center: NO keys or raw plaintext stored
        if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
          SMARTNET.Integration.saveResult({
            experiment: 'AES-GCM Authenticated Encryption',
            module: 'encryption',
            status: 'Completed',
            parameters: {
              algorithm: 'AES-GCM',
              keyLength: `${keyBits}-bit`,
              kdf: 'PBKDF2-SHA256 (100k rounds)',
              nonceLength: '96-bit (fresh CSPRNG)',
              tagLength: '128-bit'
            },
            metrics: {
              plainBytes: res.plainBytes,
              cipherBytes: res.cipherBytes,
              tagBytes: res.tagBytes,
              nonceHex: res.ivHex.slice(0, 8) + '…',
              securityStatus: 'Authenticated & Confidential'
            },
            notes: 'Encrypted via browser Web Crypto API. Nonce/IV generated with crypto.getRandomValues().'
          });
        }
      } catch (err) {
        showAesError(err.message);
      } finally {
        btnAesEncrypt.disabled = false;
        btnAesEncrypt.innerHTML = '🔒 Encrypt Message (AES-GCM)';
      }
    });
  }

  if (btnAesDecrypt) {
    btnAesDecrypt.addEventListener('click', async function () {
      hideAesError();
      const cipherPkg = aesCiphertextInput.value;
      const pass = aesPassphraseDec.value;

      if (!cipherPkg || cipherPkg.trim().length === 0) {
        showAesError('Please enter the encrypted AES-GCM package or JSON to decrypt.');
        return;
      }
      if (!pass || pass.length < 1) {
        showAesError('Please enter the secret passphrase used during encryption.');
        return;
      }

      btnAesDecrypt.disabled = true;
      btnAesDecrypt.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Decrypting &amp; Verifying…';

      try {
        const res = await SMARTNET.Encryption.AesGcm.decrypt(cipherPkg, pass);
        renderAesDecryptOutput(res);
        aesOutputSection.style.display = 'block';
        const emptyPl = document.getElementById('aes-empty-placeholder');
        if (emptyPl) emptyPl.style.display = 'none';

        if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
          SMARTNET.Integration.saveResult({
            experiment: 'AES-GCM Decryption & Verification',
            module: 'encryption',
            status: 'Completed',
            parameters: {
              algorithm: 'AES-GCM',
              keyLength: `${res.keyBits}-bit`,
              authTagVerified: true
            },
            metrics: {
              decryptionStatus: 'Success',
              tagVerified: 'Valid Authenticity & Integrity',
              decryptedBytes: res.plaintext.length
            },
            notes: 'Authentication tag matched exactly; plaintext recovered securely.'
          });
        }
      } catch (err) {
        showAesError(err.message);
        if (SMARTNET.Integration && typeof SMARTNET.Integration.saveResult === 'function') {
          SMARTNET.Integration.saveResult({
            experiment: 'AES-GCM Decryption Attempt',
            module: 'encryption',
            status: 'Failed',
            parameters: { algorithm: 'AES-GCM', authTagVerified: false },
            metrics: { error: 'Authentication Tag Mismatch or Wrong Key' },
            notes: 'Decryption failed safely without leaking unauthenticated data.'
          });
        }
      } finally {
        btnAesDecrypt.disabled = false;
        btnAesDecrypt.innerHTML = '🔓 Decrypt &amp; Verify Authenticity';
      }
    });
  }

  function renderAesEncryptOutput(res, keyBits) {
    if (!aesResultCard) return;

    aesResultCard.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-success">AES-GCM ${keyBits}-bit</span>
          <span class="badge bg-primary">Authenticated Encryption</span>
          <span class="badge bg-info text-dark">Fresh 96-bit Nonce</span>
        </div>
        <button class="btn btn-sm btn-outline-secondary" id="btn-copy-aes-pkg">📋 Copy Package</button>
      </div>

      <!-- Process Flow Architecture -->
      <div class="crypto-flow-diagram mb-3 p-3 rounded" style="background:var(--bg-surface);border:1px solid var(--border-color);">
        <div class="small fw-bold text-muted mb-2">CRYPTOGRAPHIC PROCESS FLOW</div>
        <div class="d-flex flex-wrap align-items-center justify-content-center gap-2 text-center font-monospace small">
          <div class="p-2 border rounded" style="background:var(--bg-card);">
            <div>Plaintext</div>
            <div class="text-muted" style="font-size:0.7rem;">${res.plainBytes} bytes</div>
          </div>
          <div>+</div>
          <div class="p-2 border rounded" style="background:var(--bg-card);">
            <div>PBKDF2 Key</div>
            <div class="text-muted" style="font-size:0.7rem;">${keyBits}-bit</div>
          </div>
          <div>+</div>
          <div class="p-2 border rounded" style="background:var(--bg-card);border-color:var(--color-primary)!important;">
            <div class="text-primary fw-bold">Fresh Nonce/IV</div>
            <div class="text-muted" style="font-size:0.7rem;">96-bit CSPRNG</div>
          </div>
          <div>➔</div>
          <div class="p-2 border rounded text-white fw-bold" style="background:var(--color-primary);">
            AES-GCM Engine
          </div>
          <div>➔</div>
          <div class="p-2 border rounded" style="background:var(--bg-card);border-color:var(--color-accent)!important;">
            <div class="text-accent fw-bold">Ciphertext + Tag</div>
            <div class="text-muted" style="font-size:0.7rem;">128-bit Auth Tag</div>
          </div>
        </div>
      </div>

      <!-- Hex breakdown -->
      <div class="row g-2 mb-3 font-monospace small">
        <div class="col-md-6">
          <div class="p-2 border rounded h-100" style="background:var(--bg-surface);">
            <div class="text-muted small fw-bold">FRESH NONCE / IV (96-bit):</div>
            <div class="text-primary text-break mt-1">${res.ivHex}</div>
          </div>
        </div>
        <div class="col-md-6">
          <div class="p-2 border rounded h-100" style="background:var(--bg-surface);">
            <div class="text-muted small fw-bold">AUTHENTICATION TAG (128-bit):</div>
            <div class="text-success text-break mt-1">${res.tagHex}</div>
          </div>
        </div>
        <div class="col-12">
          <div class="p-2 border rounded" style="background:var(--bg-surface);">
            <div class="text-muted small fw-bold">RAW CIPHERTEXT (HEX):</div>
            <div class="text-secondary text-break mt-1">${res.cipherHex}</div>
          </div>
        </div>
      </div>

      <!-- Portable Ciphertext JSON Package -->
      <div class="mb-3">
        <label class="form-label small fw-bold text-muted">Complete Portable Ciphertext Package (JSON):</label>
        <pre class="p-3 border rounded text-light font-monospace small mb-0" id="aes-package-display" style="background:var(--bg-surface);max-height:180px;overflow-y:auto;">${escapeHtml(res.packageJson)}</pre>
      </div>

      <!-- Action buttons -->
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-sm btn-outline-primary" id="btn-transfer-to-dec">
          ➔ Transfer to Decryptor Tab
        </button>
      </div>
    `;

    const copyBtn = document.getElementById('btn-copy-aes-pkg');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyToClipboard(res.packageJson, copyBtn);
      });
    }

    const transferBtn = document.getElementById('btn-transfer-to-dec');
    if (transferBtn) {
      transferBtn.addEventListener('click', function () {
        aesModeDecrypt.click();
        aesCiphertextInput.value = res.packageJson;
        aesPassphraseDec.value = aesPassphrase.value;
      });
    }
  }

  function renderAesDecryptOutput(res) {
    if (!aesResultCard) return;

    aesResultCard.innerHTML = `
      <div class="alert alert-success d-flex align-items-center gap-2 mb-3">
        <span style="font-size:1.4rem;">✅</span>
        <div>
          <div class="fw-bold">Authentication &amp; Integrity Verified!</div>
          <div class="small">The 128-bit GCM authentication tag matches perfectly. The message has not been tampered with and was verified using the correct key.</div>
        </div>
      </div>

      <div class="p-3 border rounded mb-3" style="background:var(--bg-surface);">
        <label class="form-label small fw-bold text-muted">RECOVERED ORIGINAL PLAINTEXT:</label>
        <div class="p-3 border rounded bg-card font-monospace fw-bold fs-6 text-primary" style="white-space:pre-wrap;">${escapeHtml(res.plaintext)}</div>
      </div>

      <div class="row g-2 font-monospace small">
        <div class="col-md-6">
          <div class="p-2 border rounded" style="background:var(--bg-surface);">
            <span class="text-muted">Algorithm:</span> AES-GCM (${res.keyBits}-bit)
          </div>
        </div>
        <div class="col-md-6">
          <div class="p-2 border rounded" style="background:var(--bg-surface);">
            <span class="text-muted">Auth Tag:</span> Valid (Integrity Guaranteed)
          </div>
        </div>
      </div>
    `;
  }

  if (btnAesReset) {
    btnAesReset.addEventListener('click', function () {
      aesPlaintext.value = '';
      aesPassphrase.value = '';
      aesCiphertextInput.value = '';
      aesPassphraseDec.value = '';
      aesOutputSection.style.display = 'none';
      hideAesError();
      const emptyPl = document.getElementById('aes-empty-placeholder');
      if (emptyPl) emptyPl.style.display = 'block';
    });
  }

  // Tamper testing button to demonstrate authentication failure
  if (btnAesTamperTest) {
    btnAesTamperTest.addEventListener('click', function () {
      let val = aesCiphertextInput.value.trim();
      if (!val) {
        showAesError('Please load an encrypted package first to test tampering.');
        return;
      }
      try {
        let pkg = JSON.parse(val);
        if (pkg.ciphertextHex && pkg.ciphertextHex.length > 2) {
          // Flip the first character
          let flipped = pkg.ciphertextHex[0] === 'a' ? 'b' : 'a';
          pkg.ciphertextHex = flipped + pkg.ciphertextHex.slice(1);
          aesCiphertextInput.value = JSON.stringify(pkg, null, 2);
          showAesError('Notice: 1 bit of the ciphertext was tampered with. Now click "Decrypt & Verify Authenticity" to observe how AES-GCM detects corruption and prevents decryption.');
        }
      } catch (e) {
        showAesError('Could not tamper: Input is not a JSON package.');
      }
    });
  }

  /* ── Utilities ───────────────────────────────────────────── */
  function copyToClipboard(text, btnElement) {
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
