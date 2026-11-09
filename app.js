// app.js — MyToDoList 主邏輯
// Firebase 專案: my-to-do-list-9a809
// 功能: Google 登入、即時多人協作待辦清單（Firestore onSnapshot）

import {
  auth, db, googleProvider, isReady,
  signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, setDoc, getDoc, getDocs,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot,
  serverTimestamp, arrayUnion, arrayRemove,
  saveConfig, clearConfig, getStoredConfig
} from "./firebase-config.js";

// ═══════════════════════════════════════════════════════════
// 顏色工具
// ═══════════════════════════════════════════════════════════
const COLOR_MAP = {
  indigo:  { bg: "bg-indigo-100",  text: "text-indigo-600",  ring: "ring-indigo-200" },
  violet:  { bg: "bg-violet-100",  text: "text-violet-600",  ring: "ring-violet-200" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-600", ring: "ring-emerald-200" },
  amber:   { bg: "bg-amber-100",   text: "text-amber-600",   ring: "ring-amber-200"  },
  rose:    { bg: "bg-rose-100",    text: "text-rose-600",    ring: "ring-rose-200"   },
};

function colorClasses(color = "indigo") {
  return COLOR_MAP[color] || COLOR_MAP.indigo;
}

const PRIORITY_LABEL = {
  high:   { emoji: "🔴", text: "高", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  medium: { emoji: "🟡", text: "中", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  low:    { emoji: "🟢", text: "低", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

// ═══════════════════════════════════════════════════════════
// 狀態
// ═══════════════════════════════════════════════════════════
let currentUser    = null;
let activeListId   = null;
let activeListData = null;
let isOwner        = false;

// Firestore 即時監聽的取消函數
let unsubLists = null;
let unsubTodos = null;

// 本地快取（供 assign select 使用）
let listMembersCache = {}; // uid → {name, photoURL, email}

// ═══════════════════════════════════════════════════════════
// DOM 快取
// ═══════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);

const EL = {
  // 通用
  fbStatusDot:     $("fb-status-dot"),
  toasts:          $("toasts"),

  // Header auth
  uiSignedOut:     $("ui-signed-out"),
  uiSignedIn:      $("ui-signed-in"),
  userAvatar:      $("user-avatar"),
  userName:        $("user-name"),
  userEmail:       $("user-email"),
  btnGoogleLogin:  $("btn-google-login"),
  btnHeroLogin:    $("btn-hero-login"),
  btnLogout:       $("btn-logout"),

  // 頁面區域
  guestHero:       $("guest-hero"),
  appWorkspace:    $("app-workspace"),

  // 側邊欄
  sidebar:         $("sidebar"),
  sidebarBackdrop: $("sidebar-backdrop"),
  btnMenuToggle:   $("btn-menu-toggle"),
  listsUl:         $("lists-ul"),
  listsCount:      $("lists-count"),
  btnNewList:      $("btn-new-list"),
  btnJoinList:     $("btn-join-list"),

  // 主內容
  noListSelected:  $("no-list-selected"),
  listContent:     $("list-content"),
  listIconBadge:   $("list-icon-badge"),
  listTitle:       $("list-title"),
  listRoleBadge:   $("list-role-badge"),
  listDesc:        $("list-desc"),
  collabAvatars:   $("collab-avatars"),
  collabCount:     $("collab-count"),
  btnOpenCollab:   $("btn-open-collab"),
  btnListMore:     $("btn-list-more"),
  listMoreMenu:    $("list-more-menu"),
  btnEditList:     $("btn-edit-list"),
  btnClearDone:    $("btn-clear-done"),
  btnDeleteList:   $("btn-delete-list"),
  deleteListLabel: $("delete-list-label"),

  // 新增 Todo 表單
  formAddTodo:     $("form-add-todo"),
  inputTodo:       $("input-todo"),
  selectPriority:  $("select-priority"),
  inputDue:        $("input-due"),
  selectAssign:    $("select-assign"),

  // 篩選
  filterTabs:      document.querySelectorAll(".filter-tab"),
  inputSearch:     $("input-search"),
  filterPriSel:    $("filter-priority-sel"),

  todosUl:         $("todos-ul"),
  summaryBar:      $("summary-bar"),
  summaryTotal:    $("summary-total"),
  summaryPct:      $("summary-pct"),
  btnFirstList:    $("btn-first-list"),

  // Modal 背景
  modalBackdrop:   $("modal-backdrop"),

  // Modal: Firebase 設定
  modalFirebase:   $("modal-firebase"),
  btnOpenConfig:   $("btn-open-config"),
  btnHeroConfig:   $("btn-hero-config"),
  formFbConfig:    $("form-firebase-config"),
  cfgApiKey:       $("cfg-api-key"),
  cfgProjectId:    $("cfg-project-id"),
  cfgAuthDomain:   $("cfg-auth-domain"),
  cfgAppId:        $("cfg-app-id"),
  cfgSenderId:     $("cfg-sender-id"),
  btnClearConfig:  $("btn-clear-config"),

  // Modal: 建立/編輯清單
  modalListForm:   $("modal-list-form"),
  listFormTitle:   $("list-form-title"),
  formList:        $("form-list"),
  formListId:      $("form-list-id"),
  formListName:    $("form-list-name"),
  formListDesc:    $("form-list-desc"),

  // Modal: 加入清單
  modalJoin:       $("modal-join"),
  formJoin:        $("form-join"),
  inputJoinCode:   $("input-join-code"),

  // Modal: 協作
  modalCollab:     $("modal-collab"),
  collabModalListname: $("collab-modal-listname"),
  collabShareCode: $("collab-share-code"),
  btnCopyCode:     $("btn-copy-code"),
  btnCopyLink:     $("btn-copy-link"),
  formInviteEmail: $("form-invite-email"),
  inputInviteEmail:$("input-invite-email"),
  collabMemberCount: $("collab-member-count"),
  collabMembersList: $("collab-members-list"),
};

// ═══════════════════════════════════════════════════════════
// Toast 通知
// ═══════════════════════════════════════════════════════════
function toast(message, type = "info") {
  const colors = {
    success: "bg-emerald-600",
    error:   "bg-rose-600",
    warning: "bg-amber-500",
    info:    "bg-indigo-600",
  };
  const icons = { success: "check-circle", error: "x-circle", warning: "alert-triangle", info: "info" };

  const el = document.createElement("div");
  el.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl text-white text-xs font-semibold shadow-lg ${colors[type]} toast-in`;
  el.innerHTML = `<i data-lucide="${icons[type]}" class="w-4 h-4 flex-shrink-0"></i><span>${message}</span>`;

  EL.toasts.appendChild(el);
  lucide.createIcons({ nodes: [el] });

  setTimeout(() => {
    el.classList.remove("toast-in");
    el.classList.add("toast-out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3500);
}

// ═══════════════════════════════════════════════════════════
// Firebase 狀態指示燈
// ═══════════════════════════════════════════════════════════
function updateFbStatusDot() {
  if (!EL.fbStatusDot) return;
  if (isReady) {
    EL.fbStatusDot.className = "w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0";
    EL.fbStatusDot.title = "Firebase 已連線";
  } else {
    EL.fbStatusDot.className = "w-2 h-2 rounded-full bg-amber-400 flex-shrink-0";
    EL.fbStatusDot.title = "Firebase 未設定";
  }
}

// ═══════════════════════════════════════════════════════════
// Modal 管理
// ═══════════════════════════════════════════════════════════
function openModal(modalEl) {
  EL.modalBackdrop.classList.remove("hidden");
  EL.modalBackdrop.classList.add("flex");
  modalEl.classList.remove("hidden");
  lucide.createIcons({ nodes: [modalEl] });
}

function closeAllModals() {
  EL.modalBackdrop.classList.add("hidden");
  EL.modalBackdrop.classList.remove("flex");
  [EL.modalFirebase, EL.modalListForm, EL.modalJoin, EL.modalCollab].forEach(m => m?.classList.add("hidden"));
}

// 點背景關閉
EL.modalBackdrop.addEventListener("click", e => {
  if (e.target === EL.modalBackdrop) closeAllModals();
});

// 關閉按鈕
document.querySelectorAll(".btn-close-modal").forEach(btn => {
  btn.addEventListener("click", closeAllModals);
});

// ═══════════════════════════════════════════════════════════
// 側邊欄行動裝置切換
// ═══════════════════════════════════════════════════════════
function openSidebar() {
  EL.sidebar.classList.remove("-translate-x-full");
  EL.sidebarBackdrop.classList.remove("hidden");
}
function closeSidebar() {
  EL.sidebar.classList.add("-translate-x-full");
  EL.sidebarBackdrop.classList.add("hidden");
}
EL.btnMenuToggle?.addEventListener("click", openSidebar);
EL.sidebarBackdrop?.addEventListener("click", closeSidebar);

// ═══════════════════════════════════════════════════════════
// Firebase 設定 Modal
// ═══════════════════════════════════════════════════════════
function openFirebaseConfig() {
  const cfg = getStoredConfig();
  EL.cfgApiKey.value      = cfg.apiKey || "";
  EL.cfgAuthDomain.value  = cfg.authDomain || "my-to-do-list-9a809.firebaseapp.com";
  EL.cfgAppId.value       = cfg.appId || "";
  EL.cfgSenderId.value    = cfg.messagingSenderId || "";
  openModal(EL.modalFirebase);
}

EL.btnOpenConfig?.addEventListener("click",  openFirebaseConfig);
EL.btnHeroConfig?.addEventListener("click",  openFirebaseConfig);

EL.formFbConfig?.addEventListener("submit", e => {
  e.preventDefault();
  const apiKey = EL.cfgApiKey.value.trim();
  if (!apiKey) { toast("請填入 API Key", "error"); return; }
  saveConfig({
    apiKey,
    authDomain:        EL.cfgAuthDomain.value.trim() || "my-to-do-list-9a809.firebaseapp.com",
    projectId:         "my-to-do-list-9a809",
    appId:             EL.cfgAppId.value.trim(),
    messagingSenderId: EL.cfgSenderId.value.trim(),
  });
});

EL.btnClearConfig?.addEventListener("click", () => {
  if (confirm("確定要清除本地 Firebase 設定？")) clearConfig();
});

// ═══════════════════════════════════════════════════════════
// Firebase 未設定的保護
// ═══════════════════════════════════════════════════════════
function requireFirebase() {
  if (!isReady) {
    toast("請先完成 Firebase 設定", "warning");
    openFirebaseConfig();
    return false;
  }
  return true;
}

function requireAuth() {
  if (!currentUser) {
    toast("請先登入 Google 帳號", "warning");
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════
// Google 登入 / 登出
// ═══════════════════════════════════════════════════════════
async function loginGoogle() {
  if (!requireFirebase()) return;
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    if (err.code === "auth/popup-closed-by-user") return;
    console.error(err);
    toast("登入失敗：" + err.message, "error");
  }
}

async function logout() {
  try {
    await signOut(auth);
    toast("已登出", "info");
  } catch (err) {
    toast("登出失敗", "error");
  }
}

EL.btnGoogleLogin?.addEventListener("click", loginGoogle);
EL.btnHeroLogin  ?.addEventListener("click", loginGoogle);
EL.btnLogout     ?.addEventListener("click", logout);

// ═══════════════════════════════════════════════════════════
// 認證狀態監聽
// ═══════════════════════════════════════════════════════════
if (isReady) {
  onAuthStateChanged(auth, user => {
    currentUser = user;
    updateAuthUI(user);
    if (user) {
      syncUserProfile(user);
      startListening();
    } else {
      stopListening();
      showGuestHero();
    }
  });
} else {
  updateAuthUI(null);
  showGuestHero();
}

function updateAuthUI(user) {
  if (user) {
    EL.uiSignedOut?.classList.add("hidden");
    EL.uiSignedIn ?.classList.remove("hidden");
    EL.uiSignedIn ?.classList.add("flex");
    if (EL.userAvatar)  EL.userAvatar.src       = user.photoURL || "";
    if (EL.userName)    EL.userName.textContent  = user.displayName || "使用者";
    if (EL.userEmail)   EL.userEmail.textContent = user.email || "";
  } else {
    EL.uiSignedOut?.classList.remove("hidden");
    EL.uiSignedIn ?.classList.add("hidden");
    EL.uiSignedIn ?.classList.remove("flex");
  }
}

function showGuestHero() {
  EL.guestHero     ?.classList.remove("hidden");
  EL.appWorkspace  ?.classList.add("hidden");
  EL.appWorkspace  ?.classList.remove("flex");
}

function showAppWorkspace() {
  EL.guestHero    ?.classList.add("hidden");
  EL.appWorkspace ?.classList.remove("hidden");
  EL.appWorkspace ?.classList.add("flex");
}

// 同步使用者資料到 Firestore (供協作查詢)
async function syncUserProfile(user) {
  if (!db) return;
  try {
    await setDoc(doc(db, "users", user.uid), {
      uid:       user.uid,
      name:      user.displayName || "",
      email:     user.email || "",
      photoURL:  user.photoURL || "",
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn("syncUserProfile 失敗", err);
  }
}

// ═══════════════════════════════════════════════════════════
// 生成邀請代碼（6 位英數）
// ═══════════════════════════════════════════════════════════
function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ═══════════════════════════════════════════════════════════
// Firestore 資料結構說明
// ─────────────────────────────────────────────────────────
// /lists/{listId}
//   name, desc, color, ownerId, ownerName, ownerPhotoURL
//   shareCode (string), memberUids (array)
//   members: { [uid]: { name, email, photoURL, joinedAt } }
//   createdAt
//
// /lists/{listId}/todos/{todoId}
//   title, completed, priority, dueDate
//   assignedTo: { uid, name, photoURL }  (or null)
//   createdBy:  { uid, name, photoURL }
//   createdAt, updatedAt
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 監聽清單列表
// ═══════════════════════════════════════════════════════════
function startListening() {
  showAppWorkspace();
  subscribeToLists();
}

function stopListening() {
  if (unsubLists) { unsubLists(); unsubLists = null; }
  if (unsubTodos) { unsubTodos(); unsubTodos = null; }
  activeListId   = null;
  activeListData = null;
}

function subscribeToLists() {
  if (!db || !currentUser) return;

  const q = query(
    collection(db, "lists"),
    where("memberUids", "array-contains", currentUser.uid)
  );

  unsubLists = onSnapshot(q, snap => {
    const lists = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lists.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    renderSidebar(lists);

    // 若目前活躍清單已被刪除，退回未選擇狀態
    if (activeListId && !lists.find(l => l.id === activeListId)) {
      activeListId = null;
      showNoListSelected();
    }
  }, err => {
    console.error("subscribeToLists 錯誤：", err);
    if (err.code === "permission-denied") {
      toast("Firestore 安全規則未開放，請確認 Firebase 規則設定", "error");
    }
  });
}

function renderSidebar(lists) {
  EL.listsCount.textContent = lists.length;

  if (lists.length === 0) {
    EL.listsUl.innerHTML = `
      <li class="text-xs text-slate-400 text-center py-10 px-3">
        <i data-lucide="folder-open" class="w-7 h-7 mx-auto mb-2 text-slate-300"></i>
        尚無清單，請建立或輸入邀請代碼加入。
      </li>`;
    lucide.createIcons({ nodes: [EL.listsUl] });
    return;
  }

  EL.listsUl.innerHTML = lists.map(list => {
    const isActive = list.id === activeListId;
    const c = colorClasses(list.color);
    return `
      <li>
        <button
          data-list-id="${list.id}"
          class="list-item w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium
                 ${isActive ? "list-item-active" : "text-slate-700 hover:bg-slate-100"} transition">
          <span class="w-7 h-7 rounded-lg ${c.bg} ${c.text} flex items-center justify-center flex-shrink-0">
            <i data-lucide="folder-check" class="w-3.5 h-3.5"></i>
          </span>
          <span class="flex-1 truncate">${escHtml(list.name)}</span>
          ${list.memberUids?.length > 1
            ? `<span class="text-[10px] text-slate-400">${list.memberUids.length}</span>` : ""}
        </button>
      </li>`;
  }).join("");

  lucide.createIcons({ nodes: [EL.listsUl] });

  // 事件綁定
  EL.listsUl.querySelectorAll(".list-item").forEach(btn => {
    btn.addEventListener("click", () => {
      selectList(btn.dataset.listId);
      closeSidebar();
    });
  });
}

// ═══════════════════════════════════════════════════════════
// 選擇清單
// ═══════════════════════════════════════════════════════════
function selectList(listId) {
  if (!listId) return;
  if (activeListId === listId) return;

  // 取消先前的 todo 訂閱
  if (unsubTodos) { unsubTodos(); unsubTodos = null; }

  activeListId = listId;
  showListContent();
  subscribeToListDoc(listId);
  subscribeToTodos(listId);

  // 重新渲染側邊欄以更新 active 樣式
  subscribeToLists_forceRender();
}

function subscribeToLists_forceRender() {
  // 強制更新 active 高亮（onSnapshot 本身不會因為 activeListId 變化而重新 render）
  EL.listsUl.querySelectorAll(".list-item").forEach(btn => {
    const isActive = btn.dataset.listId === activeListId;
    btn.className = `list-item w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium
      ${isActive ? "list-item-active" : "text-slate-700 hover:bg-slate-100"} transition`;
  });
}

// ─── 訂閱清單文件 (頭部、成員等) ──────────────────────────
function subscribeToListDoc(listId) {
  if (!db) return;
  onSnapshot(doc(db, "lists", listId), snap => {
    if (!snap.exists()) return;
    activeListData = { id: snap.id, ...snap.data() };
    isOwner = activeListData.ownerId === currentUser?.uid;
    renderListHeader(activeListData);
    updateAssignSelect(activeListData);
  });
}

function renderListHeader(data) {
  if (!data) return;
  const c = colorClasses(data.color);

  // 圖示 badge 顏色
  EL.listIconBadge.className = `w-11 h-11 rounded-xl ${c.bg} ${c.text} flex items-center justify-center flex-shrink-0`;
  EL.listTitle.textContent   = data.name || "未命名清單";
  EL.listDesc.textContent    = data.desc || "";

  // 角色徽章
  if (isOwner) {
    EL.listRoleBadge.textContent  = "擁有者";
    EL.listRoleBadge.className    = "px-2 py-0.5 text-[11px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200";
    EL.deleteListLabel.textContent = "刪除清單";
  } else {
    EL.listRoleBadge.textContent  = "協作者";
    EL.listRoleBadge.className    = "px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-50 text-slate-600 border border-slate-200";
    EL.deleteListLabel.textContent = "離開清單";
  }

  // 協作者頭像
  const members = Object.values(data.members || {});
  listMembersCache = data.members || {};
  EL.collabCount.textContent = `${members.length} 位成員`;

  EL.collabAvatars.innerHTML = members.slice(0, 5).map(m => `
    <img src="${escAttr(m.photoURL || "")}" alt="${escAttr(m.name || m.email || "?")}"
      title="${escAttr(m.name || m.email || "")}"
      class="w-7 h-7 rounded-full object-cover bg-slate-200"
      onerror="this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'><text y=\'18\' font-size=\'16\'>👤</text></svg>'">
  `).join("");
}

function updateAssignSelect(data) {
  if (!EL.selectAssign) return;
  const members = Object.values(data?.members || {});
  EL.selectAssign.innerHTML = `<option value="">（未指派）</option>` +
    members.map(m => `<option value="${escAttr(m.uid)}">${escHtml(m.name || m.email)}</option>`).join("");
}

// ─── 顯示 / 隱藏 ──────────────────────────────────────────
function showListContent() {
  EL.noListSelected?.classList.add("hidden");
  EL.listContent   ?.classList.remove("hidden");
  EL.listContent   ?.classList.add("flex");
}

function showNoListSelected() {
  EL.listContent   ?.classList.add("hidden");
  EL.listContent   ?.classList.remove("flex");
  EL.noListSelected?.classList.remove("hidden");
}

// ═══════════════════════════════════════════════════════════
// 建立 / 編輯清單
// ═══════════════════════════════════════════════════════════
function openCreateList() {
  if (!requireFirebase() || !requireAuth()) return;
  EL.listFormTitle.textContent  = "建立新的待辦清單";
  EL.formListId.value           = "";
  EL.formListName.value         = "";
  EL.formListDesc.value         = "";
  document.querySelector('input[name="list-color"][value="indigo"]').checked = true;
  openModal(EL.modalListForm);
  setTimeout(() => EL.formListName.focus(), 100);
}

function openEditList() {
  if (!activeListData) return;
  EL.listFormTitle.textContent = "編輯清單資訊";
  EL.formListId.value          = activeListData.id;
  EL.formListName.value        = activeListData.name || "";
  EL.formListDesc.value        = activeListData.desc || "";
  const colorRadio = document.querySelector(`input[name="list-color"][value="${activeListData.color || 'indigo'}"]`);
  if (colorRadio) colorRadio.checked = true;
  openModal(EL.modalListForm);
  setTimeout(() => EL.formListName.focus(), 100);
}

EL.btnNewList  ?.addEventListener("click", openCreateList);
EL.btnFirstList?.addEventListener("click", openCreateList);
EL.btnEditList ?.addEventListener("click", () => { closeListMoreMenu(); openEditList(); });

EL.formList?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!requireAuth()) return;

  const name  = EL.formListName.value.trim();
  const desc  = EL.formListDesc.value.trim();
  const color = document.querySelector('input[name="list-color"]:checked')?.value || "indigo";
  const listId = EL.formListId.value;

  if (!name) { toast("請填寫清單名稱", "warning"); return; }

  try {
    if (listId) {
      // 編輯
      await updateDoc(doc(db, "lists", listId), { name, desc, color });
      toast("清單已更新", "success");
    } else {
      // 新建
      const newDoc = await addDoc(collection(db, "lists"), {
        name, desc, color,
        ownerId:        currentUser.uid,
        ownerName:      currentUser.displayName || "",
        ownerPhotoURL:  currentUser.photoURL || "",
        shareCode:      genCode(),
        memberUids:     [currentUser.uid],
        members: {
          [currentUser.uid]: {
            uid:      currentUser.uid,
            name:     currentUser.displayName || "",
            email:    currentUser.email || "",
            photoURL: currentUser.photoURL || "",
            joinedAt: serverTimestamp(),
          }
        },
        createdAt: serverTimestamp(),
      });
      toast("清單建立成功 🎉", "success");
      closeAllModals();
      selectList(newDoc.id);
      return;
    }
    closeAllModals();
  } catch (err) {
    console.error(err);
    toast("操作失敗：" + err.message, "error");
  }
});

// ═══════════════════════════════════════════════════════════
// 刪除 / 離開清單
// ═══════════════════════════════════════════════════════════
EL.btnDeleteList?.addEventListener("click", async () => {
  closeListMoreMenu();
  if (!activeListData) return;

  if (isOwner) {
    if (!confirm(`確定刪除「${activeListData.name}」？所有事項將一同刪除。`)) return;
    try {
      // 刪除 todos 子集合（批次）
      const todosSnap = await getDocs(collection(db, "lists", activeListId, "todos"));
      await Promise.all(todosSnap.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, "lists", activeListId));
      activeListId = null; activeListData = null;
      showNoListSelected();
      toast("清單已刪除", "info");
    } catch (err) {
      toast("刪除失敗：" + err.message, "error");
    }
  } else {
    if (!confirm(`確定要離開「${activeListData.name}」？`)) return;
    try {
      const uid = currentUser.uid;
      await updateDoc(doc(db, "lists", activeListId), {
        memberUids: arrayRemove(uid),
        [`members.${uid}`]: null, // Firestore 不支援 deleteField on nested map via dot notation in updateDoc easily
      });
      // 分兩步避免問題
      const { deleteField } = await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js");
      await updateDoc(doc(db, "lists", activeListId), {
        [`members.${uid}`]: deleteField()
      });
      activeListId = null; activeListData = null;
      showNoListSelected();
      toast("已離開清單", "info");
    } catch (err) {
      toast("操作失敗：" + err.message, "error");
    }
  }
});

// ═══════════════════════════════════════════════════════════
// 加入清單 (邀請碼)
// ═══════════════════════════════════════════════════════════
EL.btnJoinList?.addEventListener("click", () => {
  if (!requireFirebase() || !requireAuth()) return;
  EL.inputJoinCode.value = "";
  openModal(EL.modalJoin);
  setTimeout(() => EL.inputJoinCode.focus(), 100);
});

EL.formJoin?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!requireAuth()) return;

  const code = EL.inputJoinCode.value.trim().toUpperCase();
  if (!code) return;

  try {
    const q   = query(collection(db, "lists"), where("shareCode", "==", code));
    const snap = await getDocs(q);

    if (snap.empty) { toast("找不到此邀請代碼，請再確認", "error"); return; }

    const listDoc  = snap.docs[0];
    const listData = listDoc.data();
    const uid      = currentUser.uid;

    if (listData.memberUids?.includes(uid)) {
      toast("您已是此清單的成員", "info");
      closeAllModals();
      selectList(listDoc.id);
      return;
    }

    await updateDoc(doc(db, "lists", listDoc.id), {
      memberUids: arrayUnion(uid),
      [`members.${uid}`]: {
        uid,
        name:     currentUser.displayName || "",
        email:    currentUser.email || "",
        photoURL: currentUser.photoURL || "",
        joinedAt: serverTimestamp(),
      }
    });

    toast(`成功加入「${listData.name}」🎉`, "success");
    closeAllModals();
    selectList(listDoc.id);
  } catch (err) {
    console.error(err);
    toast("加入失敗：" + err.message, "error");
  }
});

// ═══════════════════════════════════════════════════════════
// 協作管理 Modal
// ═══════════════════════════════════════════════════════════
EL.btnOpenCollab?.addEventListener("click", openCollabModal);

function openCollabModal() {
  if (!activeListData) return;
  EL.collabModalListname.textContent = `清單：${activeListData.name}`;
  EL.collabShareCode.textContent     = activeListData.shareCode || "------";

  // 渲染成員
  const members = Object.values(activeListData.members || {});
  EL.collabMemberCount.textContent = members.length;
  EL.collabMembersList.innerHTML = members.map(m => `
    <li class="flex items-center gap-2.5">
      <img src="${escAttr(m.photoURL || "")}" alt="" class="w-8 h-8 rounded-full border border-slate-200 bg-slate-100 object-cover"
        onerror="this.style.visibility='hidden'">
      <div class="flex-1 min-w-0">
        <div class="text-xs font-semibold text-slate-800 truncate">${escHtml(m.name || "未知使用者")}</div>
        <div class="text-[11px] text-slate-400 truncate">${escHtml(m.email || "")}</div>
      </div>
      ${m.uid === activeListData.ownerId
        ? `<span class="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5">擁有者</span>`
        : (isOwner
          ? `<button class="btn-kick text-[10px] font-semibold text-rose-600 hover:underline" data-uid="${escAttr(m.uid)}">移除</button>`
          : "")}
    </li>
  `).join("");

  // 移除成員
  EL.collabMembersList.querySelectorAll(".btn-kick").forEach(btn => {
    btn.addEventListener("click", () => kickMember(btn.dataset.uid));
  });

  openModal(EL.modalCollab);
}

async function kickMember(uid) {
  if (!confirm("確定要移除此成員？")) return;
  try {
    const { deleteField } = await import("https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js");
    await updateDoc(doc(db, "lists", activeListId), {
      memberUids: arrayRemove(uid),
      [`members.${uid}`]: deleteField(),
    });
    toast("已移除成員", "success");
    openCollabModal(); // 刷新
  } catch (err) {
    toast("操作失敗：" + err.message, "error");
  }
}

// 複製代碼 & 連結
EL.btnCopyCode?.addEventListener("click", () => {
  const code = activeListData?.shareCode;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => toast("邀請代碼已複製！", "success"));
});

EL.btnCopyLink?.addEventListener("click", () => {
  const code = activeListData?.shareCode;
  if (!code) return;
  const url = `${location.origin}${location.pathname}?join=${code}`;
  navigator.clipboard.writeText(url).then(() => toast("邀請連結已複製！", "success"));
});

// 以 email 邀請（儲存待邀清單，對方登入後加入）
EL.formInviteEmail?.addEventListener("submit", async e => {
  e.preventDefault();
  const email = EL.inputInviteEmail.value.trim().toLowerCase();
  if (!email || !activeListId) return;

  try {
    // 儲存 pending invite，對方登入後可以查詢
    await setDoc(doc(db, "invites", `${activeListId}_${email.replace(/\./g,"_")}`), {
      listId: activeListId,
      listName: activeListData?.name || "",
      shareCode: activeListData?.shareCode || "",
      inviterName: currentUser?.displayName || "",
      inviteeEmail: email,
      createdAt: serverTimestamp(),
    });
    EL.inputInviteEmail.value = "";
    toast(`已發送邀請給 ${email}，對方登入後輸入代碼「${activeListData?.shareCode}」即可加入`, "success");
  } catch (err) {
    toast("邀請失敗：" + err.message, "error");
  }
});

// ═══════════════════════════════════════════════════════════
// 清除已完成 / 更多選單
// ═══════════════════════════════════════════════════════════
EL.btnListMore?.addEventListener("click", e => {
  e.stopPropagation();
  EL.listMoreMenu.classList.toggle("hidden");
});
document.addEventListener("click", () => EL.listMoreMenu?.classList.add("hidden"));

function closeListMoreMenu() {
  EL.listMoreMenu?.classList.add("hidden");
}

EL.btnClearDone?.addEventListener("click", async () => {
  closeListMoreMenu();
  if (!activeListId) return;
  if (!confirm("確定要刪除所有已完成的事項？")) return;

  try {
    const q    = query(collection(db, "lists", activeListId, "todos"), where("completed", "==", true));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    toast(`已清除 ${snap.docs.length} 個完成項目`, "success");
  } catch (err) {
    toast("清除失敗：" + err.message, "error");
  }
});

// ═══════════════════════════════════════════════════════════
// 待辦事項 (Todos)
// ═══════════════════════════════════════════════════════════

// ─── 篩選狀態 ──────────────────────────────────────────────
let currentFilter = "all";
let currentSearch = "";
let currentPriFilter = "all";
let allTodos = [];

EL.filterTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    EL.filterTabs.forEach(t => {
      t.className = "filter-tab px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 text-xs font-semibold";
    });
    tab.className = "filter-tab px-3 py-1.5 rounded-lg bg-white text-slate-900 shadow-sm text-xs font-semibold";
    currentFilter = tab.dataset.filter;
    renderTodos();
  });
});

EL.inputSearch?.addEventListener("input", () => {
  currentSearch = EL.inputSearch.value.toLowerCase();
  renderTodos();
});

EL.filterPriSel?.addEventListener("change", () => {
  currentPriFilter = EL.filterPriSel.value;
  renderTodos();
});

// ─── 訂閱 Todos ───────────────────────────────────────────
function subscribeToTodos(listId) {
  if (!db) return;

  const q = query(
    collection(db, "lists", listId, "todos"),
    orderBy("createdAt", "asc")
  );

  unsubTodos = onSnapshot(q, snap => {
    allTodos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTodos();
  }, err => {
    console.error("subscribeToTodos 錯誤：", err);
    toast("同步事項失敗：" + err.code, "error");
  });
}

// ─── 渲染 Todos ───────────────────────────────────────────
function renderTodos() {
  let list = [...allTodos];

  // 篩選
  if (currentFilter === "active")    list = list.filter(t => !t.completed);
  if (currentFilter === "completed") list = list.filter(t => t.completed);
  if (currentPriFilter !== "all")    list = list.filter(t => t.priority === currentPriFilter);
  if (currentSearch) list = list.filter(t => t.title?.toLowerCase().includes(currentSearch));

  // 排序：未完成在前，高優先在前
  const priOrder = { high: 0, medium: 1, low: 2 };
  list.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (priOrder[a.priority] ?? 1) - (priOrder[b.priority] ?? 1);
  });

  // 統計
  const total     = allTodos.length;
  const completed = allTodos.filter(t => t.completed).length;
  const pct       = total ? Math.round(completed / total * 100) : 0;
  EL.summaryTotal.textContent = `共 ${total} 項待辦`;
  EL.summaryPct  .textContent = `已完成 ${pct}%`;

  if (list.length === 0) {
    EL.todosUl.innerHTML = `
      <li class="text-xs text-slate-400 text-center py-16 empty-state-bg rounded-2xl">
        <i data-lucide="inbox" class="w-9 h-9 mx-auto mb-2 text-slate-300"></i>
        ${total === 0 ? "目前沒有任何待辦事項，快來新增第一筆！" : "沒有符合條件的事項"}
      </li>`;
    lucide.createIcons({ nodes: [EL.todosUl] });
    return;
  }

  EL.todosUl.innerHTML = list.map(todo => buildTodoCard(todo)).join("");
  lucide.createIcons({ nodes: [EL.todosUl] });

  // 事件綁定
  EL.todosUl.querySelectorAll(".todo-toggle").forEach(cb => {
    cb.addEventListener("change", () => toggleTodo(cb.dataset.id, cb.checked));
  });
  EL.todosUl.querySelectorAll(".todo-delete").forEach(btn => {
    btn.addEventListener("click", () => deleteTodo(btn.dataset.id));
  });
  EL.todosUl.querySelectorAll(".todo-title-input").forEach(inp => {
    inp.addEventListener("blur", () => {
      const newTitle = inp.value.trim();
      if (newTitle && newTitle !== inp.dataset.original) {
        updateTodoTitle(inp.dataset.id, newTitle);
      }
    });
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter") inp.blur();
      if (e.key === "Escape") { inp.value = inp.dataset.original; inp.blur(); }
    });
  });
}

function buildTodoCard(todo) {
  const pri = PRIORITY_LABEL[todo.priority] || PRIORITY_LABEL.medium;
  const isOverdue = todo.dueDate && !todo.completed && new Date(todo.dueDate) < new Date();
  const dueStr = todo.dueDate
    ? `<span class="flex items-center gap-1 ${isOverdue ? "text-rose-600 font-semibold" : "text-slate-400"}">
         <i data-lucide="calendar" class="w-3 h-3"></i>
         ${formatDate(todo.dueDate)}${isOverdue ? " ⚠️" : ""}
       </span>`
    : "";

  const assignStr = todo.assignedTo?.name
    ? `<span class="flex items-center gap-1 text-slate-400">
         <i data-lucide="user" class="w-3 h-3"></i>
         ${escHtml(todo.assignedTo.name)}
       </span>`
    : "";

  const creatorStr = todo.createdBy?.name
    ? `<span class="text-slate-300">•</span>
       <span class="text-slate-400">${escHtml(todo.createdBy.name)} 新增</span>`
    : "";

  return `
    <li class="todo-card bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3
               flex items-start gap-3 group ${todo.completed ? "opacity-60" : ""}">

      <!-- Checkbox -->
      <input type="checkbox" class="todo-check todo-toggle mt-1" data-id="${todo.id}"
        ${todo.completed ? "checked" : ""}>

      <!-- 內容 -->
      <div class="flex-1 min-w-0 space-y-1">
        <div class="${todo.completed ? "completed" : ""}">
          <input type="text"
            class="todo-title-input line-through-anim w-full bg-transparent border-0 p-0 text-sm font-semibold
                   focus:outline-none focus:ring-0 ${todo.completed ? "text-slate-400 line-through" : "text-slate-900"}"
            value="${escAttr(todo.title || "")}"
            data-id="${todo.id}"
            data-original="${escAttr(todo.title || "")}">
        </div>
        <!-- Meta 列 -->
        <div class="flex items-center flex-wrap gap-2 text-[11px]">
          <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${pri.cls}">
            ${pri.emoji} ${pri.text}
          </span>
          ${dueStr}
          ${assignStr}
          ${creatorStr}
        </div>
      </div>

      <!-- 刪除按鈕 -->
      <button class="todo-delete opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500
                     hover:bg-rose-50 rounded-lg transition flex-shrink-0" data-id="${todo.id}" title="刪除">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    </li>`;
}

// ─── 新增 Todo ─────────────────────────────────────────────
EL.formAddTodo?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!requireAuth() || !activeListId) return;

  const title = EL.inputTodo.value.trim();
  if (!title) return;

  const assignUid = EL.selectAssign.value;
  const assignMember = assignUid ? (listMembersCache[assignUid] || null) : null;

  try {
    await addDoc(collection(db, "lists", activeListId, "todos"), {
      title,
      completed: false,
      priority:  EL.selectPriority.value || "medium",
      dueDate:   EL.inputDue.value || null,
      assignedTo: assignMember ? {
        uid:      assignMember.uid,
        name:     assignMember.name || assignMember.email,
        photoURL: assignMember.photoURL || "",
      } : null,
      createdBy: {
        uid:      currentUser.uid,
        name:     currentUser.displayName || "",
        photoURL: currentUser.photoURL || "",
      },
      createdAt:  serverTimestamp(),
      updatedAt:  serverTimestamp(),
    });

    // 重設表單
    EL.inputTodo.value        = "";
    EL.inputDue.value         = "";
    EL.selectPriority.value   = "medium";
    EL.selectAssign.value     = "";
    EL.inputTodo.focus();
  } catch (err) {
    toast("新增失敗：" + err.message, "error");
  }
});

// ─── 切換完成狀態 ──────────────────────────────────────────
async function toggleTodo(todoId, completed) {
  if (!activeListId) return;
  try {
    await updateDoc(doc(db, "lists", activeListId, "todos", todoId), {
      completed,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    toast("更新失敗：" + err.message, "error");
  }
}

// ─── 更新標題 ─────────────────────────────────────────────
async function updateTodoTitle(todoId, newTitle) {
  if (!activeListId) return;
  try {
    await updateDoc(doc(db, "lists", activeListId, "todos", todoId), {
      title: newTitle,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    toast("更新標題失敗：" + err.message, "error");
  }
}

// ─── 刪除 Todo ─────────────────────────────────────────────
async function deleteTodo(todoId) {
  if (!activeListId || !confirm("確定刪除此事項？")) return;
  try {
    await deleteDoc(doc(db, "lists", activeListId, "todos", todoId));
  } catch (err) {
    toast("刪除失敗：" + err.message, "error");
  }
}

// ═══════════════════════════════════════════════════════════
// URL 參數：?join=CODE 自動開啟加入對話框
// ═══════════════════════════════════════════════════════════
function checkUrlJoinCode() {
  const params = new URLSearchParams(location.search);
  const code   = params.get("join");
  if (code && currentUser) {
    EL.inputJoinCode.value = code.toUpperCase();
    openModal(EL.modalJoin);
    // 清除 URL 參數
    history.replaceState({}, "", location.pathname);
  }
}

// 在登入後執行
onAuthStateChanged && isReady && onAuthStateChanged(auth, user => {
  if (user) setTimeout(checkUrlJoinCode, 500);
});

// ═══════════════════════════════════════════════════════════
// 工具函數
// ═══════════════════════════════════════════════════════════
function escHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function escAttr(str = "") { return escHtml(str); }

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return isNaN(d) ? dateStr : d.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" });
}

// ═══════════════════════════════════════════════════════════
// 初始化
// ═══════════════════════════════════════════════════════════
updateFbStatusDot();

// 未設定時顯示引導橫幅
if (!isReady) {
  const banner = document.createElement("div");
  banner.className = "fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500 text-white text-xs font-semibold shadow-lg cursor-pointer";
  banner.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4"></i> Firebase 尚未設定，請點此完成設定`;
  banner.addEventListener("click", openFirebaseConfig);
  document.body.appendChild(banner);
  lucide.createIcons({ nodes: [banner] });
}

console.log("%c MyToDoList ✓ ", "background:#6366f1;color:#fff;font-weight:bold;border-radius:4px;", "Firebase:", isReady ? "✅ 已設定" : "⚠️ 請在 Firebase 設定中填入 API Key");
