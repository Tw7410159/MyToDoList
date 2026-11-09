# MyToDoList — 設定啟動指南

> Firebase 專案：**my-to-do-list-9a809**  
> 功能：Google 登入 + 多人即時協作待辦清單（Firestore onSnapshot）

---

## 🚀 快速開始（5 分鐘）

### 步驟 1：取得 Firebase Web 設定

1. 前往 [Firebase Console](https://console.firebase.google.com/project/my-to-do-list-9a809/settings/general)
2. 點選「**專案設定**」→「**一般**」頁籤
3. 在「您的應用程式」區塊，點擊「**新增應用程式**」→ 選 Web（`</>`）
4. 完成後複製 `firebaseConfig` 物件中的 `apiKey` 和 `appId`

---

### 步驟 2：啟用 Google 登入

1. 前往 [Authentication → Sign-in method](https://console.firebase.google.com/project/my-to-do-list-9a809/authentication/providers)
2. 點擊「**Google**」→ 切換為「**已啟用**」→ 儲存

---

### 步驟 3：建立 Firestore 資料庫

1. 前往 [Firestore Database](https://console.firebase.google.com/project/my-to-do-list-9a809/firestore)
2. 點擊「**建立資料庫**」
3. 選擇「**Production mode**」（使用 `firestore.rules` 中的安全規則）
4. 選擇最近的資料中心（例如 `asia-east1`）→ 完成

---

### 步驟 4：部署 Firestore 安全規則（二選一）

**方法 A：直接在 Console 貼上規則（快速）**
1. 前往 [Firestore → 規則](https://console.firebase.google.com/project/my-to-do-list-9a809/firestore/rules)
2. 複製 `firestore.rules` 的內容，貼入規則編輯器
3. 點「發布」

**方法 B：Firebase CLI**
```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # 選擇 my-to-do-list-9a809
firebase deploy --only firestore:rules
```

---

### 步驟 5：在應用程式中填入設定

1. 以瀏覽器開啟 `index.html`（需要 HTTP 伺服器，見下方）
2. 點擊右上角「**Firebase 設定**」按鈕
3. 填入 `API Key` 與 `App ID`，點「儲存並重新載入」
4. 頁面重載後，Firebase 狀態燈 🟢 變為綠色即代表成功

---

## 🌐 在本地啟動 HTTP 伺服器

Firefox 支援直接開啟本地 HTML 檔（`file://`）使用 ES module，
Chrome / Edge 需要 HTTP 伺服器才能使用 `type="module"` 的 JS。

```bash
# 方法 1：Python（通常已預裝）
cd /Users/wen/.gemini/antigravity/scratch/MyToDoList
python3 -m http.server 3000
# 開啟 http://localhost:3000

# 方法 2：Node.js npx serve
npx serve .

# 方法 3：VS Code Live Server 擴充套件
# 右鍵 index.html → Open with Live Server
```

---

## 📁 專案結構

```
MyToDoList/
├── index.html          — 完整 HTML 介面（所有 Modal）
├── style.css           — 自訂樣式 & 動畫
├── firebase-config.js  — Firebase 初始化（讀取 localStorage 設定）
├── app.js              — 主應用邏輯（認證 + Firestore + UI）
├── firestore.rules     — Firestore 安全規則
└── SETUP.md            — 本說明文件
```

---

## ✨ 功能一覽

| 功能 | 說明 |
|---|---|
| **Google 登入** | Firebase Auth + OAuth 2.0 |
| **建立清單** | 含名稱、說明、主題色 |
| **多人協作** | 邀請代碼（6 位英數）+ Email 邀請 |
| **即時同步** | Firestore `onSnapshot` 推播，零手動重整 |
| **待辦事項** | 新增、勾選完成、刪除、內文點擊編輯 |
| **優先級** | 高 🔴 / 中 🟡 / 低 🟢 |
| **截止日期** | 逾期自動紅字警示 ⚠️ |
| **指派對象** | 指派給清單中的任意成員 |
| **篩選搜尋** | 全部 / 未完成 / 已完成 + 優先級 + 關鍵字 |
| **清除完成** | 一鍵批次刪除所有已完成項目 |
| **邀請連結** | URL `?join=CODE` 自動彈出加入對話框 |
| **成員管理** | 擁有者可移除協作者 |

---

## 🔧 Firestore 資料結構

```
/lists/{listId}
  ├── name, desc, color
  ├── ownerId, ownerName, ownerPhotoURL
  ├── shareCode          ← 邀請代碼
  ├── memberUids[]       ← 成員 UID 陣列（供安全規則查詢）
  ├── members: { [uid]: { uid, name, email, photoURL, joinedAt } }
  └── createdAt

/lists/{listId}/todos/{todoId}
  ├── title, completed
  ├── priority           ← 'high' | 'medium' | 'low'
  ├── dueDate            ← 'YYYY-MM-DD' or null
  ├── assignedTo: { uid, name, photoURL } or null
  ├── createdBy:  { uid, name, photoURL }
  └── createdAt, updatedAt

/users/{uid}
  └── uid, name, email, photoURL, updatedAt

/invites/{listId_email}
  └── listId, listName, shareCode, inviterName, inviteeEmail, createdAt
```

---

## 🛡️ 安全規則說明

- **清單讀寫**：只有 `memberUids` 中的成員可存取
- **待辦事項**：須先確認對父層清單有存取權
- **刪除清單**：只有 `ownerId` 才能刪除
- **邀請流程**：任何登入用戶皆可讀取 invites（供對接邀請通知）

---

## 🌍 部署到 Firebase Hosting（免費靜態託管）

```bash
firebase init hosting
# Public directory: .（或 MyToDoList）
# Configure as SPA: No
firebase deploy --only hosting
# 自動取得 https://my-to-do-list-9a809.web.app
```
