// 6 張晶片電路圖與瑕疵位置。
// 圖是同一張底圖做出來的（486 × 760，直式）。
// 第 1–5 張的瑕疵位置是拿每張圖跟第 6 張逐點比對、找出不一樣的地方定出來的。
// 第 6 張的瑕疵小到這張圖上看不到（要放大才看得到），老師公布答案時用放大圖揭曉。
// 座標是原圖像素。每個瑕疵由一或多段「膠囊」組成：[x1, y1, x2, y2, 半徑]，兩端點相同就是圓。
// 長條刮痕用線段沿著刮痕走，點在刮痕附近就算找到。半徑 24 在 iPad 上約等於手指寬。

export const CHIPS = [
  { w: 486, h: 760, defects: [
    [[274, 618, 485, 515, 20]],   // 右下的裂痕
    [[149, 248, 149, 248, 60]],   // 左上的暗色污漬
  ]},
  { w: 486, h: 760, defects: [
    [[34, 91, 251, 43, 20]],      // 上方很淡的長刮痕
    [[133, 596, 400, 286, 20]],   // 中間的長刮痕
    [[313, 729, 469, 578, 20]],   // 右下的刮痕
  ]},
  { w: 486, h: 760, defects: [
    [[130, 205, 130, 205, 24]],   // 左上很淡的透明殘留
    [[302, 516, 343, 505, 22]],   // 短刮痕
    [[400, 331, 400, 331, 24]],   // 白色顆粒
    [[62, 654, 62, 654, 24]],     // 左下小黑點
    [[438, 118, 438, 118, 24]],   // 右上小黑點
  ]},
  { w: 486, h: 760, defects: [
    [[117, 137, 117, 137, 30]],   // 灰塵（大）
    [[371, 452, 371, 452, 24]],   // 灰塵（中）
    [[232, 646, 232, 646, 24]],   // 灰塵（小）
  ]},
  { w: 486, h: 760, defects: [
    [[338, 656, 338, 656, 24]],   // 兩條線黏在一起
    [[259, 81, 259, 81, 24]],
    [[182, 592, 182, 592, 24]],
  ]},
  // 第 6 張：放大圖（img/chip6-zoom.png）是另外畫的特寫，不是從這張裁出來的，
  // 所以位置是挑一個跟特寫結構相同的地方：直線上、緊貼條紋帶上方。
  // 點擊範圍刻意不放寬，免得有人亂點剛好點中。
  { w: 486, h: 760,
    zoom: { x: 215, y: 277, img: "img/chip6-zoom.png", w: 486, h: 760, spot: { x: 206, y: 410, r: 38 } },
    defects: [
      [[215, 277, 215, 277, 12]],  // 小到看不到的灰塵
    ]},
];

export const TOTAL_DEFECTS = CHIPS.reduce((n, c) => n + c.defects.length, 0); // 17

export const PTS_RIGHT = 100;
export const PTS_WRONG = 30;
export const DEFAULT_SECONDS = 50;

// 點 (x, y) 落在第幾個瑕疵裡，沒有就回 -1
export function hitTest(chip, x, y) {
  const defs = CHIPS[chip].defects;
  for (let d = 0; d < defs.length; d++) {
    for (const [x1, y1, x2, y2, r] of defs[d]) {
      if (distToSeg(x, y, x1, y1, x2, y2) <= r) return d;
    }
  }
  return -1;
}

function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// 畫答案圈用：瑕疵的中心、半徑與旋轉角度（單段的刮痕沿著刮痕方向畫斜的橢圓）
export function defectCircle(segs) {
  if (segs.length === 1) {
    const [ax, ay, bx, by, r] = segs[0];
    const len = Math.hypot(bx - ax, by - ay);
    return { cx: (ax + bx) / 2, cy: (ay + by) / 2, rx: len / 2 + r, ry: r, rot: Math.atan2(by - ay, bx - ax) * 180 / Math.PI };
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [ax, ay, bx, by] of segs) {
    x0 = Math.min(x0, ax, bx); y0 = Math.min(y0, ay, by);
    x1 = Math.max(x1, ax, bx); y1 = Math.max(y1, ay, by);
  }
  const r = Math.max(...segs.map(s => s[4]));
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2 + r, ry: (y1 - y0) / 2 + r, rot: 0 };
}
