/**
 * 環境省 WBGT 実況推定値 → サイネージ用 JSON（汎用 GAS）
 *
 * 現場ごとの設定は URL パラメータで渡す。GAS 本体の再デプロイは 1 本で全現場共通。
 *
 * まとめ取得（サイネージ推奨）:
 *   <exec>?type=bundle&point=63518&alertArea=兵庫県
 *   → wbgt と熱中症アラートを 1 回で返す
 *
 * WBGT のみ:
 *   <exec>?point=63518
 *
 * 任意:
 *   &pointName=表示名（JSON の pointName。省略時は CSV ヘッダーまたはコード）
 *
 * 熱中症アラートのみ:
 *   <exec>?type=alert&point=63518&alertArea=兵庫県
 *
 * 大雨警報（気象庁）:
 *   <exec>?type=rainwarn&area=280000&city=2810000
 *   area / city は point と独立（現場の予報区域コード）
 */

var MOE_EST_URL = 'https://www.wbgt.env.go.jp/est15WG/dl/wbgt_{point}_{ym}.csv';
var MOE_ALERT_URL = 'https://www.wbgt.env.go.jp/alert/dl/{year}/alert_{ymd}_{hh}.csv';
var ALERT_HHS = ['17', '14', '10', '05'];
var CACHE_TTL_SEC = 1800;
/** キャッシュキー版（フォールバック廃止時に v2 へ更新） */
var CACHE_KEY_VER = 'v4';
var OFFSEASON_AGE_HOURS = 24;

/** よく使う地点の表示名（省略可・URL の pointName が優先） */
var POINT_NAMES = {
  '63518': '神戸市',
  '63801': '神戸市（旧コード・CSVなし）',
  '63496': '明石（近隣）',
  '62078': '大阪',
  '62051': '豊中',
  '63477': '西宮',
  '44132': '東京'
};

/** 主地点に CSV／グラフが無いときの環境省代替地点（表示と実データ一致を優先し未使用） */
var MOE_FALLBACK_POINT = {};

/** 熱中症アラート CSV の府県列名（alertArea 省略時のフォールバック） */
var ALERT_AREA = {
  '63518': '兵庫県',
  '63801': '兵庫県',
  '62078': '大阪府',
  '62051': '大阪府',
  '63477': '兵庫県',
  '44132': '東京地方'
};

/** CSV 取得不可時の公式グラフ／日表フォールバック（region / prefecture は環境省サイトの URL） */
var POINT_MOE_SITE = {
  '63518': { region: '07', prefecture: '63' },
  '63801': { region: '07', prefecture: '63' },
  '63477': { region: '07', prefecture: '28' },
  '63496': { region: '07', prefecture: '28' },
  '63383': { region: '07', prefecture: '63' }
};

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var type = params.type ? String(params.type).toLowerCase() : 'wbgt';
  var callback = params.callback ? String(params.callback) : '';
  var point = '';
  var cacheKey = '';

  if (type === 'rainwarn') {
    var area = normalizeWarnArea_(params.area || '280000');
    var city = normalizeWarnCity_(params.city || '2810000');
    cacheKey = 'rainwarn_' + area + '_' + city;
  } else {
    point = normalizePoint_(params.point);
    if (!point) {
      return respond_(params, { source: 'error', error: 'point パラメータが必要です（環境省5桁地点コード）' });
    }
    if (type === 'bundle') {
      var areaKey = resolveAlertArea_(point, params) || 'none';
      cacheKey = 'bundle_' + point + '_' + areaKey;
    } else {
      cacheKey = (type === 'alert' ? 'alert_' : 'wbgt_') + point;
      if (type === 'alert' && params.alertArea) {
        cacheKey += '_' + String(params.alertArea);
      }
    }
  }

  cacheKey = CACHE_KEY_VER + '_' + cacheKey;
  var json = getCached_(cacheKey);
  if (!json) {
    var payload;
    try {
      if (type === 'alert') {
        payload = buildAlertPayload_(point, params);
      } else if (type === 'rainwarn') {
        payload = buildRainWarnPayload_(
          normalizeWarnArea_(params.area || '280000'),
          normalizeWarnCity_(params.city || '2810000')
        );
      } else if (type === 'bundle') {
        payload = buildBundlePayload_(point, params);
      } else {
        payload = buildWbgtPayload_(point, params);
      }
    } catch (err) {
      payload = {
        source: 'error',
        point: point || '',
        error: String(err && err.message ? err.message : err)
      };
    }
    json = JSON.stringify(payload);
    if (payload && shouldCachePayload_(payload, type)) {
      putCached_(cacheKey, json);
    }
  }

  return respond_(params, json, true);
}

function shouldCachePayload_(payload, type) {
  if (!payload) return false;
  if (payload.source === 'jma-rainwarn') return true;
  if (payload.source === 'moe-bundle') {
    var w = payload.wbgt;
    var a = payload.alert;
    return (
      w &&
      (w.source === 'moe-env.go.jp' || w.source === 'off-season') &&
      a &&
      a.source === 'moe-alert'
    );
  }
  return (
    payload.source === 'moe-env.go.jp' ||
    payload.source === 'off-season' ||
    payload.source === 'moe-alert'
  );
}

function buildBundlePayload_(point, params) {
  return {
    source: 'moe-bundle',
    point: String(point),
    wbgt: buildWbgtPayload_(point, params),
    alert: buildAlertPayload_(point, params)
  };
}

function respond_(params, body, isJsonString) {
  var callback = params.callback ? String(params.callback) : '';
  var text = isJsonString ? body : JSON.stringify(body);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + text + ');').setMimeType(
      ContentService.MimeType.JAVASCRIPT
    );
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}

function normalizePoint_(raw) {
  var p = String(raw || '').trim();
  if (!/^\d{5}$/.test(p)) return '';
  return p;
}

function normalizeWarnArea_(raw) {
  return String(raw || '').trim().replace(/\D/g, '') || '280000';
}

function normalizeWarnCity_(raw) {
  return String(raw || '').trim().replace(/\D/g, '') || '2810000';
}

function resolvePointName_(point, csvHeader, params) {
  if (params.pointName) return String(params.pointName).trim();
  if (csvHeader) return String(csvHeader).trim();
  if (POINT_NAMES[point]) return POINT_NAMES[point];
  return String(point);
}

function resolveAlertArea_(point, params) {
  if (params.alertArea) return String(params.alertArea).trim();
  if (params.prefecture) return String(params.prefecture).trim();
  if (ALERT_AREA[point]) return ALERT_AREA[point];
  return '';
}

function tryMoeFallbackPayload_(point, params, headerName) {
  /* 神戸表示と実データ一致のため、近隣地点への切替は行わない */
  return null;
}

function buildWbgtPayload_(point, params) {
  params = params || {};
  var tz = 'Asia/Tokyo';
  var now = new Date();
  var ym = Utilities.formatDate(now, tz, 'yyyyMM');
  var fetched = fetchEstRows_(point, ym);
  var headerName = fetched.headerName;

  if (!fetched.rows.length) {
    var prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    fetched = fetchEstRows_(point, Utilities.formatDate(prev, tz, 'yyyyMM'));
    headerName = headerName || fetched.headerName;
  }

  if (!fetched.rows.length) {
    var graphPayload = buildWbgtPayloadFromGraph_(point, params, headerName);
    if (graphPayload) return graphPayload;
    var monitorPayload = buildWbgtPayloadFromMonitorPage_(point, params, headerName);
    if (monitorPayload) return monitorPayload;
    var fbEmpty = tryMoeFallbackPayload_(point, params, headerName);
    if (fbEmpty) return fbEmpty;
    return offSeasonPayload_(point, params, headerName, '');
  }

  var latest = fetched.rows[fetched.rows.length - 1];
  var latestMs = parseJstMs_(latest.date, latest.time);
  var ageHours = isFinite(latestMs) ? (now.getTime() - latestMs) / 3600000 : Infinity;

  if (ageHours > OFFSEASON_AGE_HOURS) {
    var staleGraph = buildWbgtPayloadFromGraph_(point, params, headerName);
    if (staleGraph) return staleGraph;
    var staleMonitor = buildWbgtPayloadFromMonitorPage_(point, params, headerName);
    if (staleMonitor) return staleMonitor;
    var fbStale = tryMoeFallbackPayload_(point, params, headerName);
    if (fbStale) return fbStale;
    return offSeasonPayload_(point, params, headerName, latest.date + ' ' + latest.time);
  }

  var slots = [];
  for (var i = 0; i < 4; i++) {
    slots.push({
      wbgt: latest.wbgt,
      levelIdx: wbgtLevel_(latest.wbgt),
      hour: i === 0 ? '現在' : latest.time
    });
  }

  var pointName = resolvePointName_(point, headerName, params);
  return {
    source: 'moe-env.go.jp',
    point: String(point),
    pointName: pointName,
    updatedAt: latest.date + ' ' + latest.time,
    data: slots,
    slots: slots
  };
}

function offSeasonPayload_(point, params, headerName, updatedAt) {
  return {
    source: 'off-season',
    inService: false,
    point: String(point),
    pointName: resolvePointName_(point, headerName, params),
    updatedAt: updatedAt || '',
    data: [],
    slots: []
  };
}

function resolveMoeSite_(point, params) {
  var region = params.region ? String(params.region).trim() : '';
  var pref = params.prefecture ? String(params.prefecture).trim() : '';
  if (POINT_MOE_SITE[point]) {
    if (!region) region = POINT_MOE_SITE[point].region;
    if (!pref) pref = POINT_MOE_SITE[point].prefecture;
  }
  if (!region || !pref) return null;
  return { region: region, prefecture: pref };
}

/** 全国47か所ページ（wbgt_data.php）から実測値を取得（グラフが空のときの環境省公式代替） */
function buildWbgtPayloadFromMonitorPage_(point, params, headerName) {
  var site = resolveMoeSite_(point, params);
  if (!site) return null;
  var url =
    'https://www.wbgt.env.go.jp/wbgt_data.php?region=' +
    site.region +
    '&prefecture=' +
    site.prefecture +
    '&point=' +
    point;
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    var html = res.getContentText('UTF-8');
    var re = new RegExp(
      "submitMapGraph\\('graph_ref_td\\.php',\\s*'[^']+',\\s*'[^']+',\\s*'" +
        point +
        "'\\)[^>]*>\\s*<div class=\"name\">[^<]+</div>\\s*<div class=\"value wbgt_lv\\d+\">([0-9.]+)</div>"
    );
    var m = re.exec(html);
    if (!m) return null;
    var wbgt = parseFloat(m[1]);
    if (!isFinite(wbgt) || wbgt < 5 || wbgt > 45) return null;
    var tz = 'Asia/Tokyo';
    var now = new Date();
    var hourLabel = Utilities.formatDate(now, tz, 'H') + '時';
    var slots = [];
    for (var i = 0; i < 4; i++) {
      slots.push({
        wbgt: wbgt,
        levelIdx: wbgtLevel_(wbgt),
        hour: i === 0 ? '現在' : hourLabel
      });
    }
    return {
      source: 'moe-env.go.jp',
      point: String(point),
      pointName: resolvePointName_(point, headerName, params),
      updatedAt: Utilities.formatDate(now, tz, 'yyyy/M/d H:mm'),
      data: slots,
      slots: slots,
      dataVia: 'wbgt-data-monitor'
    };
  } catch (err) {
    Logger.log('wbgt_data: ' + err);
    return null;
  }
}

/** est15WG CSV が無い／古いとき、公式 graph_ref_td / day_list から 4 枠を組み立てる */
function buildWbgtPayloadFromGraph_(point, params, headerName) {
  var site = resolveMoeSite_(point, params);
  if (!site) return null;

  var tz = 'Asia/Tokyo';
  var now = new Date();
  var day = Utilities.formatDate(now, tz, 'yyyyMMdd');
  var nowHour = parseInt(Utilities.formatDate(now, tz, 'H'), 10);
  var observed = {};
  var forecast = {};

  try {
    var dayUrl =
      'https://www.wbgt.env.go.jp/day_list.php?region=' +
      site.region +
      '&prefecture=' +
      site.prefecture +
      '&point=' +
      point +
      '&day=' +
      day;
    var dayRes = UrlFetchApp.fetch(dayUrl, { muteHttpExceptions: true });
    if (dayRes.getResponseCode() === 200) {
      observed = parseDayListObserved_(dayRes.getContentText('UTF-8'));
    }
  } catch (err) {
    Logger.log('day_list: ' + err);
  }

  try {
    var graphUrl =
      'https://www.wbgt.env.go.jp/graph_ref_td.php?region=' +
      site.region +
      '&prefecture=' +
      site.prefecture +
      '&point=' +
      point;
    var graphRes = UrlFetchApp.fetch(graphUrl, { muteHttpExceptions: true });
    if (graphRes.getResponseCode() === 200) {
      var graphHtml = graphRes.getContentText('UTF-8');
      forecast = parseGraphForecast_(graphHtml);
      if (!hasObservedKeys_(observed)) {
        observed = parseGraphObserved_(graphHtml);
      }
    }
  } catch (err) {
    Logger.log('graph_ref_td: ' + err);
  }

  var slots = buildFourSlotsFromGraph_(observed, forecast, nowHour);
  var hasWbgt = false;
  for (var i = 0; i < slots.length; i++) {
    if (slots[i].wbgt != null && isFinite(slots[i].wbgt)) {
      hasWbgt = true;
      break;
    }
  }
  if (!hasWbgt) return null;

  var pointName = resolvePointName_(point, headerName, params);
  return {
    source: 'moe-env.go.jp',
    point: String(point),
    pointName: pointName,
    updatedAt: Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm'),
    data: slots,
    slots: slots,
    dataVia: 'graph-fallback'
  };
}

function hasObservedKeys_(observed) {
  for (var k in observed) {
    if (Object.prototype.hasOwnProperty.call(observed, k)) return true;
  }
  return false;
}

function parseDayListObserved_(html) {
  var out = {};
  var re =
    /<td class="asc_body"[^>]*>(\d{1,2})<\/td>\s*<td class="asc_body wbgt_lv\d+">([0-9.]+)<\/td>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    out[parseInt(m[1], 10)] = parseFloat(m[2]);
  }
  return out;
}

function parseGraphObserved_(html) {
  var out = {};
  var start = html.indexOf('// line1');
  if (start < 0) return out;
  var end = html.indexOf('drawPlot', start);
  var chunk = end > start ? html.substring(start, end) : html.substring(start);
  var re = /line\[(\d+)\]\s*=\s*\[\[(\d+),([0-9.]+)\],\s*\[(\d+),([0-9.]+)\]\]/g;
  var m;
  while ((m = re.exec(chunk)) !== null) {
    var h2 = parseInt(m[4], 10);
    var v2 = parseFloat(m[5]);
    if (h2 >= 0 && h2 <= 24 && !isNaN(v2)) out[h2] = v2;
    var h1 = parseInt(m[2], 10);
    var v1 = parseFloat(m[3]);
    if (h1 >= 0 && h1 <= 24 && !isNaN(v1)) out[h1] = v1;
  }
  return out;
}

function parseGraphForecast_(html) {
  var out = {};
  var re = /spanMouseOverEvent\(\['[^']+',\s*'(\d{1,2})',\s*'([^']*)'\]\)/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var raw = String(m[2] || '').trim();
    if (!raw || !/^\d/.test(raw)) continue;
    var h = parseInt(m[1], 10);
    var w = parseFloat(raw);
    if (h >= 0 && h <= 24 && !isNaN(w)) out[h] = w;
  }
  return out;
}

function latestObservedHour_(observed, nowHour) {
  var best = -1;
  for (var h = 0; h <= nowHour; h++) {
    if (observed[h] != null && !isNaN(observed[h])) best = h;
  }
  if (best < 0) {
    for (var k in observed) {
      var hi = parseInt(k, 10);
      if (observed[hi] != null && !isNaN(observed[hi]) && hi > best) best = hi;
    }
  }
  return best;
}

function forecastHourAtOrAfter_(forecast, hour) {
  var keys = Object.keys(forecast)
    .map(function (k) {
      return parseInt(k, 10);
    })
    .filter(function (h) {
      return h >= hour && forecast[h] != null;
    })
    .sort(function (a, b) {
      return a - b;
    });
  return keys.length ? keys[0] : -1;
}

function buildFourSlotsFromGraph_(observed, forecast, nowHour) {
  var offsets = [0, 3, 6, 9];
  var slots = [];
  for (var i = 0; i < 4; i++) {
    var targetH = nowHour + offsets[i];
    var wbgt = null;
    var hourLabel = '';

    if (i === 0) {
      var obsH = latestObservedHour_(observed, nowHour);
      if (obsH >= 0) {
        wbgt = observed[obsH];
        hourLabel = obsH + '時';
      }
    } else {
      var fh = forecastHourAtOrAfter_(forecast, targetH);
      if (fh < 0) fh = forecastHourAtOrAfter_(forecast, Math.ceil(targetH / 3) * 3);
      if (fh >= 0 && forecast[fh] != null) {
        wbgt = forecast[fh];
        hourLabel = fh + '時';
      } else if (observed[targetH] != null) {
        wbgt = observed[targetH];
        hourLabel = targetH + '時';
      }
    }

    slots.push({
      wbgt: wbgt,
      levelIdx: wbgt == null ? 0 : wbgtLevel_(wbgt),
      hour: i === 0 ? hourLabel || '現在' : hourLabel || '+' + offsets[i] + 'h'
    });
  }
  return slots;
}

function parseJstMs_(dateStr, timeStr) {
  var d = String(dateStr || '').split('/');
  var t = String(timeStr || '').split(':');
  if (d.length < 3 || t.length < 2) return NaN;
  var iso =
    d[0] +
    '-' +
    ('0' + d[1]).slice(-2) +
    '-' +
    ('0' + d[2]).slice(-2) +
    'T' +
    ('0' + t[0]).slice(-2) +
    ':' +
    ('0' + t[1]).slice(-2) +
    ':00+09:00';
  return Date.parse(iso);
}

function fetchEstRows_(point, ym) {
  var url = MOE_EST_URL.replace('{point}', point).replace('{ym}', ym);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code === 404) {
    return { status: 'not_found', rows: [], headerName: '' };
  }
  if (code !== 200) {
    return { status: 'http_' + code, rows: [], headerName: '' };
  }

  var text = res.getContentText('UTF-8');
  var lines = text.split(/\r?\n/);
  var headerName = '';
  if (lines.length > 0) {
    var headerCols = lines[0].split(',');
    if (headerCols.length >= 3) {
      headerName = (headerCols[2] || '').trim();
    }
  }

  var out = [];
  for (var i = 1; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var cols = line.split(',');
    if (cols.length < 3) continue;
    var raw = (cols[2] || '').trim();
    if (raw === '' || /^[\/\-]+$/.test(raw)) continue;
    var v = parseFloat(raw);
    if (!isFinite(v) || v < 5 || v > 45) continue;
    out.push({
      date: (cols[0] || '').trim(),
      time: (cols[1] || '').trim(),
      wbgt: Math.round(v * 10) / 10
    });
  }
  return { status: 'ok', rows: out, headerName: headerName };
}

function wbgtLevel_(w) {
  return w >= 31 ? 4 : w >= 28 ? 3 : w >= 25 ? 2 : w >= 21 ? 1 : 0;
}

function getCached_(key) {
  try {
    return CacheService.getScriptCache().get(key);
  } catch (e) {
    return null;
  }
}

function putCached_(key, json) {
  try {
    CacheService.getScriptCache().put(key, json, CACHE_TTL_SEC);
  } catch (e) {
    /* continue */
  }
}

function buildAlertPayload_(point, params) {
  var area = resolveAlertArea_(point, params);
  if (!area) {
    return {
      source: 'error',
      point: String(point),
      error: 'alertArea パラメータが必要です（例: 兵庫県・大阪府）'
    };
  }

  var tz = 'Asia/Tokyo';
  var now = new Date();
  for (var off = 0; off < 2; off++) {
    var day = new Date(now.getTime() - off * 86400000);
    var ymd = Utilities.formatDate(day, tz, 'yyyyMMdd');
    for (var i = 0; i < ALERT_HHS.length; i++) {
      var hh = ALERT_HHS[i];
      var url = MOE_ALERT_URL.replace('{year}', ymd.substring(0, 4))
        .replace('{ymd}', ymd)
        .replace('{hh}', hh);
      var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) continue;
      var rows = Utilities.parseCsv(decodeJp_(res));
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        if (!row || row.length < 9) continue;
        if (String(row[0]).trim() !== area) continue;
        var td1 = String(row[6]).trim();
        var td2 = String(row[7]).trim();
        return {
          source: 'moe-alert',
          point: String(point),
          area: area,
          level: alertLevel_(td1, td2),
          today: { flag: td1, label: alertLabel_(td1) },
          tomorrow: { flag: td2, label: alertLabel_(td2) },
          reportFile: 'alert_' + ymd + '_' + hh + '.csv',
          updatedAt: ymd + ' ' + hh + ':00'
        };
      }
    }
  }
  return {
    source: 'moe-alert',
    point: String(point),
    area: area,
    level: 'none',
    today: { flag: '0', label: '発表なし' },
    tomorrow: { flag: '0', label: '発表なし' }
  };
}

function alertSeverity_(flag) {
  if (flag === '3' || flag === '2') return 2;
  if (flag === '1') return 1;
  return 0;
}

function alertLevel_(td1, td2) {
  var s = Math.max(alertSeverity_(td1), alertSeverity_(td2));
  return s === 2 ? 'special' : s === 1 ? 'warning' : 'none';
}

function alertLabel_(flag) {
  if (flag === '1') return '熱中症警戒アラート';
  if (flag === '2') return '熱中症特別警戒アラート（判定・注意喚起）';
  if (flag === '3') return '熱中症特別警戒アラート';
  return '発表なし';
}

function decodeJp_(res) {
  var encs = ['Shift_JIS', 'UTF-8'];
  for (var i = 0; i < encs.length; i++) {
    try {
      var t = res.getContentText(encs[i]);
      if (t && /[\u3040-\u30ff\u4e00-\u9faf]/.test(t)) return t;
    } catch (e) {
      /* try next */
    }
  }
  return res.getContentText();
}

function buildRainWarnPayload_(areaCode, cityCode) {
  var warnUrl = 'https://www.jma.go.jp/bosai/warning/data/warning/' + areaCode + '.json';
  var probUrl = 'https://www.jma.go.jp/bosai/probability/data/probability/' + areaCode + '.json';
  var warnRes = UrlFetchApp.fetch(warnUrl, { muteHttpExceptions: true });
  var probRes = UrlFetchApp.fetch(probUrl, { muteHttpExceptions: true });
  var warnJson = warnRes.getResponseCode() === 200 ? JSON.parse(warnRes.getContentText('UTF-8')) : null;
  var probJson = probRes.getResponseCode() === 200 ? JSON.parse(probRes.getContentText('UTF-8')) : null;
  var parsed = parseJmaHeavyRainLevel_(warnJson, probJson, areaCode, cityCode);
  var l3Kinds = parseJmaActiveL3Kinds_(warnJson, cityCode, areaCode);
  return {
    source: 'jma-rainwarn',
    area: areaCode,
    city: cityCode,
    level: parsed.level,
    label: parsed.label,
    l3Kinds: l3Kinds,
    updatedAt: warnJson && warnJson.reportDatetime ? warnJson.reportDatetime : ''
  };
}

var JMA_WARN_CODE_MAP = {
  '32': { level: 'special', kind: 'blizzard' },
  '33': { level: 'special', kind: 'rain' },
  '34': { level: 'special', kind: 'megatsunami' },
  '35': { level: 'special', kind: 'wind' },
  '36': { level: 'special', kind: 'snow' },
  '37': { level: 'special', kind: 'wave' },
  '38': { level: 'special', kind: 'surge' },
  '02': { level: 'warning', kind: 'wind' },
  '03': { level: 'warning', kind: 'rain' },
  '04': { level: 'warning', kind: 'flood' },
  '05': { level: 'warning', kind: 'blizzard' },
  '06': { level: 'warning', kind: 'snow' },
  '07': { level: 'warning', kind: 'wave' },
  '08': { level: 'warning', kind: 'surge' },
  '09': { level: 'warning', kind: 'surge' },
  '11': { level: 'warning', kind: 'tsunami' },
  '10': { level: 'advisory', kind: 'heavyrain' },
  '12': { level: 'advisory', kind: 'snow' },
  '13': { level: 'advisory', kind: 'snowdrift' },
  '14': { level: 'advisory', kind: 'thunder' },
  '15': { level: 'advisory', kind: 'wind' },
  '16': { level: 'advisory', kind: 'wave' },
  '17': { level: 'advisory', kind: 'snowmelt' },
  '18': { level: 'advisory', kind: 'flood' },
  '19': { level: 'advisory', kind: 'surge' },
  '20': { level: 'advisory', kind: 'fog' },
  '21': { level: 'advisory', kind: 'dry' },
  '22': { level: 'advisory', kind: 'avalanche' },
  '23': { level: 'advisory', kind: 'lowtemp' },
  '24': { level: 'advisory', kind: 'frost' },
  '25': { level: 'advisory', kind: 'ice' },
  '26': { level: 'advisory', kind: 'snowacc' },
  '29': { level: 'advisory', kind: 'tsunami' }
};
var JMA_WARNING_KIND_ORDER = ['rain', 'flood', 'surge', 'wind', 'blizzard', 'snow', 'wave', 'tsunami'];

function jmaLevelFromWarnCode_(code, dangerHeadline) {
  var c = String(code || '');
  if (c === '03' && dangerHeadline) return 'danger';
  var entry = JMA_WARN_CODE_MAP[c];
  return entry ? entry.level : null;
}

function parseJmaActiveL3Kinds_(warnJson, cityCode, areaCode) {
  var found = {};
  var codes = [String(cityCode), String(areaCode)];
  if (warnJson && warnJson.areaTypes) {
    for (var ti = 0; ti < warnJson.areaTypes.length; ti++) {
      var areas = warnJson.areaTypes[ti].areas || [];
      for (var ai = 0; ai < areas.length; ai++) {
        if (codes.indexOf(String(areas[ai].code)) < 0) continue;
        var warnings = areas[ai].warnings || [];
        for (var wi = 0; wi < warnings.length; wi++) {
          var st = String(warnings[wi].status || '');
          if (!st || st.indexOf('解除') >= 0) continue;
          var entry = JMA_WARN_CODE_MAP[String(warnings[wi].code || '')];
          if (entry && entry.level === 'warning') found[entry.kind] = true;
        }
      }
    }
  }
  var list = [];
  for (var ki = 0; ki < JMA_WARNING_KIND_ORDER.length; ki++) {
    if (found[JMA_WARNING_KIND_ORDER[ki]]) list.push(JMA_WARNING_KIND_ORDER[ki]);
  }
  return list;
}

function parseJmaHeavyRainLevel_(warnJson, probJson, areaCode, cityCode) {
  var rank = { none: 0, early: 1, advisory: 2, warning: 3, danger: 4, special: 5 };
  var labels = {
    none: '発表なし',
    early: '早期注意情報',
    advisory: '大雨注意報',
    warning: '大雨警報',
    danger: '大雨危険警報',
    special: '大雨特別警報'
  };
  var best = 'none';
  var headline = warnJson && warnJson.headlineText ? String(warnJson.headlineText) : '';
  var dangerHeadline = headline.indexOf('大雨') >= 0 && headline.indexOf('危険警報') >= 0;
  var codes = [String(cityCode), String(areaCode)];

  function bump(level) {
    if (rank[level] > rank[best]) best = level;
  }

  if (warnJson && warnJson.areaTypes) {
    for (var ti = 0; ti < warnJson.areaTypes.length; ti++) {
      var areas = warnJson.areaTypes[ti].areas || [];
      for (var ai = 0; ai < areas.length; ai++) {
        if (codes.indexOf(String(areas[ai].code)) < 0) continue;
        var warnings = areas[ai].warnings || [];
        for (var wi = 0; wi < warnings.length; wi++) {
          var st = String(warnings[wi].status || '');
          if (!st || st.indexOf('解除') >= 0) continue;
          var c = String(warnings[wi].code || '');
          var levelKey = jmaLevelFromWarnCode_(c, dangerHeadline);
          if (levelKey) bump(levelKey);
        }
      }
    }
  }

  if (rank[best] === 0 && probJson && probJson.length) {
    for (var pi = 0; pi < probJson.length; pi++) {
      var series = probJson[pi].timeSeries || [];
      for (var si = 0; si < series.length; si++) {
        var pAreas = series[si].areas || [];
        for (var pai = 0; pai < pAreas.length; pai++) {
          if (String(pAreas[pai].code) !== String(areaCode)) continue;
          var props = pAreas[pai].properties || [];
          for (var pri = 0; pri < props.length; pri++) {
            var ptype = String(props[pri].type || '');
            if (ptype.indexOf('警報級') < 0 || ptype.indexOf('雨') < 0) continue;
            var cells = props[pri].timeCells || [];
            for (var ci = 0; ci < cells.length; ci++) {
              var locals = cells[ci].locals || [];
              for (var li = 0; li < locals.length; li++) {
                var cond = String(locals[li].condition || '');
                var val = Number(locals[li].value);
                if (cond.indexOf('高') >= 0 || val >= 50) bump('early');
                else if (cond.indexOf('中') >= 0 || val >= 30) bump('early');
              }
            }
          }
        }
      }
    }
  }

  return { level: best, label: labels[best] || labels.none };
}
