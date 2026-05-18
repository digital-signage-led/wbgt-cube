/**
 * gas_wbgt_wakayama_v1.gs
 * 和歌山市 WBGT 環境省データ プロキシ Web App
 *
 * 観測点：和歌山（65042）— 和歌山市の環境省WBGT地点
 *
 * データ源（環境省公式CSV）:
 *   1) 実況推定値 https://www.wbgt.env.go.jp/est15WG/dl/wbgt_65042_yyyymm.csv  （℃・小数）
 *   2) 予測値    https://www.wbgt.env.go.jp/prev15WG/dl/yohou_wakayama.csv      （10倍整数）
 */

var PREF_KEY = 'wakayama';
var POINT_CODE = '65042';
var TZ = 'Asia/Tokyo';

function doGet(e) {
  var result = buildWakayamaWbgt_();
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildWakayamaWbgt_() {
  var now = new Date();
  var ym = Utilities.formatDate(now, TZ, 'yyyyMM');
  var fc = fetchForecast_();
  var nowSlot = null;
  var source = 'none';

  var est = fetchEstimated_(ym);
  if (est && est.wbgt != null) {
    nowSlot = { wbgt: est.wbgt, levelIdx: levelOf_(est.wbgt), hour: '現在' };
    source = 'estimated';
  } else if (fc && fc.length > 0 && fc[0] && fc[0].wbgt != null) {
    nowSlot = { wbgt: fc[0].wbgt, levelIdx: fc[0].levelIdx, hour: '現在' };
    source = 'forecast';
  }

  var slots = [
    nowSlot || { wbgt: null, levelIdx: null, hour: '現在' },
    fc[1] || { wbgt: null, levelIdx: null, hour: '+3h' },
    fc[2] || { wbgt: null, levelIdx: null, hour: '+6h' },
    fc[3] || { wbgt: null, levelIdx: null, hour: '+9h' }
  ];

  return {
    source: source,
    updatedAt: Utilities.formatDate(now, TZ, 'yyyy-MM-dd HH:mm'),
    slots: slots
  };
}

/** 実況推定CSV: Date,Time,65042 形式。WBGTは3列目のみ読む（時刻列を誤読しない） */
function fetchEstimated_(ym) {
  var url = 'https://www.wbgt.env.go.jp/est15WG/dl/wbgt_' + POINT_CODE + '_' + ym + '.csv';
  var text = httpGet_(url);
  if (!text) return null;

  var rows = text.split(/\r?\n/).filter(function (r) {
    return r.trim().length > 0;
  });
  for (var i = rows.length - 1; i >= 1; i--) {
    var cols = rows[i].split(',').map(function (c) {
      return c.trim();
    });
    if (cols.length < 3) continue;
    var v = parseWbgtCellEstimated_(cols[2]);
    if (v != null) {
      return { wbgt: v, time: cols[0] + ' ' + cols[1] };
    }
  }
  return null;
}

function fetchForecast_() {
  var url = 'https://www.wbgt.env.go.jp/prev15WG/dl/yohou_' + PREF_KEY + '.csv';
  var text = httpGet_(url);
  if (!text) return [null, null, null, null];

  var rows = text.split(/\r?\n/).filter(function (r) {
    return r.trim().length > 0;
  });
  if (rows.length < 2) return [null, null, null, null];

  var header = rows[0].split(',').map(function (c) {
    return c.trim();
  });
  var dataRow = null;
  for (var r = 1; r < rows.length; r++) {
    var c = rows[r].split(',');
    if (c[0] && c[0].trim() === POINT_CODE) {
      dataRow = rows[r].split(',').map(function (x) {
        return x.trim();
      });
      break;
    }
  }
  if (!dataRow) return [null, null, null, null];

  var now = new Date();
  var nowJstHour = parseInt(Utilities.formatDate(now, TZ, 'HH'), 10);
  var todayYmd = Utilities.formatDate(now, TZ, 'yyyyMMdd');
  var futureHeaderIdx = [];

  for (var i = 2; i < header.length; i++) {
    var t = header[i];
    if (!/^\d{10}$/.test(t)) continue;
    var ymd = t.substr(0, 8);
    var hh = parseInt(t.substr(8, 2), 10);
    if (ymd === todayYmd && hh > nowJstHour) {
      futureHeaderIdx.push({ idx: i, hh: hh });
    } else if (ymd > todayYmd) {
      futureHeaderIdx.push({ idx: i, hh: hh });
    }
  }
  if (futureHeaderIdx.length === 0) return [null, null, null, null];

  var result = [];
  for (var k = 0; k < 4; k++) {
    var meta = futureHeaderIdx[k];
    if (!meta) {
      result.push(null);
      continue;
    }
    var v = parseWbgtCellForecast_(dataRow[meta.idx]);
    var hh = meta.hh === 24 ? 0 : meta.hh;
    result.push({
      wbgt: v,
      levelIdx: v == null ? null : levelOf_(v),
      hour: hh + '時'
    });
  }
  return result;
}

function httpGet_(url) {
  try {
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: true
    });
    if (res.getResponseCode() !== 200) return null;
    return res.getContentText('utf-8');
  } catch (err) {
    Logger.log('httpGet_ error: ' + url + ' / ' + err);
    return null;
  }
}

/** 実況推定CSV: すでに ℃（例: 22.4）。10で割らない */
function parseWbgtCellEstimated_(raw) {
  if (raw == null) return null;
  var s = String(raw).trim();
  if (s === '' || /^[\/\-]+$/.test(s)) return null;
  var f = parseFloat(s);
  if (isNaN(f) || f < 5 || f > 45) return null;
  return Math.round(f * 10) / 10;
}

/** 予測CSV: 10倍整数（例: 240 → 24.0） */
function parseWbgtCellForecast_(raw) {
  if (raw == null) return null;
  var s = String(raw).trim();
  if (s === '' || /^[\/\-]+$/.test(s)) return null;
  if (/\./.test(s)) {
    var f = parseFloat(s);
    return isNaN(f) || f < 5 || f > 45 ? null : Math.round(f * 10) / 10;
  }
  var n = parseInt(s, 10);
  if (isNaN(n) || n < 50 || n > 500) return null;
  return Math.round(n) / 10;
}

function levelOf_(w) {
  if (w == null || isNaN(w)) return null;
  if (w >= 31) return 4;
  if (w >= 28) return 3;
  if (w >= 25) return 2;
  if (w >= 21) return 1;
  return 0;
}

function test_() {
  Logger.log(JSON.stringify(buildWakayamaWbgt_(), null, 2));
}
