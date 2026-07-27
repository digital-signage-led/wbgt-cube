# コンテンツ開始地点プロンプト（4面 512×128）

新しいチャットに、ベースとなる4面 HTML（例: `index-4face.html`）を添付したうえで、下のプロンプトを貼る。  
このプロンプトは **コンテンツが始まる地点（`SignageConfig` → `content-area`）から現場差し替えを行う** ときの正とする。

---

## コンテンツが始まる地点（ファイル上の目印）

| 順 | 目印 | 役割 |
|----|------|------|
| 1 | `/* 現場ごとの設定` | `SignageConfig` / `SIGNAGE_CONFIG`（顧客・地点・ロゴ） |
| 2 | `<div class="content-area">` | 表示コンテンツ本体（シーン1〜）の開始 |

**ここより上**（`<head>`・layout512 CSS・native640 切替）は原則いじらない。  
**ここから下**の現場固有値・ロゴパス・表示地名を差し替える。

---

## コピー用プロンプト

```text
あなたは WBGT キューブサイネージ（本番 4面 512×128・ロゴ列なし）の現場差し替え担当です。

【作業の開始地点】
添付 HTML のうち、次の「コンテンツ開始地点」から作業する。
1. `/* 現場ごとの設定` ブロック内の SignageConfig / SIGNAGE_CONFIG
2. 直後の `<div class="content-area">` 以降に出る表示用地名ラベル・下帯ロゴ img src

`<head>`・layout512/native640・シーン構成・スクロール・色ロジックは変更しない。

【この案件の確定情報（東京_五洋建設_カナモト）】
- 面数: 4面（512×128・ロゴ列なし）
- 顧客: 五洋建設
- 住所: 〒142-0051 東京都品川区平塚３-９-１
- 画面の現地表示（locationLabel / s2-loc）: 品川区
- WBGT・AMeDAS 主地点: 44132（東京）
- AMeDAS 補完: 44136
- 予報区域 / 警報区域: 130000（東京都）
- 警報市区: 1310900（品川区）
- 座標: lat 35.6148 / lon 139.7113
- 熱中症アラート地域: 東京都
- moe.region: 04 / moe.prefecture: 13
- GAS: 既存共通 URL を維持（差し替えない）
- ロゴ:
  - 下帯バナー: ./assets/goyo_logo_foot.png
  - マーク: ./assets/goyo_logo_mark.png

【やること】
1. HTML 先頭コメント・title・preload を本案件名に合わせる
2. SignageConfig.site / moe / jma / geo を上記に合わせる
3. SIGNAGE_CONFIG の logoSrc / footLogoSrc / footBannerSrc / logoAlt を上記ロゴに合わせる
4. content-area 内の固定テキスト（s2-loc、ra-white-area 初期文言、下帯 img の src/alt など）を本案件に合わせる
5. JS 内のフォールバック既定値（moePoint / jmaPoint / warnCity / locationLabel / prefKey / geo など）も同じ値に揃える
6. 旧現場名（例: 東亜建設・安八町・岐阜・旧地点コード）が残っていないか検索して除去する

【やらないこと】
- シーン順・スクロール速度・アニメーションの変更
- WBGT 色・文言（multi / T3_WBGT_GUIDE_TIERS）の変更
- 5面化やロゴ列の復活（本案件は 4面・ロゴなし）
- GAS URL の差し替え（共通のまま）

【完了条件】
- SignageConfig とフォールバック既定値が一致している
- 画面表示地名が「品川区」
- 下帯に五洋建設ロゴが出るパスになっている
- 旧現場名・旧地点コードがファイル内に残っていない
```

---

## 新規現場へ流用するとき

上のプロンプトの【この案件の確定情報】だけを差し替えて使う。最低限そろえる項目:

1. 顧客名（customer / label / logoAlt）
2. 住所（address）と表示地名（locationLabel）
3. moe.point / jma.amedasPoint（と必要なら fallback / supplement）
4. forecastArea / warnArea / warnCity
5. geo（lat / lon）
6. assets ロゴファイル名と SIGNAGE_CONFIG のパス

---

## ローカル確認

```text
index-4face.html
index-4face.html?demo=1
index-4face.html?only=1
```

localhost ではブラウザ確認用に拡大表示される（本番は `native640=1`）。
