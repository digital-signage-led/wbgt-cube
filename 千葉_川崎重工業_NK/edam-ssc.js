/**
 * 環境クラウドサービス（EDAM）騒音・振動 瞬時値
 * API: {apiHost}/Json/SSCNumData/{idNum}
 * RNSoVal … 騒音(dB) / RNShVal … 振動(dB)
 */
(function (global) {
    'use strict';

    const DEFAULT_HOST = 'https://www2.edam.ne.jp';
    const DEFAULT_PATH = '/Json/SSCNumData';

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

    async function fetchWithTimeout(url, ms) {
        const ctrl = new AbortController();
        const timer = setTimeout(function () { ctrl.abort(); }, ms);
        try {
            return await fetch(url, { cache: 'no-store', signal: ctrl.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    async function fetchRow(idNum, options) {
        options = options || {};
        const direct = apiBase(options) + '/' + idNum + '?flag=true&r=' + Date.now();
        const enc = encodeURIComponent(direct);
        const urls = [];
        const proxy = options.corsProxy !== 'off' && options.corsProxy !== 'none'
            ? (options.corsProxy || 'https://api.allorigins.win/raw?url=')
            : '';
        /* 同一オリジン／CORS許可時は直叩き優先 */
        urls.push(direct);
        if (proxy) {
            urls.push(proxy + enc);
            urls.push('https://api.allorigins.win/get?url=' + enc);
        }
        let lastErr = null;
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
                    data = typeof inner === 'string' ? JSON.parse(inner) : inner;
                } else {
                    data = JSON.parse(text);
                }
                if (!Array.isArray(data) || !data.length) throw new Error('empty');
                return data[0];
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
