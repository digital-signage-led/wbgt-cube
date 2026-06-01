# 汎用 WBGT GAS（全現場共通）

`Code.gs` を **1 回だけ** Google Apps Script にデプロイし、各現場は `signage-config.js` だけ差し替えます。

## デプロイ

1. [script.google.com](https://script.google.com) で新規プロジェクト
2. `Code.gs` を貼り付けて保存
3. **デプロイ** → **新しいデプロイ** → 種類 **ウェブアプリ**
4. 実行ユーザー: 自分 / アクセス: **全員**
5. 表示された `.../exec` を `signage-config.js` の `moe.gasUrl` に設定

## API（クエリパラメータ）

| 用途 | URL 例 |
|------|--------|
| WBGT 実況 | `?point=63801` |
| 表示名の上書き | `?point=63801&pointName=神戸（魚崎）` |
| 熱中症アラート | `?type=alert&point=63801&alertArea=兵庫県` |
| 大雨警報 | `?type=rainwarn&area=280000&city=2810000` |

- **point** … 環境省 [est15WG](https://www.wbgt.env.go.jp/est15WG/) の **5 桁地点コード**（必須）
- **pointName** … 省略時は CSV 1 行目の地点名、なければコードそのまま
- **alertArea** … アラート CSV の都道府県列（例: `兵庫県` `大阪府` `東京地方`）
- **area / city** … 気象庁 bosai の予報区域・市町村コード（WBGT の point とは別）

## 現場設定（signage-config.js）

```javascript
moe: {
  gasUrl: 'https://script.google.com/macros/s/…/exec',
  point: '63801',           // 環境省 WBGT
  pointName: '神戸（魚崎）', // 任意
  alertArea: '兵庫県'       // alert 利用時
},
jma: {
  amedasPoint: '63477',     // 気象庁 AMeDAS（WBGT と別番号）
  forecastArea: '280000'    // 兵庫県
}
```

地点コードは環境省サイトの地点一覧、気象庁は [アメダス](https://www.jma.go.jp/bosai/amedas/) で確認してください。

## 注意

- 環境省 WBGT と気象庁 AMeDAS は **番号体系が異なります**（同じ 5 桁を流用しない）。
- WBGT は提供期間外（冬など）は `source: "off-season"` を返します。
- 無効な `point` は `source: "error"` になります。
