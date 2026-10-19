// 晶片懸案：題目資料。所有圖都是 486 × 760（直式），座標是原圖像素。

export const W = 486, H = 760;

// 第 6 張（看起來正常，其實有一顆看不到的灰塵）：跟第一個遊戲同一張圖。
// zoom 是灰塵在第 6 張上的位置；spot 是灰塵在特寫圖（closeup.png）上的位置。
export const CHIP6 = { img: "img/standard.png", zoom: { x: 215, y: 277 }, closeup: "img/closeup.png",
  closeupStd: "img/closeup-standard.png", spot: { x: 206, y: 410, r: 38 } };

// 關卡二的 3 張新晶片：從第一個遊戲的瑕疵剪下來、貼到底圖其他位置組成的（瑕疵位置跟第一個遊戲不同）。
// 每個瑕疵是一或多段膠囊 [x1, y1, x2, y2, 半徑]。
export const CASE_CHIPS = [
  { img: "img/case-A.png", defects: [
    [[316, 205, 316, 205, 28]],
    [[139, 569, 98, 580, 20]],
  ]},
  { img: "img/case-B.png", defects: [
    [[252, 167, 40, 271, 20]],
    [[384, 644, 384, 644, 24]],
    [[166, 420, 166, 420, 24]],
  ]},
  { img: "img/case-C.png", defects: [
    [[189, 432, 33, 583, 20]],
    [[336, 256, 336, 256, 24]],
    [[240, 90, 240, 90, 24]],
  ]},
];
export const STANDARD = "img/standard.png";

export const FACTORY_PER_HOUR = 30000;   // 原簡報 p.20、p.29：工廠每小時檢查 3～4.5 萬顆
export const PHOTOS_PER_CHIP = 400;      // 遊戲設定：放大後一顆晶片要拍 400 張（20 × 20 格）

// 第一個遊戲每張晶片的瑕疵數（要跟 chip-inspector/data.js 一致）
export const GAME1_DEFECTS = [2, 3, 5, 3, 3, 1];

// 沒有第一個遊戲的資料時，用這組範例數據
export const SAMPLE_EVIDENCE = { source: "sample", n: 25, chip6Found: 0, notFinished: 14,
  notSeen: "0,1,3,6,11,14", avgSec: 9.6, seconds: 50 };

// 從第一個遊戲的房間資料（rooms/{代碼}）算出證物要用的數字
export function evidenceFromRoom(code, room) {
  const arr = v => v == null ? [] : Array.isArray(v) ? v.filter(x => x != null) : Object.values(v);
  const ps = Object.values(room.players || {}).filter(p => p.t > 0).map(p => {
    const chips = p.chips || {};
    return GAME1_DEFECTS.map((_, i) => ({ seen: (chips[i] || {}).seen || 0, hits: arr((chips[i] || {}).hits) }));
  });
  const n = ps.length;
  if (!n) return null;
  const notSeen = GAME1_DEFECTS.map((_, i) => ps.filter(c => c[i].seen < 1000).length);
  let secSum = 0, views = 0;
  for (const c of ps) for (const x of c) if (x.seen >= 1000) { secSum += x.seen / 1000; views++; }
  return {
    source: code, n,
    chip6Found: ps.filter(c => c[5].hits.length).length,
    notFinished: ps.filter(c => c.some(x => x.seen < 1000)).length,
    notSeen: notSeen.join(","),
    avgSec: views ? Math.round(secSum / views * 10) / 10 : 0,
    seconds: (room.meta && room.meta.seconds) || 50,
  };
}

export function hitTest(defects, x, y) {
  for (let d = 0; d < defects.length; d++) {
    for (const [x1, y1, x2, y2, r] of defects[d]) {
      const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2)) : 0;
      if (Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= r) return d;
    }
  }
  return -1;
}

export function defectCircle(segs) {
  if (segs.length === 1) {
    const [ax, ay, bx, by, r] = segs[0];
    return { cx: (ax + bx) / 2, cy: (ay + by) / 2, rx: Math.hypot(bx - ax, by - ay) / 2 + r, ry: r,
      rot: Math.atan2(by - ay, bx - ax) * 180 / Math.PI };
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [ax, ay, bx, by] of segs) { x0 = Math.min(x0, ax, bx); y0 = Math.min(y0, ay, by); x1 = Math.max(x1, ax, bx); y1 = Math.max(y1, ay, by); }
  const r = Math.max(...segs.map(s => s[4]));
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2 + r, ry: (y1 - y0) / 2 + r, rot: 0 };
}

// ── 各關的文字 ──
export const STAGES = ["案件", "線索一", "線索二", "線索三", "結案"];

export const CAUSES = [
  { id: "small", text: "瑕疵太小，眼睛看不到" },
  { id: "many", text: "晶片太多，人看太慢又會累" },
  { id: "light", text: "檢測的時候燈光太暗" },
  { id: "lazy", text: "大家不夠認真" },
];

export const HINTS = [
  ["先點開每一份證物讀一讀，想想它在說「看不到」還是「看不完」。",
   "第 6 張大家都看了卻沒人找到；後面幾張則是很多人根本沒看到。這是兩種不同的原因。"],
  ["想想看，你用手機拍到很小的字之後，會怎麼做？",
   "哪一個工具能讓看不到的東西變得看得到，還能把畫面留下來？"],
  ["玩「大家來找碴」的時候，有原圖跟沒原圖，差在哪裡？",
   "晶片的電路是做的時候隨便長出來的，還是事先設計好的？比對時可以按住「閃一下」。"],
  ["電腦要找出不一樣的地方，至少需要哪兩張圖？",
   "電腦能比對的，只有照片裡拍得到的東西。第 6 張的灰塵，要用什麼照片才拍得到？"],
  ["每一步都需要前一步給它東西：電腦要比對，得先有什麼？",
   "瑕疵如果被下一層蓋住就修不好了。要在什麼時候檢查？"],
];
