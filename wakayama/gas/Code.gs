/**
 * Google Apps Script プロジェクトにこのファイルを Code.gs として配置し、
 * 「デプロイ」→「新しいデプロイ」→ ウェブアプリ（全員アクセス可）で公開。
 * 発行された exec URL を 和歌山.html の DEFAULT_MOE_GAS_URL に設定。
 *
 * ※ gas_wbgt_wakayama_v1.gs（CSV版）を使う場合はそちらを Code.gs に貼り付けてください。
 */
var MOE_REGION = '07';
var MOE_PREF = '65';
var MOE_POINT = '65042';

function doGet(e) {
  var region = (e && e.parameter && e.parameter.region) || MOE_REGION;
  var pref = (e && e.parameter && e.parameter.prefecture) || MOE_PREF;
  var point = (e && e.parameter && e.parameter.point) || MOE_POINT;
  var slots = fetchWbgtSlots(region, pref, point);
  var tz = 'Asia/Tokyo';
  var body = {
    source: 'moe-env.go.jp',
    point: point,
    location: '和歌山（和歌山市）',
    updatedAt: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm'),
    slots: slots
  };
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function fetchWbgtSlots(region, pref, point) {
  var tz = 'Asia/Tokyo';
  var now = new Date();
  var day = Utilities.formatDate(now, tz, 'yyyyMMdd');
  var nowHour = parseInt(Utilities.formatDate(now, tz, 'H'), 10);
  var dayUrl =
    'https://www.wbgt.env.go.jp/day_list.php?region=' +
    region +
    '&prefecture=' +
    pref +
    '&point=' +
    point +
    '&day=' +
    day;
  var graphUrl =
    'https://www.wbgt.env.go.jp/graph_ref_td.php?region=' +
    region +
    '&prefecture=' +
    pref +
    '&point=' +
    point;
  var observed = {};
  try {
    observed = parseDayListObserved(
      UrlFetchApp.fetch(dayUrl, { muteHttpExceptions: true }).getContentText('UTF-8')
    );
  } catch (err) {
    Logger.log('day_list: ' + err);
  }
  var forecast = {};
  try {
    var graphHtml = UrlFetchApp.fetch(graphUrl, { muteHttpExceptions: true }).getContentText('UTF-8');
    forecast = parseGraphForecast(graphHtml);
    if (!hasKeys(observed)) observed = parseGraphObserved(graphHtml);
  } catch (err) {
    Logger.log('graph: ' + err);
  }
  return buildFourSlots(observed, forecast, nowHour);
}

function hasKeys(obj) {
  for (var k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) return true;
  }
  return false;
}

function parseDayListObserved(html) {
  var out = {};
  var re =
    /<td class="asc_body"[^>]*>(\d{1,2})<\/td>\s*<td class="asc_body wbgt_lv\d+">([0-9.]+)<\/td>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    out[parseInt(m[1], 10)] = parseFloat(m[2]);
  }
  return out;
}

function parseGraphObserved(html) {
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

function parseGraphForecast(html) {
  var out = {};
  var re = /spanMouseOverEvent\(\['[^']+',\s*'(\d{1,2})',\s*'(\d{1,2})'\]\)/g;
  var m;
  while ((m = re.exec(html)) !== null) {
    var h = parseInt(m[1], 10);
    var w = parseFloat(m[2]);
    if (h >= 0 && h <= 24 && !isNaN(w)) out[h] = w;
  }
  return out;
}

function wbgtLevel(w) {
  if (w == null || isNaN(w)) return 0;
  if (w >= 31) return 4;
  if (w >= 28) return 3;
  if (w >= 25) return 2;
  if (w >= 21) return 1;
  return 0;
}

function latestObservedHour(observed, nowHour) {
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

function forecastHourAtOrAfter(forecast, hour) {
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

function buildFourSlots(observed, forecast, nowHour) {
  var offsets = [0, 3, 6, 9];
  var slots = [];
  for (var i = 0; i < 4; i++) {
    var targetH = nowHour + offsets[i];
    var wbgt = null;
    var hourLabel = '';
    if (i === 0) {
      var obsH = latestObservedHour(observed, nowHour);
      if (obsH >= 0) {
        wbgt = observed[obsH];
        hourLabel = obsH + '時';
      }
    } else {
      var fh = forecastHourAtOrAfter(forecast, targetH);
      if (fh < 0) fh = forecastHourAtOrAfter(forecast, Math.ceil(targetH / 3) * 3);
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
      levelIdx: wbgt == null ? 0 : wbgtLevel(wbgt),
      hour: i === 0 ? hourLabel || '現在' : hourLabel || '+' + offsets[i] + 'h'
    });
  }
  return slots;
}
