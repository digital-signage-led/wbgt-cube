const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3014;
const ROOT = __dirname;
const ECS_LIVE_PATH = path.join(ROOT, 'assets', 'ecs-live.json');
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8'
};

function proxyEcsWbgt(dataId, res) {
    const url = 'https://www.ecs-cloud.ne.jp/Json/WBGTNumData/' +
        encodeURIComponent(dataId) + '?r=' + Date.now();
    https.get(url, { headers: { 'User-Agent': 'tokushima-sasakikensetu-signage/1.0' } }, function (up) {
        const chunks = [];
        up.on('data', function (chunk) { chunks.push(chunk); });
        up.on('end', function () {
            const body = Buffer.concat(chunks);
            if (up.statusCode === 200) {
                try {
                    fs.writeFileSync(ECS_LIVE_PATH, body, 'utf8');
                } catch (err) {
                    console.warn('[ecs-live] write failed:', err.message);
                }
            }
            res.writeHead(up.statusCode || 200, Object.assign({
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-store'
            }, corsHeaders_()));
            res.end(body);
        });
    }).on('error', function (err) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('ECS proxy error: ' + err.message);
    });
}

function serveStatic(filePath, res) {
    fs.readFile(filePath, function (err, data) {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

function corsHeaders_() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
}

http.createServer(function (req, res) {
    const u = new URL(req.url, 'http://127.0.0.1:' + PORT);
    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders_());
        res.end();
        return;
    }
    const proxyMatch = u.pathname.match(/^\/api\/ecs\/wbgt\/([^/]+)$/);
    if (proxyMatch) {
        proxyEcsWbgt(proxyMatch[1], res);
        return;
    }

    let rel = u.pathname === '/' ? 'index-5face.html' : u.pathname.replace(/^\//, '');
    const filePath = path.normalize(path.join(ROOT, rel));
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }
    serveStatic(filePath, res);
}).listen(PORT, function () {
    console.log('Signage server: http://127.0.0.1:' + PORT + '/');
    console.log('ECS proxy:    http://127.0.0.1:' + PORT + '/api/ecs/wbgt/1050');
});
