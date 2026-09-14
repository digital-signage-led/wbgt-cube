/**
 * 現場テンプレート（位置情報だけ書き換え）
 *
 * 使い方:
 * 1. このファイルを site-config.js にコピー
 * 2. 下の ★ を現場の値に書き換え
 * 3. index-4face.html / assets / ロゴはそのまま使う
 *
 * コード・見た目・ループ構成は共通。変えるのはこのファイルだけ。
 */
(function (global) {
  'use strict';

  var cfg = {
    site: {
      customer: '株式会社鴻治組',
      rental: '',
      /* ★ 時刻下白帯に出る会場名・工事名 */
      label: '（会場名・工事名）',
      /* ★ 備考用（画面には出さないことが多い） */
      address: '（住所）',
      /* ★ 予報・天気パネル下の短い地名（例: 熊野町） */
      locationLabel: '（表示地名）'
    },
    moe: {
      /* GAS は共通。地点は point で切替 */
      gasUrl:
        'https://script.google.com/macros/s/AKfycbzSTsappgfJTaJruOBJsbnCXSTPkeTBp39CXpvoSZsPQ0mWGs4KjSonC8_eZ2b1EeUXTQ/exec',
      /* ★ 環境省 WBGT 5桁地点コード（必須・会場最寄り） */
      point: '00000',
      fallbackPoint: '',
      /* ★ GAS/CSV 用の観測地点名（環境省表記） */
      pointName: '（観測地点名）',
      /* ★ 熱中症アラートの府県名（例: 広島県） */
      alertArea: '（都道府県）',
      /* ★ 環境省 region / prefecture（都道府県コード） */
      region: '00',
      prefecture: '00'
    },
    jma: {
      /* ★ 気象庁 AMeDAS 地点（通常は moe.point と同じ） */
      amedasPoint: '00000',
      amedasSupplementPoint: '',
      /* ★ 予報区域コード（例: 広島県 340000） */
      forecastArea: '000000',
      /* ★ 予報表示用の短い地名（locationLabel と同じでよい） */
      forecastLabel: '（表示地名）',
      /* ★ 警報 JSON の都道府県コード（例: 340000） */
      warnArea: '000000',
      /* ★ 警報の市町村コード（例: 熊野町 3430700） */
      warnCity: '0000000',
      /* ★ 警報上段に出る市町村名（例: 熊野町） */
      warnCityLabel: '（市町村名）'
    },
    /* ★ 会場座標（任意） */
    geo: { lat: 0, lon: 0 },
    timeZone: 'Asia/Tokyo',
    refreshMs: 60000,
    footSource: '出典：気象庁・環境省データ'
  };

  global.SignageConfig = cfg;

  global.SIGNAGE_CONFIG = {
    logoSrc: './assets/kohji_logo.png?v=3',
    logoAlt: '鴻治組',
    logoPanelBg: '#ffffff',
    logoCorpSrc: '',
    footLogoSrc: '',
    footBannerSrc: './assets/kohji_foot.png?v=3',
    footLogos: [],
    trailingLogos: [
      { src: './assets/kohji_logo.png?v=3', alt: '鴻治組' }
    ]
  };
})(typeof window !== 'undefined' ? window : global);
