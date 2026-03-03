const fetch = require('node-fetch');

const PROXY_BASE = "https://proxy2.animanga.fun";
const HLS_PROXY = "https://proxy2.animanga.fun";

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
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

function createProxyUrl(targetUrl, headers = {}) {
  const encodedUrl = encodeURIComponent(targetUrl);
  const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
  return `${PROXY_BASE}/proxy?url=${encodedUrl}&headers=${encodedHeaders}`;
}

function createM3U8ProxyUrl(targetUrl, headers = {}) {
  const encodedUrl = encodeURIComponent(targetUrl);
  const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
  return `${HLS_PROXY}/m3u8-proxy?url=${encodedUrl}&headers=${encodedHeaders}`;
}

function createMP4ProxyUrl(targetUrl, headers = {}) {
  const encodedUrl = encodeURIComponent(targetUrl);
  const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
  return `https://cloudflare-m3u8-proxy.animeexost.workers.dev/mp4-proxy?url=${encodedUrl}&headers=${encodedHeaders}`;
}

module.exports = {
  fetchWithTimeout,
  createProxyUrl,
  createM3U8ProxyUrl,
  createMP4ProxyUrl,
  PROXY_BASE,
  HLS_PROXY
};
