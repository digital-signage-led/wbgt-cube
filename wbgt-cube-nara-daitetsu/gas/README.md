# WBGT GAS プロキシ（環境省 CSV）— 奈良市・大鉄用

親フォルダ: `wbgt-cube-nara-daitetsu`

## ファイル

- `gas_wbgt_moe_proxy.gs` … 地点 64036（奈良市）向け Web App 用スクリプト

## 対応地点

| point | 地点名 | 予測CSV |
|-------|--------|---------|
| 64036 | 奈良市 | yohou_nara.csv |

※ `wbgt-cube-nara-daitetsu/nara_daitetsu/daitetsu_index.html` は GAS を優先し、失敗時は環境省 CSV（64036）にフォールバックします。

## デプロイ手順（任意・GAS を使う場合）

1. [Google Apps Script](https://script.google.com/) で新規プロジェクトを開く
2. `gas_wbgt_moe_proxy.gs` の内容を `Code.gs` に貼り付け
3. **デプロイ** → **新しいデプロイ** → 種類 **ウェブアプリ**
4. 次の設定で公開
   - 実行ユーザー: **自分**
   - アクセスできるユーザー: **全員**
5. 表示された **ウェブアプリ URL**（`.../exec`）を `nara_daitetsu/daitetsu_index.html` の `DEFAULT_MOE_GAS_URL` に設定

## 動作確認

```
https://（デプロイURL）/exec?point=64036
```

`pointName` が **奈良市**、`data[0].wbgt` に数値が入れば OK。
