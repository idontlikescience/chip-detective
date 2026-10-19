// 連線層（本機版）：跟 server.py 講話。firebase-config.js 沒填時使用。

let offset = 0; // 伺服器時間 − 這台機器的時間
export const serverNow = () => Date.now() + offset;

async function call(path, body) {
  const t0 = Date.now();
  const res = await fetch("/api/" + path, body === undefined ? { cache: "no-store" } : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.now) offset = data.now - (t0 + Date.now()) / 2;
  if (!res.ok) { const e = new Error(data.error || res.status); e.code = data.error; throw e; }
  return data;
}

// 一直輪詢，直到呼叫回傳的 stop()
function poll(fn, ms) {
  let alive = true, timer = 0;
  const tick = async () => {
    try { await fn(); } catch (e) { if (e.code === "no-room") return; console.warn(e); }
    if (alive) timer = setTimeout(tick, ms);
  };
  tick();
  return () => { alive = false; clearTimeout(timer); };
}

// ── 老師端 ──
export const info = () => call("info");
export const createRoom = seconds => call("rooms", { seconds });
export const setState = (code, key, state, extra = {}) => call(`rooms/${code}/state`, { key, state, ...extra });
export const kick = (code, key, uid) => call(`rooms/${code}/kick`, { key, uid });
export const fetchRoom = (code, key, taps = false) => call(`rooms/${code}?key=${key}${taps ? "&taps=1" : ""}`);
export function watchRoom(code, key, cb, onGone) {
  return poll(async () => {
    try { cb(await fetchRoom(code, key)); }
    catch (e) { if (e.code === "no-room") onGone && onGone(); throw e; }
  }, 800);
}

// ── 學生端 ──
export const join = (code, name) => call(`rooms/${code}/join`, { name });
export const pushMe = (code, uid, token, data) => call(`rooms/${code}/me`, { uid, token, data });
export const fetchMe = (code, uid, token) => call(`rooms/${code}?uid=${uid}&token=${token}`);
// getMe() 回傳目前的 { uid, token }（還沒加入就是 null）；cb 第二個參數是這次查詢用的 uid
export function watchMeta(code, getMe, cb, onGone) {
  return poll(async () => {
    const me = getMe();
    try { cb(await fetchMe(code, me ? me.uid : "", me ? me.token : ""), me && me.uid); }
    catch (e) { if (e.code === "no-room") onGone && onGone(); throw e; }
  }, 1000);
}
