async function serverSideDecrypt(encryptedData) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const randomBytes = crypto.getRandomValues(new Uint8Array(16));
    const nonce = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');

    // Try to mimic a real browser request as closely as possible
    const response = await fetch('https://new.vidnest.fun/decrypt', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://new.vidnest.fun',
        'Referer': 'https://new.vidnest.fun/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({ data: encryptedData, timestamp, nonce })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = await response.json();
    
    if (result.data) {
      try {
        return JSON.parse(result.data);
      } catch (e) {
        return { data: result.data };
      }
    }
    
    return result;
    
  } catch (error) {
    console.error('Server decrypt failed:', error.message);
    return null;
  }
}
