# 香川_㈱ヒカリ_NK / WBGT サイネージ 4面

## 現場
- 顧客: 株式会社ヒカリ
- 面数: 4面（512×128・ロゴ列なし）
- 会場: 〒763-0024 香川県丸亀市塩飽町48-1
- 画面表記: 丸亀市

## データ地点
| 項目 | 値 |
| --- | --- |
| 環境省 WBGT | `72111`（多度津） |
| 気象庁 AMeDAS | `72111`（多度津） |
| AMeDAS 補完 | `72086`（高松） |
| 天気予報 | `390000`（香川県） |
| 警報区域 | `390000` / 市 `3720200`（丸亀市） |
| 熱中症アラート | 香川県 |
| 環境省 region / prefecture | `09` / `72` |
| GAS | 共通（`moe.point` で地点切替） |

## ファイル
- `index-4face.html` … 本番 4面
- `assets/hikari_logo_foot.png` … 下帯ロゴ（シーン1白帯）
- `SIGNAGE_CONFIG.footBannerSrc` … `./assets/hikari_logo_foot.png?v=1`

## 確認
- PC: `index-4face.html` を localhost で開く（ブラウザ拡大表示）
- 端末相当: `?native640=1`
- 単体シーン: `?only=1`〜`5`
