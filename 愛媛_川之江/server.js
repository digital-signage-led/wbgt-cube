const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3015;
const ROOT = __dirname;
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8'
};

function serveStatic(filePath, res) {
    fs.readFile(filePath, function (err, data) {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
        if (ext === '.html') headers['Cache-Control'] = 'no-store';
        res.writeHead(200, headers);
        res.end(data);
    });
}

http.createServer(function (req, res) {
    const u = new URL(req.url, 'http://127.0.0.1:' + PORT);
    let rel = u.pathname === '/' ? 'index-4face.html' : u.pathname.replace(/^\//, '');
    const filePath = path.normalize(path.join(ROOT, rel));
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }
    serveStatic(filePath, res);
}).listen(PORT, function () {
    console.log('Signage server: http://127.0.0.1:' + PORT + '/');
});
