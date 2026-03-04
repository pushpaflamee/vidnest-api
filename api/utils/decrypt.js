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

    const requestBody = {
      data: data.data,
      timestamp: timestamp,
      nonce: nonce
    };

    console.log('Server-side decrypting...');

    // Call decryption endpoint with EXACT headers from browser
    const decryptRes = await fetch(DECRYPT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Host': 'new.vidnest.fun',
        'Connection': 'keep-alive',
        'Content-Length': Buffer.byteLength(JSON.stringify(requestBody)).toString(),
        'sec-ch-ua-platform': '"Windows"',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
        'Content-Type': 'application/json',
        'sec-ch-ua-mobile': '?0',
        'Accept': '*/*',
        'Origin': 'https://vidnest.fun',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
        'Referer': 'https://vidnest.fun/',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9'
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
