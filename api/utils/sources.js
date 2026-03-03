const { fetchWithTimeout, createProxyUrl, createM3U8ProxyUrl, createMP4ProxyUrl } = require('./fetch');

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

      const contentType = response.headers.get('content-type') || '';
      let rawData;
      
      // Try to get raw text first
      try {
        rawData = await response.text();
      } catch (e) {
        throw new Error('Failed to read response body');
      }

      // Check if it's JSON
      let isJson = false;
      let parsedData = null;
      
      if (contentType.includes('application/json') || rawData.trim().startsWith('{') || rawData.trim().startsWith('[')) {
        try {
          parsedData = JSON.parse(rawData);
          isJson = true;
        } catch (e) {
          // Not valid JSON
        }
      }

      // Return raw response for debugging + any parsed data
      return {
        raw: rawData,
        isJson: isJson,
        parsed: parsedData,
        contentType: contentType,
        endpoint: endpoint,
        server: this.serverKey,
        hint: this.analyzeResponse(rawData, isJson, parsedData)
      };

    } catch (error) {
      console.error(`[${this.serverKey}] Error:`, error.message);
      throw error;
    }
  }

  getEndpoint() {
    const base = this.type === 'movie' ? this.server.movieUrl : this.server.tvUrl;
    if (this.type === 'movie') {
      // Some servers need ?server=upcloud parameter
      if (this.serverKey === 'beta') {
        return `${base}/${this.tmdbId}?server=upcloud`;
      }
      return `${base}/${this.tmdbId}`;
    }
    // TV endpoint
    if (this.serverKey === 'beta') {
      return `${base}/${this.tmdbId}/${this.season}/${this.episode}?server=upcloud`;
    }
    return `${base}/${this.tmdbId}/${this.season}/${this.episode}`;
  }

  analyzeResponse(raw, isJson, parsed) {
    // Analyze what we got back
    if (!raw || raw.length === 0) {
      return "Empty response";
    }
    
    if (isJson && parsed) {
      if (parsed.url || parsed.sources || parsed.streams || parsed.data) {
        return "Contains video data (unencrypted)";
      }
      if (parsed.encrypted !== undefined) {
        return `Encrypted flag: ${parsed.encrypted}`;
      }
      return `JSON with keys: ${Object.keys(parsed).join(', ')}`;
    }
    
    // Check for common encryption patterns
    if (raw.length > 100 && /^[A-Za-z0-9+/=]+$/.test(raw.replace(/\s/g, ''))) {
      return "Base64-like content (possibly encrypted)";
    }
    
    if (raw.includes('U2FsdGVkX1') || raw.includes('eyJ') || raw.includes('eyAi')) {
      return "Contains base64 patterns";
    }
    
    return `Raw text (${raw.length} chars)`;
  }
}

module.exports = {
  SERVERS,
  SourceFetcher
};
