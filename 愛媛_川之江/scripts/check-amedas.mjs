const CLOCK_TZ = 'Asia/Tokyo';
const JMA_AMEDAS_POINT = '73151';

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.json();
}

const ltText = await (await fetch('https://www.jma.go.jp/bosai/amedas/data/latest_time.txt')).text();
const latest = new Date(ltText.trim());
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLOCK_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});
const p = Object.fromEntries(fmt.formatToParts(latest).map((x) => [x.type, x.value]));
const ymd = `${p.year}${p.month}${p.day}`;
const hhmm = `${p.hour}${p.minute}`;
const exactKey = `${ymd}${hhmm}00`;
const blockH = String(Math.floor(Number(p.hour) / 3) * 3).padStart(2, '0');

console.log('latest JST parts:', { ymd, hhmm, exactKey, blockH });

const urls = [
  `https://www.jma.go.jp/bosai/amedas/data/point/${JMA_AMEDAS_POINT}/${ymd}_${blockH}.json`,
  `https://www.jma.go.jp/bosai/amedas/data/point/${JMA_AMEDAS_POINT}/${ymd}${hhmm}.json`,
  `https://www.jma.go.jp/bosai/amedas/data/map/${ymd}${hhmm}00.json`
];

for (const url of urls) {
  try {
    const data = await fetchJson(url);
    if (url.includes('/map/')) {
      const obs = data[JMA_AMEDAS_POINT];
      console.log('OK map', {
        temp: obs && obs.temp && obs.temp[0],
        hum: obs && obs.humidity && obs.humidity[0],
        rain: obs && obs.precipitation10m && obs.precipitation10m[0]
      });
    } else {
      const keys = Object.keys(data).filter((k) => /^\d{14}$/.test(k)).sort();
      const key = data[exactKey] ? exactKey : keys[keys.length - 1];
      const obs = data[key] || data;
      console.log('OK point', url.split('/').pop(), {
        key,
        temp: obs.temp,
        hum: obs.humidity,
        keys: keys.slice(-3)
      });
    }
  } catch (e) {
    console.log('NG', url.split('/').slice(-2).join('/'), e.message);
  }
}
