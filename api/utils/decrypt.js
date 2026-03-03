const CryptoJS = require('crypto-js');

// The base64-encoded AES-256 key
const CIPHER_KEY_BASE64 = "K9vT2mQxL8fWcD3pRZyU+Sa7nB1/M4tHgC6JkPwXe5qOVFbE2rYnLsZdVuA0GhT9";

// Decode the base64 key to get the actual 32-byte AES-256 key
function getKey() {
  // Remove any whitespace and decode base64
  const cleanKey = CIPHER_KEY_BASE64.replace(/\s/g, '');
  const keyWords = CryptoJS.enc.Base64.parse(cleanKey);
  return keyWords;
}

/**
 * Decrypt AES-256-GCM response
 * Format: { encrypted: true, data: "<base64(12-byte IV + ciphertext)>" }
 */
function decryptCipherResponse(response, keyBase64 = CIPHER_KEY_BASE64) {
  try {
    // If response is string, try to parse as JSON
    let data = response;
    if (typeof response === 'string') {
      try {
        data = JSON.parse(response);
      } catch (e) {
        // Not JSON, treat as raw encrypted string
        return decryptRaw(response, keyBase64);
      }
    }

    // Check if it's the encrypted format
    if (data && data.encrypted === true && data.data) {
      return decryptRaw(data.data, keyBase64);
    }

    // If not encrypted, return as-is
    if (data && (data.sources || data.streams || data.url || data.success)) {
      return data;
    }

    return null;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
}

/**
 * Decrypt raw base64 string (IV + ciphertext)
 * IV = first 12 bytes, rest = ciphertext
 */
function decryptRaw(base64String, keyBase64) {
  try {
    // Clean the base64 string
    const cleanBase64 = base64String.replace(/\s/g, '');
    
    // Decode base64 to WordArray
    const encryptedWords = CryptoJS.enc.Base64.parse(cleanBase64);
    const encryptedBytes = wordArrayToUint8Array(encryptedWords);
    
    if (encryptedBytes.length < 13) {
      throw new Error('Data too short (needs at least 12 bytes IV + 1 byte ciphertext)');
    }

    // Extract IV (first 12 bytes) and ciphertext (rest)
    const iv = encryptedBytes.slice(0, 12);
    const ciphertext = encryptedBytes.slice(12);

    // Decode the key from base64
    const keyClean = keyBase64.replace(/\s/g, '');
    const keyWords = CryptoJS.enc.Base64.parse(keyClean);
    
    // Convert to proper format for CryptoJS
    const ivWords = bytesToWordArray(iv);
    const ciphertextWords = bytesToWordArray(ciphertext);

    // Try AES-GCM decryption
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertextWords },
      keyWords,
      {
        iv: ivWords,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.NoPadding
      }
    );

    const result = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!result) {
      throw new Error('Decryption returned empty result');
    }

    // Try to parse as JSON
    try {
      return JSON.parse(result);
    } catch (e) {
      // Return as string if not valid JSON
      return { decryptedText: result, isJson: false };
    }

  } catch (error) {
    console.error('Raw decryption failed:', error.message);
    
    // Fallback: try different methods
    return tryFallbackDecryption(base64String, keyBase64);
  }
}

/**
 * Fallback decryption methods
 */
function tryFallbackDecryption(base64String, keyBase64) {
  const methods = [
    // Method 1: Standard AES-CBC with IV prepended
    () => {
      const encrypted = CryptoJS.enc.Base64.parse(base64String);
      const bytes = wordArrayToUint8Array(encrypted);
      const iv = bytes.slice(0, 16);
      const ciphertext = bytes.slice(16);
      
      const key = CryptoJS.enc.Base64.parse(keyBase64);
      
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: bytesToWordArray(ciphertext) },
        key,
        { iv: bytesToWordArray(iv), mode: CryptoJS.mode.CBC }
      );
      
      return decrypted.toString(CryptoJS.enc.Utf8);
    },
    
    // Method 2: Direct AES decrypt (ECB)
    () => {
      const key = CryptoJS.enc.Base64.parse(keyBase64);
      const decrypted = CryptoJS.AES.decrypt(base64String, key, {
        mode: CryptoJS.mode.ECB
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    },
    
    // Method 3: Try as simple base64 decode (maybe not encrypted)
    () => {
      const decoded = atob(base64String);
      return decoded;
    }
  ];

  for (let i = 0; i < methods.length; i++) {
    try {
      const result = methods[i]();
      if (result && result.length > 0) {
        console.log(`Fallback method ${i + 1} succeeded`);
        try {
          return JSON.parse(result);
        } catch (e) {
          return { decryptedText: result, isJson: false, method: `fallback-${i + 1}` };
        }
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

/**
 * Convert WordArray to Uint8Array
 */
function wordArrayToUint8Array(wordArray) {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  
  for (let i = 0; i < sigBytes; i++) {
    const byte = (words[Math.floor(i / 4)] >>> (24 - (i % 4) * 8)) & 0xff;
    u8[i] = byte;
  }
  
  return u8;
}

/**
 * Convert Uint8Array to WordArray
 */
function bytesToWordArray(bytes) {
  const words = [];
  for (let i = 0; i < bytes.length; i++) {
    words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

/**
 * Clean headers for proxy requests
 */
function cleanHeaders(headers) {
  if (!headers || typeof headers !== 'object') return {};
  
  const cleaned = {};
  const allowed = ['referer', 'origin', 'user-agent', 'accept', 'accept-language'];
  
  for (const key of allowed) {
    const value = headers[key] || headers[key.toLowerCase()];
    if (value) cleaned[key] = value;
  }
  
  return cleaned;
}

/**
 * Clean URL (remove proxy prefixes if present)
 */
function cleanUrl(url) {
  if (!url) return '';
  
  // If URL is wrapped in a proxy, extract the original
  if (url.includes('/proxy?url=')) {
    const match = url.match(/[?&]url=([^&]+)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch (e) {
        return url;
      }
    }
  }
  
  return url;
}

module.exports = {
  decryptCipherResponse,
  decryptRaw,
  cleanHeaders,
  cleanUrl,
  CIPHER_KEY_BASE64
};
