/**
 * WBGT サイネージ用 HTTP サーバー
 * - index-4face.html 配信
 * - 伝承バトー API プロキシ /api/densho/latest（CORS 回避）
 * 使い方: node serve.js
 *   同一PC: http://127.0.0.1:8765/index-4face.html?layout512=1&native640=1
 *   サイネージ（Wi-Fi）: http://<このPCのIP>:8765/index-4face.html?layout512=1&native640=1
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const ROOT = __dirname;
const DEFAULT_PORT = 8765;
const DENSHO_UPSTREAM =
    process.env.DENSHO_API ||
    'https://densho-bato.com/member/get_json_data_latest?term_id=1&pgn=miyagawa01';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};

const PAGE_QUERY = 'layout512=1&native640=1';

function pageUrl_(host, port) {
    return 'http://' + host + ':' + port + '/index-4face.html?' + PAGE_QUERY;
}

function getLanIpv4Addresses_() {
    const out = [];
    const nets = os.networkInterfaces();
    Object.keys(nets).forEach(function (name) {
        (nets[name] || []).forEach(function (net) {
            if (net && net.family === 'IPv4' && !net.internal) out.push(net.address);
        });
    });
    return out;
}

function openBrowser_(port) {
    if (process.argv.indexOf('--no-open') >= 0) return;
    const url = pageUrl_('127.0.0.1', port);
    if (process.platform === 'win32') {
        exec('start "" "' + url + '"', function () {});
    } else if (process.platform === 'darwin') {
        exec('open "' + url + '"', function () {});
    } else {
        exec('xdg-open "' + url + '"', function () {});
    }
}

function sendJson(res, status, obj) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(obj));
}

async function proxyDensho_(res) {
    try {
        const upstream = await fetch(DENSHO_UPSTREAM, { cache: 'no-store' });
        const body = await upstream.text();
        res.writeHead(upstream.status, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
        });
        res.end(body);
    } catch (e) {
        sendJson(res, 502, { error: String(e.message || e) });
    }
}

function serveFile_(res, filePath) {
    fs.readFile(filePath, function (err, data) {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

function onRequest(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/densho/latest') {
        proxyDensho_(res);
        return;
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index-4face.html';
    const filePath = path.join(ROOT, rel.replace(/^\/+/, ''));
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    serveFile_(res, filePath);
}

function tryListen(port) {
    const server = http.createServer(onRequest);
    server.once('error', function (err) {
        if (err.code === 'EADDRINUSE' && port < DEFAULT_PORT + 10) {
            console.warn('Port ' + port + ' in use — trying ' + (port + 1));
            tryListen(port + 1);
            return;
        }
        console.error('サーバー起動失敗:', err.message || err);
        process.exit(1);
    });
    const bindHost = process.argv.indexOf('--local-only') >= 0 ? '127.0.0.1' : '0.0.0.0';
    server.listen(port, bindHost, function () {
        const localUrl = pageUrl_('127.0.0.1', port);
        const lanIps = getLanIpv4Addresses_();
        const signageUrl = lanIps.length ? pageUrl_(lanIps[0], port) : localUrl;
        try {
            fs.writeFileSync(path.join(ROOT, '.wbgt-server-url'), localUrl, 'utf8');
            fs.writeFileSync(path.join(ROOT, '.wbgt-signage-url'), signageUrl, 'utf8');
        } catch (_) {}
        console.log('');
        console.log('========================================');
        console.log(' WBGT signage server started');
        console.log(' Local:   ' + localUrl);
        if (lanIps.length) {
            console.log(' Signage (Wi-Fi / LAN):');
            lanIps.forEach(function (ip) {
                console.log('   ' + pageUrl_(ip, port));
            });
        } else {
            console.log(' Signage: (no LAN IP found — check Wi-Fi)');
        }
        console.log(' Stop: close this window');
        console.log('========================================');
        console.log('');
        openBrowser_(port);
    });
}

tryListen(Number(process.env.PORT) || DEFAULT_PORT);
                                                                                                        
