const { fetchWithTimeout, createProxyUrl, createM3U8ProxyUrl, createMP4ProxyUrl } = require('./fetch');
const { decryptCipherResponse, cleanHeaders, cleanUrl, CIPHER_KEY } = require('./decrypt');

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
    this.timeout = 10000;
  }

  async fetch() {
    if (!this.server) {
      throw new Error(`Unknown server: ${this.serverKey}`);
    }

    try {
      switch (this.server.type) {
        case 'lamda':
          return await this.fetchLamda();
        case 'ophim':
          return await this.fetchOphim();
        case 'gama':
          return await this.fetchGama();
        case 'beta':
          return await this.fetchBeta();
        case 'catflix':
          return await this.fetchCatflix();
        case 'sigma':
          return await this.fetchSigma();
        case 'hexa':
          return await this.fetchHexa();
        case 'delta':
          return await this.fetchDelta();
        case 'alfa':
          return await this.fetchAlfa();
        default:
          throw new Error(`Unsupported server type: ${this.server.type}`);
      }
    } catch (error) {
      console.error(`[${this.serverKey}] Fetch error:`, error.message);
      throw error;
    }
  }

  getEndpoint() {
    const base = this.type === 'movie' ? this.server.movieUrl : this.server.tvUrl;
    if (this.type === 'movie') {
      return `${base}/${this.tmdbId}`;
    }
    return `${base}/${this.tmdbId}/${this.season}/${this.episode}`;
  }

  async fetchLamda() {
    const url = this.getEndpoint();
    const response = await fetchWithTimeout(url, {}, this.timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const encrypted = await response.text();
    const data = decryptCipherResponse(encrypted, CIPHER_KEY);
    
    if (!data) throw new Error('Decryption failed');
    
    const streams = Array.isArray(data.streams) ? data.streams : [];
    const englishStream = streams.find(s => 
      (s.language || '').toLowerCase() === 'english'
    ) || streams[0];
    
    if (!englishStream?.url) throw new Error('No stream URL found');

    return {
      sources: [{
        url: englishStream.url,
        quality: englishStream.quality || 'English',
        type: this.detectStreamType(englishStream.url)
      }],
      subtitles: []
    };
  }

  async fetchOphim() {
    const url = this.getEndpoint();
    const response = await fetchWithTimeout(url, {}, this.timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const encrypted = await response.text();
    const data = decryptCipherResponse(encrypted, CIPHER_KEY);
    
    if (!data || !Array.isArray(data.streams)) {
      throw new Error('Invalid response format');
    }

    return {
      sources: data.streams.map(s => ({
        url: s.url,
        quality: s.quality || 'HD',
        type: this.detectStreamType(s.url)
      })),
      subtitles: []
    };
  }

  async fetchGama() {
    const url = this.getEndpoint();
    const response = await fetchWithTimeout(url, {}, this.timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const encrypted = await response.text();
    const data = decryptCipherResponse(encrypted, CIPHER_KEY);
    
    if (!data?.url) throw new Error('No URL in response');

    const headers = { Referer: "https://videostr.net/" };
    const proxiedUrl = createProxyUrl(data.url, headers);

    const subtitles = (data.subtitles || []).map(s => ({
      url: s.url,
      lang: s.lang || 'Unknown',
      label: s.label || 'Unknown',
      default: !!s.default
    }));

    return {
      sources: [{
        url: proxiedUrl,
        quality: 'auto',
        type: 'hls'
      }],
      subtitles
    };
  }

  async fetchBeta() {
    // Similar to Gama but with UpCloud server parameter
    const url = `${this.getEndpoint()}?server=upcloud`;
    const response = await fetchWithTimeout(url, {}, this.timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const encrypted = await response.text();
    const data = decryptCipherResponse(encrypted, CIPHER_KEY);
    
    if (!data?.url) throw new Error('No URL in response');

    const headers = { 
      Referer: "https://videostr.net/",
      "User-Agent": "Mozilla/5.0"
    };
    const proxiedUrl = createProxyUrl(data.url, headers);

    const subtitles = (data.subtitles || []).map(s => ({
      url: s.url,
      lang: s.lang || 'Unknown',
      label: s.label || 'Unknown',
      default: !!s.default
    }));

    return {
      sources: [{
        url: proxiedUrl,
        quality: 'auto',
        type: 'hls'
      }],
      subtitles
    };
  }

  async fetchCatflix() {
    const url = this.getEndpoint();
    const response = await fetchWithTimeout(url, {}, this.timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const encrypted = await response.text();
    const data = decryptCipherResponse(encrypted, CIPHER_KEY);
    
    if (!data?.url || !Array.isArray(data.url)) {
      throw new Error('Invalid Catflix response');
    }

    const sources = data.url.map(u => ({
      url: createMP4ProxyUrl(u.link, data.headers || {}),
      quality: u.resolution ? (isNaN(Number(u.resolution)) ? u.resolution : `${u.resolution}p`) : 'auto',
      type: u.type || 'mp4'
    })).sort((a, b) => {
      const aq = parseInt(a.quality) || 0;
      const bq = parseInt(b.quality) || 0;
      return bq - aq; // Highest quality first
    });

    const subtitles = (data.tracks || []).map(t => ({
      url: t.file,
      label: t.label || 'Unknown',
      lang: t.label || 'en',
      default: false
    }));

    return { sources, subtitles };
  }

  async fetchSigma() {
    const base = this.type === 'movie' ? 'movie' : 'tv';
    const url = `${this.server.movieUrl}/${base}/${this.tmdbId}${this.type === 'tv' ? `/${this.season}/${this.episode}` : ''}`;
    
    const response = await fetchWithTimeout(url, {}, this.timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const encrypted = await response.text();
    const data = decryptCipherResponse(encrypted, CIPHER_KEY);
    
    if (!data?.success || !Array.isArray(data.sources)) {
      throw new Error('Invalid Sigma response');
    }

    const hlsSources = data.sources.filter(s => s.type === 'hls' && s.file);
    if (!hlsSources.length) throw new Error('No HLS sources');

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
      sources: [{
        url: createProxyUrl(selected.file, headers),
        quality: selected.label || 'auto',
        type: 'hls'
      }],
      subtitles: []
    };
  }

  async fetchHexa() {
    const url = this.getEndpoint();
    const response = await fetchWithTimeout(url, {}, this.timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const encrypted = await response.text();
    const data = decryptCipherResponse(encrypted, CIPHER_KEY);
    
    if (!data?.data?.stream?.playlist) {
      throw new Error('Invalid Hexa response');
    }

    const stream = data.data.stream;
    const headers = cleanHeaders(data.headers || {});
    
    const captions = (stream.captions || [])
      .filter(c => c.url && (c.type === 'vtt' || c.type === 'srt'))
      .map(c => ({
        label: c.language || 'Unknown',
        lang: (c.language || 'en').toLowerCase(),
        url: cleanUrl(c.url),
        default: false
      }));

    const playlistUrl = cleanUrl(stream.playlist);
    const proxiedUrl = `https://proxy2.animanga.fun/proxy?url=${encodeURIComponent(playlistUrl)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;

    return {
      sources: [{
        url: proxiedUrl,
        quality: 'auto',
        type: 'hls'
      }],
      subtitles: captions
    };
  }

  async fetchDelta() {
    const url = this.getEndpoint();
    const response = await fetchWithTimeout(url, {}, this.timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const encrypted = await response.text();
    const data = decryptCipherResponse(encrypted, CIPHER_KEY);
    
    const streams = Array.isArray(data.streams) ? data.streams : [];
    if (!streams.length) throw new Error('No streams found');

    const hindiStream = streams.find(s => 
      (s.language || '').toLowerCase() === 'hindi'
    );
    
    if (!hindiStream?.url) throw new Error('Hindi stream not available');

    return {
      sources: [{
        url: hindiStream.url,
        quality: 'Hindi',
        type: this.detectStreamType(hindiStream.url)
      }],
      subtitles: []
    };
  }

  async fetchAlfa() {
    const url = this.getEndpoint();
    const response = await fetchWithTimeout(url, {}, this.timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const encrypted = await response.text();
    const data = decryptCipherResponse(encrypted, CIPHER_KEY);
    
    if (!data?.sources || !Array.isArray(data.sources)) {
      throw new Error('Invalid Alfa response');
    }

    const validSources = data.sources.filter(s => {
      if (!s.url) return false;
      const isM3U8 = s.isM3U8 || s.url.includes('.m3u8') || s.url.includes('/hls/') || s.url.includes('master');
      const isTXT = s.url.includes('.txt');
      return isM3U8 || isTXT;
    });

    if (!validSources.length) throw new Error('No valid sources');

    const sources = validSources.map(s => {
      let url = s.url;
      const isM3U8 = !s.url.includes('.txt') && (s.isM3U8 || s.url.includes('.m3u8') || s.url.includes('/hls/'));
      
      if (isM3U8) {
        const headers = encodeURIComponent(JSON.stringify({ Referer: "https://primevid.click/" }));
        url = `https://proxy.animanga.fun/proxy?url=${encodeURIComponent(s.url)}&headers=${headers}`;
      }

      // Prioritize non-IP URLs
      const hasIP = /\/\/\d+\.\d+\.\d+\.\d+/.test(url);
      
      return {
        url,
        quality: s.quality || 'auto',
        type: isM3U8 ? 'hls' : 'mp4',
        priority: s.url.includes('.txt') ? 2 : hasIP ? 1 : 0
      };
    }).sort((a, b) => b.priority - a.priority);

    return {
      sources: sources.map(({ priority, ...rest }) => rest),
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
