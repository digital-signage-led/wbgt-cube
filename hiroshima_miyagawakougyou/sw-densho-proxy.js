'use strict';

/** 伝承バトー API を同一オリジン /api/densho/latest として中継（CORS 回避） */
var DENSHO_UPSTREAM =
    'https://densho-bato.com/member/get_json_data_latest?term_id=1&pgn=miyagawa01';

self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
    var url = new URL(event.request.url);
    if (url.pathname !== '/api/densho/latest') return;
    event.respondWith(fetch(DENSHO_UPSTREAM, { cache: 'no-store' }).then(function (res) {
        return res.text().then(function (body) {
            return new Response(body, {
                status: res.status,
                statusText: res.statusText,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Cache-Control': 'no-store'
                }
            });
        });
    }).catch(function (err) {
        return new Response(JSON.stringify({ error: String(err.message || err) }), {
            status: 502,
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    }));
});
