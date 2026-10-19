// 資料庫（本機版）：跟 server.py 講話，用輪詢模仿 Firebase 的即時更新。firebase-config.js 沒填時使用。

let offset = 0;
export const serverNow = () => Date.now() + offset;

async function call(body) {
  const t0 = Date.now();
  const res = await fetch(body ? "/api/db" : "", body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : undefined);
  const data = await res.json();
  if (data.now) offset = data.now - (t0 + Date.now()) / 2;
  if (!res.ok) throw new Error(data.error || res.status);
  return data;
}
async function read(path) {
  const t0 = Date.now();
  const res = await fetch("/api/db?path=" + encodeURIComponent(path), { cache: "no-store" });
  const data = await res.json();
  if (data.now) offset = data.now - (t0 + Date.now()) / 2;
  return data.value ?? null;
}

// 本機版沒有登入：每個瀏覽器自己產生一個 id，存在 localStorage
let uid = null;
try { uid = localStorage.getItem("cd-local-uid"); } catch (e) {}
if (!uid) { uid = Math.random().toString(36).slice(2, 12); try { localStorage.setItem("cd-local-uid", uid); } catch (e) {} }

export const ready = async () => uid;
export const get = path => read(path);
export const set = (path, value) => call({ op: "set", path, value });
export const update = (path, value) => call({ op: "update", path, value });
export const remove = path => call({ op: "remove", path });

export function watch(path, cb) {
  let alive = true, last, timer = 0;
  const tick = async () => {
    try {
      const v = await read(path), s = JSON.stringify(v);
      if (s !== last) { last = s; cb(v); }
    } catch (e) { console.warn(e); }
    if (alive) timer = setTimeout(tick, 700);
  };
  tick();
  return () => { alive = false; clearTimeout(timer); };
}
