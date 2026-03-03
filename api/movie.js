const { getMovieDetails } = require('./utils/tmdb');
const { SourceFetcher, SERVERS } = require('./utils/sources');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id, server = 'lamda', debug = 'true' } = req.query;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameter: id (TMDB ID)'
    });
  }

  const serverKey = server.toLowerCase();
  if (!SERVERS[serverKey]) {
    return res.status(400).json({
      success: false,
      error: `Invalid server. Available: ${Object.keys(SERVERS).join(', ')}`
    });
  }

  try {
    const fetcher = new SourceFetcher(serverKey, id, 'movie');
    const result = await fetcher.fetch();
    
    // Try to extract any URLs from the raw response
    const extractedUrls = extractUrls(result.raw);
    
    const response = {
      success: true,
      server: serverKey,
      tmdbId: id,
      endpoint: result.endpoint,
      contentType: result.contentType,
      isJson: result.isJson,
      hint: result.hint,
      responseLength: result.raw.length,
      raw: debug === 'true' ? result.raw.substring(0, 5000) : '[hidden - set debug=false to hide]',
      parsed: result.parsed,
      extractedUrls: extractedUrls,
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Movie API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      server: serverKey,
      tmdbId: id,
      stack: debug === 'true' ? error.stack : undefined
    });
  }
};

function extractUrls(text) {
  if (!text) return [];
  
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
  const matches = text.match(urlRegex) || [];
  
  // Also look for URL-encoded URLs
  const decodedMatches = matches.map(url => {
    try {
      if (url.includes('%')) {
        return decodeURIComponent(url);
      }
      return url;
    } catch (e) {
      return url;
    }
  });
  
  return [...new Set(decodedMatches)].slice(0, 10); // Unique, max 10
}
