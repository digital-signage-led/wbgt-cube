/**
 * 環境クラウド（EDAM）騒音振動 SSC プロキシ — GitHub Pages / 異オリジン向け
 *
 * 使い方:
 *   <exec>?idNum=2526
 *   <exec>?idNum=2526&callback=cb  （JSONP）
 *
 * デプロイ: 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *   実行ユーザー: 自分 / アクセス: 全員
 * 発行 URL を SignageConfig.edamSsc.gasUrl に設定
 */
var SSC_API_BASE = 'https://www2.edam.ne.jp/Json/SSCNumData';
var CACHE_TTL_SEC = 20;

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
    if (payload && payload.source === 'edam-ssc' && payload.data && payload.data.length) {
      putCached_(cacheKey, json);
    }
  }
  return respond_(params, json, true);
}

function buildSscPayload_(idNum) {
  var url = SSC_API_BASE + '/' + encodeURIComponent(idNum) + '?flag=true&r=' + Date.now();
  var text = httpGetText_(url);
  if (!text) {
    return { source: 'error', idNum: idNum, error: 'EDAM SSC fetch failed', data: [] };
  }
  var rows;
  try {
    rows = JSON.parse(text);
  } catch (err) {
    return { source: 'error', idNum: idNum, error: 'EDAM SSC JSON parse failed', data: [] };
  }
  if (!rows || !rows.length) {
    return { source: 'edam-ssc', idNum: idNum, data: [], note: 'empty（電源未投入の可能性）' };
  }
  return {
    source: 'edam-ssc',
    idNum: idNum,
    updatedAt: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'),
    data: rows
  };
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
      headers: { 'User-Agent': 'wbgt-edam-ssc-gas-proxy/1.0' }
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
  } catch (e) {
    /* continue */
  }
}
