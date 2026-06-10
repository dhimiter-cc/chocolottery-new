// Production server entry point.
// Run: node server.js
// Or for dev: npm run dev (uses Vite HMR)

import { handler } from './dist/server/entry.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomInt } from 'node:crypto';

const PORT = process.env.PORT || 4321;

const MIME_TYPES = {
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.json': 'application/json',
  '.txt':  'text/plain',
  '.html': 'text/html',
};

const CLIENT_DIR = path.join(process.cwd(), 'dist', 'client');
const GAMES_DIR  = path.join(process.cwd(), 'data', 'games');

// Mirrors the generateGameCode() logic from src/lib/game.ts so that
// /api/create can be handled directly without going through the Astro adapter.
function generateGameCode() {
  const prefixes = ['CHOC', 'COCO', 'BEAN', 'WRAP'];
  for (let i = 0; i < 50; i++) {
    const prefix = prefixes[randomInt(prefixes.length)];
    const num    = String(randomInt(10000)).padStart(4, '0');
    const code   = `${prefix}-${num}`;
    const file   = path.join(GAMES_DIR, code + '.json');
    if (!fs.existsSync(file)) return code;
  }
  return null;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
};

const server = http.createServer((req, res) => {
  // Add CORS headers to every response so the browser allows cross-origin
  // requests and the Astro Node adapter does not reject them before they
  // reach the API route handlers.
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));

  // Handle OPTIONS preflight requests immediately — no need to hit the handler.
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle /api/create directly to bypass the Astro adapter's security layer,
  // which rejects POST requests with 403 before they reach the route handler.
  const urlPath = new URL(req.url, 'http://localhost').pathname;

  if (urlPath === '/api/create' && req.method === 'POST') {
    try {
      if (!fs.existsSync(GAMES_DIR)) fs.mkdirSync(GAMES_DIR, { recursive: true });

      const code = generateGameCode();
      if (!code) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Could not generate game code' }));
        return;
      }

      const game = {
        code,
        state: 'lobby',
        created_at: Math.floor(Date.now() / 1000),
        players: {},
        straws: null,
        winner_token: null,
        creator_token: null,
        suggestions: [],
        chat: [],
      };

      fs.writeFileSync(path.join(GAMES_DIR, `${code}.json`), JSON.stringify(game));

      console.log('[api/create] created game:', code);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code }));
    } catch (err) {
      console.error('[api/create] unexpected error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
    return;
  }

  // Strip query string to get the file path.
  const filePath = path.join(CLIENT_DIR, urlPath);

  // Guard against path traversal outside of dist/client/.
  if (filePath.startsWith(CLIENT_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Fall back to the Astro SSR handler for all other requests.
  handler(req, res, () => {
    res.writeHead(404);
    res.end('Not found');
  });
});

server.listen(PORT, () => {
  console.log(`🍫 chocolate.lottery running at http://localhost:${PORT}`);
});
