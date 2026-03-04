const fetch = require('node-fetch');

async function decryptCipherResponse(response) {
    try {
        // Parse the encrypted response
        let data = response;
        if (typeof response === 'string') {
            try {
                data = JSON.parse(response);
            } catch (e) {
                return null;
            }
        }

        // If not encrypted, return as-is
        if (!data.encrypted) return data;
        
        if (!data.data || typeof data.data !== 'string') {
            throw new Error("Response missing encrypted data field");
        }

        // Generate timestamp and nonce (matching their client)
        const timestamp = Math.floor(Date.now() / 1000);
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        // Call their decryption endpoint
        const decryptRes = await fetch("https://new.vidnest.fun/decrypt", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            body: JSON.stringify({
                data: data.data,
                timestamp: timestamp,
                nonce: nonce
            }),
            timeout: 10000
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

module.exports = {
    decryptCipherResponse
};
