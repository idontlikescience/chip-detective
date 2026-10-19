# 晶片懸案：放上網路的步驟

跟晶片檢測站共用同一個 Firebase 專案（`chip-inspector`），所以 Firebase 不用重建，只要**更新安全規則**。網頁放到你 GitHub 的新 repo `chip-detective`。

## 一、更新 Firebase 安全規則（約 2 分鐘）

1. 打開 https://console.firebase.google.com ，進入 `chip-inspector` 專案。
2. 左邊「建構 → Realtime Database」→「規則」分頁。
3. 把框裡原本的內容**全部刪掉**，貼上這個資料夾裡 `database.rules.json` 的全部內容，按「發布」。

這份規則同時包含兩個遊戲（`rooms` 是晶片檢測站、`cases` 是晶片懸案），所以晶片檢測站不受影響。

## 二、上傳到 GitHub（約 5 分鐘）

1. 打開 https://github.com/new ，名稱填 `chip-detective`，選 **Public**，按「Create repository」。
2. 點「uploading an existing file」，打開 Finder 的 `下載項目/chip-detective` 資料夾，⌘A 全選，把所有檔案和 `img` 資料夾一起拖進去（用 Chrome 或 Edge），按「Commit changes」。
3. 「Settings → Pages」：Source 選「Deploy from a branch」，Branch 選 `main`、`/ (root)`，按「Save」。
4. 等 1–2 分鐘，打開 https://idontlikescience.github.io/chip-detective/teacher.html ，看到 QR code 就成功了。

## 三、上課前測一次

1. 先開晶片檢測站玩一局（自己用手機當學生就好），記下房間代碼。
2. 開晶片懸案老師控制台，輸入那個代碼按「讀取全班數據」。
3. 用另一台裝置掃 QR code 加入，按「開始調查」，走到結案。
