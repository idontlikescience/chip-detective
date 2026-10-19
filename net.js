// 連線層入口：firebase-config.js 有填設定就用 Firebase（放上 GitHub Pages 用），
// 沒填就用本機的 server.py（自己測試用）。兩邊的函式介面一模一樣，網頁其他地方不用管是哪一個。
import { firebaseConfig } from "./firebase-config.js";

const impl = firebaseConfig && firebaseConfig.apiKey
  ? await import("./net-firebase.js")
  : await import("./net-local.js");

export const {
  serverNow, info, createRoom, setState, kick, fetchRoom, watchRoom,
  join, pushMe, fetchMe, watchMeta,
} = impl;
