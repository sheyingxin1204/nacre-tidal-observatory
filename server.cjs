const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  });
}).listen(port, '127.0.0.1', () => {
  console.log(`NACRE is available at http://127.0.0.1:${port}`);
});
