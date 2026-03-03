module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  res.status(200).json({
    name: "Streaming API",
    version: "1.0.0",
    description: "Multi-source streaming API for movies and TV shows",
    endpoints: {
      movie: {
        path: "/api/movie",
        method: "GET",
        params: {
          id: "TMDB Movie ID (required)",
          server: "Server name: lamda, ophim, beta, gama, catflix, sigma, hexa, delta, alfa (default: lamda)",
          proxy: "Use proxy: true/false (default: true)"
        },
        example: "/api/movie?id=550&server=beta"
      },
      tv: {
        path: "/api/tv",
        method: "GET",
        params: {
          id: "TMDB TV Show ID (required)",
          season: "Season number (required)",
          episode: "Episode number (required)",
          server: "Server name (default: lamda)",
          proxy: "Use proxy: true/false (default: true)"
        },
        example: "/api/tv?id=1399&season=1&episode=1&server=ophim"
      }
    },
    servers: {
      lamda: "English streams (Movies & TV)",
      ophim: "Multi-quality streams (Movies & TV)",
      beta: "FlixHQ UpCloud (Movies & TV)",
      gama: "FlixHQ (Movies & TV)",
      catflix: "MP4 sources (Movies & TV)",
      sigma: "HollyMovieHD (Movies & TV)",
      hexa: "VidLink HLS (Movies & TV)",
      delta: "Hindi streams (Movies & TV)",
      alfa: "PrimeVid sources (Movies & TV)"
    },
    note: "All streams are proxied for CORS compatibility. Use proxy=false for direct URLs (may have CORS issues)"
  });
};
