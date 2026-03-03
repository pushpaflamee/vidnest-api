// Node.js Web Crypto API implementation
const crypto = require('crypto').webcrypto;

const CIPHER_KEY_BASE64 = "K9vT2mQxL8fWcD3pRZyU+Sa7nB1/M4tHgC6JkPwXe5qOVFbE2rYnLsZdVuA0GhT9";

/**
 * Decrypt response using Web Crypto API (AES-256-GCM)
 * Format: { encrypted: true, data: "<base64(12-byte IV + ciphertext)>" }
 */
async function decryptCipherResponse(response, keyBase64 = CIPHER_KEY_BASE64) {
  try {
    // Parse JSON if string
    let data = response;
    if (typeof response === 'string') {
      try {
        data = JSON.parse(response);
      } catch (e) {
        // Not JSON, try direct decrypt
        return await decryptRaw(response, keyBase64);
      }
    }

    // Check if encrypted
    if (data && data.encrypted === true && data.data) {
      return await decryptRaw(data.data, keyBase64);
    }

    // Not encrypted, return as-is
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
 * Decrypt raw base64 string using Web Crypto API
 * IV = first 12 bytes, rest = ciphertext
 */
async function decryptRaw(base64String, keyBase64) {
  try {
    // Clean base64 string
    const cleanBase64 = base64String.replace(/\s/g, '');
    
    // Step 1: Prepare the key (32 bytes for AES-256)
    const keyBytes = base64ToUint8Array(keyBase64);
    const key32 = keyBytes.slice(0, 32); // Truncate/pad to exactly 32 bytes
    
    // Import key into Web Crypto
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key32,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Step 2: Decode the encrypted data
    const encryptedBytes = base64ToUint8Array(cleanBase64);
    
    if (encryptedBytes.length < 13) {
      throw new Error('Data too short (needs 12 bytes IV + at least 1 byte ciphertext)');
    }

    // Step 3: Split IV and ciphertext
    const iv = encryptedBytes.slice(0, 12); // First 12 bytes = IV
    const ciphertext = encryptedBytes.slice(12); // Rest = ciphertext

    // Step 4: Decrypt
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      ciphertext
    );

    // Step 5: Decode result
    const decoder = new TextDecoder();
    const decryptedText = decoder.decode(decryptedBuffer);

    // Try to parse as JSON
    try {
      return JSON.parse(decryptedText);
    } catch (e) {
      return { decryptedText, isJson: false };
    }

  } catch (error) {
    console.error('Raw decryption failed:', error.message);
    return null;
  }
}

/**
 * Convert base64 string to Uint8Array
 */
function base64ToUint8Array(base64String) {
  // Remove whitespace and padding for atob
  const clean = base64String.replace(/\s/g, '');
  
  // Use Buffer for Node.js (faster than atob)
  return new Uint8Array(Buffer.from(clean, 'base64'));
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
 * Clean URL
 */
function cleanUrl(url) {
  if (!url) return '';
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
