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

  const { id, season, episode, server = 'lamda' } = req.query;

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
    const [metadata, videoData] = await Promise.all([
      getTvDetails(id, season, episode),
      new SourceFetcher(serverKey, id, 'tv', season, episode).fetch()
    ]);

    if (!videoData.success) {
      return res.status(404).json({
        success: false,
        error: videoData.error || "Failed to fetch video",
        server: serverKey,
        tmdbId: id,
        season,
        episode
      });
    }

    const response = {
      success: true,
      server: serverKey,
      tmdbId: id,
      season: parseInt(season),
      episode: parseInt(episode),
      title: metadata?.title || `S${season}E${episode}`,
      showName: metadata?.showName,
      episodeName: metadata?.episodeName,
      poster: metadata?.poster,
      sources: videoData.sources || [],
      subtitles: videoData.subtitles || []
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
