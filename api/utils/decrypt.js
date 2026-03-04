const crypto = require('crypto').webcrypto;

async function decryptCipherResponse(response) {
  try {
    let data = typeof response === 'string' ? JSON.parse(response) : response;
    
    if (!data.encrypted) return data;
    if (!data.data) return null;

    console.log('Server-side decrypting...');
    return await serverSideDecrypt(data.data);
    
  } catch (error) {
    console.error('Decrypt error:', error.message);
    return null;
  }
}

async function serverSideDecrypt(encryptedData) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const nonce = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');

    const response = await fetch('https://new.vidnest.fun/decrypt', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': 'https://new.vidnest.fun',
        'Referer': 'https://new.vidnest.fun/'
      },
      body: JSON.stringify({ data: encryptedData, timestamp, nonce })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = await response.json();
    console.log('Decrypt API result keys:', Object.keys(result));
    
    // Handle different response structures
    if (result.data) {
      try {
        // Try to parse if it's a JSON string
        return JSON.parse(result.data);
      } catch (e) {
        // Return as-is if not JSON
        return { data: result.data, decrypted: true };
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('Server decrypt failed:', error.message);
    return null;
  }
}

module.exports = { decryptCipherResponse };
