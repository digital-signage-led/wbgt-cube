# WBGTサイネージ文言変更プロンプト（汎用）

対象ファイル内の `multi`（短い表示：シーン1下帯・多言語）と
`T3_WBGT_GUIDE_TIERS`（シーン3下帯の詳細ガイド）を、下記方針・文言に更新してください。

会場名・ロゴ・観測地点コード・地域設定などの現場固有設定は変更しないこと。
文言データの差し替えのみ行うこと。

## 方針
- 「中止」という文言は使わない
- 「危険物」「保護具」「化学防護服」「防毒衣」など、特定業種向けの表現は使わない
- 一般向けの熱中症対策（休憩・水分・塩分補給・体調確認）に統一する
- 多言語キーは jp / en / id / fil / vn を維持する
- レイアウト・スクロール・シーン遷移など、文言以外は変更しない

## 短い表示文（multi）※確定文言

```javascript
const multi = [
  { jp:"【ほぼ安全】適宜水分補給", en:"Safe: Stay hydrated", id:"Aman: Minum air cukup", fil:"Halos ligtas: Uminom ng tubig", vn:"An toàn: Bổ sung nước" },
  { jp:"【注意】積極的に水分補給", en:"Caution: Actively hydrate", id:"Waspada: Minum air aktif", fil:"Babala: Uminom ng tubig", vn:"Chú ý: Uống nước thường xuyên" },
  { jp:"【警戒】定期的に休憩", en:"Warning: Take regular breaks", id:"Siaga: Istirahat rutin", fil:"Alerto: Magpahinga", vn:"Cảnh báo: Nghỉ ngơi định kỳ" },
  { jp:"【厳重警戒】こまめに休憩・体調確認", en:"Severe Warning: Stop intense work", id:"Waspada: Hentikan kerja berat", fil:"Malubha: Itigil ang trabaho", vn:"Cảnh báo nghiêm trọng: Ngừng làm việc nặng" },
  { jp:"【危険】休憩・水分塩分補給を徹底", en:"Danger: Stop work immediately", id:"Bahaya: Hentikan kerja", fil:"Panganib: Itigil ang trabaho", vn:"Nguy hiểm: Dừng công việc ngay" }
];
```

## 詳細ガイド（T3_WBGT_GUIDE_TIERS）※確定文言

```javascript
const T3_WBGT_GUIDE_TIERS = [
  { range: '35以上', color: '黒', title: '熱中症特別警戒アラート', guide: '記録的な暑さです。無理をせず、涼しい場所での休憩と水分・塩分補給を最優先にしてください。' },
  { range: '33以上', color: '紫', title: '熱中症警戒アラート', guide: '危険な暑さです。こまめな休憩と水分・塩分補給を徹底し、体調の変化に注意してください。' },
  { range: '31以上', color: '赤', title: '危険', guide: '熱中症の危険性が非常に高い状態です。休憩の間隔を短くし、水分・塩分補給と体調確認を徹底してください。' },
  { range: '28～31未満', color: '橙', title: '厳重警戒', guide: '炎天下を避け、10～20分おきに水分や塩分を補給してください。負荷の高い作業は控えめにしましょう。' },
  { range: '25～28未満', color: '黄', title: '警戒', guide: '積極的に休憩を取り、水分や塩分の補給してください。負荷の高い作業では30分おきに休憩を入れましょう。' },
  { range: '21～25未満', color: '水色', title: '注意', guide: '熱中症の兆候に注意し、こまめに水分や塩分を補給してください。' },
  { range: '21未満', color: '青', title: 'ほぼ安全', guide: '熱中症の危険性は低い状態です。引き続き水分や塩分の補給を心掛けましょう。' }
];
```

## 変更後チェック
- ファイル内に「中止」「危険物」が残っていないこと
- 会場名・観測地点・ロゴ・API設定など現場固有設定が変わっていないこと
- レイアウト・スクロール・シーン遷移など文言以外が変わっていないこと
