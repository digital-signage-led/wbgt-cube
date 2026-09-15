/**
 * WBGT OFF 時の通常気象・気温連動テーマ（Single Source of Truth）
 * WBGT 危険度色とは別系統。気温から危険度は判定しない。
 */
(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (typeof root !== 'undefined') root.WeatherTheme = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    var STORAGE_KEY = 'ac_weather_theme_v1';
    var STALE_MS = 90 * 60 * 1000;

    var PRESET_BANDS = [
        { min: null, max: 0, name: 'ice-violet', label: 'アイスバイオレット', color: '#6544B5', meaning: '凍結・極寒' },
        { min: 0, max: 10, name: 'turquoise', label: 'ターコイズ', color: '#00A6A6', meaning: '冷たい' },
        { min: 10, max: 20, name: 'emerald', label: 'エメラルド', color: '#2E9E62', meaning: '涼しい・爽やか' },
        { min: 20, max: 28, name: 'rose', label: 'ローズ', color: '#D94F8A', meaning: '暖かい' },
        { min: 28, max: null, name: 'burgundy', label: 'バーガンディ', color: '#6D2945', meaning: '熱さ・重い暑さ' }
    ];

    var observed = { temp: null, atMs: null };

    function cloneBands(bands) {
        return (bands || PRESET_BANDS).map(function (b) {
            return {
                min: b.min == null ? null : Number(b.min),
                max: b.max == null ? null : Number(b.max),
                name: b.name,
                label: b.label || b.name,
                color: String(b.color || '').toUpperCase(),
                meaning: b.meaning || ''
            };
        });
    }

    function readStored() {
        try {
            if (typeof localStorage === 'undefined') return null;
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function writeStored(cfg) {
        if (typeof localStorage === 'undefined') return false;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
        return true;
    }

    function queryTempOverride() {
        if (typeof location === 'undefined' || !location.search) return null;
        try {
            var q = new URLSearchParams(location.search);
            var raw = q.get('themeTemp');
            if (raw == null || raw === '') raw = q.get('tempTheme');
            if (raw == null || raw === '') return null;
            var n = Number(raw);
            return Number.isFinite(n) ? n : null;
        } catch (e) {
            return null;
        }
    }

    function getConfig() {
        var stored = readStored();
        return {
            enabled: stored && stored.enabled === false ? false : true,
            bands: stored && Array.isArray(stored.bands) && stored.bands.length
                ? cloneBands(stored.bands)
                : cloneBands(PRESET_BANDS)
        };
    }

    function saveConfig(next) {
        var cur = getConfig();
        var cfg = {
            enabled: next && next.enabled === false ? false : true,
            bands: next && next.bands ? cloneBands(next.bands) : cur.bands
        };
        writeStored(cfg);
        return cfg;
    }

    function resetPreset() {
        writeStored({ enabled: true, bands: cloneBands(PRESET_BANDS) });
        return getConfig();
    }

    function isValidTemperature(temp) {
        if (temp == null) return false;
        if (typeof temp === 'string' && temp.trim() === '') return false;
        var n = Number(temp);
        return Number.isFinite(n);
    }

    function isFresh(atMs, nowMs) {
        if (atMs == null) return true;
        var t = typeof atMs === 'number' ? atMs : Date.parse(atMs);
        if (!Number.isFinite(t)) return false;
        var now = nowMs != null ? nowMs : Date.now();
        return (now - t) <= STALE_MS;
    }

    function bandForTemperature(temp, bands) {
        if (!isValidTemperature(temp)) return null;
        var n = Number(temp);
        var list = bands || getConfig().bands;
        for (var i = 0; i < list.length; i++) {
            var b = list[i];
            var minOk = b.min == null || n >= b.min;
            var maxOk = b.max == null || n < b.max;
            if (minOk && maxOk) return b;
        }
        return null;
    }

    function lighten(hex, amount) {
        var h = String(hex || '').replace('#', '');
        if (h.length !== 6) return hex;
        var r = parseInt(h.slice(0, 2), 16);
        var g = parseInt(h.slice(2, 4), 16);
        var b = parseInt(h.slice(4, 6), 16);
        var mix = function (c) {
            return Math.max(0, Math.min(255, Math.round(c + (255 - c) * amount)));
        };
        var to = function (c) {
            return ('0' + mix(c).toString(16)).slice(-2);
        };
        return ('#' + to(r) + to(g) + to(b)).toUpperCase();
    }

    function colorsFromBand(band) {
        if (!band || !band.color) return null;
        return {
            bgColor: band.color,
            barColor: lighten(band.color, 0.16),
            name: band.name,
            label: band.label
        };
    }

    function setObservedTemperature(temp, at) {
        observed.temp = isValidTemperature(temp) ? Number(temp) : null;
        if (at == null) {
            observed.atMs = Date.now();
        } else if (at instanceof Date) {
            observed.atMs = at.getTime();
        } else if (typeof at === 'number') {
            observed.atMs = at;
        } else {
            var p = Date.parse(at);
            observed.atMs = Number.isFinite(p) ? p : Date.now();
        }
    }

    function resolveTemperature(explicitTemp, atMs, nowMs) {
        var q = queryTempOverride();
        if (q != null) return q;
        var temp = explicitTemp != null ? explicitTemp : observed.temp;
        var when = atMs != null ? atMs : observed.atMs;
        if (!isValidTemperature(temp)) return null;
        if (!isFresh(when, nowMs)) return null;
        return Number(temp);
    }

    function paintColors(options) {
        var opt = options || {};
        if (opt.wbgtOn) return null;
        var cfg = getConfig();
        if (cfg.enabled === false) return null;
        var temp = resolveTemperature(opt.temperature, opt.atMs, opt.nowMs);
        if (temp == null) return null;
        return colorsFromBand(bandForTemperature(temp, cfg.bands));
    }

    return {
        STORAGE_KEY: STORAGE_KEY,
        STALE_MS: STALE_MS,
        PRESET_BANDS: cloneBands(PRESET_BANDS),
        getConfig: getConfig,
        saveConfig: saveConfig,
        resetPreset: resetPreset,
        isValidTemperature: isValidTemperature,
        isFresh: isFresh,
        bandForTemperature: bandForTemperature,
        colorsFromBand: colorsFromBand,
        setObservedTemperature: setObservedTemperature,
        resolveTemperature: resolveTemperature,
        paintColors: paintColors,
        queryTempOverride: queryTempOverride
    };
});
