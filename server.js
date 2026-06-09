// Production server entry point.
// Run: node server.js
// Or for dev: npm run dev (uses Vite HMR)

import { handler } from './dist/server/entry.mjs';
import http from 'node:http';

const PORT = process.env.PORT || 4321;

const server = http.createServer((req, res) => {
  handler(req, res, () => {
    res.writeHead(404);
    res.end('Not found');
  });
});

server.listen(PORT, () => {
  console.log(`🍫 chocolate.lottery running at http://localhost:${PORT}`);
});
