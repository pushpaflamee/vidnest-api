const { fetchWithTimeout } = require('./fetch');
const { decryptCipherResponse, cleanHeaders } = require('./decrypt');

const BASE_URL = "https://new.vidnest.fun";

const SERVERS = {
  lamda: { name: "Lamda", type: "lamda", referer: null },
  alfa: { name: "Alfa", type: "alfa", referer: "https://primevid.click/" },
  ophim: { name: "Ophim", type: "ophim", referer: null },
  beta: { name: "Beta", type: "beta", referer: "https://videostr.net/" },
  sigma: { name: "Sigma", type: "sigma", referer: "https://flashstream.cc/" },
  gama: { name: "Gama", type: "gama", referer: "https://videostr.net/" },
  catflix: { name: "Catflix", type: "catflix", referer: null },
  hexa: { name: "Hexa", type: "hexa", referer: null },
  delta: { name: "Delta", type: "delta", referer: null }
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
      
      let jsonData = null;
      try {
        jsonData = JSON.parse(rawText);
      } catch (e) {
        // Not valid JSON
      }

      let decrypted = null;
      
      // Check if encrypted and decrypt via server endpoint
      if (jsonData && jsonData.encrypted === true && jsonData.data) {
        decrypted = await decryptCipherResponse(jsonData);
        
        if (!decrypted) {
          return {
            success: false,
            error: "Decryption failed via server endpoint",
            rawData: jsonData
          };
        }
      } else if (jsonData) {
        decrypted = jsonData;
      } else {
        // Try decrypt raw text just in case
        decrypted = await decryptCipherResponse(rawText);
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
        if (this.type === 'movie') {
          return `${BASE_URL}/allmovies/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/allmovies/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'alfa':
        if (this.type === 'movie') {
          return `${BASE_URL}/primesrc/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/primesrc/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'ophim':
        if (this.type === 'movie') {
          return `${BASE_URL}/ophim/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/ophim/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'beta':
        if (this.type === 'movie') {
          return `${BASE_URL}/flixhq/movie/${this.tmdbId}?server=upcloud`;
        } else {
          return `${BASE_URL}/flixhq/tv/${this.tmdbId}/${this.season}/${this.episode}?server=upcloud`;
        }
      
      case 'sigma':
        if (this.type === 'movie') {
          return `${BASE_URL}/hollymoviehd/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/hollymoviehd/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'gama':
        if (this.type === 'movie') {
          return `${BASE_URL}/flixhq/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/flixhq/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'catflix':
        if (this.type === 'movie') {
          return `${BASE_URL}/moviebox/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/moviebox/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'hexa':
        if (this.type === 'movie') {
          return `${BASE_URL}/vidlink/movie/${this.tmdbId}`;
        } else {
          return `${BASE_URL}/vidlink/tv/${this.tmdbId}/${this.season}/${this.episode}`;
        }
      
      case 'delta':
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
      case 'lamda': result = this.processLamda(data); break;
      case 'alfa': result = this.processAlfa(data); break;
      case 'ophim': result = this.processOphim(data); break;
      case 'beta': result = this.processBeta(data); break;
      case 'sigma': result = this.processSigma(data); break;
      case 'gama': result = this.processGama(data); break;
      case 'catflix': result = this.processCatflix(data); break;
      case 'hexa': result = this.processHexa(data); break;
      case 'delta': result = this.processDelta(data); break;
      default: result = { success: false, error: "Unknown server processor" };
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
        error: "No English stream found",
        availableLanguages: streams.map(s => s.language)
      };
    }

    return {
      success: true,
      sources: [{
        url: englishStream.url,
        quality: englishStream.quality || 'English',
        type: this.detectStreamType(englishStream.url),
        referer: this.server.referer
      }],
      subtitles: []
    };
  }

  processAlfa(data) {
    if (!data.sources || !Array.isArray(data.sources)) {
      return { success: false, error: "No sources in Alfa response" };
    }

    const validSources = data.sources.filter(s => {
      if (!s.url) return false;
      const isM3U8 = s.isM3U8 || s.url.includes('.m3u8') || s.url.includes('/hls/') || s.url.includes('master');
      return isM3U8 || s.url.includes('.txt');
    });

    if (!validSources.length) {
      return { success: false, error: "No valid M3U8/HLS sources found" };
    }

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

    const sources = sortedSources.map(s => ({
      url: s.url,
      quality: s.quality || 'auto',
      type: s.isM3U8 || s.url.includes('.m3u8') || s.url.includes('/hls/') ? 'hls' : 'mp4',
      referer: this.server.referer
    }));

    return { success: true, sources: sources, subtitles: [] };
  }

  processOphim(data) {
    if (!data.streams || !Array.isArray(data.streams)) {
      return { success: false, error: "No streams array in Ophim response" };
    }

    return {
      success: true,
      sources: data.streams.map(s => ({
        url: s.url,
        quality: s.quality || 'HD',
        type: this.detectStreamType(s.url),
        referer: this.server.referer
      })),
      subtitles: []
    };
  }

  processBeta(data) {
    if (!data.url) {
      return { success: false, error: "No URL in Beta response" };
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
        url: data.url,
        quality: 'auto',
        type: 'hls',
        referer: this.server.referer
      }],
      subtitles: subtitles
    };
  }

  processSigma(data) {
    if (!data.success || !Array.isArray(data.sources)) {
      return { success: false, error: "Invalid Sigma response" };
    }

    const hlsSources = data.sources.filter(s => s.type === 'hls' && s.file);
    if (!hlsSources.length) {
      return { success: false, error: "No HLS sources found" };
    }

    const selected = hlsSources.length >= 3 ? hlsSources[2] : hlsSources[hlsSources.length - 1];

    return {
      success: true,
      sources: [{
        url: selected.file,
        quality: selected.label || 'auto',
        type: 'hls',
        referer: this.server.referer,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.5",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "cross-site",
          "Origin": "https://flashstream.cc"
        }
      }],
      subtitles: []
    };
  }

  processGama(data) {
    if (!data.url) {
      return { success: false, error: "No URL in Gama response" };
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
        url: data.url,
        quality: 'auto',
        type: 'hls',
        referer: this.server.referer
      }],
      subtitles: subtitles
    };
  }

  processCatflix(data) {
    if (!data.url || !Array.isArray(data.url)) {
      return { success: false, error: "Invalid Catflix URL format" };
    }

    const serverHeaders = data.headers || {};
    
    const sources = data.url.map(u => ({
      url: u.link,
      quality: u.resolution ? (isNaN(Number(u.resolution)) ? u.resolution : `${u.resolution}p`) : 'auto',
      type: u.type || 'mp4',
      referer: serverHeaders.Referer || serverHeaders.referer || null,
      headers: Object.keys(serverHeaders).length > 0 ? serverHeaders : null
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

    return { success: true, sources: sources, subtitles: subtitles };
  }

  processHexa(data) {
    if (!data.data?.stream?.playlist) {
      return { success: false, error: "No playlist in Hexa data" };
    }

    const stream = data.data.stream;
    const serverHeaders = data.headers || {};
    
    const subtitles = (stream.captions || [])
      .filter(c => c.url && (c.type === 'vtt' || c.type === 'srt'))
      .map(c => ({
        label: c.language || 'Unknown',
        lang: (c.language || 'en').toLowerCase(),
        url: c.url,
        default: false
      }));

    return {
      success: true,
      sources: [{
        url: stream.playlist,
        quality: 'auto',
        type: 'hls',
        referer: serverHeaders.Referer || serverHeaders.referer || null,
        headers: Object.keys(serverHeaders).length > 0 ? serverHeaders : null
      }],
      subtitles: subtitles
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
        type: this.detectStreamType(hindiStream.url),
        referer: this.server.referer
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
