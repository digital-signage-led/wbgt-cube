/**
 * ホームページニュース取得・整形（index-4face / index-5face）
 *
 * 取得候補を並列で試し、fetchedAt が最も新しいものを採用:
 *  1) ローカル serve の /api/news（公式サイトを定期取得）
 *  2) GitHub Pages 等の remoteUrl（Actions 更新）
 *  3) 同梱 ./data/news.json
 *
 * ※ 旧実装は remote 成功時点で打ち切るため、Pages が古いと
 *    手元の新しい news.json が使われなかった。
 */
(function (global) {
  'use strict';

  var items_ = [];
  var fetchedAt_ = '';
  var source_ = '';
  var timerId_ = null;
  var lastError_ = '';
  var FETCH_TIMEOUT_MS = 4000;

  function cfg_() {
    var s = global.SIGNAGE_CONFIG || {};
    var n = s.news || {};
    return {
      enabled: n.enabled !== false,
      url: n.url || './data/news.json',
      apiUrl: n.apiUrl || '/api/news',
      remoteUrl: String(n.remoteUrl || '').trim(),
      newsListUrl: String(n.newsListUrl || 'https://www.satokogyo.co.jp/news/').trim(),
      refreshMs: Math.max(60000, Number(n.refreshMs) || 600000),
      maxItems: Math.max(1, Number(n.maxItems) || 3)
    };
  }

  function normalizePayload_(data) {
    var list = (data && Array.isArray(data.items)) ? data.items : [];
    var c = cfg_();
    items_ = list.slice(0, c.maxItems).map(function (it) {
      return {
        title: String((it && it.title) || '').trim(),
        date: String((it && it.date) || '').trim(),
        category: String((it && it.category) || '').trim(),
        url: String((it && it.url) || '').trim()
      };
    }).filter(function (it) { return !!it.title; });
    fetchedAt_ = (data && data.fetchedAt) || '';
    source_ = (data && data.source) || '';
    return items_;
  }

  function fetchJson_(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;
    var opts = { cache: 'no-store' };
    if (ctrl) {
      opts.signal = ctrl.signal;
      timer = setTimeout(function () {
        try { ctrl.abort(); } catch (e) { /* ignore */ }
      }, FETCH_TIMEOUT_MS);
    }
    return fetch(url, opts).then(function (res) {
      if (!res.ok) throw new Error('news HTTP ' + res.status + ' ' + url);
      return res.json();
    }).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  function fetchedAtMs_(data) {
    if (!data || !data.fetchedAt) return 0;
    var t = Date.parse(data.fetchedAt);
    return Number.isFinite(t) ? t : 0;
  }

  function isUsablePayload_(data) {
    return !!(data && Array.isArray(data.items) && data.items.length);
  }

  /**
   * 全候補を並列取得し、最も新しい fetchedAt の結果を採用。
   */
  function refresh() {
    var c = cfg_();
    if (!c.enabled) return Promise.resolve([]);

    var tasks = [
      fetchJson_(c.apiUrl).catch(function () { return null; }),
      c.remoteUrl
        ? fetchJson_(c.remoteUrl).catch(function () { return null; })
        : Promise.resolve(null),
      fetchJson_(c.url).catch(function () { return null; })
    ];

    return Promise.all(tasks).then(function (results) {
      var best = null;
      var bestMs = -1;
      for (var i = 0; i < results.length; i++) {
        var data = results[i];
        if (!isUsablePayload_(data)) continue;
        var ms = fetchedAtMs_(data);
        if (ms >= bestMs) {
          best = data;
          bestMs = ms;
        }
      }
      if (!best) {
        throw new Error('news: no usable source');
      }
      lastError_ = '';
      return normalizePayload_(best);
    }).catch(function (err) {
      lastError_ = String(err && err.message ? err.message : err);
      return items_;
    });
  }

  function getItems() {
    return items_.slice();
  }

  function getTickerLines() {
    return items_.map(function (it) {
      var bits = [];
      if (it.date) bits.push(it.date);
      if (it.category) bits.push(it.category);
      bits.push(it.title);
      return bits.join('  ');
    });
  }

  function getTickerText(sep) {
    var lines = getTickerLines();
    if (!lines.length) return '';
    return lines.join(sep || '　　／　　');
  }

  function startAutoRefresh() {
    var c = cfg_();
    if (!c.enabled) return;
    if (timerId_ != null) clearInterval(timerId_);
    refresh();
    timerId_ = setInterval(refresh, c.refreshMs);
  }

  global.SignageNews = {
    refresh: refresh,
    getItems: getItems,
    getTickerLines: getTickerLines,
    getTickerText: getTickerText,
    startAutoRefresh: startAutoRefresh,
    getFetchedAt: function () { return fetchedAt_; },
    getSource: function () { return source_; },
    getLastError: function () { return lastError_; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
