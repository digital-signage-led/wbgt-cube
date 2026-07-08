const MOE_URL =
  'https://script.google.com/macros/s/AKfycbzSTsappgfJTaJruOBJsbnCXSTPkeTBp39CXpvoSZsPQ0mWGs4KjSonC8_eZ2b1EeUXTQ/exec' +
  '?point=73151&pointName=' + encodeURIComponent('四国中央') +
  '&region=09&prefecture=73&alertArea=' + encodeURIComponent('愛媛県') +
  '&type=bundle';

async function check(name, url, parse) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const text = await res.text();
    const info = parse ? await parse(res, text) : { status: res.status, len: text.length };
    console.log('OK', name, JSON.stringify(info));
    return true;
  } catch (e) {
    console.log('NG', name, e.message);
    return false;
  }
}

await check('MOE GAS (WBGT)', MOE_URL, async (res, text) => {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    json = m ? JSON.parse(m[0]) : null;
  }
  return {
    status: res.status,
    source: json && json.source,
    inService: json && json.inService,
    updatedAt: json && json.updatedAt,
    wbgt: json && (json.wbgt ?? json.currentWbgt),
    slots: json && json.slots && json.slots.length
  };
});

await check('JMA latest_time', 'https://www.jma.go.jp/bosai/amedas/data/latest_time.txt', async (res, text) => ({
  status: res.status,
  latest: text.trim()
}));

await check('JMA forecast 380000', 'https://www.jma.go.jp/bosai/forecast/data/forecast/380000.json', async (res, text) => {
  const j = JSON.parse(text);
  return { status: res.status, reports: j.length };
});

await check('JMA warning 380000', 'https://www.jma.go.jp/bosai/warning/data/warning/380000.json', async (res, text) => {
  const j = JSON.parse(text);
  return { status: res.status, keys: Object.keys(j).slice(0, 5) };
});

try {
  const lt = (await (await fetch('https://www.jma.go.jp/bosai/amedas/data/latest_time.txt')).text()).trim();
  const d = new Date(lt);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ymd = `${y}${mo}${da}`;
  const hhmm = hh + mm;
  const blockH = String(Math.floor(d.getUTCMinutes() / 10) * 10).padStart(2, '0');
  const urls = [
    `https://www.jma.go.jp/bosai/amedas/data/point/73151/${ymd}_${blockH}.json`,
    `https://www.jma.go.jp/bosai/amedas/data/point/73151/${ymd}${hhmm}.json`
  ];
  for (const url of urls) {
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      console.log('NG JMA AMeDAS 73151', url.split('/').pop(), 'status=' + res.status);
      continue;
    }
    const j = JSON.parse(text);
    const keys = Object.keys(j);
    const k = keys[keys.length - 1];
    const obs = j[k];
    const temp = obs && obs[0] && obs[0][2];
    const hum = obs && obs[0] && obs[0][3];
    console.log('OK JMA AMeDAS 73151', JSON.stringify({ file: url.split('/').pop(), temp, hum }));
    break;
  }
} catch (e) {
  console.log('NG JMA AMeDAS 73151', e.message);
}
