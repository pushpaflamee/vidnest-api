const { getTvDetails, fetchExternalSubtitles } = require('./utils/tmdb');
const { SourceFetcher, SERVERS } = require('./utils/sources');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, season, episode, server = 'lamda', proxy } = req.query;

  if (!id || !season || !episode) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: id (TMDB ID), season, episode'
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
    // Fetch metadata and video data in parallel
    const [metadata, videoData] = await Promise.all([
      getTvDetails(id, season, episode),
      new SourceFetcher(serverKey, id, 'tv', season, episode).fetch().catch(err => ({ error: err.message }))
    ]);

    if (videoData.error) {
      return res.status(404).json({
        success: false,
        error: videoData.error,
        server: serverKey,
        tmdbId: id,
        season,
        episode
      });
    }

    // Try to fetch external subtitles
    let subtitles = videoData.subtitles || [];
    try {
      const externalSubs = await fetchExternalSubtitles(id, 'tv', season, episode);
      subtitles = [...subtitles, ...externalSubs];
    } catch (e) {
      // Ignore subtitle fetch errors
    }

    const response = {
      success: true,
      server: serverKey,
      tmdbId: id,
      season: parseInt(season),
      episode: parseInt(episode),
      title: metadata?.title || `TV Show ${id} S${season}E${episode}`,
      showName: metadata?.showName,
      episodeName: metadata?.episodeName,
      poster: metadata?.poster,
      backdrop: metadata?.backdrop,
      sources: videoData.sources.map(s => ({
        url: s.url,
        quality: s.quality,
        type: s.type || 'mp4',
        ...(proxy === 'false' && { direct: true })
      })),
      subtitles: subtitles.map(s => ({
        url: s.url,
        lang: s.lang || 'en',
        label: s.label || 'Unknown',
        default: s.default || false
      })),
      headers: {
        Referer: "https://videostr.net/",
        Origin: "https://videostr.net"
      }
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('TV API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      server: serverKey,
      tmdbId: id,
      season,
      episode
    });
  }
};
