# 環境省 WBGT GAS プロキシ（大阪市）

| 地点番号 | 地点名 | 予測 CSV |
|----------|--------|----------|
| 62078 | 大阪市 | yohou_osaka.csv |

## デプロイ済み URL

`index.html` の `DEFAULT_MOE_GAS_URL` に設定済み:

https://script.google.com/macros/s/AKfycbxB489LuGmC6APmtnJIXhBzWaO8TqI1xf2XBGPyODwia78K78HDKWd3vJjBvTIm3iLCOA/exec

`?point=62078` はクライアント側で自動付与されます。GAS 失敗時は環境省 CSV にフォールバックします。

## 再デプロイ時

1. `gas_wbgt_moe_proxy.gs` を Google Apps Script で更新
2. 「デプロイ」→「新しいデプロイ」→ ウェブアプリ → アクセス「全員」
3. 新しい URL を `index.html` の `DEFAULT_MOE_GAS_URL` に反映
