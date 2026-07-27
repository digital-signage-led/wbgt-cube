/**
 * 環境クラウドサービス（EDAM）騒音・振動 瞬時値
 * API: {apiHost}/Json/SSCNumData/{idNum}
 * RNSoVal … 騒音(dB) / RNShVal … 振動(dB)
 *
 * 取得順:
 *  1) 同一オリジン /api/ssc/{id}（node server.js のローカルプロキシ）
 *  2) gasUrl（GAS プロキシ）
 *  3) CORS プロキシ群
 *  4) EDAM 直叩き（CORS許可時のみ）
 */
(function (global) {
    'use strict';

    const DEFAULT_HOST = 'https://www2.edam.ne.jp';
    const DEFAULT_PATH = '/Json/SSCNumData';
    const TRY_MS = 7000;
    const DEFAULT_PROXIES = [
        'https://cors.eu.org/',
        'https://api.allorigins.win/raw?url=',
        'https://api.allorigins.win/get?url='
    ];

    function apiBase(options) {
        const host = String((options && options.apiHost) || DEFAULT_HOST).replace(/\/$/, '');
        const path = (options && options.apiPath) || DEFAULT_PATH;
        return host + path;
    }

    function formatDb(raw) {
        if (raw === null || raw === undefined || raw === '') return null;
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        const rounded = Math.round(n * 10) / 10;
        return (Math.abs(rounded % 1) < 1e-9)
            ? String(Math.round(rounded)) + '.0'
            : String(rounded);
    }

    function parseTimeLabel(timeStr) {
        const s = String(timeStr || '');
        if (s.length >= 14) {
            return s.slice(0, 4) + '/' + s.slice(4, 6) + '/' + s.slice(6, 8)
                + ' ' + s.slice(8, 10) + ':' + s.slice(10, 12) + ':' + s.slice(12, 14);
        }
        return '';
    }

    function rowToValues(row) {
        row = row || {};
        return {
            noise: formatDb(row.RNSoVal != null ? row.RNSoVal : row.SoVal),
            vibration: formatDb(row.RNShVal != null ? row.RNShVal : row.ShVal),
            time: parseTimeLabel(row.Time),
            raw: row
        };
    }

    function isValidSscRow_(row) {
        if (!row || typeof row !== 'object') return false;
        const hasTime = row.Time != null && String(row.Time).length >= 8;
        const hasNoise = row.RNSoVal != null || row.SoVal != null;
        const hasVib = row.RNShVal != null || row.ShVal != null;
        return !!(hasTime && (hasNoise || hasVib));
    }

    function extractJsonPayload(text) {
        const s = String(text || '').trim();
        if (!s) throw new Error('empty body');
        /* HTML（Live Preview のフォールバック等）は除外 */
        if (/^<!DOCTYPE/i.test(s) || /<html[\s>]/i.test(s)) throw new Error('html body');
        try {
            return JSON.parse(s);
        } catch (e0) {
            const m = s.match(/\[\s*\{[\s\S]*?\}\s*\]/);
            if (!m) throw e0;
            return JSON.parse(m[0]);
        }
    }

    function firstRowFromData(data) {
        let row = null;
        if (Array.isArray(data) && data.length) row = data[0];
        else if (data && Array.isArray(data.data) && data.data.length) row = data.data[0];
        else if (data && data.Time != null) row = data;
        if (!isValidSscRow_(row)) throw new Error('empty');
        return row;
    }

    async function fetchWithTimeout(url, ms) {
        const ctrl = new AbortController();
        const timer = setTimeout(function () { ctrl.abort(); }, ms || TRY_MS);
        try {
            return await fetch(url, { cache: 'no-store', signal: ctrl.signal, mode: 'cors' });
        } finally {
            clearTimeout(timer);
        }
    }

    function fetchJsonp(url, ms) {
        return new Promise(function (resolve, reject) {
            const cb = '_edamSscCb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
            const sep = url.indexOf('?') >= 0 ? '&' : '?';
            const src = url + sep + 'callback=' + encodeURIComponent(cb);
            let settled = false;
            const timer = setTimeout(function () {
                if (settled) return;
                settled = true;
                cleanup();
                reject(new Error('JSONP timeout'));
            }, ms || TRY_MS);
            function cleanup() {
                clearTimeout(timer);
                try { delete global[cb]; } catch (e) { global[cb] = undefined; }
                if (script && script.parentNode) script.parentNode.removeChild(script);
            }
            global[cb] = function (payload) {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(payload);
            };
            const script = document.createElement('script');
            script.async = true;
            script.src = src;
            script.onerror = function () {
                if (settled) return;
                settled = true;
                cleanup();
                reject(new Error('JSONP load error'));
            };
            (document.head || document.documentElement).appendChild(script);
        });
    }

    async function parseResponseRow_(url, res) {
        const ct = String(res.headers.get('content-type') || '').toLowerCase();
        const text = await res.text();
        if (!res.ok) throw new Error('HTTP ' + res.status);
        if (ct && ct.indexOf('text/html') >= 0) throw new Error('html content-type');
        let data;
        if (url.indexOf('allorigins.win/get') >= 0) {
            const wrap = JSON.parse(text);
            const inner = wrap.contents;
            data = typeof inner === 'string' ? extractJsonPayload(inner) : inner;
        } else {
            data = extractJsonPayload(text);
        }
        return firstRowFromData(data);
    }

    async function fetchViaGas_(idNum, gasUrl) {
        const base = String(gasUrl || '').replace(/\/$/, '');
        if (!base) throw new Error('gasUrl empty');
        const q = 'idNum=' + encodeURIComponent(idNum) + '&r=' + Date.now();
        const url = base + (base.indexOf('?') >= 0 ? '&' : '?') + q;
        try {
            const res = await fetchWithTimeout(url, TRY_MS);
            return await parseResponseRow_(url, res);
        } catch (e) {
            const payload = await fetchJsonp(url, TRY_MS);
            return firstRowFromData(payload);
        }
    }

    function localProxyUrls_(idNum) {
        if (typeof location === 'undefined') return [];
        if (location.protocol !== 'http:' && location.protocol !== 'https:') return [];
        /* Live Preview 等で /api が無い場合に長く待たないよう、明示オプトイン or node server 想定時のみ */
        const q = (typeof location !== 'undefined' && location.search) ? location.search : '';
        const want = /(?:\?|&)sscLocal=1(?:&|$)/.test(q) || /(?:\?|&)proxy=1(?:&|$)/.test(q);
        /* server.js 起動時は常に試す（短いタイムアウト） */
        if (!want && !global.__EDAM_SSC_FORCE_LOCAL__) {
            /* 同一オリジンは短時間1本だけ試し、HTML/404なら即フォールバック */
        }
        const origin = location.origin;
        const id = encodeURIComponent(String(idNum));
        const bust = 'r=' + Date.now();
        return [
            origin + '/api/ssc/' + id + '?' + bust
        ];
    }

    function buildProxyUrls_(direct, options) {
        const urls = [];
        const off = options.corsProxy === 'off' || options.corsProxy === 'none';
        if (off) return urls;

        const list = [];
        if (options.corsProxy && typeof options.corsProxy === 'string'
            && options.corsProxy !== 'off' && options.corsProxy !== 'none') {
            list.push(options.corsProxy);
        }
        DEFAULT_PROXIES.forEach(function (p) {
            if (list.indexOf(p) < 0) list.push(p);
        });

        const enc = encodeURIComponent(direct);
        list.forEach(function (proxy) {
            if (proxy.indexOf('allorigins.win/') >= 0 || /[?&]url=$/.test(proxy) || proxy.slice(-5) === '?url=') {
                urls.push(proxy + enc);
            } else {
                urls.push(proxy + direct);
            }
        });
        urls.push('https://r.jina.ai/' + direct);
        return urls;
    }

    async function tryUrls_(urls, timeoutMs) {
        let lastErr = null;
        const ms = timeoutMs || TRY_MS;
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            try {
                const res = await fetchWithTimeout(url, ms);
                return await parseResponseRow_(url, res);
            } catch (e) {
                lastErr = e;
            }
        }
        throw lastErr || new Error('EDAM SSC 取得不可');
    }

    async function fetchRow(idNum, options) {
        options = options || {};
        const direct = apiBase(options) + '/' + idNum + '?flag=true&r=' + Date.now();
        let lastErr = null;

        /* 1) ローカル同一オリジン（短時間）。無ければすぐ次へ */
        const localUrls = localProxyUrls_(idNum);
        if (localUrls.length) {
            try {
                return await tryUrls_(localUrls, 2500);
            } catch (e) {
                lastErr = e;
            }
        }

        /* 2) GAS */
        if (options.gasUrl) {
            try {
                return await fetchViaGas_(idNum, options.gasUrl);
            } catch (e) {
                lastErr = e;
            }
        }

        /* 3) CORS プロキシ（ブラウザ本番経路） */
        try {
            return await tryUrls_(buildProxyUrls_(direct, options), TRY_MS);
        } catch (e) {
            lastErr = e;
        }

        /* 4) 直叩き */
        try {
            return await tryUrls_([direct], TRY_MS);
        } catch (e) {
            lastErr = e;
        }

        throw lastErr || new Error('EDAM SSC 取得不可');
    }

    async function fetchValues(idNum, options) {
        const row = await fetchRow(idNum, options);
        const vals = rowToValues(row);
        if (vals.noise == null && vals.vibration == null) {
            throw new Error('SSC values missing');
        }
        return vals;
    }

    global.EdamSsc = {
        fetchValues: fetchValues,
        fetchRow: fetchRow,
        rowToValues: rowToValues,
        formatDb: formatDb
    };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
