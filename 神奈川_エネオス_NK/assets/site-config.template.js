/**
 * 現場テンプレート（位置情報だけ書き換え）
 */
(function (global) {
  'use strict';

  var cfg = {
    site: {
      customer: 'エネオス株式会社',
      rental: '',
      label: '（会場名）',
      address: '（住所）',
      locationLabel: '（表示地名）'
    },
    moe: {
      gasUrl:
        'https://script.google.com/macros/s/AKfycbzSTsappgfJTaJruOBJsbnCXSTPkeTBp39CXpvoSZsPQ0mWGs4KjSonC8_eZ2b1EeUXTQ/exec',
      point: '00000',
      fallbackPoint: '',
      pointName: '（観測地点名）',
      alertArea: '（都道府県）',
      region: '00',
      prefecture: '00'
    },
    jma: {
      amedasPoint: '00000',
      amedasSupplementPoint: '',
      forecastArea: '000000',
      forecastLabel: '（表示地名）',
      warnArea: '000000',
      warnCity: '0000000',
      warnCityLabel: '（市町村名）'
    },
    geo: { lat: 0, lon: 0 },
    timeZone: 'Asia/Tokyo',
    refreshMs: 60000,
    footSource: '出典：気象庁・環境省データ',
    schedule: { enabled: false, weekStartsOn: 1, items: [] }
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
