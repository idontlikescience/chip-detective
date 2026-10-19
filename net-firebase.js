// 連線層（Firebase 版）：放上 GitHub Pages 時用。函式介面跟 net-local.js 一模一樣。
// 資料結構：
//   rooms/{4 位數代碼}/meta            owner（開房老師的 uid）、state（lobby / playing / ended）、
//                                     created、seconds、startedAt、endsAt
//   rooms/{代碼}/players/{學生 uid}    name、score、found、wrong、t、chips（每張：seen、hits、taps）
// 學生和老師都用匿名登入分辨身分；誰能寫什麼由 database.rules.json 決定。
import { firebaseConfig } from "./firebase-config.js";
import { CHIPS } from "./data.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const [{ initializeApp }, A, D] = await Promise.all([
  import(SDK + "firebase-app.js"),
  import(SDK + "firebase-auth.js"),
  import(SDK + "firebase-database.js"),
]);
const app = initializeApp(firebaseConfig);
const db = D.getDatabase(app);
let user = null;
const ready = A.signInAnonymously(A.getAuth(app)).then(r => (user = r.user));

let offset = 0; // 伺服器時間 − 這台機器的時間
D.onValue(D.ref(db, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });
export const serverNow = () => Date.now() + offset;

const STALE = 12 * 60 * 60 * 1000; // 開房超過 12 小時的房間代碼可以被新房間拿去用
const MAX_PLAYERS = 80;
const ref = path => D.ref(db, path);
function fail(code) { const e = new Error(code); e.code = code; throw e; }

// Firebase 不存空陣列，陣列也可能變成 {0:…, 1:…}，讀回來統一整理成跟本機版一樣的形狀
const arr = v => v == null ? [] : Array.isArray(v) ? v.filter(x => x != null) : Object.values(v);
function normPlayer(p) {
  const chips = p.chips || {};
  return {
    name: p.name, score: p.score || 0, found: p.found || 0, wrong: p.wrong || 0, t: p.t || 0,
    chips: CHIPS.map((_, i) => {
      const c = chips[i] || {};
      return { seen: c.seen || 0, hits: arr(c.hits), taps: arr(c.taps).map(arr) };
    }),
  };
}
const normPlayers = ps => Object.fromEntries(Object.entries(ps || {}).map(([u, p]) => [u, normPlayer(p)]));

// ── 老師端 ──
export const info = async () => ({ lan: null });

export async function createRoom(seconds) {
  await ready;
  for (let k = 0; k < 40; k++) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    const old = (await D.get(ref(`rooms/${code}/meta`))).val();
    if (old && serverNow() - (old.created || 0) < STALE) continue;
    await D.set(ref(`rooms/${code}`), {
      meta: { owner: user.uid, state: "lobby", created: Math.round(serverNow()), seconds, startedAt: 0, endsAt: 0 },
    });
    return { code, key: user.uid };
  }
  fail("no-code");
}

export async function fetchRoom(code, key) {
  await ready;
  const v = (await D.get(ref(`rooms/${code}`))).val();
  if (!v || !v.meta) fail("no-room");
  if (key && v.meta.owner !== user.uid) fail("no-room"); // 別人的房間（或換了瀏覽器）：開新房
  return { meta: v.meta, players: normPlayers(v.players) };
}

export function watchRoom(code, key, cb, onGone) {
  let stop = null, dead = false;
  ready.then(() => {
    if (dead) return;
    stop = D.onValue(ref(`rooms/${code}`), s => {
      const v = s.val();
      if (!v || !v.meta) { onGone && onGone(); return; }
      cb({ meta: v.meta, players: normPlayers(v.players) });
    }, e => console.warn(e));
  });
  return () => { dead = true; stop && stop(); };
}

export async function setState(code, key, state, extra = {}) {
  await ready;
  const meta = (await D.get(ref(`rooms/${code}/meta`))).val();
  if (!meta) fail("no-room");
  const now = Math.round(serverNow());
  const up = { "meta/state": state };
  const secs = extra.seconds ? Math.max(10, Math.min(600, extra.seconds)) : meta.seconds;
  if (extra.seconds) up["meta/seconds"] = secs;
  if (state === "playing") {
    up["meta/startedAt"] = now;
    up["meta/endsAt"] = now + secs * 1000;
  } else if (state === "ended") {
    up["meta/endsAt"] = Math.min(meta.endsAt || now, now);
  } else if (state === "lobby") { // 同一個房間重玩：清掉成績，名單保留
    Object.assign(up, { "meta/startedAt": 0, "meta/endsAt": 0, "meta/created": now });
    const ps = (await D.get(ref(`rooms/${code}/players`))).val() || {};
    for (const uid in ps) Object.assign(up, {
      [`players/${uid}/score`]: 0, [`players/${uid}/found`]: 0, [`players/${uid}/wrong`]: 0,
      [`players/${uid}/t`]: 0, [`players/${uid}/chips`]: null,
    });
  }
  await D.update(ref(`rooms/${code}`), up);
  return { meta: { ...meta, ...Object.fromEntries(Object.entries(up).filter(([k]) => k.startsWith("meta/")).map(([k, v]) => [k.slice(5), v])) } };
}

export const kick = async (code, key, uid) => { await ready; await D.remove(ref(`rooms/${code}/players/${uid}`)); };

// ── 學生端 ──
export async function join(code, name) {
  await ready;
  const v = (await D.get(ref(`rooms/${code}`))).val();
  if (!v || !v.meta) fail("no-room");
  const ps = v.players || {};
  if (Object.keys(ps).length >= MAX_PLAYERS && !ps[user.uid]) fail("full");
  await D.set(ref(`rooms/${code}/players/${user.uid}`), { name, score: 0, found: 0, wrong: 0, t: 0 });
  return { uid: user.uid, token: "", meta: v.meta };
}

export async function pushMe(code, uid, token, data) {
  await ready;
  await D.update(ref(`rooms/${code}/players/${user.uid}`), {
    score: data.score, found: data.found, wrong: data.wrong,
    chips: data.chips.map(c => ({ seen: Math.round(c.seen), hits: c.hits, taps: c.taps })),
    t: D.serverTimestamp(),
  });
  return { ok: true };
}

export async function fetchMe(code, uid) {
  await ready;
  const meta = (await D.get(ref(`rooms/${code}/meta`))).val();
  if (!meta) fail("no-room");
  const p = uid === user.uid ? (await D.get(ref(`rooms/${code}/players/${uid}`))).val() : null;
  return { meta, me: p ? normPlayer(p) : undefined };
}

// getMe() 回傳目前的 { uid, token }（還沒加入就是 null）；cb 第二個參數是這次查詢用的 uid
export function watchMeta(code, getMe, cb, onGone) {
  let meta = null, mine = null, gotMeta = false, gotMine = false, dead = false;
  const stops = [];
  const emit = () => {
    if (!gotMeta || !gotMine || !meta) return;
    const m = getMe();
    cb({ meta, me: m && m.uid === user.uid && mine ? mine : undefined }, m && m.uid);
  };
  ready.then(() => {
    if (dead) return;
    stops.push(D.onValue(ref(`rooms/${code}/meta`), s => {
      meta = s.val(); gotMeta = true;
      if (!meta) { onGone && onGone(); return; }
      emit();
    }, e => console.warn(e)));
    stops.push(D.onValue(ref(`rooms/${code}/players/${user.uid}`), s => {
      mine = s.val() ? normPlayer(s.val()) : null; gotMine = true;
      emit();
    }, e => console.warn(e)));
  });
  return () => { dead = true; stops.forEach(f => f()); };
}
