# WBGTサイネージ：日本標準時（JST）の時計を確実にする

## 目的
シーン1の時計・日付・スケジュール取得時刻を、常に日本標準時（Asia/Tokyo）にする。
端末のタイムゾーンが UTC や海外でも、表示は JST にすること。

## 実装方針
1. 表示は必ず timeZone: 'Asia/Tokyo'（Intl / jstPartsFromMs）で組み立てる。hourCycle: 'h23'。
2. ネット時刻同期の優先順は次とすること（NICT HTTP JSON は廃止・404のため先頭にしない）:
   Cloudflare cdn-cgi/trace → timeapi.io(Asia/Tokyo) → worldtimeapi → NICT（あれば）
3. dateTime にタイムゾーンがない場合は、必ず +09:00 として UTC に変換すること。
4. デモモード（demo=1）でも起動時と定期で syncTimeFromNetwork を行うこと。
5. 同期失敗時のみ Date.now() フォールバック。その場合も表示は Asia/Tokyo。
6. 文言・レイアウト・シーン遷移など、時計以外は変更しないこと。

## 確認
- シーン1の時刻が実時計（日本）とほぼ一致すること
- ブラウザのタイムゾーンを UTC にしても JST 表示になること
