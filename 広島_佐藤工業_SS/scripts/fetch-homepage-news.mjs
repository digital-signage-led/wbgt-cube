/**
 * 佐藤工業ホームページの新着を取得し data/news.json に保存する。
 * 優先: 新着一覧HTML → RSS → トップページ NEWS 欄
 * 使い方: node scripts/fetch-homepage-news.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = join(ROOT, 'config', 'news.config.json');
const OUT_DIR = join(ROOT, 'data');
const OUT_PATH = join(OUT_DIR, 'news.json');

function loadConfig() {
  const raw = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const homepageUrl = String(raw.homepageUrl || 'https://www.satokogyo.co.jp/');
  return {
    homepageUrl,
    newsListUrl: String(raw.newsListUrl || new URL('/news/', homepageUrl).href),
    rssUrl: String(raw.rssUrl || new URL('/news/rss.php', homepageUrl).href),
    maxItems: Math.max(1, Number(raw.maxItems) || 8),
    refreshMinutes: Math.max(1, Number(raw.refreshMinutes) || 10)
  };
}

function decodeHtml(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function absolutize(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

function formatJaDateFromRss_(pubDate) {
  const d = new Date(pubDate);
  if (!Number.isFinite(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '年' + m + '月' + day + '日';
}

async function fetchText(url, accept) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'SatoKogyo-WBGT-SignageNews/1.0',
      Accept: accept || 'text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8'
    },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  const buf = Buffer.from(await res.arrayBuffer());
  let text = buf.toString('utf8');
  /* RSS が Shift_JIS の場合の救済 */
  if (/charset=["']?(?:shift_jis|sjis|windows-31j)/i.test(text) || /\uFFFD/.test(text.slice(0, 400))) {
    try {
      text = new TextDecoder('shift_jis').decode(buf);
    } catch (_) { /* keep utf8 */ }
  }
  return text;
}

/** 佐藤工業ニュース一覧（ul.news-list / トップNEWS）向け */
function parseSatoNewsList(html, baseUrl, maxItems) {
  const items = [];
  const re = /<li\s+class="list-item"[\s\S]*?<\/li>/gi;
  let m;
  while ((m = re.exec(html)) && items.length < maxItems) {
    const block = m[0];
    const hrefM = block.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*item-inner/i)
      || block.match(/href="([^"]+)"/i);
    const titleM = block.match(/<p\s+class="item-title">([\s\S]*?)<\/p>/i)
      || block.match(/class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\//i);
    const catM = block.match(/<span\s+class="category[^"]*">([\s\S]*?)<\/span>/i);
    const dateM = block.match(/<span\s+class="date">([\s\S]*?)<\/span>/i)
      || block.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
    if (!titleM) continue;
    const title = decodeHtml(titleM[1].replace(/<[^>]+>/g, ''));
    if (!title || title.length < 4) continue;
    items.push({
      title,
      date: dateM ? decodeHtml(String(dateM[1]).replace(/<[^>]+>/g, '')) : '',
      category: catM ? decodeHtml(catM[1].replace(/<[^>]+>/g, '')) : '',
      url: hrefM ? absolutize(hrefM[1], baseUrl) : baseUrl
    });
  }
  return items;
}

function parseRss(xml, maxItems) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && items.length < maxItems) {
    const block = m[1];
    const titleM = block.match(/<title>([\s\S]*?)<\/title>/i);
    const linkM = block.match(/<link>([\s\S]*?)<\/link>/i);
    const dateM = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    if (!titleM) continue;
    const title = decodeHtml(titleM[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1'));
    if (!title || /\uFFFD/.test(title)) continue;
    items.push({
      title,
      date: dateM ? formatJaDateFromRss_(decodeHtml(dateM[1])) : '',
      category: '',
      url: linkM ? decodeHtml(linkM[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')).trim() : ''
    });
  }
  return items;
}

/** 汎用フォールバック */
function parseGenericLinks(html, baseUrl, maxItems) {
  const items = [];
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const seen = new Set();
  while ((m = re.exec(html)) && items.length < maxItems) {
    const href = m[1];
    const text = decodeHtml(m[2].replace(/<[^>]+>/g, ''));
    if (!text || text.length < 8 || text.length > 120) continue;
    if (/^(TOP|HOME|ログイン|お問い合わせ|一覧を見る|RSS)/i.test(text)) continue;
    if (!/news|detail\.php/i.test(href) && !/お知らせ|トピックス/.test(text)) continue;
    const url = absolutize(href, baseUrl);
    if (seen.has(url + '|' + text)) continue;
    seen.add(url + '|' + text);
    items.push({ title: text, date: '', category: '', url });
  }
  return items;
}

export async function fetchHomepageNews(options = {}) {
  const cfg = { ...loadConfig(), ...options };
  let items = [];
  let source = cfg.newsListUrl;
  const errors = [];

  /* 1) 新着一覧 HTML（文字化けしにくい） */
  try {
    const html = await fetchText(cfg.newsListUrl, 'text/html');
    items = parseSatoNewsList(html, cfg.newsListUrl, cfg.maxItems);
    if (!items.length) items = parseGenericLinks(html, cfg.newsListUrl, cfg.maxItems);
    if (items.length) source = cfg.newsListUrl;
  } catch (err) {
    errors.push(String(err.message || err));
  }

  /* 2) RSS */
  if (!items.length && cfg.rssUrl) {
    try {
      const xml = await fetchText(cfg.rssUrl, 'application/rss+xml,application/xml,text/xml');
      items = parseRss(xml, cfg.maxItems);
      if (items.length) source = cfg.rssUrl;
    } catch (err) {
      errors.push(String(err.message || err));
    }
  }

  /* 3) トップページ NEWS */
  if (!items.length) {
    try {
      const html = await fetchText(cfg.homepageUrl, 'text/html');
      items = parseSatoNewsList(html, cfg.homepageUrl, cfg.maxItems);
      if (!items.length) items = parseGenericLinks(html, cfg.homepageUrl, cfg.maxItems);
      if (items.length) source = cfg.homepageUrl;
    } catch (err) {
      errors.push(String(err.message || err));
    }
  }

  if (!items.length) {
    throw new Error('news fetch failed: ' + (errors.join('; ') || 'no items'));
  }

  /* 件内容が同じなら書き込まない（Actions の不要コミット防止） */
  if (existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, 'utf8'));
      if (JSON.stringify(prev.items || []) === JSON.stringify(items)) {
        return {
          homepage: cfg.homepageUrl,
          source: prev.source || source,
          fetchedAt: prev.fetchedAt || '',
          items,
          unchanged: true
        };
      }
    } catch (_) { /* rewrite */ }
  }

  const payload = {
    homepage: cfg.homepageUrl,
    source,
    fetchedAt: new Date().toISOString(),
    items
  };
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return payload;
}

const ranDirect = process.argv[1] && process.argv[1].includes('fetch-homepage-news');

if (ranDirect) {
  fetchHomepageNews()
    .then((p) => {
      console.log('Homepage:', p.homepage);
      console.log('Source:', p.source);
      if (p.unchanged) {
        console.log('Unchanged:', OUT_PATH);
      } else {
        console.log('Wrote', OUT_PATH);
      }
      console.log('items:', p.items.length);
      p.items.slice(0, 5).forEach((it, i) => console.log((i + 1) + '.', it.date, it.title));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
