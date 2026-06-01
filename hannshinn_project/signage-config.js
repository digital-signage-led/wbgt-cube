/**
 * 現場ごとの設定（GAS は 1 本共通・地点は moe.point で切替）
 *
 * moe.point … 環境省 WBGT 5桁地点コード（必須）
 * moe.pointName … 任意（省略時は GAS が CSV ヘッダーから取得）
 * moe.alertArea … 熱中症アラート用の府県名（本番で alert 利用時）
 *
 * jma.amedasPoint … 気象庁 AMeDAS（4面・5面共通）
 * jma.forecastArea … 気象庁予報区域（4面・5面共通）
 */
(function (global) {
  'use strict';

  var cfg = {
    site: {
      customer: '株式会社ハンシン建設',
      label: '神戸市東灘区',
      address: '兵庫県神戸市東灘区御影石町２丁目２１－１６付近'
    },
    moe: {
      gasUrl:
        'https://script.google.com/macros/s/AKfycbx2RweizzthITkBmOqOWsyOVfcNK6HKMGjODF4ku72UvNVFTaluHg9Hon7WQBkgQWxMxQ/exec',
      point: '63801',
      pointName: '神戸（魚崎）',
      alertArea: '兵庫県'
    },
    jma: {
      amedasPoint: '63477',
      forecastArea: '280000'
    },
    geo: { lat: 34.7137, lon: 135.2548 },
    timeZone: 'Asia/Tokyo',
    refreshMs: 300000,
    footSource: '出典：気象庁・環境省データ'
  };

  global.SignageConfig = cfg;

  global.SIGNAGE_CONFIG = {
    logoSrc: './hanshin_logo.png',
    logoAlt: 'ハンシン建設',
    logoPanelBg: '#3a3a3a'
  };
})(typeof window !== 'undefined' ? window : global);
