const { fetchWithTimeout, createProxyUrl, createM3U8ProxyUrl, createMP4ProxyUrl } = require('./fetch');
const { decryptCipherResponse, cleanHeaders, cleanUrl, CIPHER_KEY_BASE64 } = require('./decrypt');

const BASE_URL = "https://new.vidnest.fun";

const SERVERS = {
  lamda: {
    name: "Lamda",
    movieUrl: `${BASE_URL}/allmovies/movie`,
    tvUrl: `${BASE_URL}/allmovies/tv`,
    type: "lamda"
  },
  alfa: {
    name: "Alfa",
    movieUrl: `${BASE_URL}/primesrc/movie`,
    tvUrl: `${BASE_URL}/primesrc/tv`,
    type: "alfa"
  },
  ophim: {
    name: "Ophim",
    movieUrl: `${BASE_URL}/ophim/movie`,
    tvUrl: `${BASE_URL}/ophim/tv`,
    type: "ophim"
  },
  gama: {
    name: "Gama",
    movieUrl: `${BASE_URL}/flixhq/movie`,
    tvUrl: `${BASE_URL}/flixhq/tv`,
    type: "gama"
  },
  beta: {
    name: "Beta",
    movieUrl: `${BASE_URL}/flixhq/movie`,
    tvUrl: `${BASE_URL}/flixhq/tv`,
    type: "beta"
  },
  catflix: {
    name: "Catflix",
    movieUrl: `${BASE_URL}/moviebox/movie`,
    tvUrl: `${BASE_URL}/moviebox/tv`,
    type: "catflix"
  },
  sigma: {
    name: "Sigma",
    movieUrl: `${BASE_URL}/hollymoviehd`,
    tvUrl: `${BASE_URL}/hollymoviehd`,
    type: "sigma"
  },
  hexa: {
    name: "Hexa",
    movieUrl: `${BASE_URL}/vidlink/movie`,
    tvUrl: `${BASE_URL}/vidlink/tv`,
    type: "hexa"
  },
  delta: {
    name: "Delta",
    movieUrl: `${BASE_URL}/allmovies/movie`,
    tvUrl: `${BASE_URL}/allmovies/tv`,
    type: "delta"
  }
};

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
      
      // Try to parse as JSON first
      let jsonData = null;
      try {
        jsonData = JSON.parse(rawText);
      } catch (e) {
        // Not JSON
      }

      // Check if encrypted
      let decrypted = null;
      let wasEncrypted = false;
      
      if (jsonData && jsonData.encrypted === true && jsonData.data) {
        wasEncrypted = true;
        decrypted = decryptCipherResponse(jsonData, CIPHER_KEY_BASE64);
        
        if (!decrypted) {
          console.log(`[${this.serverKey}] Decryption failed, trying fallback...`);
          // Try without the encrypted wrapper
          decrypted = decryptCipherResponse(jsonData.data, CIPHER_KEY_BASE64);
        }
      } else if (jsonData) {
        // Not encrypted
        decrypted = jsonData;
      } else {
        // Raw text, try direct decryption
        decrypted = decryptCipherResponse(rawText, CIPHER_KEY_BASE64);
      }

      if (!decrypted) {
        return {
          success: false,
          error: "Failed to decrypt response",
          raw: rawText.substring(0, 1000),
          wasEncrypted: wasEncrypted,
          hint: "Check if encryption key or method changed"
        };
      }

      // Process the decrypted data based on server type
      return this.processData(decrypted);

    } catch (error) {
      console.error(`[${this.serverKey}] Error:`, error.message);
      throw error;
    }
  }

  getEndpoint() {
    const base = this.type === 'movie' ? this.server.movieUrl : this.server.tvUrl;
    if (this.type === 'movie') {
      if (this.serverKey === 'beta') {
        return `${base}/${this.tmdbId}?server=upcloud`;
      }
      return `${base}/${this.tmdbId}`;
    }
    if (this.serverKey === 'beta') {
      return `${base}/${this.tmdbId}/${this.season}/${this.episode}?server=upcloud`;
    }
    return `${base}/${this.tmdbId}/${this.season}/${this.episode}`;
  }

  processData(data) {
    // Log what we got for debugging
    console.log(`[${this.serverKey}] Decrypted keys:`, Object.keys(data));
    
    switch (this.server.type) {
      case 'lamda':
        return this.processLamda(data);
      case 'ophim':
        return this.processOphim(data);
      case 'gama':
      case 'beta':
        return this.processFlixHQ(data);
      case 'catflix':
        return this.processCatflix(data);
      case 'sigma':
        return this.processSigma(data);
      case 'hexa':
        return this.processHexa(data);
      case 'delta':
        return this.processDelta(data);
      case 'alfa':
        return this.processAlfa(data);
      default:
        return {
          success: true,
          rawData: data,
          sources: [],
          subtitles: []
        };
    }
  }

  processLamda(data) {
    const streams = Array.isArray(data.streams) ? data.streams : [];
    const englishStream = streams.find(s => 
      (s.language || '').toLowerCase() === 'english'
    ) || streams[0];

    if (!englishStream?.url) {
      return { success: false, error: "No English stream found", availableLanguages: streams.map(s => s.language) };
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

  processOphim(data) {
    if (!data.streams || !Array.isArray(data.streams)) {
      return { success: false, error: "No streams array in response", keys: Object.keys(data) };
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

  processFlixHQ(data) {
    if (!data.url) {
      return { success: false, error: "No URL in FlixHQ response", keys: Object.keys(data) };
    }

    const headers = { Referer: "https://videostr.net/" };
    const subtitles = (data.subtitles || []).map(s => ({
      url: s.url,
      lang: s.lang || 'en',
      label: s.label || 'Unknown',
      default: !!s.default
    }));

    return {
      success: true,
      sources: [{
        url: createProxyUrl(data.url, headers),
        quality: 'auto',
        type: 'hls'
      }],
      subtitles
    };
  }

  processCatflix(data) {
    if (!data.url || !Array.isArray(data.url)) {
      return { success: false, error: "No URL array in Catflix response" };
    }

    const sources = data.url.map(u => ({
      url: createMP4ProxyUrl(u.link, data.headers || {}),
      quality: u.resolution ? (isNaN(Number(u.resolution)) ? u.resolution : `${u.resolution}p`) : 'auto',
      type: u.type || 'mp4'
    })).sort((a, b) => {
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

    return { success: true, sources, subtitles };
  }

  processSigma(data) {
    if (!data.success || !Array.isArray(data.sources)) {
      return { success: false, error: "Invalid Sigma response", keys: Object.keys(data) };
    }

    const hlsSources = data.sources.filter(s => s.type === 'hls' && s.file);
    if (!hlsSources.length) {
      return { success: false, error: "No HLS sources found" };
    }

    const selected = hlsSources.length >= 3 ? hlsSources[2] : hlsSources[hlsSources.length - 1];
    
    const headers = {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.5",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "cross-site",
      "origin": "https://flashstream.cc",
      "referer": "https://flashstream.cc/"
    };

    return {
      success: true,
      sources: [{
        url: createProxyUrl(selected.file, headers),
        quality: selected.label || 'auto',
        type: 'hls'
      }],
      subtitles: []
    };
  }

  processHexa(data) {
    if (!data.data?.stream?.playlist) {
      return { success: false, error: "No playlist in Hexa response", keys: Object.keys(data) };
    }

    const stream = data.data.stream;
    const headers = cleanHeaders(data.headers || {});
    
    const subtitles = (stream.captions || [])
      .filter(c => c.url && (c.type === 'vtt' || c.type === 'srt'))
      .map(c => ({
        label: c.language || 'Unknown',
        lang: (c.language || 'en').toLowerCase(),
        url: cleanUrl(c.url),
        default: false
      }));

    const playlistUrl = cleanUrl(stream.playlist);

    return {
      success: true,
      sources: [{
        url: `https://corsproxy.io/?${encodeURIComponent(playlistUrl)}`,
        quality: 'auto',
        type: 'hls'
      }],
      subtitles
    };
  }

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

  processAlfa(data) {
    if (!data.sources || !Array.isArray(data.sources)) {
      return { success: false, error: "No sources in Alfa response", keys: Object.keys(data) };
    }

    const validSources = data.sources.filter(s => {
      if (!s.url) return false;
      const isM3U8 = s.isM3U8 || s.url.includes('.m3u8') || s.url.includes('/hls/') || s.url.includes('master');
      const isTXT = s.url.includes('.txt');
      return isM3U8 || isTXT;
    });

    if (!validSources.length) {
      return { success: false, error: "No valid sources found", totalSources: data.sources.length };
    }

    const sources = validSources.map(s => {
      let url = s.url;
      const isM3U8 = !s.url.includes('.txt') && (s.isM3U8 || s.url.includes('.m3u8') || s.url.includes('/hls/'));
      
      if (isM3U8) {
        const headers = encodeURIComponent(JSON.stringify({ Referer: "https://primevid.click/" }));
        url = `https://corsproxy.io/?${encodeURIComponent(s.url)}`;
      }

      return {
        url,
        quality: s.quality || 'auto',
        type: isM3U8 ? 'hls' : 'mp4'
      };
    });

    return { success: true, sources, subtitles: [] };
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
