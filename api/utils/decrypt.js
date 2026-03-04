const fetch = require('node-fetch');

const DECRYPT_ENDPOINT = "https://new.vidnest.fun/decrypt";

/**
 * New server-side decryption via vidnest.fun/decrypt endpoint
 */
async function decryptCipherResponse(response) {
  try {
    // Parse if string
    let data = response;
    if (typeof response === 'string') {
      try {
        data = JSON.parse(response);
      } catch (e) {
        return null;
      }
    }

    // Check if encrypted
    if (!data.encrypted) {
      return data; // Already plaintext
    }

    if (!data.data || typeof data.data !== 'string') {
      throw new Error("Response missing encrypted data field");
    }

    // Generate timestamp and nonce
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = generateNonce();

    // Call decryption endpoint WITH proper origin headers
    const decryptRes = await fetch(DECRYPT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://new.vidnest.fun',
        'Referer': 'https://new.vidnest.fun/',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      body: JSON.stringify({
        data: data.data,
        timestamp: timestamp,
        nonce: nonce
      })
    });

    if (!decryptRes.ok) {
      const errorText = await decryptRes.text();
      throw new Error(`Decryption service error: ${decryptRes.status} - ${errorText}`);
    }

    const result = await decryptRes.json();
    
    if (!result.success) {
      throw new Error(result.error || "Decryption failed");
    }

    return result.data;

  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
}

/**
 * Generate 16-byte random nonce as hex string
 */
function generateNonce() {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Clean headers object
 */
function cleanHeaders(headers) {
  if (!headers || typeof headers !== 'object') return {};
  
  const cleaned = {};
  for (let [key, value] of Object.entries(headers)) {
    cleaned[key.trim()] = String(value).trim();
  }
  return cleaned;
}

/**
 * Clean URL
 */
function cleanUrl(url) {
  return url?.trim().replace(/\s+/g, "") || "";
}

module.exports = {
  decryptCipherResponse,
  cleanHeaders,
  cleanUrl
};
