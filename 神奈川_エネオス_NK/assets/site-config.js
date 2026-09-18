/**
 * 現場設定（横浜市磯子区鳳町1番1号 / エネオス株式会社）
 * 4面 512×128。位置・社名・観測点はこのファイルだけ差し替える。
 */
(function (global) {
  'use strict';

  var cfg = {
    site: {
      customer: 'エネオス株式会社',
      rental: '',
      label: '磯子区',
      address: '横浜市磯子区鳳町1番1号',
      locationLabel: '磯子区'
    },
    moe: {
      gasUrl:
        'https://script.google.com/macros/s/AKfycbzSTsappgfJTaJruOBJsbnCXSTPkeTBp39CXpvoSZsPQ0mWGs4KjSonC8_eZ2b1EeUXTQ/exec',
      point: '46106',
      fallbackPoint: '',
      pointName: '横浜',
      alertArea: '神奈川県',
      region: '03',
      prefecture: '46'
    },
    jma: {
      amedasPoint: '46106',
      amedasSupplementPoint: '',
      forecastArea: '140000',
      forecastLabel: '磯子区',
      warnArea: '140000',
      warnCity: '1410012',
      warnCityLabel: '磯子区'
    },
    geo: { lat: 35.412494, lon: 139.636281 },
    timeZone: 'Asia/Tokyo',
    refreshMs: 60000,
    footSource: '出典：気象庁・環境省データ',
    schedule: {
      enabled: false,
      weekStartsOn: 1,
      items: []
    }
  };

  global.SignageConfig = cfg;

  global.SIGNAGE_CONFIG = {
    logoSrc: './assets/eneos_logo.gif',
    logoAlt: 'エネオス株式会社',
    logoPanelBg: '#ffffff',
    logoCorpSrc: './assets/eneos_logo.gif',
    footLogoSrc: './assets/eneos_logo.gif',
    footBannerSrc: './assets/eneos_lockup.png'
  };
})(typeof window !== 'undefined' ? window : global);
