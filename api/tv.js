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

  const { id, season, episode, server = 'lamda', proxy = 'true' } = req.query;
  const useProxy = proxy !== 'false';

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
    // Fetch video data first to get decrypted response
    const fetcher = new SourceFetcher(serverKey, id, 'tv', season, episode, useProxy);
    const videoData = await fetcher.fetch();

    // If decryption/processing failed
    if (!videoData.success) {
      return res.status(404).json({
        decryptedResponse: videoData.rawData || videoData.decrypted || null,
        success: false,
        error: videoData.error || "Failed to fetch video",
        server: serverKey,
        tmdbId: id,
        season: parseInt(season),
        episode: parseInt(episode),
        details: videoData
      });
    }

    // Get metadata separately (don't block if it fails)
    let metadata = null;
    try {
      metadata = await getTvDetails(id, season, episode);
    } catch (e) {
      console.log('Metadata fetch failed:', e.message);
    }

    // Build response with decrypted data FIRST
    const response = {
      // 1. Full decrypted response from the server
      decryptedResponse: videoData.rawData || null,
      
      // 2. Processed video sources
      sources: videoData.sources || [],
      subtitles: videoData.subtitles || [],
      
      // 3. Metadata
      success: true,
      server: serverKey,
      tmdbId: id,
      season: parseInt(season),
      episode: parseInt(episode),
      title: metadata?.title || `S${season}E${episode}`,
      showName: metadata?.showName,
      episodeName: metadata?.episodeName,
      poster: metadata?.poster,
      backdrop: metadata?.backdrop,
      
      // 4. Other info
      proxyUsed: useProxy,
      note: "Use ?proxy=false to get direct URLs"
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('TV API Error:', error);
    return res.status(500).json({
      decryptedResponse: null,
      success: false,
      error: error.message,
      server: serverKey,
      tmdbId: id,
      season: parseInt(season),
      episode: parseInt(episode)
    });
  }
};
