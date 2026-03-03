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

  const { id, server = 'lamda', proxy = 'true' } = req.query;
  const useProxy = proxy !== 'false';

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
    const [metadata, videoData] = await Promise.all([
      getMovieDetails(id),
      new SourceFetcher(serverKey, id, 'movie', null, null, useProxy).fetch()
    ]);

    if (!videoData.success) {
      return res.status(404).json({
        success: false,
        error: videoData.error || "Failed to fetch video",
        server: serverKey,
        tmdbId: id,
        details: videoData
      });
    }

    const response = {
      success: true,
      server: serverKey,
      tmdbId: id,
      title: metadata?.title || `Movie ${id}`,
      poster: metadata?.poster,
      backdrop: metadata?.backdrop,
      year: metadata?.year,
      sources: videoData.sources || [],
      subtitles: videoData.subtitles || [],
      proxyUsed: useProxy,
      note: "Use ?proxy=false to get direct URLs (may have CORS issues)"
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Movie API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      server: serverKey,
      tmdbId: id
    });
  }
};
