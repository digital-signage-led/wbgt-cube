/**
 * ローカル確認用: 静的配信 + EDAM 騒音振動プロキシ（CORS回避）
 * 使い方: node server.js
 * 開く: http://127.0.0.1:3002/index-4face.html?only=ssc
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3002);
const SSC_HOST = 'www2.edam.ne.jp';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function send(res, code, body, headers) {
  res.writeHead(code, Object.assign({
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  }, headers || {}));
  res.end(body);
}

function proxySsc(idNum, res) {
  const id = String(idNum || '').replace(/[^\d]/g, '');
  if (!/^\d{3,8}$/.test(id)) {
    send(res, 400, JSON.stringify({ error: 'bad idNum' }), { 'Content-Type': 'application/json; charset=utf-8' });
    return;
  }
  const apiPath = '/Json/SSCNumData/' + id + '?flag=true&r=' + Date.now();
  const req = https.request({
    hostname: SSC_HOST,
    path: apiPath,
    method: 'GET',
    headers: { 'User-Agent': 'wbgt-nk-ssc-local-proxy/1.0', Accept: 'application/json' }
  }, function (up) {
    const chunks = [];
    up.on('data', function (c) { chunks.push(c); });
    up.on('end', function () {
      const buf = Buffer.concat(chunks);
      send(res, up.statusCode || 502, buf, {
        'Content-Type': 'application/json; charset=utf-8'
      });
    });
  });
  req.on('error', function (err) {
    send(res, 502, JSON.stringify({ error: String(err && err.message || err) }), {
      'Content-Type': 'application/json; charset=utf-8'
    });
  });
  req.setTimeout(12000, function () {
    req.destroy(new Error('upstream timeout'));
  });
  req.end();
}

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent((reqPath || '/').split('?')[0]);
  const rel = decoded.replace(/^\/+/, '');
  const full = path.normalize(path.join(root, rel || 'index-4face.html'));
  if (!full.startsWith(root)) return null;
  return full;
}

const server = http.createServer(function (req, res) {
  const u = new URL(req.url || '/', 'http://127.0.0.1');
  if (req.method === 'OPTIONS') {
    send(res, 204, '', {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return;
  }

  const m = u.pathname.match(/^\/(?:api\/)?(?:proxy\/)?ssc\/(\d+)\/?$/);
  if (m) {
    proxySsc(m[1], res);
    return;
  }
  if (u.pathname === '/api/ssc' || u.pathname === '/proxy/ssc') {
    proxySsc(u.searchParams.get('idNum') || u.searchParams.get('id'), res);
    return;
  }

  let filePath = safeJoin(ROOT, u.pathname === '/' ? '/index-4face.html' : u.pathname);
  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }
  fs.stat(filePath, function (err, st) {
    if (!err && st.isDirectory()) filePath = path.join(filePath, 'index-4face.html');
    fs.readFile(filePath, function (readErr, data) {
      if (readErr) {
        send(res, 404, 'Not Found: ' + u.pathname);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    });
  });
});

function listen(port, triesLeft) {
  const s = server.listen(port, '127.0.0.1', function () {
    console.log('[NK] http://127.0.0.1:' + port + '/index-4face.html?only=ssc');
    console.log('[NK] SSC proxy http://127.0.0.1:' + port + '/api/ssc/2526');
    console.log('[NK] Cursor Live Preview ではなく、この URL を開いてください（CORS回避プロキシ付き）');
  });
  s.on('error', function (err) {
    if (err && err.code === 'EADDRINUSE' && triesLeft > 0) {
      console.warn('[NK] port', port, '使用中 →', port + 1);
      listen(port + 1, triesLeft - 1);
      return;
    }
    throw err;
  });
}
listen(PORT, 30);
