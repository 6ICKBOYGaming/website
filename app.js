import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,       
  startAfter,  
  writeBatch,
  increment,   
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBEBVjahmE6BMGPglrHRdbktLI9mQKZTls",
    authDomain: "ickboy-store.firebaseapp.com",
    projectId: "ickboy-store",
    storageBucket: "ickboy-store.firebasestorage.app",
    messagingSenderId: "532385576489",
    appId: "1:532385576489:web:c0a99cbeec52db14d6ce38",
    measurementId: "G-3MGM3VH0PK"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

console.log("%c╠══ [Firebase V6.7-AdminBadge] เพิ่มระบบป้ายโลโก้แอดมินมุมซ้ายบนเรียบร้อย", "color: #ff007f; font-weight: bold;");

const auth = getAuth(app);
const productsRef = collection(db, "products");
const categoriesRef = collection(db, "categories_list");
const onlineUsersRef = collection(db, "online_users");

let allProducts = []; 
let dbCategories = [];
let isAdmin = false;
let currentEditId = null;
let currentEditCategoryId = null; 
let selectedCategory = "ทั้งหมด";
let currentSortMode = "tierlist"; 

let draggedProductId = null;
let draggedCategoryId = null;
let draggedSortId = null; 

let hotSlideInterval = null;
let newSlideInterval = null;
let globalFlashSaleTimerInterval = null; 
let realtimeUsersUnsubscribe = null;
let userPresenceInterval = null;

let itemsPerPage = 12;            
let lastVisibleDoc = null;         
let hasMoreItems = true;          
let isFetchingNextPage = false; 
let clientDisplayedProducts = [];  

// โลโก้แอดมินทรงกลมเล็กๆ วางมุมซ้ายบนของภาพสินค้า
const ADMIN_BADGE_LOGO_URL = "https://i.postimg.cc/brG5HJBR/123.jpg";

// ระบบอ่านแบบประหยัด Read ตรวจสอบเซสชันเว็บ
let allowCacheRead = false;

function throttleLoad() {
  const key = "page_session_loaded";
  if (sessionStorage.getItem(key)) {
    allowCacheRead = true;
    return true;
  }
  sessionStorage.setItem(key, "1");
  allowCacheRead = false;
  return true;
}

throttleLoad();

// DOM Elements
const hotEl = document.getElementById("hotProducts");
const newEl = document.getElementById("newProducts");
const allEl = document.getElementById("products");
const categoriesEl = document.getElementById("categories");
const dragNoticeEl = document.getElementById("dragNotice");
const sortProductsSelect = document.getElementById("sortProductsSelect");

const productName = document.getElementById("productName");
const productImage = document.getElementById("productImage");
const productPrice = document.getElementById("productPrice");
const productSalePrice = document.getElementById("productSalePrice"); 
const productDescription = document.getElementById("productDescription");
const productCategory = document.getElementById("productCategory"); 
const productTier = document.getElementById("productTier"); 
const shopee1 = document.getElementById("shopee1");
const shopee2 = document.getElementById("shopee2");
const lazada = document.getElementById("lazada");
const isNew = document.getElementById("isNew");
const isHot = document.getElementById("isHot");
const comingSoon = document.getElementById("comingSoon");
const isAdminRecommend = document.getElementById("isAdminRecommend"); // Checkbox ตัวใหม่ในฟอร์มหลัก
const submitBtn = document.getElementById("submitBtn");

const adminCategoryTitle = document.getElementById("adminCategoryTitle");
const adminCategoryInput = document.getElementById("adminCategoryInput");
const adminCategoryList = document.getElementById("adminCategoryList");
const adminCategoryPanel = document.getElementById("adminCategoryPanel");
const categorySubmitBtn = document.getElementById("categorySubmitBtn");
const categoryCancelBtn = document.getElementById("categoryCancelBtn");
const searchInput = document.getElementById("search");

const shopeePromoWidget = document.getElementById("shopeePromoWidget");
const widgetGiftImg = document.getElementById("widgetGiftImg");
const widgetMainLink = document.getElementById("widgetMainLink");
const adminWidgetPanel = document.getElementById("adminWidgetPanel");
const adminDragSortPanel = document.getElementById("adminDragSortPanel"); 
const widgetImageInput = document.getElementById("widgetImageInput");
const widgetLinkInput = document.getElementById("widgetLinkInput");
const widgetVisibleCheck = document.getElementById("widgetVisibleCheck");

let currentWidgetState = {
  imageUrl: "https://i.postimg.cc/9F4P0hX8/gift-box.png",
  buttonLink: "https://s.shopee.co.th/1VwHRlinNy",
  visible: true
};

/* ================= 🌓 ระบบสลับธีมสี ================= */
const themeToggleBtn = document.getElementById("themeToggleBtn");
const currentTheme = localStorage.getItem("theme") || "dark";
if (document.documentElement) document.documentElement.setAttribute("data-theme", currentTheme);
if (themeToggleBtn) {
  themeToggleBtn.onclick = () => {
    const targetTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", targetTheme);
    localStorage.setItem("theme", targetTheme);
  };
}

/* ================= 🔄 ระบบจัดการเวอร์ชันข้อมูล (Version Control) ================= */
async function bumpCloudVersion() {
  try {
    const versionRef = doc(db, "settings", "version_control");
    await setDoc(versionRef, { lastUpdated: Date.now() }, { merge: true });
  } catch (err) { console.error(err); }
}

/* ================= 📊 ระบบนับยอดคลิกสะสมประหยัดค่าใช้จ่าย ================= */
function getLocalPendingClicks() {
  const data = localStorage.getItem("pending_clicks");
  return data ? JSON.parse(data) : {};
}
function saveLocalPendingClicks(clicks) {
  localStorage.setItem("pending_clicks", JSON.stringify(clicks));
}

async function syncPendingClicksToCloud() {
  const pendingClicks = getLocalPendingClicks();
  const productIds = Object.keys(pendingClicks);
  if (productIds.length === 0) return;

  const lastSync = parseInt(localStorage.getItem("last_click_sync_time") || "0", 10);
  const now = Date.now();
  
  if (now - lastSync >= 14400000) { 
    try {
      const batch = writeBatch(db);
      let hasUpdates = false;
      productIds.forEach(productId => {
        if (pendingClicks[productId] > 0) {
          batch.update(doc(db, "products", productId), { clickCount: increment(pendingClicks[productId]) });
          hasUpdates = true;
        }
      });
      if (hasUpdates) {
        await batch.commit();
        localStorage.setItem("last_click_sync_time", now.toString());
        saveLocalPendingClicks({});
        console.log("🔄 [Auto Sync] ซิงค์ยอดคลิกสะสมรอบ 4 ชั่วโมงขึ้น Cloud สำเร็จแล้ว!");
      }
    } catch (err) { console.error("Auto Sync Error:", err); }
  }
}

window.forceSyncClicksToCloud = async () => {
  const pendingClicks = getLocalPendingClicks();
  const productIds = Object.keys(pendingClicks);
  if (productIds.length === 0) {
    alert("ℹ️ ไม่มีข้อมูลยอดคลิกค้างสถิติใน LocalStorage ที่ต้องอัปเดตครับ");
    return;
  }
  try {
    alert("⏳ กำลังนำส่งยอดคลิกสะสมที่ค้างอยู่ทั้งหมดขึ้นสู่ Cloud...");
    const batch = writeBatch(db);
    productIds.forEach(productId => {
      if (pendingClicks[productId] > 0) {
        batch.update(doc(db, "products", productId), { clickCount: increment(pendingClicks[productId]) });
      }
    });
    await batch.commit();
    localStorage.setItem("last_click_sync_time", Date.now().toString());
    saveLocalPendingClicks({});
    alert("✅ อัปเดตข้อมูลคลิกสะสมขึ้น Cloud สำเร็จเสร็จสิ้น!");
    loadMasterData();
  } catch (err) { alert("เกิดข้อผิดพลาด: " + err.message); }
};

window.trackProductClick = async (productId) => {
  const pending = getLocalPendingClicks();
  pending[productId] = (pending[productId] || 0) + 1;
  saveLocalPendingClicks(pending);
  
  syncPendingClicksToCloud();
  
  if (typeof gtag !== 'undefined') {
    const found = clientDisplayedProducts.find(x => x.id === productId) || allProducts.find(x => x.id === productId);
    gtag('event', 'click_affiliate_link', { 'product_id': productId, 'product_name': found?.name || "สินค้า" });
  }
};

window.resetProductClick = async (productId) => {
  if (confirm("คุณแน่ใจใช่ไหมว่าจะรีเซ็ตสถิติชิ้นนี้ให้เป็น 0 บนคลาวด์?")) {
    try {
      const pending = getLocalPendingClicks(); delete pending[productId]; saveLocalPendingClicks(pending);
      await updateDoc(doc(db, "products", productId), { clickCount: 0 });
      alert("🗑️ ล้างสถิติเรียบร้อยครับ!"); loadMasterData();
    } catch (err) { alert(err.message); }
  }
};

window.resetAllProductsClick = async () => {
  if (!confirm("🚨 คุณแน่ใจใช่ไหมที่จะรีเซ็ตสถิติสินค้าทุกตัวในระบบให้เป็น 0 บนคลาวด์?")) return;
  try {
    localStorage.setItem("pending_clicks", "{}");
    const batch = writeBatch(db);
    const snap = await getDocs(productsRef);
    snap.forEach(d => { batch.update(doc(db, "products", d.id), { clickCount: 0 }); });
    await batch.commit(); alert("✅ รีเซ็ตสถิติยอดคลิกทุกชิ้นสะอาดเรียบร้อย!"); loadMasterData();
  } catch (err) { alert(err.message); }
};

/* ================= 👥 ระบบติดตามจำนวนผู้เข้าชมแบบ Realtime ================= */
initUserPresenceSystem();
function initUserPresenceSystem() {
  if (userPresenceInterval) clearInterval(userPresenceInterval);
  
  let userSessionId = sessionStorage.getItem("user_presence_id");
  if (!userSessionId) {
    userSessionId = "user_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    sessionStorage.setItem("user_presence_id", userSessionId);
  }
  
  const userPresenceDocRef = doc(db, "online_users", userSessionId);
  
  const reportOnlineStatus = async () => {
    try {
      await setDoc(userPresenceDocRef, { lastActive: Date.now(), isAdminStatus: isAdmin }, { merge: true });
    } catch (e) { console.error("Presence Error", e); }
  };

  reportOnlineStatus();
  userPresenceInterval = setInterval(reportOnlineStatus, 30000);
  
  window.addEventListener("beforeunload", () => {
    setDoc(userPresenceDocRef, { lastActive: Date.now() - 120000 });
  });
}

function listenToRealtimeOnlineUsers() {
  if (realtimeUsersUnsubscribe) realtimeUsersUnsubscribe();
  
  const realtimeCounterDisplay = document.getElementById("realtimeUsersCountDisplay");
  if (!realtimeCounterDisplay) return;

  realtimeUsersUnsubscribe = onSnapshot(onlineUsersRef, async (snapshot) => {
    const now = Date.now();
    let onlineCount = 0;
    let expiredUserIds = [];

    snapshot.forEach(docSnap => {
      const userData = docSnap.data();
      if (userData.lastActive && (now - userData.lastActive < 60000)) {
        onlineCount++;
      } else {
        expiredUserIds.push(docSnap.id);
      }
    });

    realtimeCounterDisplay.innerText = onlineCount;

    if (isAdmin && expiredUserIds.length > 0) {
      const batch = writeBatch(db);
      expiredUserIds.forEach(id => { batch.delete(doc(db, "online_users", id)); });
      try { await batch.commit(); } catch (err) { console.error(err); }
    }
  });
}

// FIX loadMasterData เวอร์ชันประหยัดค่า Read สูงสุด 100%
async function loadMasterData() {
  try {
    syncPendingClicksToCloud();

    const useCache = !isAdmin && allowCacheRead;

    const prodSnap = await getDocs(productsRef, { source: useCache ? 'cache' : 'default' });
    const catSnap = await getDocs(query(categoriesRef, orderBy("order")), { source: useCache ? 'cache' : 'default' });
    const widgetSnap = await getDoc(doc(db, "settings", "shopee_promo_widget"), { source: useCache ? 'cache' : 'default' });

    allProducts = [];
    prodSnap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));

    dbCategories = [];
    catSnap.forEach(d => dbCategories.push({ id: d.id, ...d.data() }));

    updateCategoryDropdown();
    applyWidgetSettings(widgetSnap);

    const hotProducts = allProducts.filter(p => p.isHot).sort((a, b) => (a.hotOrder ?? 0) - (b.hotOrder ?? 0));
    const newProducts = allProducts.filter(p => p.isNew).sort((a, b) => (a.newOrder ?? 0) - (b.newOrder ?? 0));

    if (hotEl) hotEl.innerHTML = hotProducts.map(p => card(p)).join("");
    if (newEl) newEl.innerHTML = newProducts.map(p => card(p)).join("");

    initAutoSliders();

    if (isAdmin) {
      renderAdminView();
    } else {
      resetMobilePaginationState();
      await fetchNextMobilePageFromServer();
    }

    hideLoadingScreen();

  } catch (err) {
    console.error("loadMasterData error:", err);
    hideLoadingScreen();
  }
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) { loadingScreen.classList.add('fade-out'); }
}

function resetMobilePaginationState() {
  clientDisplayedProducts = []; lastVisibleDoc = null; hasMoreItems = true; isFetchingNextPage = false;
  if(allEl) allEl.innerHTML = "";
}

// FIX pagination แก้ไขบั๊กเรียก snapshot ซ้ำซ้อน + เพิ่มระบบดึงจาก Cache เพื่อประหยัดเงินเพิ่ม
async function fetchNextMobilePageFromServer() {
  if (!hasMoreItems || isAdmin || isFetchingNextPage) return;

  isFetchingNextPage = true;
  toggleInfiniteLoader(true);

  try {
    let q = productsRef;

    if (currentSortMode === "priceAsc") {
      q = query(q, orderBy("price", "asc"));
    } else if (currentSortMode === "priceDesc") {
      q = query(q, orderBy("price", "desc"));
    } else {
      q = query(q, orderBy("order", "asc"));
    }

    if (lastVisibleDoc) {
      q = query(q, startAfter(lastVisibleDoc), limit(itemsPerPage));
    } else {
      q = query(q, limit(itemsPerPage));
    }

    const useCache = !isAdmin && allowCacheRead;
    const snapshot = await getDocs(q, { source: useCache ? 'cache' : 'default' }); 

    if (snapshot.empty) {
      hasMoreItems = false;
      toggleInfiniteLoader(false);
      return;
    }

    lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];

    const batch = [];
    snapshot.forEach(d => batch.push({ id: d.id, ...d.data() }));

    clientDisplayedProducts = clientDisplayedProducts.concat(batch);

    if (snapshot.docs.length < itemsPerPage) hasMoreItems = false;

    renderMobileView();

  } catch (err) {
    console.error("pagination error:", err);
  } finally {
    isFetchingNextPage = false;
    toggleInfiniteLoader(hasMoreItems);
  }
}

function applyWidgetSettings(docSnap) {
  if (docSnap && docSnap.exists()) {
    const data = docSnap.data();
    currentWidgetState = {
      imageUrl: data.imageUrl || "https://i.postimg.cc/9F4P0hX8/gift-box.png",
      buttonLink: data.buttonLink || "https://s.shopee.co.th/1VwHRlinNy",
      visible: data.visible !== undefined ? data.visible : true
    };
  }
  if (widgetGiftImg) widgetGiftImg.src = currentWidgetState.imageUrl;
  if (widgetMainLink) widgetMainLink.href = currentWidgetState.buttonLink;
  if (shopeePromoWidget) shopeePromoWidget.style.display = currentWidgetState.visible ? "block" : "none";

  if (isAdmin) {
    if (widgetImageInput && document.activeElement !== widgetImageInput) widgetImageInput.value = currentWidgetState.imageUrl;
    if (widgetLinkInput && document.activeElement !== widgetLinkInput) widgetLinkInput.value = currentWidgetState.buttonLink;
    if (widgetVisibleCheck) widgetVisibleCheck.checked = !!currentWidgetState.visible;
  }
}

/* ================= 📦 โครงสร้างการจัดวางการ์ดสินค้า ================= */
function formatPrice(p){ if(p === undefined || p === null || p === "") return ""; return "฿" + Number(p).toLocaleString("th-TH"); }

function card(p, index){
  const priceNormal = p.price ? Number(p.price) : 0;
  const priceSale = p.salePrice ? Number(p.salePrice) : 0;
  const isProductComingSoon = !!p.comingSoon || (priceNormal === 0 && priceSale === 0);
  
  let priceHtmlDisplay = "";
  if (isProductComingSoon) {
    priceHtmlDisplay = `<div class="price coming-soon-text">Coming Soon...</div>`;
  } else {
    if (priceSale > 0 && priceNormal > 0) {
      priceHtmlDisplay = `<div class="price old-price-slashed">${formatPrice(priceNormal)}</div><div class="price">${formatPrice(priceSale)}</div>`;
    } else {
      priceHtmlDisplay = `<div class="price">${formatPrice(priceNormal || priceSale)}</div>`;
    }
  }

  const cartIconSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`;

  let btnsContent = "";
  if (isProductComingSoon) {
    btnsContent = `<div class="btn coming-soon-btn">Coming Soon...</div>`;
  } else {
    const link1 = p.shopee1 ? p.shopee1.trim() : "";
    const link2 = p.shopee2 ? p.shopee2.trim() : "";
    let shopeeBtns = "";
    
    if (link1 && link2) {
      shopeeBtns += `<a class="btn shopee" href="${link1}" target="_blank" onclick="trackProductClick('${p.id}')">${cartIconSvg}Shopee 1</a>`;
      shopeeBtns += `<a class="btn shopee" href="${link2}" target="_blank" onclick="trackProductClick('${p.id}')">${cartIconSvg}Shopee 2</a>`;
    } else if (link1 || link2) {
      shopeeBtns += `<a class="btn shopee" href="${link1 || link2}" target="_blank" onclick="trackProductClick('${p.id}')">${cartIconSvg}Shopee</a>`;
    } else {
      shopeeBtns += `<a class="btn disabled" href="javascript:void(0);">${cartIconSvg}Shopee</a>`;
    }
    
    const lazadaBtn = p.lazada?.trim() ? `<a class="btn lazada" href="${p.lazada.trim()}" target="_blank" onclick="trackProductClick('${p.id}')">${cartIconSvg}Lazada</a>` : `<a class="btn disabled" href="javascript:void(0);">${cartIconSvg}Lazada</a>`;
    btnsContent = shopeeBtns + lazadaBtn;
  }

  const canDrag = isAdmin && currentSortMode === "tierlist";
  const dragAttr = canDrag ? `draggable="true" data-id="${p.id}" class="card admin-draggable"` : `class="card"`;
  const currentQuickPriceVal = priceSale > 0 ? priceSale : (priceNormal > 0 ? priceNormal : "");
  const currentFlashSaleTimeVal = p.flashSaleEndTime || "";
  const currentAdminRecommendState = !!p.isAdminRecommend; // สถานะป้ายรูปกลมๆ ปัจจุบัน

  let tierBadgeHtml = "";
  if (p.tier) {
    tierBadgeHtml = `<div class="tier-badge rank-${p.tier}">Tier ${p.tier}</div>`;
  } else if (currentSortMode === "tierlist" && selectedCategory !== "ทั้งหมด" && index !== undefined && index >= 0 && index < 5) {
    const displayRank = index + 1;
    tierBadgeHtml = `<div class="tier-badge rank-${displayRank}">${displayRank}</div>`;
  }

  // โลโก้กลมๆ เล็กๆ วางมุมซ้ายบนของรูปสินค้า (ใช้ CSS ในตัวสร้างรูปแบบวงกลมและเงา)
  let adminLogoBadgeHtml = "";
  if (currentAdminRecommendState) {
    adminLogoBadgeHtml = `
      <div class="admin-custom-logo-badge" style="position: absolute; top: 10px; left: 10px; width: 34px; height: 34px; border-radius: 50%; overflow: hidden; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 10;">
        <img src="${ADMIN_BADGE_LOGO_URL}" style="width: 100%; height: 100%; object-fit: cover;">
      </div>
    `;
  }

  const imageLink = (!isProductComingSoon && (p.shopee1?.trim() || p.shopee2?.trim())) ? (p.shopee1?.trim() || p.shopee2?.trim()) : "";
  const imageHtml = imageLink ? `<a href="${imageLink}" target="_blank" class="card-img-link" style="position:relative; display:block;" onclick="trackProductClick('${p.id}')">${adminLogoBadgeHtml}<img src="${p.image?.trim() || 'https://via.placeholder.com/180'}" alt="${p.name}"></a>` : `<div style="position:relative; display:block;">${adminLogoBadgeHtml}<img src="${p.image?.trim() || 'https://via.placeholder.com/180'}" alt="${p.name}" class="no-link-img"></div>`;

  let flashSaleTimerHtml = "";
  const isFlashSaleActive = currentFlashSaleTimeVal ? (new Date(currentFlashSaleTimeVal).getTime() - new Date().getTime() > 0) : false;
  if (!isProductComingSoon && currentFlashSaleTimeVal && isFlashSaleActive) {
    flashSaleTimerHtml = `
      <div class="card-flash-sale-box" id="flash-box-${p.id}">
        <span class="flash-sale-badge-text">Flash Sale</span>
        <div class="flash-sale-countdown-clock dynamic-countdown-timer" data-id="${p.id}" data-endtime="${currentFlashSaleTimeVal}">00h 00m 00s</div>
      </div>
    `;
  }

  return `
  <div ${dragAttr} style="position: relative;">
    ${tierBadgeHtml}
    ${p.isHot ? `<div class="badge hot">🔥 HOT</div>` : ""}
    ${p.isNew ? `<div class="badge">🆕 NEW</div>` : ""}
    ${imageHtml}
    <div class="info">
      <h4>${p.name}</h4>
      ${flashSaleTimerHtml}
      <div class="price-container">${priceHtmlDisplay}</div>
      ${p.description ? `<p>${p.description}</p>` : ""}
      <div class="btns">
        ${btnsContent}
        ${isAdmin ? `
          <div style="background: rgba(245, 158, 11, 0.08); border: 1px dashed var(--admin-yellow); padding: 8px 10px; border-radius: 8px; margin-bottom: 8px; font-size: 12px; color: var(--admin-yellow); width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span>📊 ยอดคลิกสะสมคลาวด์:</span>
              <strong>${p.clickCount || 0} ครั้ง</strong>
            </div>
            <button class="btn-reset-clicks" onclick="resetProductClick('${p.id}')" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.2s; width: 100%; text-align: center;">
              🗑️ ล้างจำนวนสถิตคลิกชิ้นนี้
            </button>
          </div>

          <div class="admin-card-actions">
            <button class="btn edit" onclick='editProduct("${p.id}")'>Edit</button>
            <button class="btn delete" onclick='deleteProduct("${p.id}")'>Delete</button>
          </div>
          <div class="quick-admin-controls-wrapper">
            <div class="quick-price-box">
              <label>⚡️ ราคาด่วน:</label>
              <div class="quick-price-row">
                <input type="text" class="quick-price-input" value="${currentQuickPriceVal}" placeholder="ระบุราคา..." onkeydown="handleQuickPriceKey(event, '${p.id}')">
                <button class="quick-price-clear-btn" title="เคลียร์ค่า" onclick="clearQuickPrice('${p.id}')">✕</button>
              </div>
            </div>
            <div class="quick-flash-sale-box">
              <label>⏰ ตั้งเวลา Flash Sale:</label>
              <div class="quick-price-row">
                <input type="text" class="quick-date-input" value="" placeholder="เช่น 2 หรือ 45m..." onkeydown="handleQuickFlashSaleKey(event, '${p.id}')">
                <button class="quick-price-clear-btn" title="ลบเวลา" onclick="clearQuickFlashSale('${p.id}')">✕</button>
              </div>
            </div>
            <!-- ✅ ระบบเปิด-ปิดป้ายโลโก้ด่วน ถูกจัดวางไว้ใต้ตั้งเวลาด่วน Flash Sale -->
            <div class="quick-recommend-badge-box" style="margin-top: 8px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px; display: flex; align-items: center; justify-content: space-between; width:100%;">
              <label style="font-size:11px; color:#a3a3a3; display:flex; align-items:center; gap:5px; cursor:pointer;">
                <img src="${ADMIN_BADGE_LOGO_URL}" style="width:16px; height:16px; border-radius:50%;"> เปิดใช้ป้ายโลโก้แอดมิน:
              </label>
              <input type="checkbox" ${currentAdminRecommendState ? "checked" : ""} onchange="toggleQuickAdminRecommend('${p.id}', this.checked)" style="width:16px; height:16px; cursor:pointer;">
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  </div>
  `;
}

// ฟังก์ชันสำหรับเปิด-ปิดป้ายแอดมินแบบด่วนบนตัวการ์ดทันที
window.toggleQuickAdminRecommend = async (productId, isChecked) => {
  try {
    await updateDoc(doc(db, "products", productId), { isAdminRecommend: isChecked });
    const foundIdx = allProducts.findIndex(p => p.id === productId);
    if (foundIdx !== -1) allProducts[foundIdx].isAdminRecommend = isChecked;
    await bumpCloudVersion(); 
    loadMasterData();
  } catch (err) { 
    alert("เกิดข้อผิดพลาด: " + err.message); 
  }
};

window.handleQuickPriceKey = async (event, productId) => {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault(); const inputVal = event.target.value.trim();
    if (!inputVal || isNaN(inputVal)) { alert("กรุณากรอกเฉพาะตัวเลขราคาครับ"); return; }
    const newPriceNum = Number(inputVal);
    const foundIdx = allProducts.findIndex(p => p.id === productId);
    if (foundIdx !== -1) {
      let updateFields = { comingSoon: false };
      const oldPrice = allProducts[foundIdx].price ? Number(allProducts[foundIdx].price) : 0;
      if (oldPrice > 0 && newPriceNum < oldPrice) { updateFields.salePrice = newPriceNum; } 
      else { updateFields.price = newPriceNum; updateFields.salePrice = 0; }
      try {
        event.target.blur(); await updateDoc(doc(db, "products", productId), updateFields);
        allProducts[foundIdx] = { ...allProducts[foundIdx], ...updateFields };
        await bumpCloudVersion(); loadMasterData();
      } catch (err) { alert(err.message); }
    }
  }
};

window.clearQuickPrice = async (productId) => {
  try {
    const updateFields = { price: 0, salePrice: 0, comingSoon: true };
    await updateDoc(doc(db, "products", productId), updateFields);
    const foundIdx = allProducts.findIndex(p => p.id === productId);
    if (foundIdx !== -1) allProducts[foundIdx] = { ...allProducts[foundIdx], ...updateFields };
    await bumpCloudVersion(); loadMasterData();
  } catch (err) { alert(err.message); }
};

window.handleQuickFlashSaleKey = async (event, productId) => {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault(); let inputVal = event.target.value.trim().toLowerCase();
    if (!inputVal) { alert("กรุณาใส่เวลาตัวอย่างเลขชั่วโมงครับ"); return; }
    let targetMs = 0;
    if (inputVal.endsWith("m")) {
      const minutes = parseFloat(inputVal.replace("m", "")); if (isNaN(minutes) || minutes <= 0) return;
      targetMs = minutes * 60 * 1000;
    } else {
      const hours = parseFloat(inputVal); if (isNaN(hours) || hours <= 0) return;
      targetMs = hours * 60 * 60 * 1000;
    }
    const endTimeIsoString = new Date(new Date().getTime() + targetMs).toISOString();
    try {
      event.target.value = ""; event.target.blur();
      await updateDoc(doc(db, "products", productId), { flashSaleEndTime: endTimeIsoString });
      const foundIdx = allProducts.findIndex(p => p.id === productId);
      if (foundIdx !== -1) allProducts[foundIdx].flashSaleEndTime = endTimeIsoString;
      await bumpCloudVersion(); loadMasterData();
    } catch (err) { alert(err.message); }
  }
};

window.clearQuickFlashSale = async (productId) => {
  try {
    await updateDoc(doc(db, "products", productId), { flashSaleEndTime: "" });
    const foundIdx = allProducts.findIndex(p => p.id === productId);
    if (foundIdx !== -1) allProducts[foundIdx].flashSaleEndTime = "";
    await bumpCloudVersion(); loadMasterData();
  } catch (err) { alert(err.message); }
};

function startFlashSaleClockTicker() {
  if (globalFlashSaleTimerInterval) clearInterval(globalFlashSaleTimerInterval);
  globalFlashSaleTimerInterval = setInterval(() => {
    const timerElements = document.querySelectorAll(".dynamic-countdown-timer");
    if (timerElements.length === 0) return;
    timerElements.forEach(el => {
      const endTimeAttr = el.getAttribute("data-endtime");
      const pId = el.getAttribute("data-id");
      if (!endTimeAttr) return;
      const timeRemaining = new Date(endTimeAttr).getTime() - new Date().getTime();
      if (timeRemaining <= 0) {
        const flashBox = document.getElementById(`flash-box-${pId}`);
        if (flashBox) flashBox.style.display = "none";
      } else {
        const hours = Math.floor(timeRemaining / 3600000);
        const minutes = Math.floor((timeRemaining % 3600000) / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        el.innerHTML = `${hours < 10 ? "0" + hours : hours}h ${minutes < 10 ? "0" + minutes : minutes}m ${seconds < 10 ? "0" + seconds : seconds}s`;
      }
    });
  }, 1000);
}

function render() {
  if (isAdmin) { renderAdminView(); } else { renderMobileView(); }
}

function renderMobileView() {
  if (document.getElementById("categoryTitle")) document.getElementById("categoryTitle").innerText = "หมวดหมู่สินค้า: " + selectedCategory;
  let displayed = [...clientDisplayedProducts];
  if (selectedCategory !== "ทั้งหมด") displayed = displayed.filter(p => p.category === selectedCategory);
  const kw = searchInput?.value.trim().toLowerCase();
  if (kw) displayed = displayed.filter(p => p.name?.toLowerCase().includes(kw) || p.description?.toLowerCase().includes(kw));

  if (allEl) allEl.innerHTML = displayed.map((p, index) => card(p, index)).join("");
  renderSidebarCategories();
  renderInfiniteScrollLoader();
  startFlashSaleClockTicker();
}

function renderAdminView() {
  if (document.getElementById("categoryTitle")) document.getElementById("categoryTitle").innerText = "🛠️ โหมดแอดมิน (แสดงฐานข้อมูลคลาวด์ทั้งหมด)";
  let filtered = [...allProducts];
  if (selectedCategory !== "ทั้งหมด") filtered = allProducts.filter(p => p.category === selectedCategory);
  const kw = searchInput?.value.trim().toLowerCase();
  if (kw) filtered = filtered.filter(p => p.name?.toLowerCase().includes(kw) || p.description?.toLowerCase().includes(kw));

  if (currentSortMode === "priceAsc") {
    filtered.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
  } else if (currentSortMode === "priceDesc") {
    filtered.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
  } else {
    filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  if (allEl) allEl.innerHTML = filtered.map((p, index) => card(p, index)).join("");
  renderSidebarCategories();
  renderAdminCategoryList();
  renderAdminDragSortLists();
  
  toggleInfiniteLoader(false);

  if (dragNoticeEl) {
    dragNoticeEl.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; background:rgba(16, 185, 129, 0.1); border:1px solid #10b981; padding:12px; border-radius:8px; margin-bottom:15px; width:100%; box-sizing:border-box;">
        <span style="flex:1; font-size:13px; color:#10b981;">🟢 <b>ระบบออนไลน์ Realtime:</b> กำลังมีผู้เข้าชมขณะนี้ <strong id="realtimeUsersCountDisplay" style="font-size:18px; text-shadow: 0 0 8px #10b981;">0</strong> คน</span>
        <button class='btn edit' style='padding:6px 12px; font-size:12px; background:#3b82f6; color:#fff; border:none; border-radius:6px; cursor:pointer;' onclick='forceSyncClicksToCloud()'>🔄 อัปเดตยอดคลิกสะสมขึ้นคลาวด์</button>
        <button class='btn edit' style='padding:6px 12px; font-size:12px; background:#10b981; color:#fff; border:none; border-radius:6px; cursor:pointer;' onclick='saveAllProductsOrderManually()'>💾 บันทึกลำดับสินค้าทั้งหมด</button>
      </div>
    `;
    dragNoticeEl.style.display = "block";
  }
  setupProductDragAndDrop(filtered);
  startFlashSaleClockTicker();
  listenToRealtimeOnlineUsers();
}

window.filterCategory = (category) => { 
  selectedCategory = category; 
  render();
};

function renderInfiniteScrollLoader() {
  let loaderContainer = document.getElementById("infiniteScrollLoaderContainer");
  if (isAdmin || !hasMoreItems || selectedCategory !== "ทั้งหมด") {
    if (loaderContainer) loaderContainer.classList.remove("show"); return;
  }
  if (!loaderContainer) {
    loaderContainer = document.createElement("div"); loaderContainer.id = "infiniteScrollLoaderContainer"; loaderContainer.className = "infinite-scroll-loader show";
    const spinner = document.createElement("div"); spinner.className = "spinner-neon";
    loaderContainer.appendChild(spinner); allEl.parentNode.insertBefore(loaderContainer, allEl.nextSibling);
    
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage && hasMoreItems && selectedCategory === "ทั้งหมด") {
        fetchNextMobilePageFromServer();
      }
    }, { rootMargin: "150px" });
    observer.observe(loaderContainer);
  } else {
    loaderContainer.classList.add("show");
  }
}

function toggleInfiniteLoader(visible) {
  const loaderContainer = document.getElementById("infiniteScrollLoaderContainer");
  if (loaderContainer) {
    if (visible && !isAdmin && selectedCategory === "ทั้งหมด") { loaderContainer.classList.add("show"); } 
    else { loaderContainer.classList.remove("show"); }
  }
}

if(searchInput) searchInput.addEventListener("input", () => { render(); });
if(sortProductsSelect) sortProductsSelect.addEventListener("change", (e) => { currentSortMode = e.target.value; render(); });

function renderSidebarCategories() {
  if (!categoriesEl) return;
  const totalCount = allProducts.length;
  let html = `<div class="category ${selectedCategory === 'ทั้งหมด' ? 'active' : ''}" onclick="filterCategory('ทั้งหมด')">ทั้งหมด (${totalCount})</div>`;
  dbCategories.forEach(cat => {
    const count = allProducts.filter(p => p.category && p.category.trim() === cat.name.trim()).length;
    html += `<div class="category ${selectedCategory === cat.name ? 'active' : ''}" onclick="filterCategory('${cat.name}')">${cat.name} (${count})</div>`;
  });
  categoriesEl.innerHTML = html;
}

function updateCategoryDropdown() {
  if (!productCategory) return;
  productCategory.innerHTML = dbCategories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join("");
}

function renderAdminCategoryList() {
  if(!adminCategoryList) return;
  if (dbCategories.length === 0) { adminCategoryList.innerHTML = "<div style='color:var(--text-muted); font-size:13px; text-align:center;'>ยังไม่มีหมวดหมู่</div>"; return; }
  adminCategoryList.innerHTML = dbCategories.map(cat => `
    <div class="admin-cat-item admin-draggable" draggable="true" data-catid="${cat.id}">
      <span>☰ ${cat.name}</span>
      <div class="admin-cat-actions">
        <button class="btn-mini-edit" onclick="editCategory('${cat.id}')">แก้ไขชื่อ</button>
        <button class="btn-mini-delete" onclick="deleteCategory('${cat.id}', '${cat.name}')">ลบ</button>
      </div>
    </div>
  `).join("");
  setupCategoryDragAndDrop();
}

window.clearCategoryForm = () => {
  adminCategoryInput.value = ""; currentEditCategoryId = null;
  adminCategoryTitle.innerText = "📁 แผงจัดการระบบหมวดหมู่สินค้า"; categorySubmitBtn.innerText = "เพิ่มหมวดหมู่";
  if(categoryCancelBtn) categoryCancelBtn.style.display = "none";
};

window.editCategory = (id) => {
  const cat = dbCategories.find(c => c.id === id); if (!cat) return;
  currentEditCategoryId = id; adminCategoryInput.value = cat.name || "";
  adminCategoryTitle.innerText = "📝 แก้ไขชื่อหมวดหมู่สินค้า"; categorySubmitBtn.innerText = "บันทึกการแก้ไข";
  if(categoryCancelBtn) categoryCancelBtn.style.display = "block"; adminCategoryInput.focus();
};

window.handleCategorySubmit = async () => {
  const name = adminCategoryInput.value.trim(); if (!name) return;
  try {
    if (currentEditCategoryId) { await updateDoc(doc(db, "categories_list", currentEditCategoryId), { name: name }); } 
    else {
      const maxOrder = dbCategories.reduce((max, c) => ((c.order ?? 0) > max ? c.order : max), 0);
      await addDoc(categoriesRef, { name: name, order: maxOrder + 1 });
    }
    await bumpCloudVersion(); clearCategoryForm(); loadMasterData();
  } catch (error) { alert(error.message); }
};

window.deleteCategory = async (id, name) => {
  if (confirm(`ต้องการลบหมวดหมู่ "${name}"?`)) {
    try {
      await deleteDoc(doc(db, "categories_list", id));
      if (selectedCategory === name) selectedCategory = "ทั้งหมด";
      await bumpCloudVersion(); loadMasterData();
    } catch (error) { alert(error.message); }
  }
};

function setupCategoryDragAndDrop() {
  const catItems = document.querySelectorAll("#adminCategoryList .admin-cat-item");
  catItems.forEach(item => {
    item.addEventListener("dragstart", (e) => { draggedCategoryId = item.getAttribute("data-catid"); });
    item.addEventListener("dragover", (e) => e.preventDefault());
    item.addEventListener("drop", async (e) => {
      e.preventDefault(); const targetCategoryId = item.getAttribute("data-catid");
      if (draggedCategoryId === targetCategoryId) return;
      let currentCats = [...dbCategories];
      const dIdx = currentCats.findIndex(c => c.id === draggedCategoryId), tIdx = currentCats.findIndex(c => c.id === targetCategoryId);
      if (dIdx === -1 || tIdx === -1) return;
      const [removed] = currentCats.splice(dIdx, 1); currentCats.splice(tIdx, 0, removed);
      dbCategories = currentCats; renderAdminCategoryList();
      try {
        for (let i = 0; i < currentCats.length; i++) { await updateDoc(doc(db, "categories_list", currentCats[i].id), { order: i }); }
        await bumpCloudVersion();
      } catch (err) { console.error(err); }
    });
  });
}

window.handleWidgetUpdate = async () => {
  try {
    await setDoc(doc(db, "settings", "shopee_promo_widget"), { imageUrl: widgetImageInput.value.trim(), buttonLink: widgetLinkInput.value.trim(), visible: widgetVisibleCheck.checked });
    await bumpCloudVersion(); alert("💾 บันทึกข้อมูลวิดเจ็ตกิจกรรมสำเร็จ!"); loadMasterData();
  } catch (err) { alert(err.message); }
};

function setupProductDragAndDrop(currentFilteredProducts) {
  const cards = document.querySelectorAll("#products .card.admin-draggable");
  cards.forEach(cardItem => {
    cardItem.addEventListener("dragstart", (e) => { draggedProductId = cardItem.getAttribute("data-id"); });
    cardItem.addEventListener("dragover", (e) => e.preventDefault());
    cardItem.addEventListener("drop", (e) => {
      e.preventDefault(); const targetProductId = cardItem.getAttribute("data-id");
      if (draggedProductId === targetProductId) return;

      let updatedList = [...currentFilteredProducts];
      const dIdx = updatedList.findIndex(p => p.id === draggedProductId), tIdx = updatedList.findIndex(p => p.id === targetProductId);
      if (dIdx === -1 || tIdx === -1) return;

      const [removed] = updatedList.splice(dIdx, 1); updatedList.splice(tIdx, 0, removed);
      updatedList.forEach((prod, i) => { const found = allProducts.find(x => x.id === prod.id); if(found) found.order = i; });
      renderAdminView();
    });
  });
}

window.saveAllProductsOrderManually = async () => {
  try {
    alert("⏳ กำลังจัดแพ็กเกจลำดับโครงสร้างสินค้าส่งขึ้น Cloud...");
    const batch = writeBatch(db);
    allProducts.forEach((prod, idx) => { batch.update(doc(db, "products", prod.id), { order: prod.order ?? idx }); });
    await batch.commit(); await bumpCloudVersion();
    alert("💾 ลำดับโครงสร้างสินค้าทั้งหมดบันทึกเรียบร้อย!"); loadMasterData();
  } catch (err) { alert(err.message); }
};

window.handleProductSubmit = async () => {
  const name = productName.value.trim(), image = productImage.value.trim();
  const price = Number(productPrice.value) || 0, salePrice = Number(productSalePrice.value) || 0;
  if (!name) { alert("กรุณาป้อนชื่อแบรนด์หรือรุ่นสินค้าด้วยครับ"); return; }

  const productData = {
    name, image, price, salePrice, description: productDescription.value.trim(),
    category: productCategory.value, tier: productTier.value, shopee1: shopee1.value.trim(),
    shopee2: shopee2.value.trim(), lazada: lazada.value.trim(), isNew: isNew.checked,
    isHot: isHot.checked, comingSoon: comingSoon.checked || (price === 0 && salePrice === 0),
    isAdminRecommend: isAdminRecommend ? isAdminRecommend.checked : false // บันทึกสถานะป้ายโลโก้แอดมิน
  };

  try {
    if (currentEditId) {
      await updateDoc(doc(db, "products", currentEditId), productData); currentEditId = null; submitBtn.innerText = "เพิ่มสินค้าเข้าระบบ"; removeProductCancelButton(); 
    } else {
      productData.order = allProducts.reduce((max, p) => ((p.order ?? 0) > max ? p.order : max), 0) + 1;
      productData.hotOrder = allProducts.reduce((max, p) => ((p.hotOrder ?? 0) > max ? p.hotOrder : max), 0) + 1;
      productData.newOrder = allProducts.reduce((max, p) => ((p.newOrder ?? 0) > max ? p.newOrder : max), 0) + 1;
      productData.flashSaleEndTime = ""; productData.clickCount = 0;
      await addDoc(productsRef, productData);
    }
    await bumpCloudVersion(); clearProductForm(); alert("บันทึกสินค้าเรียบร้อย!"); loadMasterData();
  } catch (error) { alert(error.message); }
};

function clearProductForm() {
  productName.value = ""; productImage.value = ""; productPrice.value = ""; productSalePrice.value = ""; productDescription.value = "";
  if(productTier) productTier.value = ""; shopee1.value = ""; shopee2.value = ""; lazada.value = ""; isNew.checked = false; isHot.checked = false; comingSoon.checked = false;
  if(isAdminRecommend) isAdminRecommend.checked = false; // เคลียร์ Checkbox ป้ายแอดมิน
}

function removeProductCancelButton() {
  const existingCancelBtn = document.getElementById("productCancelBtn");
  if (existingCancelBtn) existingCancelBtn.remove();
  if (submitBtn) { submitBtn.style.display = "block"; submitBtn.style.width = "100%"; submitBtn.style.margin = "15px 0 0 0"; }
  const wrapper = document.getElementById("submitBtnWrapper");
  if (wrapper) { wrapper.style.display = "block"; wrapper.style.gap = "0"; wrapper.style.marginTop = "0"; }
}

window.cancelProductEdit = () => {
  currentEditId = null; clearProductForm(); submitBtn.innerText = "เพิ่มสินค้าเข้าระบบ"; removeProductCancelButton();
};

window.editProduct = (id) => {
  const p = allProducts.find(item => item.id === id); if (!p) return;
  currentEditId = id; productName.value = p.name || ""; productImage.value = p.image || ""; productPrice.value = p.price || ""; productSalePrice.value = p.salePrice || ""; productDescription.value = p.description || ""; productCategory.value = p.category || "";
  if(productTier) productTier.value = p.tier || ""; shopee1.value = p.shopee1 || ""; shopee2.value = p.shopee2 || ""; lazada.value = p.lazada || ""; isNew.checked = !!p.isNew; isHot.checked = !!p.isHot; comingSoon.checked = !!p.comingSoon;
  if(isAdminRecommend) isAdminRecommend.checked = !!p.isAdminRecommend; // โหลดสถานะ Checkbox ของป้ายแอดมินตอนกดแก้ไข
  
  submitBtn.innerText = "บันทึกการแก้ไขสินค้า"; 
  let wrapper = document.getElementById("submitBtnWrapper");
  if (!wrapper) {
    wrapper = document.createElement("div"); wrapper.id = "submitBtnWrapper"; submitBtn.parentNode.insertBefore(wrapper, submitBtn); wrapper.appendChild(submitBtn);
  }
  wrapper.style.display = "flex"; wrapper.style.gap = "10px"; wrapper.style.width = "100%"; wrapper.style.marginTop = "15px";
  submitBtn.style.width = "70%"; submitBtn.style.margin = "0";
  
  if (!document.getElementById("productCancelBtn")) {
    const cancelBtn = document.createElement("button"); cancelBtn.id = "productCancelBtn"; cancelBtn.innerText = "ยกเลิก"; cancelBtn.className = "btn delete"; 
    cancelBtn.style.width = "30%"; cancelBtn.style.margin = "0"; cancelBtn.style.whiteSpace = "nowrap";
    cancelBtn.onclick = (e) => { e.preventDefault(); window.cancelProductEdit(); };
    wrapper.appendChild(cancelBtn);
  }
  document.getElementById("adminPanel").scrollIntoView({ behavior: "smooth" });
};

window.deleteProduct = async (id) => {
  if (confirm("ต้องการลบสินค้าถาวรออกจากฐานข้อมูลคลาวด์?")) {
    try { 
      await deleteDoc(doc(db, "products", id)); if (currentEditId === id) window.cancelProductEdit();
      await bumpCloudVersion(); loadMasterData(); 
    } catch (error) { alert(error.message); }
  }
};

/* ================= 🔒 ระบบดูแลสิทธิ์และเข้าสู่ระบบควบคุม ================= */
const loginBtn = document.getElementById("loginBtn"); const logoutBtn = document.getElementById("logoutBtn"); const authModal = document.getElementById("authModal"); const closeAuthBtn = document.getElementById("closeAuthBtn"); const authSubmitBtn = document.getElementById("authSubmitBtn"); const adminPanel = document.getElementById("adminPanel");

if(loginBtn) loginBtn.onclick = () => authModal.style.display = "flex";
if(closeAuthBtn) closeAuthBtn.onclick = () => { authModal.style.display = "none"; };
if(authSubmitBtn) {
  authSubmitBtn.onclick = async () => {
    try {
      await signInWithEmailAndPassword(auth, document.getElementById("authEmail").value.trim(), document.getElementById("authPassword").value.trim());
      authModal.style.display = "none"; document.getElementById("authEmail").value = ""; document.getElementById("authPassword").value = "";
    } catch (error) { alert("สิทธิ์เข้าใช้งานไม่ถูกต้อง!"); }
  };
}
if(logoutBtn) logoutBtn.onclick = () => { signOut(auth).then(() => { alert("ออกจากแผงควบคุมแอดมินเรียบร้อยครับ"); window.cancelProductEdit(); }); };

onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  const dStyle = isAdmin ? "flex" : "none";
  if(loginBtn) loginBtn.style.display = isAdmin ? "none" : "inline-block";
  if(logoutBtn) logoutBtn.style.display = isAdmin ? "inline-block" : "none";
  if(adminPanel) adminPanel.style.display = dStyle;
  if(adminCategoryPanel) adminCategoryPanel.style.display = dStyle;
  if(adminWidgetPanel) adminWidgetPanel.style.display = dStyle;
  if(adminDragSortPanel) adminDragSortPanel.style.display = dStyle;
  if(!isAdmin) {
    window.cancelProductEdit();
    if (realtimeUsersUnsubscribe) { realtimeUsersUnsubscribe(); realtimeUsersUnsubscribe = null; }
  }
  initUserPresenceSystem();
  loadMasterData();
});

const backToTopBtn = document.getElementById("backToTopBtn");
if (backToTopBtn) {
  window.addEventListener("scroll", () => { if (window.scrollY > 300) backToTopBtn.classList.add("show"); else backToTopBtn.classList.remove("show"); });
  backToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

window.scrollSlide = (elementId, direction) => {
  const el = document.getElementById(elementId); if (!el || el.children.length <= 1) return;
  const cardWidth = el.children[0].offsetWidth + 10;
  el.scrollTo({ left: direction === "right" ? el.scrollLeft + cardWidth : el.scrollLeft - cardWidth, behavior: "smooth" });
};
function initAutoSliders() {
  if (hotSlideInterval) clearInterval(hotSlideInterval); if (newSlideInterval) clearInterval(newSlideInterval);
  hotSlideInterval = setInterval(() => window.scrollSlide("hotProducts", "right"), 6000);
  newSlideInterval = setInterval(() => window.scrollSlide("newProducts", "right"), 7000);
}

function renderAdminDragSortLists() {
  const adminHotDragList = document.getElementById("adminHotDragList"), adminNewDragList = document.getElementById("adminNewDragList");
  if (!adminHotDragList || !adminNewDragList) return;
  const hotProducts = allProducts.filter(p => p.isHot).sort((a, b) => (a.hotOrder ?? 0) - (b.hotOrder ?? 0));
  const newProducts = allProducts.filter(p => p.isNew).sort((a, b) => (a.newOrder ?? 0) - (b.newOrder ?? 0));
  adminHotDragList.innerHTML = hotProducts.map(p => `<div class="admin-cat-item admin-draggable" draggable="true" data-sortid="${p.id}" data-type="hot"><span>☰ ${p.name}</span></div>`).join("");
  adminNewDragList.innerHTML = newProducts.map(p => `<div class="admin-cat-item admin-draggable" draggable="true" data-sortid="${p.id}" data-type="new"><span>☰ ${p.name}</span></div>`).join("");
  setupNewHotDragAndDrop();
}

function setupNewHotDragAndDrop() {
  const dragItems = document.querySelectorAll("#adminHotDragList .admin-cat-item, #adminNewDragList .admin-cat-item");
  dragItems.forEach(item => {
    item.addEventListener("dragstart", (e) => { draggedSortId = item.getAttribute("data-sortid"); });
    item.addEventListener("dragover", (e) => e.preventDefault());
    item.addEventListener("drop", (e) => {
      e.preventDefault(); const targetId = item.getAttribute("data-sortid"), listType = item.getAttribute("data-type");
      if (draggedSortId === targetId) return;
      let currentGroup = allProducts.filter(p => listType === "hot" ? p.isHot : p.isNew).sort((a, b) => listType === "hot" ? (a.hotOrder ?? 0) - (b.hotOrder ?? 0) : (a.newOrder ?? 0) - (b.newOrder ?? 0));
      const dIdx = currentGroup.findIndex(p => p.id === draggedSortId), tIdx = currentGroup.findIndex(p => p.id === targetId);
      if (dIdx === -1 || tIdx === -1) return;
      const [removed] = currentGroup.splice(dIdx, 1); currentGroup.splice(tIdx, 0, removed);
      currentGroup.forEach((prod, idx) => { const f = allProducts.find(x => x.id === prod.id); if(f) { if(listType === "hot") f.hotOrder = idx; else f.newOrder = idx; } });
      renderAdminView();
    });
  });
}

window.saveSpecialGroupOrdersManually = async () => {
  try {
    alert("⏳ กำลังอัปโหลดสลับตำแหน่ง HOT / NEW ขึ้นคลาวด์...");
    const batch = writeBatch(db);
    allProducts.forEach(prod => { batch.update(doc(db, "products", prod.id), { hotOrder: prod.hotOrder ?? 0, newOrder: prod.newOrder ?? 0 }); });
    await batch.commit(); await bumpCloudVersion(); alert("💾 อัปเดตลำดับกลุ่มสิทธิพิเศษสำเร็จ!"); loadMasterData();
  } catch (err) { alert(err.message); }
};