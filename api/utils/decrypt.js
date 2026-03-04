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

    // Generate timestamp and nonce exactly like the browser does
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = generateNonce();

    // Build request body exactly as in the JS code
    const requestBody = {
      data: data.data,
      timestamp: timestamp,
      nonce: nonce
    };

    console.log('Server-side decrypting with timestamp:', timestamp, 'nonce:', nonce.substring(0, 8) + '...');

    // Call decryption endpoint with FULL browser headers
    const decryptRes = await fetch(DECRYPT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://new.vidnest.fun',
        'Referer': 'https://new.vidnest.fun/',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(requestBody)
    });

    if (!decryptRes.ok) {
      const errorText = await decryptRes.text();
      throw new Error(`Decryption service error: ${decryptRes.status} - ${errorText}`);
    }

    const result = await decryptRes.json();
    console.log('Decrypt API result keys:', Object.keys(result));
    
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
 * Matches the browser implementation: crypto.getRandomValues + hex encode
 */
function generateNonce() {
  const bytes = new Uint8Array(16);
  // Use crypto for better randomness if available, fallback to Math.random
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
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
