# 香川県立丸亀支援学校 WBGT サイネージ

4面（512×128）WBGT デジタルサイネージ。HTML 1本＋ロゴのみで動作します。

## フォルダごと GitHub にアップロードして OK

このフォルダは **そのまま丸ごと** GitHub に上げて問題ありません。

```
marugame_shienschool-project/
├── index.html          … 本体（必須）
├── assets/logo.png     … ロゴ（必須）
├── README.md
├── .gitignore
├── package.json        … 開発用（任意）
└── scripts/            … 確認用（任意）
```

- **`node_modules` は同梱していません**（約10MB削減・Pages 公開に不要）
- GitHub の **Add file → Upload files** でフォルダをドラッグ＆ドロップ可
- または `git push` でも可（`.gitignore` 済み）

> `.git` フォルダはローカル用です。GitHub ウェブから初回アップロードする場合は、中身だけ選んでもフォルダごと選んでも構いません。

## リポジトリ構成

```
.
├── index.html          … サイネージ本体（必須）
├── assets/
│   └── logo.png        … 学校ロゴ（必須）
├── scripts/            … 開発・確認用（任意）
│   ├── verify-t3-wave.mjs
│   └── make-logo-transparent.ps1
└── README.md
```

**GitHub Pages で公開するのに必要なのは `index.html` と `assets/logo.png` だけです。**

## 現場設定（index.html 内 SignageConfig）

| 項目 | 丸亀支援学校 |
|------|-------------|
| 学校名 | 香川県立丸亀支援学校 |
| 表示ラベル | 丸亀市 |
| WBGT・AMeDAS | 72111（多度津） |
| 天気予報 | 390000（香川県） |

## WBGT共通GAS

現場ごとに GAS を作る必要はありません。**共通 GAS 1本**に `point` パラメータで地点を渡します。

- **名称（運用）:** WBGT共通GAS（環境省WBGT・熱中症アラート 共通取得GAS）
- **URL:** `https://script.google.com/macros/s/AKfycbzSTsappgfJTaJruOBJsbnCXSTPkeTBp39CXpvoSZsPQ0mWGs4KjSonC8_eZ2b1EeUXTQ/exec`
- **丸亀の地点:** `point=72111`

気象庁データ（AMeDAS・予報など）は GAS 経由ではなく、ブラウザから気象庁 API を直接取得します。

## コンテンツの流れ

1. シーン1 … 時刻＋白帯（学校名・WBGT）
2. シーン2 … アメダス（気温・降水など）
3. シーン3 … 4日予報
4. シーン4 … WBGT（日本語）
5. シーン5 … WBGT予報  
→ （熱中症アラート発表時のみ）アラート → シーン1へ

## ローカル確認

Live Preview や簡易 HTTP サーバーで `index.html` を開きます。

```
http://127.0.0.1:3008/index.html
```

### シーン単体プレビュー

| URL | 内容 |
|-----|------|
| `?only=1` | シーン1 |
| `?only=2` | シーン2 |
| `?only=3` | シーン3（4日予報） |
| `?only=4` | シーン4（WBGT日本語） |
| `?only=5` | シーン5（WBGT予報） |
| `?only=4&level=4` | 厳重警戒デモ |
| `?only=4&level=5` | 危険デモ |

## GitHub Pages で公開

1. このフォルダを GitHub リポジトリに push
2. **Settings → Pages → Build and deployment**
3. **Source:** Deploy from a branch
4. **Branch:** `main` / **Folder:** `/ (root)`
5. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` で表示

## 初回 push の例

```bash
cd marugame_shienschool-project
git init
git add index.html assets/logo.png README.md .gitignore
git add scripts/
git commit -m "Add Marugame support school WBGT signage"
git branch -M main
git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
git push -u origin main
```

## 開発用スクリプト（任意）

Playwright が入っている場合:

```bash
npm install playwright
node scripts/verify-t3-wave.mjs
```

パトランプ表示（厳重警戒・危険）のクラス付与を自動確認します。
