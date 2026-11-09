# MyToDoList 🗒️

> 支援 **Google 登入** 與 **多人即時協作** 的待辦清單網頁應用程式

[![Firebase](https://img.shields.io/badge/Firebase-10.x-orange?logo=firebase)](https://firebase.google.com/)
[![Firestore](https://img.shields.io/badge/Firestore-即時同步-blue?logo=firebase)](https://firebase.google.com/docs/firestore)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.x-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)

---

## ✨ 功能特色

| 功能 | 說明 |
|---|---|
| 🔐 Google 登入 | Firebase Auth + OAuth 2.0，安全快速 |
| 📋 多份協作清單 | 建立不同主題清單，支援主題色標記 |
| 🔑 邀請代碼 | 6 位英數代碼或 `?join=CODE` 連結，一鍵加入 |
| ⚡ 即時同步 | Firestore `onSnapshot`，所有成員修改立即推播 |
| ✅ 任務管理 | 新增、勾選完成、點擊標題直接編輯、刪除 |
| 🎯 優先級 | 高 🔴 / 中 🟡 / 低 🟢 三級標記 |
| 📅 截止日期 | 設定截止日，逾期自動紅字警示 ⚠️ |
| 👤 指派成員 | 將任務指派給清單中任意協作者 |
| 🔍 篩選搜尋 | 狀態 × 優先級 × 關鍵字三重篩選 |
| 👥 成員管理 | 查看協作者頭像，擁有者可移除成員 |

---

## 🗂️ 專案結構

```
MyToDoList/
├── index.html          # 完整 HTML 介面（所有 Modal、頭部、側邊欄）
├── style.css           # 自訂樣式與動畫（Tailwind 擴充）
├── firebase-config.js  # Firebase SDK 初始化（讀取 localStorage 設定）
├── app.js              # 主應用邏輯（認證 + Firestore + UI 渲染）
├── firestore.rules     # Firestore 安全規則
└── SETUP.md            # 詳細設定指南
```

---

## 🚀 快速開始

### 前置需求

- 一個 [Firebase](https://console.firebase.google.com/) 帳號（本專案使用 `my-to-do-list-9a809`）
- 任何 HTTP 伺服器（Python、Node.js 或 VS Code Live Server）

### 步驟一：Firebase Console 設定（3 步）

1. **取得 Web API Key**
   前往 [Firebase Console → 專案設定 → 一般](https://console.firebase.google.com/project/my-to-do-list-9a809/settings/general) → 新增 Web App → 複製 `apiKey` 與 `appId`

2. **啟用 Google 登入**
   前往 [Authentication → Sign-in method](https://console.firebase.google.com/project/my-to-do-list-9a809/authentication/providers) → Google → 啟用

3. **建立 Firestore 資料庫**
   前往 [Firestore Database](https://console.firebase.google.com/project/my-to-do-list-9a809/firestore) → 建立資料庫 → 貼入 `firestore.rules` 中的安全規則

### 步驟二：在本地啟動

```bash
# Clone 此 Repo
git clone https://github.com/<你的帳號>/MyToDoList.git
cd MyToDoList

# 啟動 HTTP 伺服器（選一）
python3 -m http.server 3000
# 或
npx serve .
```

### 步驟三：填入 Firebase 設定

1. 開啟 `http://localhost:3000`
2. 點右上角 **「Firebase 設定」** 按鈕
3. 填入 `API Key`（必填）與 `App ID`（選填）
4. 點「儲存並重新載入」，狀態燈變 🟢 即完成

---

## 🔧 Firestore 資料結構

```
/lists/{listId}
  ├── name, desc, color         # 清單基本資訊
  ├── shareCode                 # 6 位英數邀請代碼
  ├── ownerId, memberUids[]     # 擁有者 & 成員 UID 陣列
  └── members: { uid → { name, email, photoURL, joinedAt } }

/lists/{listId}/todos/{todoId}
  ├── title, completed          # 內容與完成狀態
  ├── priority                  # 'high' | 'medium' | 'low'
  ├── dueDate                   # 'YYYY-MM-DD' or null
  ├── assignedTo: { uid, name, photoURL }
  ├── createdBy:  { uid, name, photoURL }
  └── createdAt, updatedAt

/users/{uid}                    # Google 帳號個人資料快取
/invites/{id}                   # Email 邀請記錄
```

---

## 🛡️ Firestore 安全規則摘要

- **清單讀寫**：只有 `memberUids` 中的成員可存取
- **待辦事項**：須確認對父層清單有存取權
- **刪除清單**：只有 `ownerId` 才能執行
- **加入清單**：登入用戶透過邀請碼可將自己加入 `memberUids`

詳見 [`firestore.rules`](./firestore.rules)

---

## 🌍 部署到 Firebase Hosting（免費）

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # Public directory: .（選 No 給 SPA）
firebase deploy --only hosting
# 自動取得 https://my-to-do-list-9a809.web.app
```

---

## 🛠️ 技術棧

| 技術 | 版本 | 用途 |
|---|---|---|
| Firebase Auth | 10.x | Google OAuth 登入 |
| Firebase Firestore | 10.x | 即時 NoSQL 資料庫 |
| Tailwind CSS | 3.x (CDN) | UI 樣式框架 |
| Lucide Icons | latest | 圖示庫 |
| Vanilla JS (ES Module) | — | 無框架，純原生 JS |

---

## 📄 授權

MIT License — 歡迎 Fork 與自由使用。
