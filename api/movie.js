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

  const { id, server = 'lamda' } = req.query;

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
    const videoData = await fetcher.fetch();

    if (!videoData.success) {
      return res.status(404).json({
        success: false,
        error: videoData.error || "Failed to fetch video"
      });
    }

    let metadata = null;
    try {
      metadata = await getMovieDetails(id);
    } catch (e) {
      console.log('Metadata fetch failed:', e.message);
    }

    const response = {
      // 1. URLs (sources)
      sources: videoData.sources || [],
      
      // 2. Subtitles
      subtitles: videoData.subtitles || [],
      
      // 3. Metadata only
      success: true,
      server: serverKey,
      tmdbId: id,
      title: metadata?.title || `Movie ${id}`,
      poster: metadata?.poster,
      backdrop: metadata?.backdrop,
      year: metadata?.year
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Movie API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
