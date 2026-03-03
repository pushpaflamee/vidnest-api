const { fetchWithTimeout, createProxyUrl, createM3U8ProxyUrl, createMP4ProxyUrl, createDirectUrl } = require('./fetch');
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
  constructor(serverKey, tmdbId, type = 'movie', season = null, episode = null, useProxy = true) {
    this.server = SERVERS[serverKey];
    this.serverKey = serverKey;
    this.tmdbId = tmdbId;
    this.type = type;
    this.season = season;
    this.episode = episode;
    this.timeout = 15000;
    this.useProxy = useProxy;
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
      let wasEncrypted = false;
      
      if (jsonData && jsonData.encrypted === true && jsonData.data) {
        wasEncrypted = true;
        decrypted = await decryptCipherResponse(jsonData, CIPHER_KEY_BASE64);
        
        if (!decrypted) {
          return {
            success: false,
            error: "Decryption failed",
            rawData: jsonData,
            wasEncrypted: true
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
    const base = this.type === 'movie' ? this.server.movieUrl : this.server.tvUrl;
    
    if (this.serverKey === 'sigma') {
      if (this.type === 'movie') {
        return `${base}/movie/${this.tmdbId}`;
      } else {
        return `${base}/tv/${this.tmdbId}/${this.season}/${this.episode}`;
      }
    }
    
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
    console.log(`[${this.serverKey}] Processing data with keys:`, Object.keys(data));

    let result;
    
    switch (this.server.type) {
      case 'lamda':
        result = this.processLamda(data);
        break;
      case 'ophim':
        result = this.processOphim(data);
        break;
      case 'gama':
      case 'beta':
        result = this.processFlixHQ(data);
        break;
      case 'catflix':
        result = this.processCatflix(data);
        break;
      case 'sigma':
        result = this.processSigma(data);
        break;
      case 'hexa':
        result = this.processHexa(data);
        break;
      case 'delta':
        result = this.processDelta(data);
        break;
      case 'alfa':
        result = this.processAlfa(data);
        break;
      default:
        result = {
          success: true,
          sources: [],
          subtitles: []
        };
    }

    result.rawData = data;
    return result;
  }

  processLamda(data) {
    const streams = Array.isArray(data.streams) ? data.streams : [];
    const englishStream = streams.find(s => 
      (s.language || '').toLowerCase() === 'english'
    ) || streams[0];

    if (!englishStream?.url) {
      return { 
        success: false, 
        error: "No stream URL found",
        availableStreams: streams.length,
        rawData: data
      };
    }

    return {
      success: true,
      sources: [{
        url: this.useProxy ? createProxyUrl(englishStream.url) : englishStream.url,
        quality: englishStream.quality || 'English',
        type: this.detectStreamType(englishStream.url),
        directUrl: englishStream.url
      }],
      subtitles: [],
      rawData: data
    };
  }

  processOphim(data) {
    if (!data.streams || !Array.isArray(data.streams)) {
      return { 
        success: false, 
        error: "No streams array",
        rawData: data
      };
    }

    return {
      success: true,
      sources: data.streams.map(s => ({
        url: this.useProxy ? createProxyUrl(s.url) : s.url,
        quality: s.quality || 'HD',
        type: this.detectStreamType(s.url),
        directUrl: s.url
      })),
      subtitles: [],
      rawData: data
    };
  }

  processFlixHQ(data) {
    if (!data.url) {
      return { 
        success: false, 
        error: "No URL in response",
        rawData: data
      };
    }

    const subtitles = (data.subtitles || []).map(s => ({
      url: s.url,
      lang: s.lang || 'en',
      label: s.label || 'Unknown',
      default: !!s.default
    }));

    const directUrl = data.url;
    const proxiedUrl = createProxyUrl(data.url, { Referer: "https://videostr.net/" });

    return {
      success: true,
      sources: [{
        url: this.useProxy ? proxiedUrl : directUrl,
        quality: 'auto',
        type: 'hls',
        directUrl: directUrl,
        proxiedUrl: proxiedUrl
      }],
      subtitles: subtitles,
      rawData: data
    };
  }

  processCatflix(data) {
    if (!data.url || !Array.isArray(data.url)) {
      return { 
        success: false, 
        error: "Invalid Catflix URL format",
        rawData: data
      };
    }

    const sources = data.url.map(u => {
      const directUrl = u.link;
      return {
        url: this.useProxy ? createMP4ProxyUrl(directUrl, data.headers || {}) : directUrl,
        quality: u.resolution ? (isNaN(Number(u.resolution)) ? u.resolution : `${u.resolution}p`) : 'auto',
        type: u.type || 'mp4',
        directUrl: directUrl
      };
    }).sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));

    const subtitles = (data.tracks || []).map(t => ({
      url: t.file,
      label: t.label || 'Unknown',
      lang: t.label || 'en',
      default: false
    }));

    return { 
      success: true, 
      sources: sources, 
      subtitles: subtitles,
      rawData: data
    };
  }

  processSigma(data) {
    if (!data.success || !Array.isArray(data.sources)) {
      return { 
        success: false, 
        error: "Invalid Sigma response", 
        hasSuccess: data.success,
        sourcesType: typeof data.sources,
        rawData: data
      };
    }

    const hlsSources = data.sources.filter(s => s.type === 'hls' && s.file);
    if (!hlsSources.length) {
      return { 
        success: false, 
        error: "No HLS sources", 
        totalSources: data.sources.length,
        rawData: data
      };
    }

    const selected = hlsSources.length >= 3 ? hlsSources[2] : hlsSources[hlsSources.length - 1];
    
    const directUrl = selected.file;
    const proxiedUrl = createProxyUrl(directUrl, {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.5",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "cross-site",
      "origin": "https://flashstream.cc",
      "referer": "https://flashstream.cc/"
    });

    return {
      success: true,
      sources: [{
        url: this.useProxy ? proxiedUrl : directUrl,
        quality: selected.label || 'auto',
        type: 'hls',
        directUrl: directUrl,
        headers: {
          "Referer": "https://flashstream.cc/",
          "Origin": "https://flashstream.cc",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0"
        }
      }],
      subtitles: [],
      rawData: data
    };
  }

  processHexa(data) {
    if (!data.data?.stream?.playlist) {
      return { 
        success: false, 
        error: "No playlist in Hexa data",
        rawData: data
      };
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

    const directUrl = cleanUrl(stream.playlist);
    const proxiedUrl = createM3U8ProxyUrl(directUrl, headers);

    return {
      success: true,
      sources: [{
        url: this.useProxy ? proxiedUrl : directUrl,
        quality: 'auto',
        type: 'hls',
        directUrl: directUrl
      }],
      subtitles: subtitles,
      rawData: data
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
        availableLanguages: streams.map(s => s.language),
        rawData: data
      };
    }

    return {
      success: true,
      sources: [{
        url: this.useProxy ? createProxyUrl(hindiStream.url) : hindiStream.url,
        quality: 'Hindi',
        type: this.detectStreamType(hindiStream.url),
        directUrl: hindiStream.url
      }],
      subtitles: [],
      rawData: data
    };
  }

  processAlfa(data) {
    if (!data.sources || !Array.isArray(data.sources)) {
      return { 
        success: false, 
        error: "No sources in Alfa response",
        rawData: data
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
        error: "No valid sources found", 
        totalSources: data.sources.length,
        rawData: data
      };
    }

    const sources = validSources.map(s => {
      const directUrl = s.url;
      const isM3U8 = !s.url.includes('.txt') && (s.isM3U8 || s.url.includes('.m3u8') || s.url.includes('/hls/'));
      
      return {
        url: this.useProxy ? createProxyUrl(directUrl, { Referer: "https://primevid.click/" }) : directUrl,
        quality: s.quality || 'auto',
        type: isM3U8 ? 'hls' : 'mp4',
        directUrl: directUrl
      };
    });

    return { 
      success: true, 
      sources: sources, 
      subtitles: [],
      rawData: data
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
