# WBGTサイネージ：長期グレー／「取得不可」を防ぐ

## 症状
しばらく動かすと画面全体が灰色になり、「取得不可」表示のまま戻らない。
（WBGT取得失敗や誤った off-season 応答のあと、直前の正常表示を捨ててしまう）

## 目的
一度でも WBGT の成功値（lastGoodWbgtSlots_）があれば、その後の取得失敗でも
灰色の「取得不可」や提供期間外グレーに落とさない。直前の成功値・色レベルを維持し、
裏では再取得を継続する。

文言・レイアウト・シーン遷移など、WBGT 失敗時の表示維持以外は変更しない。

## 実装内容（必須）

### 1. keepLastGoodWbgtDisplay_(reason) を追加
- lastGoodWbgtSlots_ が hasFull4Slots なら:
  - wbgtUnavailable = false
  - syncWbgtLevelFromSlots(lastGoodWbgtSlots_)
  - updateForecastSlotsIfAllowed_(lastGoodWbgtSlots_)（関数が無ければ updateForecastSlots）
  - 下帯・背景の再描画（queueOrRefreshS1FootBar_ / refreshSignageBgIfChanged_ / queueDisplayRefresh_ など既存API）
  - true を返す
- 無ければ false

### 2. applyWbgtUnavailableToDom_ を変更
- グレース経過後でも、keepLastGoodWbgtDisplay_('取得継続失敗') が true なら return（取得不可にしない）
- 成功値が一度も無いときだけ従来どおり wbgtUnavailable = true と「取得不可」スロット表示

### 3. applyWbgtSlotsToDom の失敗分岐を変更
- スロット不正／null 時:
  1) keepLastGoodWbgtDisplay_('取得失敗') が true → noteWbgtFetchFailure_() して return false（灰色にしない）
  2) それ以外で grace 超過 → applyWbgtUnavailableToDom_()
- 「1分以内だけ維持」の古い分岐は、上記に置き換え（成功値がある限り時間無制限で維持）

### 4. applyWbgtOffSeason_ を変更
- lastGood がある場合は applyWbgtOffSeason_ で灰色にしない
  - applyWbgtInSeason_() + keepLastGoodWbgtDisplay_('off-season応答') して return
- lastGood が無いときだけ従来の off-season（灰色・WBGT非表示）

### 5. 取得 catch でも維持
runScheduledFetch（または同等）の WBGT 取得 catch 内で:
```js
console.warn('[取得] WBGT系:', e.message || e);
applyWbgtSlotsToDom(null);  // 直前値維持パスを通す
moeOk = false;
```

## 本案件の状態（index-4face.html）
- 上記 1〜5 すべて実装済み
- 「取得不可」灰色は、一度も成功値が無い起動直後の長期失敗時のみ
