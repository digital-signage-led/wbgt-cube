/**
 * 512×128 サイネージ列背景（本番 index.html 互換）
 */
(function (global) {
  'use strict';

  const UNKNOWN = { bgColor: '#2a2a2a', barColor: '#3a3a3a' };
  const OFF_SEASON = { bgColor: '#484848', barColor: '#585858' };
  const LED_FOOT_BAR_BG = '#fff9f0';

  const LEVELS = [
    { min: 31, levelIdx: 4, bgColor: '#D61914', barColor: '#E94540' },
    { min: 28, levelIdx: 3, bgColor: '#FF7E00', barColor: '#FF9A38' },
    { min: 25, levelIdx: 2, bgColor: '#FFBE2D', barColor: '#FECD58' },
    { min: 21, levelIdx: 1, bgColor: '#FFD92D', barColor: '#FEE968' },
    { min: -99, levelIdx: 0, bgColor: '#308DD8', barColor: '#55A5E6' }
  ];

  const KIND = { STRIP: 'strip', WBGT: 'wbgt', FORECAST: 'forecast' };

  function colorsForLevel(levelIdx) {
    if (levelIdx == null || levelIdx < 0) return UNKNOWN;
    const idx = Math.max(0, Math.min(4, levelIdx | 0));
    const row = LEVELS.find(l => l.levelIdx === idx);
    return row ? { bgColor: row.bgColor, barColor: row.barColor } : UNKNOWN;
  }

  function colorsForDisplay(levelIdx, displayMode) {
    if (displayMode === 'offseason') return OFF_SEASON;
    if (displayMode === 'unavailable' || levelIdx == null || levelIdx < 0) return UNKNOWN;
    return colorsForLevel(levelIdx);
  }

  function isDarkTextLevel(levelIdx) {
    return levelIdx === 1 || levelIdx === 2;
  }

  function isDarkTextForDisplay(levelIdx, displayMode) {
    if (displayMode === 'offseason' || displayMode === 'unavailable') return false;
    return isDarkTextLevel(levelIdx);
  }

  function ensureBgLayer(el, kind) {
    if (!el || el.querySelector('.col-bg-layer')) return;
    el.classList.add('col-bg-host');
    const layer = document.createElement('div');
    layer.className = 'col-bg-layer col-bg-' + kind;
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML =
      '<div class="col-bg-top"></div>' +
      '<div class="col-bg-body"></div>' +
      (kind === KIND.WBGT
        ? '<div class="col-bg-wbgt-foot"></div>'
        : '<div class="col-bg-foot"></div>');
    el.insertBefore(layer, el.firstChild);
  }

  function applyColorsToLayer(layer, colors, kind) {
    if (!layer) return;
    const top = layer.querySelector('.col-bg-top');
    const body = layer.querySelector('.col-bg-body');
    if (top) top.style.backgroundColor = colors.barColor;
    if (body) body.style.backgroundColor = colors.bgColor;
    const foot = layer.querySelector('.col-bg-foot');
    if (foot && kind !== KIND.WBGT) foot.style.backgroundColor = LED_FOOT_BAR_BG;
  }

  function applyStrip(el, levelIdx, displayMode) {
    ensureBgLayer(el, KIND.STRIP);
    applyColorsToLayer(el.querySelector('.col-bg-layer'), colorsForDisplay(levelIdx, displayMode), KIND.STRIP);
    el.classList.toggle('col-bg-dark-text', isDarkTextForDisplay(levelIdx, displayMode));
    el.classList.toggle('wbgt-off-season', displayMode === 'offseason');
    el.classList.toggle('wbgt-unavailable', displayMode === 'unavailable');
  }

  function ensureSceneStripBg(container) {
    if (!container || container.querySelector('.scene-strip-bg')) return;
    const wrap = document.createElement('div');
    wrap.className = 'scene-strip-bg';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<div class="col-bg-top"></div><div class="col-bg-body"></div><div class="col-bg-foot"></div>';
    container.insertBefore(wrap, container.firstChild);
  }

  function applySceneStripBg(container, levelIdx, displayMode) {
    if (!container) return;
    ensureSceneStripBg(container);
    const colors = colorsForDisplay(levelIdx, displayMode);
    const wrap = container.querySelector('.scene-strip-bg');
    container.classList.toggle('col-bg-dark-text', isDarkTextForDisplay(levelIdx, displayMode));
    container.classList.toggle('wbgt-off-season', displayMode === 'offseason');
    container.classList.toggle('wbgt-unavailable', displayMode === 'unavailable');
    if (!wrap) return;
    const top = wrap.querySelector('.col-bg-top');
    const body = wrap.querySelector('.col-bg-body');
    const foot = wrap.querySelector('.col-bg-foot');
    if (top) top.style.backgroundColor = colors.barColor;
    if (body) body.style.backgroundColor = colors.bgColor;
    if (foot) foot.style.backgroundColor = LED_FOOT_BAR_BG;
  }

  function refreshForecast(slots, displayMode) {
    const row = slots && slots[0];
    const levelIdx =
      row && row.wbgt != null
        ? Number.isInteger(row.levelIdx)
          ? row.levelIdx
          : 0
        : -1;
    const mode = displayMode || (levelIdx < 0 ? 'unavailable' : 'normal');
    document.querySelectorAll('#scene4 .fc-track .fc-panel').forEach(function (panel) {
      applyStrip(panel, levelIdx, mode);
    });
  }

  function refreshContentAreaBg(levelIdx, displayMode) {
    const content = document.querySelector('.content-area');
    if (!content) return;
    applySceneStripBg(content, levelIdx, displayMode);
  }

  function initSignageLogo_() {
    const img = document.getElementById('signage-logo');
    const cfg = global.SIGNAGE_CONFIG;
    if (!img || !cfg) return;
    img.src = cfg.logoSrc;
    img.alt = cfg.logoAlt;
  }

  function refreshLogoPanel(levelIdx, displayMode) {
    const panel = document.querySelector('.logo-panel');
    if (!panel) return;
    panel.style.backgroundColor = colorsForDisplay(levelIdx, displayMode).barColor;
  }

  function refreshScene1Panels(currentLevelIdx, displayMode) {
    document.querySelectorAll('#scene1 .panel-clock').forEach(function (panel) {
      applyStrip(panel, currentLevelIdx, displayMode);
    });
  }

  function refreshAll(currentLevelIdx, displayMode) {
    refreshContentAreaBg(currentLevelIdx, displayMode);
    refreshScene1Panels(currentLevelIdx, displayMode);
    refreshLogoPanel(currentLevelIdx, displayMode);
  }

  function initHosts() {
    document.querySelectorAll('.col-bg-layer').forEach(el => el.remove());
    document.querySelectorAll('.col-bg-host').forEach(el => {
      el.classList.remove('col-bg-host', 'col-bg-dark-text', 'col-bg-unknown');
    });
    document.querySelectorAll('.scene-strip-bg').forEach(el => el.remove());
    initSignageLogo_();
    refreshContentAreaBg(-1, 'unavailable');
    refreshLogoPanel(-1, 'unavailable');
  }

  global.SignageBg = {
    LEVELS,
    KIND,
    colorsForDisplay,
    applyStrip,
    initHosts,
    initSignageLogo_,
    refreshAll,
    refreshLogoPanel,
    refreshForecast,
    refreshContentAreaBg
  };
})(typeof window !== 'undefined' ? window : global);
