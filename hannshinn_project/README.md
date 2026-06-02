# ハンシン建設 WBGT サイネージ（神戸市）

## フォルダ構成（LED 本番）

```
hannshinn_project/
├── signage-4/
│   └── index.html          ← 4面 512×128（このフォルダに .html はこれだけ）
├── signage-5/
│   ├── index.html          ← 5面 640×128（このフォルダに .html はこれだけ）
│   └── hanshin_logo.png
└── gas/
    └── Code.gs             ← Apps Script にデプロイ
```

**同じフォルダに複数の `.html` を置かないでください**（パス・ブックマークの不整合の原因になります）。

## LED に登録する URL

| 面数 | パス（例） |
|------|------------|
| **4面** | `…/signage-4/index.html` |
| **5面** | `…/signage-5/index.html` |

GitHub Pages 例:  
`https://ユーザー.github.io/リポジトリ/signage-4/index.html`

## 設定の変更

`signage-4/index.html` と `signage-5/index.html` 内の **`SignageConfig`**（`<body>` 直後の `<script>`）を編集します。

- `moe.gasUrl` … GAS デプロイ後の `.../exec`
- `moe.point` / `fallbackPoint` / `jma` / `geo` … 現場

両面で同じ設定にする場合は、**両方の index.html を同じ内容に**してください。

## GAS

1. `gas/Code.gs` を Apps Script に貼り付け
2. ウェブアプリとしてデプロイ（アクセス: 全員）
3. 各 `index.html` の `moe.gasUrl` を更新

## デモ

- `signage-4/index.html?demo=1&level=2`
- `signage-4/index.html?rain=approaching`
