# GAS（江南市サイネージ）

## 結論

**新しい GAS を作る必要はありません。**  
`index.html` の `SignageConfig.moe.gasUrl` に設定済みの **ハンシン建設共通プロキシ** をそのまま使います。

現場ごとの違いは GAS 側ではなく、**HTML から渡す URL パラメータ**（`point`・`alertArea`・`region` など）で切り替えます。

## 本番で GAS に渡る例（自動付与）

サイネージが実際に叩く URL のイメージ:

```
https://script.google.com/macros/s/AKfycbzSTsappgfJTaJruOBJsbnCXSTPkeTBp39CXpvoSZsPQ0mWGs4KjSonC8_eZ2b1EeUXTQ/exec
  ?point=51106
  &pointName=名古屋
  &region=07
  &prefecture=62
  &alertArea=愛知県
  &type=bundle
```

| パラメータ | 江南市現場の値 |
|------------|----------------|
| `point` | `51106`（名古屋・環境省 WBGT） |
| `alertArea` | `愛知県` |
| `region` / `prefecture` | `07` / `62`（東海・愛知） |
| `type` | `bundle`（WBGT＋熱中症アラートを1回で取得） |

大雨警報を GAS 経由で試す場合（本番 HTML は `NO_JMA_WARN` で非表示）:

```
?type=rainwarn&area=230000&city=2321700
```

## 気象庁データについて

**アメダス・天気予報・ナウキャストは GAS を使いません。** ブラウザが気象庁 API を直接取得します（`jma.amedasPoint: 51106`、`forecastArea: 230000` など）。

## 共通 GAS のソース

実体は `hannshinn_project/gas/Code.gs`（汎用・全現場共通）です。  
江南市用に `51106` の表示名・愛知県アラート・環境省サイト用コードを追記済みです。

## 別 URL が必要なときだけ

自社 Google アカウントでプロキシを分けたい場合のみ:

1. `hannshinn_project/gas/Code.gs` を Apps Script 新規プロジェクトに貼り付け
2. **デプロイ → ウェブアプリ**（実行: 自分、アクセス: **全員**）
3. 発行された `.../exec` を `index.html` の `moe.gasUrl` に書き換え

デプロイ後、ブラウザで次を開き JSON が返れば OK:

```
<exec>?type=bundle&point=51106&alertArea=愛知県&region=07&prefecture=62&pointName=名古屋
```
