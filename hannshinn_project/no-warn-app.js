/**
 * 警報・注意報なし — 本番シーン4（WBGT×4列）常時表示
 * 4面・5面とも同じ内容（5面はロゴ列128pxが追加されるだけ）
 */
(function () {
  'use strict';

  const CFG = window.SignageConfig || {};
  const LOGO = window.SIGNAGE_CONFIG || {};
  const MOE_GAS_URL = CFG.moe?.gasUrl || '';
  const MOE_POINT = CFG.moe?.point || '';
  const MOE_POINT_NAME = CFG.moe?.pointName || '';
  const JMA_POINT = CFG.jma?.amedasPoint || '';
  const JMA_AREA = CFG.jma?.forecastArea || '280000';
  const CLOCK_TZ = CFG.timeZone || 'Asia/Tokyo';
  const SITE_LABEL = CFG.site?.label || '';
  const FOOT_SOURCE = CFG.footSource || '出典：気象庁・環境省データ';
  const REFRESH_MS = CFG.refreshMs || 300000;
  const SCENE4_PANEL_COUNT = 4;
  const SCENE4_LAPS = 2;
  const SCENE4_SCROLL_PX = 0.6;
  const SCENE1_WBGT_LAP_PX = 512;
  const SCENE1_WBGT_LAPS = 2;
  const SCENE1_WBGT_SETS = 3;
  const SCENE1_WBGT_HOLD_MS = 6000;
  const SCENE1_WBGT_SPEED_PX = 0.6;
  const FC_LV_LAP_PX = 512;
  const FC_LV_SPEED_PX = 0.6;
  const FC_BAR_LABELS = ['暑さ指数', 'WBGT'];
  const MULTI = [
    '【ほぼ安全】適宜水分補給',
    '【注意】積極的に水分補給',
    '【警戒】定期的に休憩',
    '【厳重警戒】激しい作業中止',
    '【危険】作業を直ちに中止'
  ];

  const scene1 = document.getElementById('scene1');
  const scene4 = document.getElementById('scene4');
  const fcConveyor = document.getElementById('fc-conveyor');
  const fcLvTrack = document.getElementById('fc-lv-track');
  const s1WbgtTrack = document.getElementById('s1-wbgt-track');
  const logoRotator = document.getElementById('logo-rotator');

  const timeSync = { baseUtcMs: null, perfAtSync: 0, source: '' };
  const clockHmFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLOCK_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const clockDateFormatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: CLOCK_TZ,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short'
  });

  let fcLvAnimId = null;
  let fcLvX = 0;
  let scene4AnimId = null;
  let scene4FcLvX = 0;
  let scene4SetWidth = SCENE4_PANEL_COUNT * 128;
  let scene1AnimId = null;
  let scene1HoldTimerId = null;
  let scene1EndHoldTimerId = null;
  let clockIntervalId = null;
  let logoRotDeg = 0;
  let sceneLoopStarted = false;
  let wbgtOffSeason = false;
  let wbgtUnavailable = false;
  let currentLevelIdx = -1;
  let lastWbgtSlots = null;

  function wbgtLevel(w) {
    if (!Number.isFinite(w)) return -1;
    return w >= 31 ? 4 : w >= 28 ? 3 : w >= 25 ? 2 : w >= 21 ? 1 : 0;
  }

  function normalizeWbgt(raw) {
    if (raw === null || raw === undefined || raw === '') return null;
    const w = Number(raw);
    if (!Number.isFinite(w) || w < 5 || w > 45) return null;
    return w;
  }

  function displayMode() {
    if (wbgtOffSeason) return 'offseason';
    if (wbgtUnavailable) return 'unavailable';
    return 'normal';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function fcBarLabel_(index) {
    return FC_BAR_LABELS[index % 2];
  }

  function wbgtMessage_() {
    if (wbgtOffSeason) return 'WBGT提供期間外';
    if (wbgtUnavailable || currentLevelIdx < 0) return 'WBGTデータ取得不可';
    return MULTI[currentLevelIdx] || 'WBGTデータ取得不可';
  }

  function formatFcWbgtHtml(wbgt) {
    if (wbgt == null) return '--';
    return (
      '<span class="fc-wbgt-num">' +
      Number(wbgt).toFixed(1) +
      '</span><span class="fc-wbgt-unit">℃</span>'
    );
  }

  function hasFull4Slots(slots) {
    return (
      Array.isArray(slots) &&
      slots.length >= SCENE4_PANEL_COUNT &&
      slots[0] != null &&
      slots[0].wbgt != null
    );
  }

  function isTrustedMoePayload(json, slots) {
    if (!hasFull4Slots(slots)) return false;
    const src = json && json.source;
    return src === 'estimated' || src === 'forecast' || src === 'moe-env.go.jp';
  }

  function normalizeMoeSlots(payload) {
    const rows = Array.isArray(payload)
      ? payload
      : payload?.data || payload?.slots || [];
    if (!Array.isArray(rows) || rows.length < SCENE4_PANEL_COUNT) return null;
    const slots = [];
    for (let i = 0; i < SCENE4_PANEL_COUNT; i++) {
      const row = rows[i] || {};
      const wbgt = normalizeWbgt(row.wbgt ?? row.value ?? row.wbgtValue);
      const explicit = Number.isInteger(row.levelIdx) ? row.levelIdx : null;
      const lv = wbgt == null ? 0 : explicit != null ? explicit : wbgtLevel(wbgt);
      slots.push({
        wbgt,
        levelIdx: Math.max(0, Math.min(4, lv)),
        hour: row.hour || row.timeLabel || row.time || (i === 0 ? '現在' : '+' + i * 3 + 'h')
      });
    }
    return slots;
  }

  function parseMoeJson(json) {
    const slots = normalizeMoeSlots(json);
    if (!isTrustedMoePayload(json, slots)) {
      throw new Error('untrusted: ' + ((json && json.source) || 'unknown'));
    }
    return slots;
  }

  function syncLevelFromSlots_(slots) {
    if (!slots || !slots[0] || slots[0].wbgt == null) {
      currentLevelIdx = -1;
      return;
    }
    const row = slots[0];
    const explicit = Number.isInteger(row.levelIdx) ? row.levelIdx : null;
    currentLevelIdx =
      explicit != null ? Math.max(0, Math.min(4, explicit)) : wbgtLevel(row.wbgt);
  }

  function refreshSignageBg_() {
    if (typeof SignageBg === 'undefined') return;
    const mode = displayMode();
    const lv = mode === 'normal' ? currentLevelIdx : -1;
    SignageBg.refreshAll(lv, mode);
    if (lastWbgtSlots) SignageBg.refreshForecast(lastWbgtSlots, mode);
  }

  function fitFcWbgtFontSize_() {
    const maxW = 118;
    document.querySelectorAll('#scene4 .fc-wbgt').forEach(wrap => {
      const num = wrap.querySelector('.fc-wbgt-num');
      const unit = wrap.querySelector('.fc-wbgt-unit');
      if (!num) return;
      let size = 34;
      num.style.fontSize = size + 'px';
      if (unit) unit.style.fontSize = '14px';
      while (size > 22 && wrap.scrollWidth > maxW) {
        size -= 1;
        num.style.fontSize = size + 'px';
        if (unit) unit.style.fontSize = Math.max(11, Math.round(size * 0.41)) + 'px';
      }
    });
  }

  function updateForecastSlots(slots) {
    const arr =
      slots && slots.length
        ? slots
        : [{ wbgt: null, levelIdx: 0, hour: '現在' }];
    document.querySelectorAll('#scene4 .fc-track .fc-panel').forEach((panel, i) => {
      const slotIdx = i % SCENE4_PANEL_COUNT;
      const slot = arr[slotIdx] || arr[0];
      const wbgtHtml =
        wbgtOffSeason || slot.wbgt == null ? '--' : formatFcWbgtHtml(slot.wbgt);
      panel.className = 'fc-panel fc-slot-' + (slotIdx % 2);
      panel.querySelectorAll('.fc-bar-label').forEach(el => {
        el.textContent = fcBarLabel_(slotIdx);
      });
      panel.querySelectorAll('.fc-val-live').forEach(el => {
        el.innerHTML = wbgtHtml;
      });
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(fitFcWbgtFontSize_);
    });
    lastWbgtSlots = slots;
    syncLevelFromSlots_(slots);
    refreshSignageBg_();
  }

  function applyWbgtSlots_(slots) {
    if (!slots || !hasFull4Slots(slots)) {
      wbgtUnavailable = true;
      currentLevelIdx = -1;
      const nullSlot = { wbgt: null, hour: '取得不可' };
      slots = [nullSlot, nullSlot, nullSlot, nullSlot];
    } else {
      wbgtUnavailable = false;
    }
    updateForecastSlots(slots);
  }

  function applyWbgtOffSeason_() {
    wbgtOffSeason = true;
    wbgtUnavailable = false;
    currentLevelIdx = -1;
    lastWbgtSlots = null;
    document.querySelectorAll('#scene4 .fc-scroll-wrap, #scene4 .fc-lv-bar').forEach(el => {
      el.style.display = 'none';
    });
    document.querySelectorAll('#scene1 .s1-wbgt-bar').forEach(el => {
      el.style.display = 'none';
    });
    refreshSignageBg_();
    buildS1WbgtTrack_();
    buildFcLvTrack_();
  }

  function applyWbgtInSeason_() {
    wbgtOffSeason = false;
    document.querySelectorAll('#scene4 .fc-scroll-wrap, #scene4 .fc-lv-bar').forEach(el => {
      el.style.display = '';
    });
    document.querySelectorAll('#scene1 .s1-wbgt-bar').forEach(el => {
      el.style.display = '';
    });
  }

  function compactScene4Panels_() {
    if (!fcConveyor) return;
    if (!fcConveyor.dataset.doubled) {
      const panels = [...fcConveyor.querySelectorAll('.fc-panel')];
      panels.forEach(p => fcConveyor.appendChild(p.cloneNode(true)));
      fcConveyor.dataset.doubled = '1';
    }
    scene4SetWidth = SCENE4_PANEL_COUNT * 128;
    fcConveyor.style.width = scene4SetWidth * 2 + 'px';
  }

  function getSyncedUtcMs_() {
    if (timeSync.baseUtcMs == null) return null;
    return timeSync.baseUtcMs + (performance.now() - timeSync.perfAtSync);
  }

  function applySyncedUtcMs_(utcMs, source) {
    if (!Number.isFinite(utcMs)) return;
    timeSync.baseUtcMs = utcMs;
    timeSync.perfAtSync = performance.now();
    timeSync.source = source || '';
  }

  async function syncTimeFromNetwork_() {
    try {
      const t0 = performance.now();
      const res = await fetch('https://www.jma.go.jp/bosai/amedas/data/latest_time.txt', {
        cache: 'no-store'
      });
      const t1 = performance.now();
      if (!res.ok) throw new Error('jma time');
      const txt = (await res.text()).trim();
      const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(txt) ? txt : txt.replace(/\.\d+$/, '') + '+09:00';
      const serverUtcMs = Date.parse(iso);
      if (!Number.isFinite(serverUtcMs)) throw new Error('parse');
      applySyncedUtcMs_(serverUtcMs + (t1 - t0) / 2, 'jma-amedas');
      return true;
    } catch (e) {
      applySyncedUtcMs_(Date.now(), 'local-fallback');
      return false;
    }
  }

  function updateClock_() {
    let ms = getSyncedUtcMs_();
    if (ms == null) {
      applySyncedUtcMs_(Date.now(), 'local-fallback');
      ms = getSyncedUtcMs_();
    }
    const now = new Date(Math.floor(ms));
    const t = clockHmFormatter.format(now);
    const d = clockDateFormatter.format(now);
    document.querySelectorAll('.clock-hm').forEach(el => {
      el.textContent = t;
    });
    document.querySelectorAll('#scene1 .s1-bar-label').forEach(el => {
      el.textContent = d;
    });
  }

  function startClockTicker_() {
    if (clockIntervalId != null) clearTimeout(clockIntervalId);
    function tick() {
      try {
        updateClock_();
      } catch (err) {
        console.warn('[時計]', err);
      }
      const ms = getSyncedUtcMs_() ?? Date.now();
      clockIntervalId = setTimeout(tick, Math.max(50, 1000 - (ms % 1000)));
    }
    tick();
  }

  function footBarUseCompact_(text) {
    return String(text || '').length > 18;
  }

  function buildEvenCharSpans_(text, chClass) {
    return [...text].map(ch => '<span class="' + chClass + '">' + escapeHtml(ch) + '</span>').join('');
  }

  function buildS1WbgtMsgHtml_(text) {
    if (footBarUseCompact_(text)) {
      return '<span class="s1-wbgt-msg-compact">' + escapeHtml(text) + '</span>';
    }
    return '<span class="s1-wbgt-msg">' + buildEvenCharSpans_(text, 's1-wbgt-ch') + '</span>';
  }

  function buildS1WbgtSetHtml_(text) {
    const msg = buildS1WbgtMsgHtml_(text);
    if (footBarUseCompact_(text)) {
      return (
        '<div class="s1-wbgt-set"><div class="s1-wbgt-slot s1-wbgt-slot-wide">' + msg + '</div></div>'
      );
    }
    const slot = '<div class="s1-wbgt-slot">' + msg + '</div>';
    return '<div class="s1-wbgt-set">' + slot + slot + '</div>';
  }

  function hasS1WbgtFootMessage_() {
    return !!String(wbgtMessage_() || '').trim();
  }

  function buildS1WbgtTrack_() {
    if (!s1WbgtTrack) return;
    const text = wbgtOffSeason ? '' : wbgtMessage_();
    let html = '';
    for (let i = 0; i < SCENE1_WBGT_SETS; i++) html += buildS1WbgtSetHtml_(text);
    s1WbgtTrack.innerHTML = html;
    s1WbgtTrack.style.transform = 'translateX(0px)';
  }

  function clearScene1Timers_() {
    if (scene1AnimId) cancelAnimationFrame(scene1AnimId);
    if (scene1HoldTimerId) clearTimeout(scene1HoldTimerId);
    if (scene1EndHoldTimerId) clearTimeout(scene1EndHoldTimerId);
    scene1AnimId = null;
    scene1HoldTimerId = null;
    scene1EndHoldTimerId = null;
  }

  function clearScene4Timers_() {
    if (scene4AnimId) cancelAnimationFrame(scene4AnimId);
    if (fcLvAnimId) cancelAnimationFrame(fcLvAnimId);
    scene4AnimId = null;
    fcLvAnimId = null;
  }

  function showScene_(id) {
    if (scene1) {
      const on = id === 'scene1';
      scene1.classList.toggle('active', on);
      scene1.style.display = on ? 'flex' : 'none';
    }
    if (scene4) {
      const on = id === 'scene4';
      scene4.classList.toggle('active', on);
      scene4.style.display = on ? 'block' : 'none';
    }
  }

  function stepLogo_(deg) {
    if (!logoRotator) return;
    logoRotDeg = (logoRotDeg + deg) % 360;
    logoRotator.style.transition = 'transform 0.42s ease';
    logoRotator.style.transform = 'rotate(' + logoRotDeg + 'deg)';
  }

  function finishScene1_() {
    if (wbgtOffSeason) {
      playScene1_();
      return;
    }
    playScene4_();
  }

  function finishScene4_() {
    clearScene4Timers_();
    playScene1_();
  }

  function playScene1_() {
    clearScene1Timers_();
    clearScene4Timers_();
    showScene_('scene1');
    updateClock_();
    buildS1WbgtTrack_();
    refreshSignageBg_();
    stepLogo_(90);
    const s1WbgtBar = document.querySelector('#scene1 .s1-wbgt-bar');
    const showFoot = !wbgtOffSeason && hasS1WbgtFootMessage_();
    if (s1WbgtBar) s1WbgtBar.style.display = showFoot ? 'block' : 'none';
    if (!s1WbgtTrack || !showFoot) {
      scene1HoldTimerId = setTimeout(finishScene1_, SCENE1_WBGT_HOLD_MS);
      return;
    }
    function runS1WbgtSequence() {
      const stopX = 0;
      const scrollEndX = -SCENE1_WBGT_LAP_PX * SCENE1_WBGT_LAPS;
      s1WbgtTrack.style.transform = 'translateX(0px)';
      scene1HoldTimerId = setTimeout(() => {
        scene1HoldTimerId = null;
        let x = stopX;
        function animate() {
          x -= SCENE1_WBGT_SPEED_PX;
          if (x <= scrollEndX) {
            s1WbgtTrack.style.transform = 'translateX(0px)';
            scene1AnimId = null;
            scene1EndHoldTimerId = setTimeout(() => {
              scene1EndHoldTimerId = null;
              finishScene1_();
            }, SCENE1_WBGT_HOLD_MS);
            return;
          }
          s1WbgtTrack.style.transform = 'translateX(' + x + 'px)';
          scene1AnimId = requestAnimationFrame(animate);
        }
        scene1AnimId = requestAnimationFrame(animate);
      }, SCENE1_WBGT_HOLD_MS);
    }
    requestAnimationFrame(() => requestAnimationFrame(runS1WbgtSequence));
  }

  function playScene4_() {
    if (wbgtOffSeason) {
      playScene1_();
      return;
    }
    clearScene1Timers_();
    clearScene4Timers_();
    showScene_('scene4');
    buildFcLvTrack_();
    compactScene4Panels_();
    refreshSignageBg_();
    fitFcWbgtFontSize_();
    stepLogo_(90);
    const scrollTotal = scene4SetWidth * SCENE4_LAPS;
    if (!fcConveyor || !scrollTotal) {
      setTimeout(finishScene4_, 500);
      return;
    }
    let x = 0;
    let totalScrolled = 0;
    scene4FcLvX = 0;
    fcConveyor.style.transition = 'none';
    fcConveyor.style.transform = 'translateX(0px)';
    if (fcLvTrack) fcLvTrack.style.transform = 'translateX(0px)';
    function animate() {
      x -= SCENE4_SCROLL_PX;
      totalScrolled += SCENE4_SCROLL_PX;
      if (x <= -scene4SetWidth) x += scene4SetWidth;
      fcConveyor.style.transform = 'translateX(' + x + 'px)';
      scene4FcLvX -= FC_LV_SPEED_PX;
      if (scene4FcLvX <= -FC_LV_LAP_PX) scene4FcLvX += FC_LV_LAP_PX;
      if (fcLvTrack) fcLvTrack.style.transform = 'translateX(' + scene4FcLvX + 'px)';
      if (totalScrolled >= scrollTotal) {
        fcConveyor.style.transform = 'translateX(0px)';
        scene4AnimId = null;
        finishScene4_();
        return;
      }
      scene4AnimId = requestAnimationFrame(animate);
    }
    scene4AnimId = requestAnimationFrame(animate);
  }

  function startSceneLoop_() {
    if (sceneLoopStarted) return;
    sceneLoopStarted = true;
    playScene1_();
  }

  function fetchMoeViaJsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = 'wbgtCb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      const sep = url.indexOf('?') >= 0 ? '&' : '?';
      const script = document.createElement('script');
      let done = false;
      function finish(err, data) {
        if (done) return;
        done = true;
        try {
          delete window[cb];
        } catch (_) {
          window[cb] = undefined;
        }
        script.remove();
        if (err) reject(err);
        else resolve(data);
      }
      window[cb] = data => finish(null, data);
      script.onerror = () => finish(new Error('JSONP failed'));
      script.src = url + sep + 'callback=' + encodeURIComponent(cb);
      document.head.appendChild(script);
      setTimeout(() => finish(new Error('JSONP timeout')), 20000);
    });
  }

  async function fetchMoeFromGas() {
    if (!MOE_GAS_URL) throw new Error('GAS URL 未設定');
    if (!MOE_POINT) throw new Error('signage-config.js の moe.point を設定してください');
    const url = new URL(MOE_GAS_URL);
    url.searchParams.set('point', MOE_POINT);
    if (MOE_POINT_NAME) url.searchParams.set('pointName', MOE_POINT_NAME);
    let json = null;
    try {
      const res = await fetch(url.toString(), {
        cache: 'no-store',
        redirect: 'follow',
        mode: 'cors'
      });
      if (!res.ok) throw new Error('GAS HTTP ' + res.status);
      json = JSON.parse(await res.text());
    } catch (e) {
      json = await fetchMoeViaJsonp(url.toString());
    }
    if (json && (json.source === 'off-season' || json.inService === false)) return 'offseason';
    return parseMoeJson(json);
  }

  async function fetchAmedas_() {
    if (!JMA_POINT) return { stamp: '', temp: null, humi: null };
    const latestRes = await fetch('https://www.jma.go.jp/bosai/amedas/data/latest_time.txt', {
      cache: 'no-store'
    });
    const latestTxt = (await latestRes.text()).trim();
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(latestTxt)
      ? latestTxt
      : latestTxt.replace(/\.\d+$/, '') + '+09:00';
    const t = new Date(iso);
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: CLOCK_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const p = Object.fromEntries(fmt.formatToParts(t).map(x => [x.type, x.value]));
    const key = `${p.year}${p.month}${p.day}${p.hour}${p.minute}00`;
    const blockH = String(Math.floor(Number(p.hour) / 3) * 3).padStart(2, '0');
    let obs = {};
    try {
      const mapRes = await fetch(
        `https://www.jma.go.jp/bosai/amedas/data/map/${key}.json`,
        { cache: 'no-store' }
      );
      if (!mapRes.ok) throw new Error('map');
      obs = (await mapRes.json())[JMA_POINT] || {};
    } catch (_) {
      const pointUrl = `https://www.jma.go.jp/bosai/amedas/data/point/${JMA_POINT}/${p.year}${p.month}${p.day}_${blockH}.json`;
      const pointRes = await fetch(pointUrl, { cache: 'no-store' });
      if (!pointRes.ok) throw new Error('point');
      const pointData = await pointRes.json();
      const keys = Object.keys(pointData)
        .filter(k => /^\d{14}$/.test(k))
        .sort();
      obs = pointData[key] || pointData[keys.find(k => k <= key) || keys[keys.length - 1]] || {};
    }
    const pick = a => (Array.isArray(a) && a[0] !== '' ? Number(a[0]) : null);
    return {
      stamp: `${Number(p.month)}/${Number(p.day)} ${p.hour}:${p.minute}`,
      temp: pick(obs.temp),
      humi: pick(obs.humidity)
    };
  }

  async function fetchForecast_() {
    try {
      const res = await fetch(
        `https://www.jma.go.jp/bosai/forecast/data/forecast/${JMA_AREA}.json`,
        { cache: 'no-store' }
      );
      if (!res.ok) throw new Error('forecast');
      const json = await res.json();
      const weekly = Array.isArray(json) ? json[1] : null;
      const ts = weekly && weekly.timeSeries;
      if (Array.isArray(ts)) {
        for (const block of ts) {
          const a = block.areas && block.areas[0];
          if (a && Array.isArray(a.tempsMax) && a.tempsMax[1] !== '') {
            return { text: `明日最高 ${a.tempsMax[1]}℃`, max: a.tempsMax[1] };
          }
        }
      }
    } catch (e) {
      console.warn('[予報]', e.message || e);
    }
    return { text: '予測 取得中', max: null };
  }

  let lastAmedas = null;
  let lastForecast = null;

  function buildFcLvTrack_() {
    if (!fcLvTrack) return;
    const loc = SITE_LABEL ? SITE_LABEL + ' · ' : '';
    const obs =
      lastAmedas?.stamp != null
        ? `${loc}実況 ${lastAmedas.stamp} 気温${lastAmedas.temp ?? '--'}℃ 湿度${lastAmedas.humi ?? '--'}%`
        : `${loc}実況 取得中`;
    const wbgtMsg = wbgtMessage_();
    const fc = lastForecast?.text || '予測 取得中';
    const lines = wbgtOffSeason ? [FOOT_SOURCE] : [obs, wbgtMsg, fc, FOOT_SOURCE];
    let html = '';
    for (let i = 0; i < lines.length; i++) {
      html +=
        '<div class="fc-lv-set"><div class="fc-lv-slot-wide"><span class="fc-lv-msg-compact">' +
        escapeHtml(lines[i]) +
        '</span></div></div>';
    }
    fcLvTrack.innerHTML = html;
    fcLvX = 0;
    scene4FcLvX = 0;
    fcLvTrack.style.transform = 'translateX(0px)';
  }

  async function refresh() {
    try {
      const [moe, amedas, forecast] = await Promise.all([
        fetchMoeFromGas(),
        fetchAmedas_(),
        fetchForecast_()
      ]);
      lastAmedas = amedas;
      lastForecast = forecast;
      if (moe === 'offseason') {
        applyWbgtOffSeason_();
        updateForecastSlots(null);
      } else {
        applyWbgtInSeason_();
        applyWbgtSlots_(moe);
      }
      buildS1WbgtTrack_();
      buildFcLvTrack_();
    } catch (e) {
      console.error('[サイネージ]', e);
      wbgtOffSeason = false;
      wbgtUnavailable = true;
      currentLevelIdx = -1;
      applyWbgtInSeason_();
      applyWbgtSlots_(null);
      lastForecast = { text: '取得失敗', max: null };
      buildS1WbgtTrack_();
      buildFcLvTrack_();
    }
  }

  window.addEventListener('load', async function () {
    if (typeof SignageBg !== 'undefined') SignageBg.initHosts();
    compactScene4Panels_();
    await syncTimeFromNetwork_();
    startClockTicker_();
    if (!MOE_GAS_URL) {
      console.error('GAS URL が未設定です。signage-config.js の moe.gasUrl を確認してください。');
    }
    if (!MOE_POINT) {
      console.error('moe.point が未設定です（環境省 WBGT 5桁地点コード）');
    }
    if (!JMA_POINT) {
      console.warn('jma.amedasPoint が未設定です（気象庁アメダス地点コード）');
    }
    console.log('[サイネージ]', CFG.site?.address || '', 'WBGT', MOE_POINT, 'AMeDAS', JMA_POINT || '(未設定)');
    updateForecastSlots(null);
    await refresh();
    startSceneLoop_();
    setInterval(refresh, REFRESH_MS);
  });
})();
