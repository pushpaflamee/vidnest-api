const { fetchWithTimeout } = require('./fetch');
const { decryptCipherResponse, CIPHER_KEY_BASE64 } = require('./decrypt');

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
    if (!this.server) throw new Error(`Unknown server: ${this.serverKey}`);

    try {
      const endpoint = this.getEndpoint();
      console.log(`[${this.serverKey}] Fetching: ${endpoint}`);

      const response = await fetchWithTimeout(endpoint, {}, this.timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const rawText = await response.text();
      console.log(`[${this.serverKey}] Raw response (first 200 chars):`, rawText.substring(0, 200));

      let jsonData = null;
      try {
        jsonData = JSON.parse(rawText);
        console.log(`[${this.serverKey}] JSON keys:`, Object.keys(jsonData));
      } catch (e) {
        console.log(`[${this.serverKey}] Not JSON, will decrypt raw`);
      }

      let decrypted = null;
      
      if (jsonData?.encrypted === true && jsonData.data) {
        console.log(`[${this.serverKey}] Decrypting...`);
        decrypted = await decryptCipherResponse(jsonData);
        console.log(`[${this.serverKey}] Decrypted keys:`, decrypted ? Object.keys(decrypted) : 'null');
      } else if (jsonData) {
        decrypted = jsonData;
      } else {
        decrypted = await decryptCipherResponse(rawText);
      }

      if (!decrypted) {
        return { success: false, error: "Decryption failed", raw: rawText.substring(0, 500) };
      }

      // Handle nested data structures
      if (decrypted.data && typeof decrypted.data === 'object' && !decrypted.sources) {
        console.log(`[${this.serverKey}] Unwrapping nested data`);
        decrypted = decrypted.data;
      }

      return this.processData(decrypted);

    } catch (error) {
      console.error(`[${this.serverKey}] Error:`, error.message);
      return { success: false, error: error.message };
    }
  }

  getEndpoint() {
    const endpoints = {
      lamda: `/allmovies/${this.type}/${this.tmdbId}${this.type === 'tv' ? `/${this.season}/${this.episode}` : ''}`,
      alfa: `/primesrc/${this.type}/${this.tmdbId}${this.type === 'tv' ? `/${this.season}/${this.episode}` : ''}`,
      ophim: `/ophim/${this.type}/${this.tmdbId}${this.type === 'tv' ? `/${this.season}/${this.episode}` : ''}`,
      beta: `/flixhq/${this.type}/${this.tmdbId}${this.type === 'tv' ? `/${this.season}/${this.episode}` : ''}?server=upcloud`,
      sigma: `/hollymoviehd/${this.type}/${this.tmdbId}${this.type === 'tv' ? `/${this.season}/${this.episode}` : ''}`,
      gama: `/flixhq/${this.type}/${this.tmdbId}${this.type === 'tv' ? `/${this.season}/${this.episode}` : ''}`,
      catflix: `/moviebox/${this.type}/${this.tmdbId}${this.type === 'tv' ? `/${this.season}/${this.episode}` : ''}`,
      hexa: `/vidlink/${this.type}/${this.tmdbId}${this.type === 'tv' ? `/${this.season}/${this.episode}` : ''}`,
      delta: `/allmovies/${this.type}/${this.tmdbId}${this.type === 'tv' ? `/${this.season}/${this.episode}` : ''}`
    };
    return `${BASE_URL}${endpoints[this.serverKey]}`;
  }

  processData(data) {
    console.log(`[${this.serverKey}] Processing with keys:`, Object.keys(data));
    
    const processors = {
      lamda: this.processLamda.bind(this),
      alfa: this.processAlfa.bind(this),
      ophim: this.processOphim.bind(this),
      beta: this.processBeta.bind(this),
      sigma: this.processSigma.bind(this),
      gama: this.processGama.bind(this),
      catflix: this.processCatflix.bind(this),
      hexa: this.processHexa.bind(this),
      delta: this.processDelta.bind(this)
    };

    const result = processors[this.serverKey](data);
    result.rawData = data;
    return result;
  }

  processLamda(data) {
    const streams = Array.isArray(data.streams) ? data.streams : [];
    const stream = streams.find(s => (s.language || '').toLowerCase() === 'english') || streams[0];
    if (!stream?.url) return { success: false, error: "No stream found" };
    return { success: true, sources: [{ url: stream.url, quality: stream.quality || 'auto', type: 'hls' }], subtitles: [] };
  }

  processAlfa(data) {
    console.log(`[Alfa] Data:`, JSON.stringify(data).substring(0, 300));
    
    // Try multiple possible structures
    let sources = data.sources || data.data?.sources || (Array.isArray(data) ? data : null) || (data.url ? [{url: data.url, quality: 'auto'}] : null);
    
    if (!sources) {
      return { success: false, error: "No sources found", debug: { keys: Object.keys(data) } };
    }

    const valid = sources.filter(s => s.url && (s.url.includes('.m3u8') || s.url.includes('/hls/') || s.isM3U8));
    if (!valid.length) return { success: false, error: "No valid sources", debug: { sources } };

    return { 
      success: true, 
      sources: valid.map(s => ({ url: s.url, quality: s.quality || 'auto', type: 'hls', referer: this.server.referer })),
      subtitles: [] 
    };
  }

  processOphim(data) {
    if (!data.streams?.length) return { success: false, error: "No streams" };
    return { success: true, sources: data.streams.map(s => ({ url: s.url, quality: s.quality, type: 'hls' })), subtitles: [] };
  }

  processBeta(data) {
    if (!data.url) return { success: false, error: "No URL" };
    return { success: true, sources: [{ url: data.url, quality: 'auto', type: 'hls', referer: this.server.referer }], subtitles: data.subtitles || [] };
  }

  processSigma(data) {
    const hls = data.sources?.filter(s => s.type === 'hls' && s.file);
    if (!hls?.length) return { success: false, error: "No HLS" };
    const selected = hls[Math.min(2, hls.length - 1)];
    return { success: true, sources: [{ url: selected.file, quality: selected.label, type: 'hls', referer: this.server.referer }], subtitles: [] };
  }

  processGama(data) {
    if (!data.url) return { success: false, error: "No URL" };
    return { success: true, sources: [{ url: data.url, quality: 'auto', type: 'hls', referer: this.server.referer }], subtitles: data.subtitles || [] };
  }

  processCatflix(data) {
    if (!data.url?.length) return { success: false, error: "No URLs" };
    const sources = data.url.map(u => ({ url: u.link, quality: u.resolution ? `${u.resolution}p` : 'auto', type: u.type || 'mp4' })).sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
    return { success: true, sources, subtitles: (data.tracks || []).map(t => ({ url: t.file, label: t.label })) };
  }

  processHexa(data) {
    const playlist = data.data?.stream?.playlist || data.stream?.playlist;
    if (!playlist) return { success: false, error: "No playlist" };
    return { success: true, sources: [{ url: playlist, quality: 'auto', type: 'hls' }], subtitles: [] };
  }

  processDelta(data) {
    const streams = Array.isArray(data.streams) ? data.streams : [];
    const hindi = streams.find(s => (s.language || '').toLowerCase() === 'hindi');
    if (!hindi?.url) return { success: false, error: "No Hindi stream" };
    return { success: true, sources: [{ url: hindi.url, quality: 'Hindi', type: 'hls' }], subtitles: [] };
  }
}

module.exports = { SERVERS, SourceFetcher };
