// Firebase 網頁設定：從 Firebase 主控台「專案設定 → 一般 → 你的應用程式」複製過來。
// 這段本來就會公開在網頁上，不是密碼；誰能讀寫什麼，是由資料庫的安全規則（database.rules.json）決定。
// 要改回只用本機的 server.py，把 apiKey 改成空字串即可。
export const firebaseConfig = {
  apiKey: "AIzaSyBv3GiTUDg_2jPpuJYqDDcLJPJ9weNvPTs",
  authDomain: "chip-inspector.firebaseapp.com",
  databaseURL: "https://chip-inspector-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chip-inspector",
  storageBucket: "chip-inspector.firebasestorage.app",
  messagingSenderId: "193782417967",
  appId: "1:193782417967:web:87410132007166b62414da",
};
