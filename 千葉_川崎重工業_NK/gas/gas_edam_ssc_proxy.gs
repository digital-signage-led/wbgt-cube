/**
 * 環境クラウド（EDAM）騒音振動 SSC プロキシ — 安定版 v2
 * 正経路: ブラウザ → 本 GAS → EDAM（無料 CORS プロキシは使わない）
 *
 * 使い方:
 *   <exec>?idNum=2526
 *   <exec>?idNum=2526&callback=cb  （JSONP）
 *
 * デプロイ: ウェブアプリ / 実行=自分 / アクセス=全員
 * 発行 URL → SignageConfig.edamSsc.gasUrl
 *
 * トリガー: 時間主導で watchdog を5分間隔
 * NOTIFY_TO を自分の Gmail に変更すること
 */
var SSC_API_BASE = 'https://www2.edam.ne.jp/Json/SSCNumData';
/** 画面は1秒ポーリング可。EDAM 実叩きは本 TTL で間引き（個人 GAS 約2万回/日想定） */
var CACHE_TTL_SEC = 15;
var LAST_PROP_PREFIX = 'ssc_last_';
var WATCH_ID_DEFAULT = '2526';
var NOTIFY_TO = 'YOUR_EMAIL@gmail.com'; /* ★デプロイ前に変更 */
var NOTIFY_COOLDOWN_SEC = 3600;
var WATCH_PROP_KEY = 'ssc_watch_last_mail';

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var idNum = normalizeId_(params.idNum || params.sscId || params.loId || params.id);
  if (!idNum) {
    return respond_(params, { source: 'error', error: 'idNum パラメータが必要です（EDAM SSC LoID）' });
  }
  var cacheKey = 'ssc_' + idNum;
  var json = getCached_(cacheKey);
  if (!json) {
    var payload = buildSscPayload_(idNum);
    json = JSON.stringify(payload);
    /* 有データも空（直前値フォールバック含む）もキャッシュ＝障害中の UrlFetch 連打を防ぐ */
    if (payload && (payload.source === 'edam-ssc' || payload.source === 'edam-ssc-stale')) {
      putCached_(cacheKey, json);
    }
  }
  return respond_(params, json, true);
}

/**
 * EDAM 取得。空/失敗時は PropertiesService の直前正常値を返す。
 */
function buildSscPayload_(idNum) {
  var url = SSC_API_BASE + '/' + encodeURIComponent(idNum) + '?flag=true&r=' + Date.now();
  var text = httpGetText_(url);
  var nowLabel = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  if (!text) {
    return staleOrEmpty_(idNum, nowLabel, 'EDAM SSC fetch failed');
  }
  var rows;
  try {
    rows = JSON.parse(text);
  } catch (err) {
    return staleOrEmpty_(idNum, nowLabel, 'EDAM SSC JSON parse failed');
  }
  if (!rows || !rows.length) {
    return staleOrEmpty_(idNum, nowLabel, 'empty（電源未投入の可能性）');
  }
  var payload = {
    source: 'edam-ssc',
    idNum: idNum,
    updatedAt: nowLabel,
    data: rows
  };
  putLast_(idNum, payload);
  return payload;
}

function staleOrEmpty_(idNum, nowLabel, note) {
  var last = getLast_(idNum);
  if (last && last.data && last.data.length) {
    return {
      source: 'edam-ssc-stale',
      idNum: idNum,
      updatedAt: last.updatedAt || nowLabel,
      staleAt: nowLabel,
      note: note,
      data: last.data
    };
  }
  var emptyPayload = {
    source: 'edam-ssc',
    idNum: idNum,
    updatedAt: nowLabel,
    note: note,
    data: []
  };
  /* 空でもキャッシュ対象にするため source は edam-ssc のまま */
  return emptyPayload;
}

function putLast_(idNum, payload) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      LAST_PROP_PREFIX + idNum,
      JSON.stringify(payload)
    );
  } catch (e) { /* continue */ }
}

function getLast_(idNum) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(LAST_PROP_PREFIX + idNum);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function normalizeId_(raw) {
  var s = String(raw || '').trim();
  if (!/^\d{3,8}$/.test(s)) return '';
  return s;
}

function httpGetText_(url) {
  try {
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { 'User-Agent': 'wbgt-edam-ssc-gas-proxy/2.0' }
    });
    if (res.getResponseCode() !== 200) return null;
    return res.getContentText('utf-8');
  } catch (err) {
    return null;
  }
}

function respond_(params, body, isJsonString) {
  var callback = params.callback ? String(params.callback) : '';
  var text = isJsonString ? body : JSON.stringify(body);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
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
  } catch (e) { /* continue */ }
}

/**
 * 5分トリガー想定。EDAM を直接確認し、空/異常ならメール（1時間に1回まで）。
 */
function watchdog() {
  var idNum = WATCH_ID_DEFAULT;
  var url = SSC_API_BASE + '/' + encodeURIComponent(idNum) + '?flag=true&r=' + Date.now();
  var text = httpGetText_(url);
  var bad = false;
  var detail = '';
  if (!text) {
    bad = true;
    detail = 'EDAM fetch failed / empty body';
  } else {
    try {
      var rows = JSON.parse(text);
      if (!rows || !rows.length) {
        bad = true;
        detail = 'EDAM returned [] (empty)';
      }
    } catch (err) {
      bad = true;
      detail = 'EDAM JSON parse failed';
    }
  }
  if (!bad) return;
  notifyOnce_(
    '[SSC監視] 千葉市新港清掃工場更新整備工事 idNum=' + idNum,
    '環境クラウド SSC の更新を確認できませんでした。\n\n' +
      detail + '\n' +
      'API: ' + url + '\n' +
      '時刻: ' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss') + '\n\n' +
      'サイネージは直前値フォールバックの可能性があります。現場・EDAM・GASクォータを確認してください。'
  );
}

function notifyOnce_(subject, body) {
  if (!NOTIFY_TO || NOTIFY_TO.indexOf('YOUR_EMAIL') >= 0) {
    console.warn('NOTIFY_TO 未設定のためメール送信スキップ');
    return;
  }
  try {
    var props = PropertiesService.getScriptProperties();
    var last = Number(props.getProperty(WATCH_PROP_KEY) || '0');
    var now = Date.now();
    if (last && (now - last) < NOTIFY_COOLDOWN_SEC * 1000) return;
    MailApp.sendEmail(NOTIFY_TO, subject, body);
    props.setProperty(WATCH_PROP_KEY, String(now));
  } catch (e) {
    console.error('notifyOnce_ failed', e);
  }
}
