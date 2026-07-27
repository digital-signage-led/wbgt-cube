/**
 * 環境クラウドサービス（EDAM）騒音・振動 瞬時値
 * API: {apiHost}/Json/SSCNumData/{idNum}
 * RNSoVal … 騒音(dB) / RNShVal … 振動(dB)
 *
 * GitHub Pages / 異オリジンでは EDAM に CORS が無いため、
 * gasUrl（推奨）→ 複数 CORS プロキシ → 直叩き の順で取得する。
 */
(function (global) {
    'use strict';

    const DEFAULT_HOST = 'https://www2.edam.ne.jp';
    const DEFAULT_PATH = '/Json/SSCNumData';
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

    function extractJsonArray(text) {
        const s = String(text || '').trim();
        if (!s) throw new Error('empty body');
        try {
            return JSON.parse(s);
        } catch (e0) {
            /* jina.ai などが Markdown で包む場合 */
            const m = s.match(/\[[\s\S]*?\]/);
            if (!m) throw e0;
            return JSON.parse(m[0]);
        }
    }

    function firstRowFromData(data) {
        if (Array.isArray(data) && data.length) return data[0];
        if (data && Array.isArray(data.data) && data.data.length) return data.data[0];
        if (data && data.Time != null) return data;
        throw new Error('empty');
    }

    async function fetchWithTimeout(url, ms) {
        const ctrl = new AbortController();
        const timer = setTimeout(function () { ctrl.abort(); }, ms);
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
            }, ms || 12000);
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

    async function fetchViaGas_(idNum, gasUrl) {
        const base = String(gasUrl || '').replace(/\/$/, '');
        if (!base) throw new Error('gasUrl empty');
        const q = 'idNum=' + encodeURIComponent(idNum) + '&r=' + Date.now();
        const url = base + (base.indexOf('?') >= 0 ? '&' : '?') + q;
        try {
            const res = await fetchWithTimeout(url, 12000);
            const text = await res.text();
            if (!res.ok) throw new Error('GAS HTTP ' + res.status);
            return firstRowFromData(extractJsonArray(text));
        } catch (e) {
            const payload = await fetchJsonp(url, 12000);
            return firstRowFromData(payload);
        }
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
                /* cors.eu.org 等: 素の URL を連結（エンコード版も併用） */
                urls.push(proxy + direct);
                urls.push(proxy + enc);
            }
        });
        /* 最終手段: jina reader（Markdown 内 JSON） */
        urls.push('https://r.jina.ai/' + direct);
        return urls;
    }

    async function fetchRow(idNum, options) {
        options = options || {};
        const direct = apiBase(options) + '/' + idNum + '?flag=true&r=' + Date.now();
        let lastErr = null;

        if (options.gasUrl) {
            try {
                return await fetchViaGas_(idNum, options.gasUrl);
            } catch (e) {
                lastErr = e;
            }
        }

        const urls = [direct].concat(buildProxyUrls_(direct, options));
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            try {
                const res = await fetchWithTimeout(url, 12000);
                const text = await res.text();
                if (!res.ok) throw new Error('HTTP ' + res.status);
                let data;
                if (url.indexOf('allorigins.win/get') >= 0) {
                    const wrap = JSON.parse(text);
                    const inner = wrap.contents;
                    data = typeof inner === 'string' ? extractJsonArray(inner) : inner;
                } else {
                    data = extractJsonArray(text);
                }
                return firstRowFromData(data);
            } catch (e) {
                lastErr = e;
            }
        }
        throw lastErr || new Error('EDAM SSC 取得不可');
    }

    async function fetchValues(idNum, options) {
        const row = await fetchRow(idNum, options);
        return rowToValues(row);
    }

    global.EdamSsc = {
        fetchValues: fetchValues,
        fetchRow: fetchRow,
        rowToValues: rowToValues,
        formatDb: formatDb
    };
})(typeof window !== 'undefined' ? window : global);
