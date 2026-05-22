/**
 * 環境省 WBGT プロキシ（Web App）
 *
 * 地点はクエリ ?point= で指定（既定 64036=奈良市）
 * データ源（環境省公式CSV）:
 *   実況推定 https://www.wbgt.env.go.jp/est15WG/dl/wbgt_{地点}_{yyyyMM}.csv
 *   予測    https://www.wbgt.env.go.jp/prev15WG/dl/yohou_{都道府県キー}.csv
 *
 * デプロイ: 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」→ アクセス「全員」
 * 発行URLを wbgt-cube-nara-daitetsu/nara_daitetsu/daitetsu_index.html の DEFAULT_MOE_GAS_URL に設定（任意）
 */
var TZ = 'Asia/Tokyo';

/** @type {Object.<string, {prefKey: string, pointName: string}>} */
var POINT_TABLE = {
  '64036': { prefKey: 'nara', pointName: '奈良市' }
};

var DEFAULT_POINT = '64036';

function doGet(e) {
  var result = buildWbgt_(e);
  var json = JSON.stringify(result);
  var cb = e && e.parameter && e.parameter.callback;
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function buildWbgt_(e) {
  var point = String((e && e.parameter && e.parameter.point) || DEFAULT_POINT).trim();
  var cfg = POINT_TABLE[point];
  if (!cfg) {
    return {
      source: 'error',
      point: point,
      pointName: '',
      updatedAt: Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm'),
      data: []
    };
  }

  var now = new Date();
  var ym = Utilities.formatDate(now, TZ, 'yyyyMM');
  var fc = fetchForecast_(point, cfg.prefKey);
  var nowSlot = null;
  var source = 'moe-env.go.jp';

  var est = fetchEstimated_(point, ym);
  if (est && est.wbgt != null) {
    nowSlot = { wbgt: est.wbgt, levelIdx: levelOf_(est.wbgt), hour: '現在' };
  } else if (fc && fc.length > 0 && fc[0] && fc[0].wbgt != null) {
    nowSlot = { wbgt: fc[0].wbgt, levelIdx: fc[0].levelIdx, hour: '現在' };
  }

  var fcStart = est && est.wbgt != null ? 0 : 1;
  var slots = [
    nowSlot || { wbgt: null, levelIdx: 0, hour: '現在' },
    fc[fcStart] || { wbgt: null, levelIdx: 0, hour: '+3h' },
    fc[fcStart + 1] || { wbgt: null, levelIdx: 0, hour: '+6h' },
    fc[fcStart + 2] || { wbgt: null, levelIdx: 0, hour: '+9h' }
  ];

  return {
    source: source,
    point: point,
    pointName: cfg.pointName,
    updatedAt: Utilities.formatDate(now, TZ, 'yyyy/MM/dd HH:mm'),
    data: slots,
    slots: slots
  };
}

function fetchEstimated_(point, ym) {
  var url = 'https://www.wbgt.env.go.jp/est15WG/dl/wbgt_' + point + '_' + ym + '.csv';
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

function fetchForecast_(point, prefKey) {
  var url = 'https://www.wbgt.env.go.jp/prev15WG/dl/yohou_' + prefKey + '.csv';
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
    if (c[0] && c[0].trim() === point) {
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
      levelIdx: v == null ? 0 : levelOf_(v),
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

function parseWbgtCellEstimated_(raw) {
  if (raw == null) return null;
  var s = String(raw).trim();
  if (s === '' || /^[\/\-]+$/.test(s)) return null;
  var f = parseFloat(s);
  if (isNaN(f) || f < 5 || f > 45) return null;
  return Math.round(f * 10) / 10;
}

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
  if (w == null || isNaN(w)) return 0;
  if (w >= 31) return 4;
  if (w >= 28) return 3;
  if (w >= 25) return 2;
  if (w >= 21) return 1;
  return 0;
}

function test_nara_() {
  Logger.log(JSON.stringify(buildWbgt_({ parameter: { point: '64036' } }), null, 2));
}

