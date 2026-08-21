/**
 * ホームページニュース（data/news.json /api/news / GitHub Pages remoteUrl）の取得・整形
 * index-5face / index-4face から読み込む
 */
(function (global) {
  'use strict';

  var items_ = [];
  var fetchedAt_ = '';
  var source_ = '';
  var timerId_ = null;
  var lastError_ = '';

  function cfg_() {
    var s = global.SIGNAGE_CONFIG || {};
    var n = s.news || {};
    return {
      enabled: n.enabled !== false,
      url: n.url || './data/news.json',
      apiUrl: n.apiUrl || '/api/news',
      remoteUrl: String(n.remoteUrl || '').trim(),
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
    return fetch(url, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('news HTTP ' + res.status + ' ' + url);
      return res.json();
    });
  }

  /**
   * 取得順:
   *  1) ローカル serve の /api/news
   *  2) GitHub Pages 等の remoteUrl（Actions 更新）
   *  3) 同梱 ./data/news.json
   */
  function refresh() {
    var c = cfg_();
    if (!c.enabled) return Promise.resolve([]);
    var tryApi = fetchJson_(c.apiUrl);
    var tryRemote = c.remoteUrl
      ? function () { return fetchJson_(c.remoteUrl); }
      : function () { return Promise.reject(new Error('no remoteUrl')); };
    var tryLocal = function () { return fetchJson_(c.url); };

    return tryApi
      .catch(tryRemote)
      .catch(tryLocal)
      .then(function (data) {
        lastError_ = '';
        return normalizePayload_(data);
      })
      .catch(function (err) {
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
