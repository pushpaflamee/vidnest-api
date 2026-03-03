const { getTvDetails } = require('./utils/tmdb');
const { SourceFetcher, SERVERS } = require('./utils/sources');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id, season, episode, server = 'lamda', debug = 'true' } = req.query;

  if (!id || !season || !episode) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: id, season, episode'
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
    const fetcher = new SourceFetcher(serverKey, id, 'tv', season, episode);
    const result = await fetcher.fetch();
    
    const extractedUrls = extractUrls(result.raw);

    const response = {
      success: true,
      server: serverKey,
      tmdbId: id,
      season: parseInt(season),
      episode: parseInt(episode),
      endpoint: result.endpoint,
      contentType: result.contentType,
      isJson: result.isJson,
      hint: result.hint,
      responseLength: result.raw.length,
      raw: debug === 'true' ? result.raw.substring(0, 5000) : '[hidden]',
      parsed: result.parsed,
      extractedUrls: extractedUrls,
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('TV API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      server: serverKey,
      tmdbId: id,
      season,
      episode
    });
  }
};

function extractUrls(text) {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
  const matches = text.match(urlRegex) || [];
  return [...new Set(matches)].slice(0, 10);
}
