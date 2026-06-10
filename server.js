// Production server entry point.
// Run: node server.js
// Or for dev: npm run dev (uses Vite HMR)

import { handler } from './dist/server/entry.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

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

const server = http.createServer((req, res) => {
  // Strip query string to get the file path.
  const urlPath = new URL(req.url, 'http://localhost').pathname;
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
