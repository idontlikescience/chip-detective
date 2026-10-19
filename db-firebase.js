// 資料庫（Firebase 版）：放上 GitHub Pages 用。跟第一個遊戲（晶片檢測站）用同一個 Firebase 專案。
// 匿名登入分辨身分；誰能讀寫什麼由 database.rules.json 決定。
import { firebaseConfig } from "./firebase-config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
const [{ initializeApp }, A, D] = await Promise.all([
  import(SDK + "firebase-app.js"),
  import(SDK + "firebase-auth.js"),
  import(SDK + "firebase-database.js"),
]);
const app = initializeApp(firebaseConfig);
const db = D.getDatabase(app);
const login = A.signInAnonymously(A.getAuth(app)).then(r => r.user.uid);

let offset = 0;
D.onValue(D.ref(db, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });
export const serverNow = () => Date.now() + offset;

export const ready = () => login;
export const get = async path => { await login; return (await D.get(D.ref(db, path))).val(); };
export const set = async (path, value) => { await login; await D.set(D.ref(db, path), value); };
export const update = async (path, value) => { await login; await D.update(D.ref(db, path), value); };
export const remove = async path => { await login; await D.remove(D.ref(db, path)); };

export function watch(path, cb) {
  let stop = null, dead = false;
  login.then(() => {
    if (!dead) stop = D.onValue(D.ref(db, path), s => cb(s.val()), e => console.warn(e));
  });
  return () => { dead = true; stop && stop(); };
}
