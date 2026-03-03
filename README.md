# Vidnest API

A serverless API that scrapes streaming sources from multiple providers and returns playable video URLs.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/pushpaflamee/vidnest-api)

## Environment Variables

- `TMDB_KEY` - Your TMDB API key (optional, has fallback)

## API Endpoints

### Movie Endpoint

GET /api/movie?id={tmdbId}&server={serverName}

**Parameters:**
- `id` (required): TMDB Movie ID
- `server` (optional): One of `lamda`, `ophim`, `beta`, `gama`, `catflix`, `sigma`, `hexa`, `delta`, `alfa` (default: `lamda`)
- `proxy` (optional): `true` or `false` (default: `true`)

**Example:** `/api/movie?id=550&server=beta`

### TV Episode Endpoint

GET /api/tv?id={tmdbId}&season={season}&episode={episode}&server={serverName}

**Parameters:**
- `id` (required): TMDB TV Show ID
- `season` (required): Season number
- `episode` (required): Episode number
- `server` (optional): Server name (default: `lamda`)

**Example:** `/api/tv?id=1399&season=1&episode=1&server=ophim`

## Response Format

{
  "success": true,
  "server": "beta",
  "tmdbId": "550",
  "title": "Fight Club",
  "poster": "https://image.tmdb.org/t/p/w1280/...",
  "sources": [
    {
      "url": "https://proxy.../proxy?url=...",
      "quality": "auto",
      "type": "hls"
    }
  ],
  "subtitles": [
    {
      "url": "https://.../sub.vtt",
      "lang": "en",
      "label": "English",
      "default": true
    }
  ]
}

| Server  | Type           | Best For                  |
| ------- | -------------- | ------------------------- |
| lamda   | English        | Reliable English streams  |
| ophim   | Multi-quality  | Various quality options   |
| beta    | FlixHQ UpCloud | Fast, stable streams      |
| gama    | FlixHQ         | Alternative FlixHQ source |
| catflix | MP4            | Direct MP4 downloads      |
| sigma   | HollyMovieHD   | High-quality HLS          |
| hexa    | VidLink        | Captions included         |
| delta   | Hindi          | Hindi language content    |
| alfa    | PrimeVid       | Multiple source types     |

## Local Development
npm install
vercel dev

## License : MIT
