const fetch = require('node-fetch');

// Better CORS proxies that don't double-encode
const CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://corsproxy.io/?"  // Keep as fallback
];

const PRIMARY_PROXY = "https://api.allorigins.win/raw?url=";

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://new.vidnest.fun/',
        'Origin': 'https://new.vidnest.fun',
        ...options.headers
      }
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// Don't double-encode URLs
function createProxyUrl(targetUrl, headers = {}) {
  // allorigins doesn't need headers in URL, it forwards them automatically
  return `${PRIMARY_PROXY}${encodeURIComponent(targetUrl)}`;
}

function createM3U8ProxyUrl(targetUrl, headers = {}) {
  // For M3U8, use a proxy that handles HLS properly
  return `https://m3u8proxy-cors.vercel.app/?url=${encodeURIComponent(targetUrl)}`;
}

function createMP4ProxyUrl(targetUrl, headers = {}) {
  // For MP4 files
  return `${PRIMARY_PROXY}${encodeURIComponent(targetUrl)}`;
}

// Direct URL without proxy (for testing)
function createDirectUrl(targetUrl) {
  return targetUrl;
}

module.exports = {
  fetchWithTimeout,
  createProxyUrl,
  createM3U8ProxyUrl,
  createMP4ProxyUrl,
  createDirectUrl,
  PRIMARY_PROXY
};
