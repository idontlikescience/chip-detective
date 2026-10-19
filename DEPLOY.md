# 晶片檢測站：放上網路的步驟

做完之後，老師開 `https://idontlikescience.github.io/chip-inspector/teacher.html` 投影，學生用平板掃 QR code 就能玩，不用開任何伺服器、不用跟電腦連同一個 Wi-Fi。

架構跟 nochip-day 一樣：

- **GitHub Pages**：放網頁檔案（免費）
- **Firebase Realtime Database**：在老師和學生的平板之間即時傳房間狀態和成績（免費方案，同時最多 100 個連線，一次一個班沒問題）

順序：**先做 Firebase、再上傳 GitHub**。因為上傳前要先把 Firebase 的設定填進 `firebase-config.js`。

---

## 一、Firebase（約 10 分鐘）

1. 打開 https://console.firebase.google.com ，用 Google 帳號登入，按「新增專案」。
   - 專案名稱：`chip-inspector`（或任何你喜歡的名字）
   - Google Analytics 可以關掉
2. **開啟匿名登入**：左邊選單「建構 → Authentication」→「開始使用」→「登入方式」分頁 →「匿名」→ 啟用 → 儲存。
3. **建立資料庫**：左邊選單「建構 → Realtime Database」→「建立資料庫」。
   - 位置選 **新加坡（asia-southeast1）**，離臺灣最近
   - 安全規則選「以鎖定模式啟動」
4. **貼上安全規則**：在 Realtime Database 頁面點「規則」分頁，把原本的內容全部刪掉，貼上這個資料夾裡 `database.rules.json` 的全部內容，按「發布」。
5. **取得網頁設定**：左上角齒輪「專案設定」→「一般」分頁，往下到「你的應用程式」，按網頁圖示 `</>`。
   - 應用程式暱稱：`chip-inspector`
   - 「同時為這個應用程式設定 Firebase Hosting」**不要勾**
   - 按「註冊應用程式」後，畫面會出現一段 `const firebaseConfig = { apiKey: ..., ... }`
6. **把那一段 `firebaseConfig` 貼給 Claude**（或自己貼進 `firebase-config.js`，取代裡面的空字串）。
   - 這段本來就會公開在網頁上，不是密碼，可以放心貼。
7. **加入授權網域**：「Authentication → 設定 → 授權網域」→「新增網域」→ 輸入 `idontlikescience.github.io`。

填好設定後，可以先在本機用真的 Firebase 試一次（`python3 server.py`，開 http://127.0.0.1:8776/teacher.html），確認排行榜會動，再上傳。

---

## 二、GitHub Pages（約 5 分鐘）

1. 打開 https://github.com/new
   - Repository name：`chip-inspector`
   - 選 **Public**（免費帳號的 GitHub Pages 要公開的 repo）
   - 其他都不用勾，按「Create repository」
2. 在新 repo 的頁面點「uploading an existing file」，把 `chip-inspector` 資料夾裡的**所有檔案和 `img` 資料夾**一起拖進去，按「Commit changes」。
   - 一定要有：`index.html`、`teacher.html`、`data.js`、`net.js`、`net-local.js`、`net-firebase.js`、`firebase-config.js`、`img/` 資料夾
   - 其他檔案（`server.py`、`HANDOVER.md`、`DEPLOY.md`、`database.rules.json`）一起放上去也沒關係，方便以後交接
3. 到 repo 的「Settings → Pages」：
   - Source 選「Deploy from a branch」
   - Branch 選 `main`、資料夾選 `/ (root)`，按「Save」
4. 等 1–2 分鐘，打開 https://idontlikescience.github.io/chip-inspector/teacher.html ，看到 QR code 就成功了。

---

## 三、上課前測一次

1. 電腦開老師控制台，用一台手機或平板掃 QR code 加入。
2. 按「開始」，點幾下，確認老師端排行榜的分數會跟著變。
3. 時間到後按「逐張公布答案」，確認點的位置和答案都會出現。

---

## 之後要改內容

- **在 GitHub 網頁上改**：打開檔案 → 右上角鉛筆圖示 → 改完按「Commit changes」，約 1 分鐘後上線。
- **改完一整批再上傳**：在本機改好、測好，再用「Add file → Upload files」把改過的檔案拖上去覆蓋。
- **不要在別人上課時改**，學生平板重新整理就會換成新版。
- 改計分上限、瑕疵數量時，要一起檢查 `database.rules.json` 的上限（分數 100000、每張點擊 999 下、每張瑕疵最多 10 個），規則改了要重新貼到 Firebase 主控台發布。
