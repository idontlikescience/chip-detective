// 資料庫入口：firebase-config.js 有填就用 Firebase，沒填就用本機 server.py。
// 兩邊的函式一模一樣：ready() 拿到自己的 uid；get / set / update / remove 讀寫某個路徑；watch 監看某個路徑。
import { firebaseConfig } from "./firebase-config.js";

// 網址加 ?local 可以強制用本機 server.py（例如還沒設定好 Firebase 規則時先測試）
const forceLocal = new URLSearchParams(location.search).has("local");
export const usingFirebase = !forceLocal && !!(firebaseConfig && firebaseConfig.apiKey);
const impl = usingFirebase
  ? await import("./db-firebase.js")
  : await import("./db-local.js");

export const { serverNow, ready, get, set, update, remove, watch } = impl;
