const { fetchWithTimeout } = require('./fetch');
const { decryptCipherResponse, cleanHeaders, CIPHER_KEY_BASE64 } = require('./decrypt');

const BASE_URL = "https://new.vidnest.fun";

const SERVERS = {
  lamda: {
    name: "Lamda",
    type: "lamda"
  },
  alfa: {
    name: "Alfa",
    type: "alfa"
  },
  ophim: {
    name: "Ophim",
    type: "ophim"
  },
  beta: {
    name: "Beta",
    type: "beta"
  },
  sigma: {
    name: "Sigma",
    type: "sigma"
  },
  gama: {
    name: "Gama",
    type: "gama"
  },
  catflix: {
    name: "Catflix",
    type: "catflix"
  },
  hexa: {
    name: "Hexa",
    type: "hexa"
  },
  delta: {
    name: "Delta",
    type: "delta"
  }
};

// Proxy URL builders as per specifications
function createAlfaProxy(targetUrl) {
  const headers = encodeURIComponent(JSON.stringify({ "Referer": "https://primevid.click/" }));
  return `https://proxy.animanga.fun/proxy?url=${encodeURIComponent(targetUrl)}&headers=${headers}`;
}

function createBetaProxy(targetUrl) {
  const headers = encodeURIComponent(JSON.stringify({
    "Referer": "https://videostr.net/",
    "User-Agent": "Mozilla/5.0"
  }));
  return `https://proxy2.animanga.fun/proxy?url=${encodeURIComponent(targetUrl)}&headers=${headers}`;
}

function createSigmaProxy(targetUrl) {
  const headers = encodeURIComponent(JSON.stringify({
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.5",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "origin": "https://flashstream.cc",
    "referer": "https://flashstream.cc/"
  }));
  return `https://proxy.animanga.fun/proxy?url=${encodeURIComponent(targetUrl)}&headers=${headers}`;
}

function createGamaProxy(targetUrl) {
  const headers = encodeURIComponent(JSON.stringify({ "Referer": "https://videostr.net/" }));
  return `https://proxy.animanga.fun/proxy?url=${encodeURIComponent(targetUrl)}&headers=${headers}`;
}

function createCatflixProxy(targetUrl, headersObj = {}) {
  const headers = encodeURIComponent(JSON.stringify(headersObj));
  return `https://cloudflare-m3u8-proxy.animeexost.workers.dev/mp4-proxy?url=${encodeURIComponent(targetUrl)}&headers=${headers}`;
}

function createHexaProxy(targetUrl, headersObj = {}) {
  const cleaned = cleanHeaders(headersObj);
  const headers = encodeURIComponent(JSON.stringify(cleaned));
  return `https://proxy2.animanga.fun/proxy?url=${encodeURIComponent(targetUrl)}&headers=${headers}`;
}

class SourceFetcher {
  constructor(serverKey, tmdbId, type = 'movie', season = null, episode = null) {
    this.server = SERVERS[serverKey];
    this.serverKey = serverKey;
    this.tmdbId = tmdbId;
    this.type = type;
    this.season = season;
    this.episode = episode;
    this.timeout = 15000;
  }

  async fetch() {
    if (!this.server) {
      throw new Error(`Unknown server: ${this.serverKey}`);
    }

    try {
      const endpoint = this.getEndpoint();
      console.log(`[${this.serverKey}] Fetching: ${endpoint}`);

      const response = await fetchWithTimeout(endpoint, {}, this.timeout);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawText = await response.text();
      
      let jsonData = null;
      try {
        jsonData = JSON.parse(rawText);
      } catch (e) {
        // Not valid JSON
      }

      let decrypted = null;
      
      if (jsonData && jsonData.encrypted === true && jsonData.data) {
        decrypted = await decryptCipherResponse(jsonData, CIPHER_KEY_BASE64);
        
        if (!decrypted) {
          return {
            success: false,
            error: "Decryption failed",
            rawData: jsonData
          };
        }
      } else if (jsonData) {
        decrypted = jsonData;
      } else {
        decrypted = await decryptCipherResponse(rawText, CIPHER_KEY_BASE64);
      }

      if (!decrypted) {
        return {
          success: false,
          error: "Failed to parse/decrypt response",
          rawData: { rawText: rawText.substring(0, 1000) }
        };
      }

      return this.processData(decrypted);

    } catch (error) {
      console.error(`[${this.serverKey}] Error:`, error.message);
      throw error;
    }
  }

  getEndpoint() {
    switch (this.serverKey) {
      case 'lamda':
        // {BASE}/allmovies/movie/{tmdbId} or {BASE}/allmovies/tv/{tmdbId}/{season}/{episode}
        if (this.type === 'movie') {
          return `${BASE_URL}/allmovies/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/allmovies/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'alfa':
        // {BASE}/primesrc/movie/{tmdbId} or {BASE}/primesrc/tv/{tmdbId}/{season}/{episode}
        if (this.type === 'movie') {
          return `${BASE_URL}/primesrc/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/primesrc/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'ophim':
        // {BASE}/ophim/movie/{tmdbId} or {BASE}/ophim/tv/{tmdbId}/{season}/{episode}
        if (this.type === 'movie') {
          return `${BASE_URL}/ophim/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/ophim/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'beta':
        // {BASE}/flixhq/movie/{tmdbId}?server=upcloud or {BASE}/flixhq/tv/{tmdbId}/{season}/{episode}?server=upcloud
        if (this.type === 'movie') {
          return `${BASE_URL}/flixhq/movie/${this.tmdbId}?server=upcloud`;
        } else {
          return `${BASE_URL}/flixhq/tv/${this.tmdbId}/${this.season}/${this.episode}?server=upcloud`;
        }
      
      case 'sigma':
        // {BASE}/hollymoviehd/movie/{tmdbId} or {BASE}/hollymoviehd/tv/{tmdbId}/{season}/{episode}
        if (this.type === 'movie') {
          return `${BASE_URL}/hollymoviehd/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/hollymoviehd/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'gama':
        // {BASE}/flixhq/movie/{tmdbId} or {BASE}/flixhq/tv/{tmdbId}/{season}/{episode}
        if (this.type === 'movie') {
          return `${BASE_URL}/flixhq/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/flixhq/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'catflix':
        // {BASE}/moviebox/movie/{tmdbId} or {BASE}/moviebox/tv/{tmdbId}/{season}/{episode}
        if (this.type === 'movie') {
          return `${BASE_URL}/moviebox/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/moviebox/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'hexa':
        // {BASE}/vidlink/movie/{tmdbId} or {BASE}/vidlink/tv/{tmdbId}/{season}/{episode}
        if (this.type === 'movie') {
          return `${BASE_URL}/vidlink/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/vidlink/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'delta':
        // {BASE}/allmovies/movie/{tmdbId} or {BASE}/allmovies/tv/{tmdbId}/{season}/{episode}
        if (this.type === 'movie') {
          return `${BASE_URL}/allmovies/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/allmovies/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      default:
        throw new Error(`Unknown server type: ${this.serverKey}`);
    }
  }

  processData(data) {
    console.log(`[${this.serverKey}] Processing data with keys:`, Object.keys(data));

    let result;
    
    switch (this.serverKey) {
      case 'lamda':
        result = this.processLamda(data);
        break;
      case 'alfa':
        result = this.processAlfa(data);
        break;
      case 'ophim':
        result = this.processOphim(data);
        break;
      case 'beta':
        result = this.processBeta(data);
        break;
      case 'sigma':
        result = this.processSigma(data);
        break;
      case 'gama':
        result = this.processGama(data);
        break;
      case 'catflix':
        result = this.processCatflix(data);
        break;
      case 'hexa':
        result = this.processHexa(data);
        break;
      case 'delta':
        result = this.processDelta(data);
        break;
      default:
        result = {
          success: false,
          error: "Unknown server processor"
        };
    }

    result.rawData = data;
    return result;
  }

  // 1. LAMDA - No proxy, filters English
  processLamda(data) {
    const streams = Array.isArray(data.streams) ? data.streams : [];
    const englishStream = streams.find(s => 
      (s.language || '').toLowerCase() === 'english'
    ) || streams[0];

    if (!englishStream?.url) {
      return { 
        success: false, 
        error: "No English stream found",
        availableLanguages: streams.map(s => s.language)
      };
    }

    return {
      success: true,
      sources: [{
        url: englishStream.url,
        quality: englishStream.quality || 'English',
        type: this.detectStreamType(englishStream.url)
      }],
      subtitles: []
    };
  }

  // 2. ALFA - Proxy with primevid referer, filters M3U8/HLS
  processAlfa(data) {
    if (!data.sources || !Array.isArray(data.sources)) {
      return { 
        success: false, 
        error: "No sources in Alfa response"
      };
    }

    const validSources = data.sources.filter(s => {
      if (!s.url) return false;
      const isM3U8 = s.isM3U8 || s.url.includes('.m3u8') || s.url.includes('/hls/') || s.url.includes('master');
      return isM3U8 || s.url.includes('.txt');
    });

    if (!validSources.length) {
      return { 
        success: false, 
        error: "No valid M3U8/HLS sources found"
      };
    }

    // Sort: prioritize non-.txt files, then non-IP URLs
    const sortedSources = validSources.sort((a, b) => {
      const aTxt = a.url.includes('.txt');
      const bTxt = b.url.includes('.txt');
      if (aTxt && !bTxt) return 1;
      if (!aTxt && bTxt) return -1;
      
      const aIp = /\/\/\d+\.\d+\.\d+\.\d+/.test(a.url);
      const bIp = /\/\/\d+\.\d+\.\d+\.\d+/.test(b.url);
      if (aIp && !bIp) return 1;
      if (!aIp && bIp) return -1;
      
      return 0;
    });

    const sources = sortedSources.map(s => {
      const isM3U8 = !s.url.includes('.txt') && (s.isM3U8 || s.url.includes('.m3u8') || s.url.includes('/hls/'));
      
      return {
        url: isM3U8 ? createAlfaProxy(s.url) : s.url,
        quality: s.quality || 'auto',
        type: isM3U8 ? 'hls' : 'mp4',
        directUrl: s.url
      };
    });

    return { 
      success: true, 
      sources: sources, 
      subtitles: []
    };
  }

  // 3. OPHIM - No proxy, returns all streams
  processOphim(data) {
    if (!data.streams || !Array.isArray(data.streams)) {
      return { 
        success: false, 
        error: "No streams array in Ophim response"
      };
    }

    return {
      success: true,
      sources: data.streams.map(s => ({
        url: s.url,
        quality: s.quality || 'HD',
        type: this.detectStreamType(s.url)
      })),
      subtitles: []
    };
  }

  // 4. BETA - Proxy with videostr referer, upcloud server
  processBeta(data) {
    if (!data.url) {
      return { 
        success: false, 
        error: "No URL in Beta response"
      };
    }

    const subtitles = (data.subtitles || []).map(s => ({
      url: s.url,
      lang: s.lang || 'en',
      label: s.label || 'Unknown',
      default: !!s.default
    }));

    return {
      success: true,
      sources: [{
        url: createBetaProxy(data.url),
        quality: 'auto',
        type: 'hls',
        directUrl: data.url
      }],
      subtitles: subtitles
    };
  }

  // 5. SIGMA - Proxy with flashstream headers, selects 3rd source or last
  processSigma(data) {
    if (!data.success || !Array.isArray(data.sources)) {
      return { 
        success: false, 
        error: "Invalid Sigma response",
        hasSuccess: data.success,
        sourcesType: typeof data.sources
      };
    }

    const hlsSources = data.sources.filter(s => s.type === 'hls' && s.file);
    if (!hlsSources.length) {
      return { 
        success: false, 
        error: "No HLS sources found"
      };
    }

    // Select 3rd if available, else last
    const selected = hlsSources.length >= 3 ? hlsSources[2] : hlsSources[hlsSources.length - 1];

    return {
      success: true,
      sources: [{
        url: createSigmaProxy(selected.file),
        quality: selected.label || 'auto',
        type: 'hls',
        directUrl: selected.file
      }],
      subtitles: []
    };
  }

  // 6. GAMA - Proxy with videostr referer (same as beta but no upcloud param)
  processGama(data) {
    if (!data.url) {
      return { 
        success: false, 
        error: "No URL in Gama response"
      };
    }

    const subtitles = (data.subtitles || []).map(s => ({
      url: s.url,
      lang: s.lang || 'en',
      label: s.label || 'Unknown',
      default: !!s.default
    }));

    return {
      success: true,
      sources: [{
        url: createGamaProxy(data.url),
        quality: 'auto',
        type: 'hls',
        directUrl: data.url
      }],
      subtitles: subtitles
    };
  }

  // 7. CATFLIX - Cloudflare proxy, sorts by resolution
  processCatflix(data) {
    if (!data.url || !Array.isArray(data.url)) {
      return { 
        success: false, 
        error: "Invalid Catflix URL format"
      };
    }

    const sources = data.url.map(u => ({
      url: createCatflixProxy(u.link, data.headers || {}),
      quality: u.resolution ? (isNaN(Number(u.resolution)) ? u.resolution : `${u.resolution}p`) : 'auto',
      type: u.type || 'mp4',
      directUrl: u.link
    })).sort((a, b) => {
      // Sort by resolution (highest first)
      const aq = parseInt(a.quality) || 0;
      const bq = parseInt(b.quality) || 0;
      return bq - aq;
    });

    const subtitles = (data.tracks || []).map(t => ({
      url: t.file,
      label: t.label || 'Unknown',
      lang: t.label || 'en',
      default: false
    }));

    return { 
      success: true, 
      sources: sources, 
      subtitles: subtitles
    };
  }

  // 8. HEXA - Proxy2 with cleaned headers, extracts playlist
  processHexa(data) {
    if (!data.data?.stream?.playlist) {
      return { 
        success: false, 
        error: "No playlist in Hexa data"
      };
    }

    const stream = data.data.stream;
    const headers = data.headers || {};
    
    const subtitles = (stream.captions || [])
      .filter(c => c.url && (c.type === 'vtt' || c.type === 'srt'))
      .map(c => ({
        label: c.language || 'Unknown',
        lang: (c.language || 'en').toLowerCase(),
        url: c.url,
        default: false
      }));

    const playlistUrl = stream.playlist;

    return {
      success: true,
      sources: [{
        url: createHexaProxy(playlistUrl, headers),
        quality: 'auto',
        type: 'hls',
        directUrl: playlistUrl
      }],
      subtitles: subtitles
    };
  }

  // 9. DELTA - No proxy, filters Hindi
  processDelta(data) {
    const streams = Array.isArray(data.streams) ? data.streams : [];
    const hindiStream = streams.find(s => 
      (s.language || '').toLowerCase() === 'hindi'
    );

    if (!hindiStream?.url) {
      return { 
        success: false, 
        error: "Hindi stream not available",
        availableLanguages: streams.map(s => s.language)
      };
    }

    return {
      success: true,
      sources: [{
        url: hindiStream.url,
        quality: 'Hindi',
        type: this.detectStreamType(hindiStream.url)
      }],
      subtitles: []
    };
  }

  detectStreamType(url) {
    if (!url) return 'mp4';
    if (url.includes('.m3u8') || url.includes('/hls/')) return 'hls';
    if (url.includes('.mp4')) return 'mp4';
    return 'mp4';
  }
}

module.exports = {
  SERVERS,
  SourceFetcher
};
