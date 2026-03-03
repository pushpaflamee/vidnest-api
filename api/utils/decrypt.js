const CryptoJS = require('crypto-js');

const CIPHER_KEY = "K9vT2mQxL8fWcD3pRZyU+Sa7nB1/M4tHgC6JkPwXe5qOVFbE2rYnLsZdVuA0GhT9";

function decryptCipherResponse(response, key = CIPHER_KEY) {
  try {
    const data = typeof response === 'string' ? response : response.toString();
    
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(data);
      if (parsed && !parsed.encrypted && (parsed.sources || parsed.streams || parsed.url || parsed.data)) {
        return parsed;
      }
      if (parsed.encrypted === false) return parsed;
    } catch (e) {
      // Not JSON, continue to decryption
    }

    // Decryption logic based on common patterns in streaming APIs
    const decrypted = decryptAES(data, key);
    if (decrypted) {
      try {
        return JSON.parse(decrypted);
      } catch (e) {
        return { url: decrypted, decrypted: true };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

function decryptAES(encryptedData, key) {
  try {
    // Remove any whitespace or newlines
    const cleanData = encryptedData.replace(/\s/g, '');
    
    // Try different decryption methods
    const methods = [
      // Method 1: Direct AES decrypt
      () => {
        const bytes = CryptoJS.AES.decrypt(cleanData, key);
        return bytes.toString(CryptoJS.enc.Utf8);
      },
      // Method 2: With custom IV
      () => {
        const iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');
        const keyHash = CryptoJS.SHA256(key).toString().substring(0, 32);
        const bytes = CryptoJS.AES.decrypt(cleanData, CryptoJS.enc.Hex.parse(keyHash), { iv });
        return bytes.toString(CryptoJS.enc.Utf8);
      },
      // Method 3: Base64 decode then decrypt
      () => {
        const decoded = atob(cleanData);
        const bytes = CryptoJS.AES.decrypt(decoded, key);
        return bytes.toString(CryptoJS.enc.Utf8);
      }
    ];

    for (const method of methods) {
      try {
        const result = method();
        if (result && result.length > 0) return result;
      } catch (e) {
        continue;
      }
    }
    
    // If decryption fails, return the original (might be plaintext)
    return encryptedData;
  } catch (e) {
    return encryptedData;
  }
}

function cleanHeaders(headers) {
  if (!headers || typeof headers !== 'object') return {};
  
  const cleaned = {};
  const allowed = ['referer', 'origin', 'user-agent', 'accept', 'accept-language', 'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site'];
  
  for (const key of allowed) {
    if (headers[key] || headers[key.toLowerCase()]) {
      cleaned[key] = headers[key] || headers[key.toLowerCase()];
    }
  }
  
  return cleaned;
}

function cleanUrl(url) {
  if (!url) return '';
  try {
    // Remove any proxy prefixes if present
    if (url.includes('/proxy?url=')) {
      const match = url.match(/url=([^&]+)/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }
    return url;
  } catch (e) {
    return url;
  }
}

module.exports = {
  decryptCipherResponse,
  cleanHeaders,
  cleanUrl,
  CIPHER_KEY
};
