const { fetchWithTimeout } = require('./fetch');

const TMDB_API_KEY = process.env.TMDB_KEY || "61e2290429798c561450eb56b26de19b";
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w1280";

async function getMovieDetails(tmdbId) {
  try {
    const response = await fetchWithTimeout(
      `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`,
      {},
      5000
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      title: data.title,
      poster: data.poster_path ? `${IMAGE_BASE}${data.poster_path}` : null,
      backdrop: data.backdrop_path ? `${IMAGE_BASE}${data.backdrop_path}` : null,
      year: data.release_date?.split('-')[0],
      overview: data.overview
    };
  } catch (error) {
    console.error('TMDB movie fetch error:', error);
    return null;
  }
}

async function getTvDetails(tmdbId, season, episode) {
  try {
    const [showRes, episodeRes] = await Promise.all([
      fetchWithTimeout(`${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_API_KEY}`, {}, 5000),
      fetchWithTimeout(`${TMDB_BASE}/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`, {}, 5000)
    ]);
    
    if (!showRes.ok || !episodeRes.ok) return null;
    
    const showData = await showRes.json();
    const episodeData = await episodeRes.json();
    
    return {
      title: `${showData.name} - S${season}E${episode}: ${episodeData.name}`,
      poster: episodeData.still_path ? `${IMAGE_BASE}${episodeData.still_path}` : 
              showData.backdrop_path ? `${IMAGE_BASE}${showData.backdrop_path}` : null,
      backdrop: showData.backdrop_path ? `${IMAGE_BASE}${showData.backdrop_path}` : null,
      showName: showData.name,
      episodeName: episodeData.name
    };
  } catch (error) {
    console.error('TMDB TV fetch error:', error);
    return null;
  }
}

async function fetchExternalSubtitles(tmdbId, type = 'movie', season = null, episode = null) {
  try {
    // This would integrate with subtitle providers like OpenSubtitles
    // For now, return empty array - implement based on your subtitle sources
    return [];
  } catch (error) {
    return [];
  }
}

module.exports = {
  getMovieDetails,
  getTvDetails,
  fetchExternalSubtitles,
  TMDB_API_KEY,
  IMAGE_BASE
};
