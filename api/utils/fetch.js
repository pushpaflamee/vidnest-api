const fetch = require('node-fetch');

const PROXY_BASE = "https://corsproxy.io/?";
const HLS_PROXY = "https://corsproxy.io/?";

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
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

function createProxyUrl(targetUrl, headers = {}) {
  return `${PROXY_BASE}${encodeURIComponent(targetUrl)}`;
}

function createM3U8ProxyUrl(targetUrl, headers = {}) {
  return `${HLS_PROXY}${encodeURIComponent(targetUrl)}`;
}

function createMP4ProxyUrl(targetUrl, headers = {}) {
  return `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
}

module.exports = {
  fetchWithTimeout,
  createProxyUrl,
  createM3U8ProxyUrl,
  createMP4ProxyUrl,
  PROXY_BASE,
  HLS_PROXY
};
