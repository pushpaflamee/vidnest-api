// Node.js Web Crypto API implementation
const crypto = require('crypto').webcrypto;

const CIPHER_KEY_BASE64 = "K9vT2mQxL8fWcD3pRZyU+Sa7nB1/M4tHgC6JkPwXe5qOVFbE2rYnLsZdVuA0GhT9";

/**
 * NEW: Server-side decryption via Vidnest API
 * Format: { encrypted: true, data: "..." } -> POST to /decrypt endpoint
 */
async function decryptCipherResponse(response, keyBase64 = CIPHER_KEY_BASE64) {
  try {
    // Parse JSON if string
    let data = response;
    if (typeof response === 'string') {
      try {
        data = JSON.parse(response);
      } catch (e) {
        // Not JSON, try legacy direct decrypt (fallback)
        console.log('Not JSON, trying legacy decrypt...');
        return await decryptRaw(response, keyBase64);
      }
    }

    // NEW METHOD: Check if encrypted flag is present
    if (data && data.encrypted === true && data.data) {
      console.log('Using NEW server-side decryption method...');
      return await serverSideDecrypt(data.data);
    }

    // Legacy fallback: Try old AES method if data looks like base64
    if (data && data.data && typeof data.data === 'string' && data.data.length > 20) {
      console.log('Trying legacy AES decryption...');
      const legacy = await decryptRaw(data.data, keyBase64);
      if (legacy) return legacy;
    }

    // Not encrypted, return as-is
    if (data && (data.sources || data.streams || data.url || data.success || data.decrypted)) {
      return data;
    }

    return data;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
}

/**
 * NEW: Server-side decryption via Vidnest API
 * Mimics the browser's fetch to https://new.vidnest.fun/decrypt
 */
async function serverSideDecrypt(encryptedData) {
  try {
    // Generate timestamp (Unix seconds)
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Generate 16-byte random nonce as hex string
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const nonce = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');

    console.log('Sending decrypt request:', { timestamp, nonce: nonce.substring(0, 8) + '...' });

    // Call Vidnest decryption endpoint
    const response = await fetch('https://new.vidnest.fun/decrypt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://new.vidnest.fun',
        'Referer': 'https://new.vidnest.fun/'
      },
      body: JSON.stringify({
        data: encryptedData,
        timestamp: timestamp,
        nonce: nonce
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Decrypt API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Return the decrypted data field
    if (result && result.data) {
      // Try to parse nested JSON
      try {
        return JSON.parse(result.data);
      } catch (e) {
        return { decrypted: result.data };
      }
    }
    
    return result;

  } catch (error) {
    console.error('Server-side decryption failed:', error.message);
    // Fallback to legacy method
    console.log('Falling back to legacy AES decryption...');
    return await decryptRaw(encryptedData, CIPHER_KEY_BASE64);
  }
}

/**
 * LEGACY: Decrypt raw base64 string using Web Crypto API (AES-256-GCM)
 * IV = first 12 bytes, rest = ciphertext
 */
async function decryptRaw(base64String, keyBase64) {
  try {
    // Clean base64 string
    const cleanBase64 = base64String.replace(/\s/g, '');
    
    // Step 1: Prepare the key (32 bytes for AES-256)
    const keyBytes = base64ToUint8Array(keyBase64);
    const key32 = keyBytes.slice(0, 32);
    
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
    const iv = encryptedBytes.slice(0, 12);
    const ciphertext = encryptedBytes.slice(12);

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
  const clean = base64String.replace(/\s/g, '');
  return new Uint8Array(Buffer.from(clean, 'base64'));
}

/**
 * Clean headers for proxy requests
 */
function cleanHeaders(headers) {
  if (!headers || typeof headers !== 'object') return {};
  
  const cleaned = {};
  const allowed = ['referer', 'origin', 'user-agent', 'accept', 'accept-language', 'content-type'];
  
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
  serverSideDecrypt, // Export new method
  cleanHeaders,
  cleanUrl,
  CIPHER_KEY_BASE64
};
