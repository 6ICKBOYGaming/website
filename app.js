// เพิ่มบรรทัดนี้ไว้ด้านบนสุดของไฟล์ app.js ร่วมกับพวกประกาศตั้งค่า Firebase อื่นๆ ครับ
import { getSmartCachedData } from "./cache.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  setDoc, 
  getDoc,
  getDocs,
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

// 🔥 [No Cache] เปลี่ยนมาใช้ getFirestore แบบเชื่อมตรง ดึงข้อมูลสด 100% ไม่เก็บ Cache ในเครื่อง
const db = getFirestore(app);

console.log("%c╠══ [Firebase V8.0-SpeedRender] ดึงข้อมูลตรงจาก Cloud 100% (No Cache Mode) ⚡", "color: #ff9900; font-weight: bold;");

const auth = getAuth(app);
const productsRef = collection(db, "products");
const categoriesRef = collection(db, "categories_list");
const consoleCategoriesRef = collection(db, "console_categories_list"); // 🎮 เพิ่ม Collection แยกสำหรับหมวดหมู่เกมคอนโซล
const onlineUsersRef = collection(db, "online_users");
const deletedLogRef = collection(db, "deleted_products_log");

let allProducts = []; 
let dbCategories = [];
let dbConsoleCategories = []; // 🎮 เพิ่มตัวแปรเก็บข้อมูลหมวดหมู่เกมคอนโซล
let isAdmin = false;
let currentEditId = null;
let currentEditCategoryId = null; 
let currentEditConsoleCategoryId = null; // 🎮 เพิ่มตัวแปรสำหรับแก้ไขหมวดหมู่เกมคอนโซล
let selectedCategory = "ทั้งหมด";
let currentSortMode = "tierlist"; 

let draggedProductId = null;
let draggedCategoryId = null;
let draggedConsoleCategoryId = null; // 🎮 เพิ่มตัวแปร Drag & Drop สำหรับหมวดหมู่เกมคอนโซล
let draggedSortId = null; 

let hotSlideInterval = null;
let newSlideInterval = null;
let globalFlashSaleTimerInterval = null; 
let userPresenceInterval = null;

const ADMIN_BADGE_LOGO_URL = "https://i.postimg.cc/brG5HJBR/123.jpg";

const hotEl = document.getElementById("hotProducts");
const goToFlashSaleAdminBtn = document.getElementById("goToFlashSaleAdminBtn");
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
const isAdminRecommendInput = document.getElementById("isAdminRecommend"); 
const submitBtn = document.getElementById("submitBtn");

const adminCategoryTitle = document.getElementById("adminCategoryTitle");
const adminCategoryInput = document.getElementById("adminCategoryInput");
const adminCategoryList = document.getElementById("adminCategoryList");
const adminCategoryPanel = document.getElementById("adminCategoryPanel");
const categorySubmitBtn = document.getElementById("categorySubmitBtn");
const categoryCancelBtn = document.getElementById("categoryCancelBtn");
const searchInput = document.getElementById("search");

// 🎮 สร้างหรือดึง Element สำหรับแผงจัดการหมวดหมู่เกมคอนโซล
let adminConsoleCategoryTitle = document.getElementById("adminConsoleCategoryTitle");
let adminConsoleCategoryInput = document.getElementById("adminConsoleCategoryInput");
let adminConsoleCategoryList = document.getElementById("adminConsoleCategoryList");
let adminConsoleCategoryPanel = document.getElementById("adminConsoleCategoryPanel");
let consoleCategorySubmitBtn = document.getElementById("consoleCategorySubmitBtn");
let consoleCategoryCancelBtn = document.getElementById("consoleCategoryCancelBtn");

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

if (goToFlashSaleAdminBtn) {
    goToFlashSaleAdminBtn.onclick = () => {
        window.location.href = "./flash-sale-admin.html"; 
    };
}

/* ================= 🔄 ระบบจัดการเวอร์ชันข้อมูล ================= */
async function bumpCloudVersion() {
  try {
    const nowTimestamp = Date.now();
    const versionRef = doc(db, "settings", "version_control");
    await setDoc(versionRef, { lastUpdated: nowTimestamp }, { merge: true });
  } catch (err) { console.error(err); }
}

/* ================= 🌓 สไตล์ชีทพิเศษสำหรับหมวดหมู่ Flash Sale ================= */
if (!document.getElementById("flash-sale-custom-style")) {
  const styleEl = document.createElement("style");
  styleEl.id = "flash-sale-custom-style";
  styleEl.innerHTML = `
    .category.flash-sale-menu-item {
      color: #ff3b3b !important;
      font-weight: bold !important;
      border: 1px dashed rgba(255, 59, 59, 0.3);
      animation: flash-menu-glow 2s infinite ease-in-out;
    }
    .category.flash-sale-menu-item.active {
      background: #ff3b3b !important;
      color: #ffffff !important;
      border: 1px solid #ff3b3b;
      box-shadow: 0 0 10px rgba(255, 59, 59, 0.5);
    }
    @keyframes flash-menu-glow {
      0%, 100% { box-shadow: 0 0 2px rgba(255, 59, 59, 0.1); }
      50% { box-shadow: 0 0 8px rgba(255, 59, 59, 0.4); background: rgba(255, 59, 59, 0.05); }
    }
  `;
  document.head.appendChild(styleEl);
}

/* ================= 📈 ระบบบันทึกสถิติ PageViews รายชั่วโมงแบบประหยัด ================= */
async function recordVisitorTraffic() {
  if (isAdmin) return; 
  
  try {
    const now = new Date();
    const tzOffset = 7 * 60 * 60 * 1000; 
    const localTime = new Date(now.getTime() + tzOffset);
    const dateString = localTime.toISOString().split('T')[0]; 
    
    const currentHour = localTime.getUTCHours();
    const analyticsDocRef = doc(db, "analytics", dateString);
    const isNewSession = !sessionStorage.getItem("visited_today");
    
    let updateData = {};
    updateData["totalPageViews"] = increment(1);         
    updateData[`hourlyTraffic.${currentHour}`] = increment(1); 
    
    if (isNewSession) {
      updateData["uniqueUsers"] = increment(1); 
      sessionStorage.setItem("visited_today", "true");
    }

    await setDoc(analyticsDocRef, updateData, { merge: true });
    console.log(`📊 [Analytics] บันทึกยอดเข้าชมรอบชั่วโมงที่ ${currentHour} เรียบร้อยแล้ว`);
  } catch (error) {
    console.error("Failed to record traffic analytics:", error);
  }
}

/* ================= 👑 ระบบติดตามจำนวนผู้เข้าชมแบบประหยัด Read ================= */
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

// เรียกเปิดระบบ Presence ครั้งแรก
initUserPresenceSystem();

window.addEventListener('storePageView', (e) => {
    recordVisitorTraffic(e.detail);
});

async function checkOnlineUsersCountManual() {
  const realtimeCounterDisplay = document.getElementById("realtimeUsersCountDisplay");
  if (!realtimeCounterDisplay) return;

  try {
    const now = Date.now();
    const activeThreshold = now - 60000; 
    
    const activeQuery = query(onlineUsersRef, where("lastActive", ">=", activeThreshold));
    const activeSnapshot = await getDocs(activeQuery);
    
    let onlineCount = activeSnapshot.size;
    realtimeCounterDisplay.innerText = onlineCount;

    if (isAdmin) {
      const expiredQuery = query(onlineUsersRef, where("lastActive", "<", activeThreshold), limit(400));
      const expiredSnapshot = await getDocs(expiredQuery);
      
      if (!expiredSnapshot.empty) {
        const batch = writeBatch(db);
        expiredSnapshot.forEach(docSnap => {
          batch.delete(doc(db, "online_users", docSnap.id));
        });
        await batch.commit();
        console.log(`🧹 [Presence Cleanup] ลบขยะเซสชันหมดอายุสำเร็จ จำนวน: ${expiredSnapshot.size} รายการ`);
      }
    }
  } catch (err) {
    console.error("Manual Presence Count Error:", err);
  }
}

/* ================= 📊 ฟังก์ชันกลางสำหรับหา "ราคาสุทธิที่จะใช้คำนวณเรียงลำดับ" ================= */
function getEffectivePrice(p) {
  const priceNormal = p.price ? Number(p.price) : 0;
  const priceSale = p.salePrice ? Number(p.salePrice) : 0;
  const priceFlash = p.flashSalePrice ? Number(p.flashSalePrice) : 0;
  const currentFlashSaleTimeVal = p.flashSaleEndTime || "";
  const isFlashSaleActive = currentFlashSaleTimeVal ? (new Date(currentFlashSaleTimeVal).getTime() - new Date().getTime() > 0) : false;

  if (isFlashSaleActive && priceFlash > 0) {
    return priceFlash;
  }
  return priceSale > 0 ? priceSale : priceNormal;
}

/* ================= ⚙️ โหลดข้อมูลหลัก (Master Data Loader - Smart Cache System) ================= */
async function loadMasterData() {
  try {
    const fetchLiveDocsFromCloud = async () => {
      let products = [];
      const prodSnap = await getDocs(query(productsRef, orderBy("order", "asc")), { source: 'default' });
      prodSnap.forEach(d => products.push({ id: d.id, ...d.data() }));

      let categories = [];
      const catSnap = await getDocs(query(categoriesRef, orderBy("order")), { source: 'default' });
      catSnap.forEach(d => categories.push({ id: d.id, ...d.data() }));

      let consoleCategories = [];
      const consoleCatSnap = await getDocs(query(consoleCategoriesRef, orderBy("order")), { source: 'default' });
      consoleCatSnap.forEach(d => consoleCategories.push({ id: d.id, ...d.data() }));

      const widgetSnap = await getDoc(doc(db, "settings", "shopee_promo_widget"), { source: 'default' });
      let widget = widgetSnap.exists() ? widgetSnap.data() : null;

      return { products, categories, consoleCategories, widget };
    };

    const result = await getSmartCachedData(db, fetchLiveDocsFromCloud, isAdmin);

    allProducts = result.products || [];
    dbCategories = result.categories || [];
    dbConsoleCategories = result.consoleCategories || []; 

    ensureConsoleCategoryElementsExist();
    allProducts = result.products || [];
    dbCategories = result.categories || [];
    dbConsoleCategories = result.consoleCategories || []; 

    ensureConsoleCategoryElementsExist();
    ensureAdminActionButtonsExist(); // 🔥 เพิ่มบรรทัดนี้เข้าไปครับ

    if (typeof updateCategoryDropdown === "function") {
      updateCategoryDropdown();
    }
    
    const mockWidgetSnap = {
      exists: () => !!result.widget,
      data: () => result.widget
    };
    applyWidgetSettings(mockWidgetSnap);

    const hotProducts = allProducts.filter(p => p.isHot && (isAdmin || !p.comingSoon)).sort((a, b) => (a.hotOrder ?? 0) - (b.hotOrder ?? 0));
    const newProducts = allProducts.filter(p => p.isNew && (isAdmin || !p.comingSoon)).sort((a, b) => (a.newOrder ?? 0) - (b.newOrder ?? 0));

    if (hotEl) hotEl.innerHTML = hotProducts.map(p => card(p)).join("");
    if (newEl) newEl.innerHTML = newProducts.map(p => card(p)).join("");

    initAutoSliders();
    
    render();

    if (!isAdmin) {
      recordVisitorTraffic(); 
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

function getOptimizedImageUrl(originalUrl, targetWidth = 350) {
  if (!originalUrl || typeof originalUrl !== "string") return "https://via.placeholder.com/180";
  const trimmedUrl = originalUrl.trim();
  if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) return trimmedUrl;
  
  if (isAdmin || trimmedUrl.includes("via.placeholder.com")) return trimmedUrl;
  
  return `https://wsrv.nl/?url=${encodeURIComponent(trimmedUrl)}&w=${targetWidth}&output=webp&q=80&il`;
}

function formatPrice(p){ if(p === undefined || p === null || p === "") return ""; return "฿" + Number(p).toLocaleString("th-TH"); }

function card(p, index){
  const priceNormal = p.price ? Number(p.price) : 0;
  const priceSale = p.salePrice ? Number(p.salePrice) : 0;
  const priceFlash = p.flashSalePrice ? Number(p.flashSalePrice) : 0; 
  const currentFlashSaleTimeVal = p.flashSaleEndTime || "";
  
  const isFlashSaleActive = currentFlashSaleTimeVal ? (new Date(currentFlashSaleTimeVal).getTime() - new Date().getTime() > 0) : false;
  const isProductComingSoon = !!p.comingSoon || (priceNormal === 0 && priceSale === 0);
  
  let priceHtmlDisplay = "";
  if (isProductComingSoon) {
    priceHtmlDisplay = `<div class="price coming-soon-text">Coming Soon...</div>`;
  } else if (isFlashSaleActive && priceFlash > 0) {
    const baseDisplayOldPrice = priceSale > 0 ? priceSale : priceNormal;
    priceHtmlDisplay = `<div class="price old-price-slashed">${formatPrice(baseDisplayOldPrice)}</div><div class="price flash-active-price" style="color:#f87171; font-weight:8px; text-shadow:0 0 6px rgba(248,113,113,0.25);">${formatPrice(priceFlash)}</div>`;
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
      shopeeBtns += `<a class="btn shopee" href="${link1}" target="_blank">${cartIconSvg}Shopee 1</a>`;
      shopeeBtns += `<a class="btn shopee" href="${link2}" target="_blank">${cartIconSvg}Shopee 2</a>`;
    } else if (link1 || link2) {
      shopeeBtns += `<a class="btn shopee" href="${link1 || link2}" target="_blank">${cartIconSvg}Shopee</a>`;
    } else {
      shopeeBtns += `<a class="btn disabled" href="javascript:void(0);">${cartIconSvg}Shopee</a>`;
    }
    
    const lazadaBtn = p.lazada?.trim() ? `<a class="btn lazada" href="${p.lazada.trim()}" target="_blank">${cartIconSvg}Lazada</a>` : `<a class="btn disabled" href="javascript:void(0);">${cartIconSvg}Lazada</a>`;
    btnsContent = shopeeBtns + lazadaBtn;
  }

  const canDrag = isAdmin && currentSortMode === "tierlist";
  const dragAttr = canDrag ? `draggable="true" data-id="${p.id}" class="card admin-draggable"` : `class="card" data-id="${p.id}"`;

  let tierBadgeHtml = "";
  if (p.tier) {
    tierBadgeHtml = `<div class="tier-badge rank-${p.tier}">Tier ${p.tier}</div>`;
  } else if (currentSortMode === "tierlist" && selectedCategory !== "ทั้งหมด" && selectedCategory !== "⚡ Flash Sale" && index !== undefined && index >= 0 && index < 5) {
    const displayRank = index + 1;
    tierBadgeHtml = `<div class="tier-badge rank-${displayRank}">${displayRank}</div>`;
  }

  let adminLogoBadgeHtml = "";
  if (p.isAdminRecommend) {
    adminLogoBadgeHtml = `
      <div class="admin-custom-logo-badge" style="
        position: absolute; 
        top: 8px; 
        left: 8px; 
        width: 32px; 
        height: 32px; 
        border-radius: 50% !important; 
        overflow: hidden !important;
        border: 2px solid #ffffff !important; 
        box-shadow: 0 3px 8px rgba(0,0,0,0.3); 
        z-index: 99 !important; 
        background-image: url('${ADMIN_BADGE_LOGO_URL}') !important;
        background-position: center center !important;
        background-repeat: no-repeat !important;
        background-size: cover !important;
      "></div>
    `;
  }

  const imageLink = (!isProductComingSoon && (p.shopee1?.trim() || p.shopee2?.trim())) ? (p.shopee1?.trim() || p.shopee2?.trim()) : "";
  const imageSrc = getOptimizedImageUrl(p.image);
  
  let finalImageTag = "";
  if (isAdmin) {
    finalImageTag = `<img src="${imageSrc}" alt="${p.name}" style="width:100%; height:200px; object-fit:cover;">`;
  } else {
    finalImageTag = `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" data-src="${imageSrc}" alt="${p.name}" class="lazy-load-img" style="width:100%; height:200px; object-fit:cover; opacity:0; transition:opacity 0.3s ease-in-out;">`;
  }

  const imageHtml = imageLink ? 
    `<a href="${imageLink}" target="_blank" class="card-img-link" style="position:relative; display:block; min-height:200px; background:rgba(255,255,255,0.02);">${adminLogoBadgeHtml}${finalImageTag}</a>` : 
    `<div style="position:relative; display:block; min-height:200px; background:rgba(255,255,255,0.02);">${adminLogoBadgeHtml}${finalImageTag}</div>`;

  let flashSaleTimerHtml = "";
  if (!isProductComingSoon && currentFlashSaleTimeVal && isFlashSaleActive) {
    flashSaleTimerHtml = `
      <div class="card-flash-sale-box" id="flash-box-${p.id}">
        <span class="flash-sale-badge-text">Flash Sale</span>
        <div class="flash-sale-countdown-clock dynamic-countdown-timer" data-id="${p.id}" data-endtime="${currentFlashSaleTimeVal}">00h 00m 00s</div>
      </div>
    `;
  }

  const currentQuickPriceVal = p.salePrice > 0 ? p.salePrice : (p.price > 0 ? p.price : "");
  const currentQuickFlashPriceVal = p.flashSalePrice > 0 ? p.flashSalePrice : ""; 

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
          <div class="admin-card-actions">
            <button class="btn edit" onclick='editProduct("${p.id}")'>Edit</button>
            <button class="btn delete" onclick='deleteProduct("${p.id}")'>Delete</button>
          </div>
          
          <div class="quick-admin-controls-wrapper" style="display: flex; flex-direction: column; gap: 8px;">
            <div class="quick-price-box">
              <label>⚡️ ราคาปกติ / ราคาลดด่วน:</label>
              <div class="quick-price-row">
                <input type="text" class="quick-price-input" value="${currentQuickPriceVal}" placeholder="ระบุราคาปกติ..." onkeydown="handleQuickPriceKey(event, '${p.id}')">
                <button class="quick-price-clear-btn" title="เคลียร์ค่าราคาปกติ" onclick="clearQuickPrice('${p.id}')">✕</button>
              </div>
            </div>
            
            <div class="quick-price-box" style="border-top: 1px dotted rgba(255,255,255,0.1); padding-top: 6px;">
              <label style="color: #ff6b6b; font-weight: bold;">🏷️ ตั้งราคาพิเศษ Flash Sale:</label>
              <div class="quick-price-row">
                <input type="text" class="quick-flash-price-input" value="${currentQuickFlashPriceVal}" placeholder="เช่น 990 (เว้นว่าง = ใช้ราคาปกติ)" onkeydown="handleQuickFlashPriceKey(event, '${p.id}')" style="border-color: rgba(239, 68, 68, 0.4);">
                <button class="quick-price-clear-btn" title="ลบราคา Flash" onclick="clearQuickFlashPrice('${p.id}')">✕</button>
              </div>
            </div>

            <div class="quick-flash-sale-box">
              <label>⏰ ตั้งเวลานับถอยหลังแคมเปญ:</label>
              <div class="quick-price-row">
                <input type="text" class="quick-date-input" value="" placeholder="สูตรด่วน: ราคา@เวลา (เช่น 990@1h) หรือใส่แค่เวลา 1h, 45m" onkeydown="handleQuickFlashSaleKey(event, '${p.id}')">
                <button class="quick-price-clear-btn" title="ลบและหยุดเวลาแฟลช" onclick="clearQuickFlashSale('${p.id}')">✕</button>
              </div>
            </div>
            
            <div class="quick-recommend-badge-box" style="margin-top: 4px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px; display: flex; align-items: center; justify-content: space-between; width:100%; box-sizing: border-box;">
              <label style="font-size:12px; color:#a3a3a3; display:flex; align-items:center; gap:8px; cursor:pointer; flex: 1;">
                <img src="${ADMIN_BADGE_LOGO_URL}" style="width:20px !important; height:20px !important; min-width:20px !important; min-height:20px !important; max-width:20px !important; max-height:20px !important; border-radius:50% !important; object-fit: cover !important; display: inline-block !important; vertical-align: middle;">
                <span>เปิดใช้ป้ายโลโก้แอดมิน:</span>
              </label>
              <input type="checkbox" ${p.isAdminRecommend ? "checked" : ""} onchange="toggleQuickAdminRecommend('${p.id}', this.checked)" style="width:18px !important; height:18px !important; min-width:18px !important; cursor:pointer; margin: 0;">
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  </div>
  `;
}

window.toggleQuickAdminRecommend = async (productId, isChecked) => {
  try {
    const nowTime = Date.now();
    await updateDoc(doc(db, "products", productId), { isAdminRecommend: isChecked, lastUpdated: nowTime });
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
      const nowTime = Date.now();
      let updateFields = { comingSoon: false, lastUpdated: nowTime };
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

window.handleQuickFlashPriceKey = async (event, productId) => {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault(); 
    const inputVal = event.target.value.trim();
    if (!inputVal || isNaN(inputVal)) { alert("กรุณาระบุราคา Flash Sale เป็นตัวเลขเท่านั้นครับ"); return; }
    const flashPriceNum = Number(inputVal);
    
    try {
      const nowTime = Date.now();
      event.target.blur();
      await updateDoc(doc(db, "products", productId), { flashSalePrice: flashPriceNum, lastUpdated: nowTime });
      const foundIdx = allProducts.findIndex(p => p.id === productId);
      if (foundIdx !== -1) allProducts[foundIdx].flashSalePrice = flashPriceNum;
      await bumpCloudVersion(); 
      loadMasterData();
    } catch (err) { alert(err.message); }
  }
};

window.clearQuickFlashPrice = async (productId) => {
  try {
    const nowTime = Date.now();
    await updateDoc(doc(db, "products", productId), { flashSalePrice: 0, lastUpdated: nowTime });
    const foundIdx = allProducts.findIndex(p => p.id === productId);
    if (foundIdx !== -1) allProducts[foundIdx].flashSalePrice = 0;
    await bumpCloudVersion(); loadMasterData();
  } catch (err) { alert(err.message); }
};

window.clearQuickPrice = async (productId) => {
  try {
    const nowTime = Date.now();
    await updateDoc(doc(db, "products", productId), { comingSoon: true, lastUpdated: nowTime });
    await bumpCloudVersion(); loadMasterData();
  } catch (err) { alert(err.message); }
};

window.handleQuickFlashSaleKey = async (event, productId) => {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault(); 
    let rawInput = event.target.value.trim().toLowerCase();
    if (!rawInput) { alert("กรุณากรอกระบุเวลาด้วยครับ"); return; }
    
    let timePart = rawInput;
    let extractedFlashPrice = null;

    if (rawInput.includes("@")) {
      const parts = rawInput.split("@");
      const priceStr = parts[0].trim();
      timePart = parts[1].trim();

      if (priceStr && !isNaN(priceStr)) {
        extractedFlashPrice = Number(priceStr);
      }
    }
    
    let totalMs = 0;
    const hasUnit = /[hms]/.test(timePart);

    if (hasUnit) {
      const matches = timePart.match(/(\d+(\.\d+)?)\s*([hms])/g);
      if (matches) {
        matches.forEach(match => {
          const part = match.trim();
          const unit = part.slice(-1); 
          const value = parseFloat(part.slice(0, -1)) || 0;

          if (unit === 'h') totalMs += value * 60 * 60 * 1000;
          if (unit === 'm') totalMs += value * 60 * 1000;
          if (unit === 's') totalMs += value * 1000;
        });
      } else {
        alert("รูปแบบหน่วยเวลาผิดพลาด! ตัวอย่าง: 1h, 45m หรือเขียนย่อพร้อมราคาเช่น 990@2h");
        return;
      }
    } else {
      if (timePart.includes(".")) {
        const parts = timePart.split(".");
        const hours = parseInt(parts[0], 10) || 0;
        const minutes = parseInt(parts[1], 10) || 0;
        totalMs = (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
      } else {
        const hours = parseFloat(timePart);
        if (isNaN(hours) || hours <= 0) { alert("กรุณาใส่เวลาที่ถูกต้องด้วยครับ"); return; }
        totalMs = hours * 60 * 60 * 1000;
      }
    }

    if (totalMs <= 0) { alert("เวลาที่คำนวณได้ต้องมากกว่า 0 วินาทีครับ"); return; }
    
    const endTimeIsoString = new Date(new Date().getTime() + totalMs).toISOString();
    const nowTime = Date.now();
    
    let updateFields = { flashSaleEndTime: endTimeIsoString, lastUpdated: nowTime };
    if (extractedFlashPrice !== null) {
      updateFields.flashSalePrice = extractedFlashPrice;
    }

    try {
      event.target.value = ""; 
      event.target.blur();
      await updateDoc(doc(db, "products", productId), updateFields);
      const foundIdx = allProducts.findIndex(p => p.id === productId);
      if (foundIdx !== -1) {
        allProducts[foundIdx] = { ...allProducts[foundIdx], ...updateFields };
      }
      await bumpCloudVersion(); 
      loadMasterData();
    } catch (err) { alert(err.message); }
  }
};

window.clearQuickFlashSale = async (productId) => {
  try {
    const nowTime = Date.now();
    await updateDoc(doc(db, "products", productId), { flashSaleEndTime: "", flashSalePrice: 0, lastUpdated: nowTime });
    const foundIdx = allProducts.findIndex(p => p.id === productId);
    if (foundIdx !== -1) {
      allProducts[foundIdx].flashSaleEndTime = "";
      allProducts[foundIdx].flashSalePrice = 0;
    }
    await bumpCloudVersion(); loadMasterData();
  } catch (err) { alert(err.message); }
};

function startFlashSaleClockTicker() {
  if (globalFlashSaleTimerInterval) clearInterval(globalFlashSaleTimerInterval);
  
  globalFlashSaleTimerInterval = setInterval(() => {
    const timerElements = document.querySelectorAll(".dynamic-countdown-timer");
    let needReRender = false;
    const now = Date.now();
    
    allProducts.forEach(p => {
      if (p.flashSaleEndTime) {
        const timeRemaining = new Date(p.flashSaleEndTime).getTime() - now;
        if (timeRemaining <= 0) {
          p.flashSaleEndTime = "";
          p.flashSalePrice = 0;
          needReRender = true;
          
          updateDoc(doc(db, "products", p.id), { flashSaleEndTime: "", flashSalePrice: 0, lastUpdated: Date.now() })
            .then(() => bumpCloudVersion())
            .catch(err => console.error("Flash Sale Auto-Revert Cloud Error:", err));
        }
      }
    });

    if (needReRender) {
      render();
      return;
    }
    
    if (timerElements.length === 0) return;
    
    timerElements.forEach((el) => {
      const endTimeAttr = el.getAttribute("data-endtime");
      if (!endTimeAttr) return;
      
      const timeRemaining = new Date(endTimeAttr).getTime() - Date.now();
      
      if (timeRemaining > 0) {
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

/* ================= 🌓 หน้าแสดงผลสินค้าฝั่งผู้ใช้ทั่วไป ================= */
function renderMobileView() {
  if (dragNoticeEl) {
    dragNoticeEl.style.display = "none";
  }

  if (document.getElementById("categoryTitle")) {
    document.getElementById("categoryTitle").innerText = "หมวดหมู่สินค้า: " + (selectedCategory || "ทั้งหมด");
  }
  
  let displayed = [];
  const now = Date.now();

  if (!selectedCategory || selectedCategory === "ทั้งหมด") {
    displayed = [...allProducts];
  } else if (selectedCategory === "⚡ Flash Sale") {
    displayed = allProducts.filter(p => {
      const hasFlashPrice = p.flashSalePrice && Number(p.flashSalePrice) > 0;
      if (!p.flashSaleEndTime) {
        return hasFlashPrice;
      }
      return hasFlashPrice && (new Date(p.flashSaleEndTime).getTime() - now > 0);
    });
  } else {
    displayed = allProducts.filter(p => {
      if (!p.category) return false;
      return p.category.toString().trim() === selectedCategory.toString().trim();
    });
  }

  if (currentSortMode === "priceAsc") {
    displayed = displayed.filter(p => !p.comingSoon && (p.price > 0 || p.salePrice > 0));
    displayed.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
  } else if (currentSortMode === "priceDesc") {
    displayed = displayed.filter(p => !p.comingSoon && (p.price > 0 || p.salePrice > 0));
    displayed.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
  } else if (currentSortMode === "adminRecommend") {
    displayed = displayed.filter(p => !!p.isAdminRecommend);
    displayed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } else {
    displayed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const kw = searchInput?.value.trim().toLowerCase();
  if (kw) {
    displayed = displayed.filter(p => 
      p.name?.toLowerCase().includes(kw) || 
      p.description?.toLowerCase().includes(kw)
    );
  }

  if (allEl) {
    allEl.innerHTML = displayed.map((p, index) => card(p, index)).join("");
  }
  
  renderSidebarCategories();
  observeLazyImages();
}

/* ================= ⚙️ [เพิ่มฟังก์ชันหลักที่ขาดหาย] ระบบเรนเดอร์จัดการหลังบ้านสำหรับ Admin ================= */
function renderAdminView() {
  if (dragNoticeEl) {
    dragNoticeEl.style.display = currentSortMode === "tierlist" ? "block" : "none";
  }

  let displayed = [...allProducts];
  const now = Date.now();

  if (selectedCategory && selectedCategory !== "ทั้งหมด") {
    if (selectedCategory === "⚡ Flash Sale") {
      displayed = allProducts.filter(p => p.flashSalePrice > 0 && (!p.flashSaleEndTime || new Date(p.flashSaleEndTime).getTime() - now > 0));
    } else {
      displayed = allProducts.filter(p => p.category && p.category.toString().trim() === selectedCategory.toString().trim());
    }
  }

  displayed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const kw = searchInput?.value.trim().toLowerCase();
  if (kw) {
    displayed = displayed.filter(p => p.name?.toLowerCase().includes(kw) || p.description?.toLowerCase().includes(kw));
  }

  if (allEl) {
    allEl.innerHTML = displayed.map((p, index) => card(p, index)).join("");
  }

  renderSidebarCategories();
  renderAdminCategoryList();
  renderAdminConsoleCategoryList();
  renderAdminDragSortLists();
  setupProductDragAndDrop(displayed);
}

/* ================= 🌓 หน้าแสดงผลแถบหมวดหมู่สินค้า ================= */
function renderSidebarCategories() {
  if (!categoriesEl) return;
  const now = Date.now();
  
  const flashSaleActiveCount = allProducts.filter(p => {
    const hasFlashPrice = p.flashSalePrice && Number(p.flashSalePrice) > 0;
    if (!p.flashSaleEndTime) return hasFlashPrice; 
    return hasFlashPrice && (new Date(p.flashSaleEndTime).getTime() - now > 0);
  }).length;

  let html = "";

  // ⭐️ ใส่ emoji ดาวแค่นำหน้าคำว่า "ทั้งหมด" จุดเดียวตามที่ต้องการครับ
  html += `
    <div class="category shrink-0 snap-center min-w-[80px] sm:w-full text-center sm:text-left px-3 py-2 text-xs sm:text-sm font-bold ${(!selectedCategory || selectedCategory === "ทั้งหมด") ? 'active' : ''}" 
         style="border-radius: 10px; cursor: pointer;" 
         onclick="window.filterCategory('ทั้งหมด')">
      ⭐ ทั้งหมด (${allProducts.length})
    </div>
  `;

  if (flashSaleActiveCount > 0) {
    html += `
      <div class="category shrink-0 snap-center min-w-[100px] sm:w-full text-center sm:text-left px-3 py-2 text-xs sm:text-sm font-bold animate-pulse ${selectedCategory === "⚡ Flash Sale" ? 'active' : ''}" 
           style="border-radius: 10px; cursor: pointer; background: linear-gradient(90deg, #ff4e50, #f9d423); color: white; border: none;" 
           onclick="window.filterCategory('⚡ Flash Sale')">
        ⚡ Flash Sale (${flashSaleActiveCount})
      </div>
    `;
  }

  dbCategories.forEach(cat => {
    const count = allProducts.filter(p => p.category && p.category.toString().trim() === cat.name.trim()).length;
    const isActive = selectedCategory && selectedCategory.trim() === cat.name.trim();
    html += `
      <div class="category shrink-0 snap-center min-w-[95px] sm:w-full text-center sm:text-left px-3 py-2 text-xs sm:text-sm font-bold ${isActive ? 'active' : ''}" 
           style="border-radius: 10px; cursor: pointer;" 
           onclick="window.filterCategory('${cat.name.trim()}')">
        ${cat.name} (${count})
      </div>
    `;
  });

  if (dbConsoleCategories && dbConsoleCategories.length > 0) {
    html += `<div class="shrink-0 snap-center font-bold text-orange-500 bg-orange-500/10 sm:bg-transparent border border-orange-500/20 sm:border-none px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs uppercase sm:mt-3 sm:pt-3 sm:border-t sm:border-white/5">🎮 คอนโซล</div>`;
    
    dbConsoleCategories.forEach(cat => {
      const count = allProducts.filter(p => p.category && p.category.toString().trim() === cat.name.trim()).length;
      const isActive = selectedCategory && selectedCategory.trim() === cat.name.trim();
      html += `
        <div class="category shrink-0 snap-center min-w-[95px] sm:w-full text-center sm:text-left px-3 py-2 text-xs sm:text-sm font-bold ${isActive ? 'active' : ''}" 
             style="border-radius: 10px; cursor: pointer;" 
             onclick="window.filterCategory('${cat.name.trim()}')">
          ${cat.name} (${count})
        </div>
      `;
    });
  }

  categoriesEl.innerHTML = html;
}

window.filterCategory = (catName) => {
  selectedCategory = catName;
  render();
};

function updateCategoryDropdown() {
  if (!productCategory) return;
  let optionsHtml = dbCategories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join("");
  if (dbConsoleCategories.length > 0) {
    optionsHtml += `<optgroup label="🎮 หมวดหมู่เกมคอนโซล">`;
    optionsHtml += dbConsoleCategories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join("");
    optionsHtml += `</optgroup>`;
  }
  productCategory.innerHTML = optionsHtml;
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

function ensureConsoleCategoryElementsExist() {
  if (!document.getElementById("adminConsoleCategoryPanel")) {
    const adminCategoryPanelEl = document.getElementById("adminCategoryPanel");
    if (adminCategoryPanelEl) {
      const consolePanelHTML = document.createElement("div");
      consolePanelHTML.id = "adminConsoleCategoryPanel";
      consolePanelHTML.className = "admin-panel"; 
      consolePanelHTML.style.marginTop = "20px";
      consolePanelHTML.style.display = isAdmin ? "block" : "none";
      consolePanelHTML.innerHTML = `
        <div class="panel-header">
          <h3 id="adminConsoleCategoryTitle" style="display:flex; align-items:center; gap:8px; margin:0;">
            แผงจัดการระบบหมวดหมู่ เกมคอนโซล
          </h3>
        </div>
        <div class="form-group" style="margin-top:12px;">
          <input type="text" id="adminConsoleCategoryInput" placeholder="ป้อนชื่อหมวดหมู่เกมคอนโซล เช่น PS5, Nintendo Switch, Xbox...">
        </div>
        <div style="display:flex; gap:10px; margin-top:12px;">
          <button id="consoleCategorySubmitBtn" class="btn edit" style="flex:1;" onclick="window.handleConsoleCategorySubmit()">เพิ่มหมวดหมู่เกมคอนโซล</button>
          <button id="consoleCategoryCancelBtn" class="btn delete" style="width:80px; display:none;" onclick="window.clearConsoleCategoryForm()">ยกเลิก</button>
        </div>
        <div id="adminConsoleCategoryList" style="margin-top:18px; display:flex; flex-direction:column; gap:8px;"></div>
      `;
      adminCategoryPanelEl.insertAdjacentElement('afterend', consolePanelHTML);
      
      adminConsoleCategoryTitle = document.getElementById("adminConsoleCategoryTitle");
      adminConsoleCategoryInput = document.getElementById("adminConsoleCategoryInput");
      adminConsoleCategoryList = document.getElementById("adminConsoleCategoryList");
      adminConsoleCategoryPanel = document.getElementById("adminConsoleCategoryPanel");
      consoleCategorySubmitBtn = document.getElementById("consoleCategorySubmitBtn");
      consoleCategoryCancelBtn = document.getElementById("consoleCategoryCancelBtn");
    }
  }
}

function renderAdminConsoleCategoryList() {
  if (!adminConsoleCategoryList) return;
  
  adminConsoleCategoryList.innerHTML = dbConsoleCategories.map(cat => `
    <div class="admin-cat-item admin-draggable" 
         draggable="true" 
         data-consolecatid="${cat.id}" 
         style="display: flex; justify-content: space-between; align-items: center; width: 100%; box-sizing: border-box; cursor: grab;">
      
      <span style="font-weight: 500; display: flex; align-items: center; gap: 8px;">
        <span style="color: var(--text-muted, #94a3b8); font-size: 14px;">☰</span>
        ${cat.name}
      </span>
      
      <div class="admin-cat-actions" style="display: flex; gap: 8px; align-items: center;">
        <button class="btn edit" onclick="window.editConsoleCategory('${cat.id}')">แก้ไข</button>
        <button class="btn delete" onclick="window.deleteConsoleCategory('${cat.id}', '${cat.name}')">ลบ</button>
      </div>
    </div>
  `).join("");
  
  setupConsoleCategoryDragAndDrop();
}

window.clearConsoleCategoryForm = () => {
  if (!adminConsoleCategoryInput) return;
  adminConsoleCategoryInput.value = ""; currentEditConsoleCategoryId = null;
  adminConsoleCategoryTitle.innerText = " แผงจัดการระบบหมวดหมู่ เกมคอนโซล"; consoleCategorySubmitBtn.innerText = "เพิ่มหมวดหมู่เกมคอนโซล";
  if(consoleCategoryCancelBtn) consoleCategoryCancelBtn.style.display = "none";
};

window.editConsoleCategory = (id) => {
  const cat = dbConsoleCategories.find(c => c.id === id); if (!cat) return;
  currentEditConsoleCategoryId = id; adminConsoleCategoryInput.value = cat.name || "";
  adminConsoleCategoryTitle.innerText = "📝 แก้ไขชื่อหมวดหมู่เกมคอนโซล"; consoleCategorySubmitBtn.innerText = "บันทึกการแก้ไข";
  if(consoleCategoryCancelBtn) consoleCategoryCancelBtn.style.display = "block"; adminConsoleCategoryInput.focus();
};

window.handleConsoleCategorySubmit = async () => {
  const name = adminConsoleCategoryInput.value.trim();
  if (!name) return;
  try {
    if (currentEditConsoleCategoryId) { 
      await updateDoc(doc(db, "console_categories_list", currentEditConsoleCategoryId), { name: name }); 
    } else {
      const maxOrder = dbConsoleCategories.reduce((max, c) => ((c.order ?? 0) > max ? c.order : max), 0);
      await addDoc(consoleCategoriesRef, { name: name, order: maxOrder + 1 });
    }
    await bumpCloudVersion(); clearConsoleCategoryForm(); loadMasterData();
  } catch (error) { alert(error.message); }
};

window.deleteConsoleCategory = async (id, name) => {
  if (confirm(`ต้องการลบหมวดหมู่เกมคอนโซล "${name}" ถาวร?`)) {
    try {
      await deleteDoc(doc(db, "console_categories_list", id));
      if (selectedCategory === name) selectedCategory = "ทั้งหมด";
      await bumpCloudVersion(); loadMasterData();
    } catch (error) { alert(error.message); }
  }
};

function setupConsoleCategoryDragAndDrop() {
  const consoleCatItems = document.querySelectorAll("#adminConsoleCategoryList .admin-cat-item");
  consoleCatItems.forEach(item => {
    item.addEventListener("dragstart", (e) => { draggedConsoleCategoryId = item.getAttribute("data-consolecatid"); });
    item.addEventListener("dragover", (e) => e.preventDefault());
    item.addEventListener("drop", async (e) => {
      e.preventDefault(); const targetConsoleCategoryId = item.getAttribute("data-consolecatid");
      if (draggedConsoleCategoryId === targetConsoleCategoryId) return;
      let currentCats = [...dbConsoleCategories];
      const dIdx = currentCats.findIndex(c => c.id === draggedConsoleCategoryId), tIdx = currentCats.findIndex(c => c.id === targetConsoleCategoryId);
      if (dIdx === -1 || tIdx === -1) return;
      const [removed] = currentCats.splice(dIdx, 1); currentCats.splice(tIdx, 0, removed);
      dbConsoleCategories = currentCats; renderAdminConsoleCategoryList();
      try {
        for (let i = 0; i < currentCats.length; i++) { await updateDoc(doc(db, "console_categories_list", currentCats[i].id), { order: i }); }
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
      const nowTime = Date.now();
      updatedList.forEach((prod, i) => { const found = allProducts.find(x => x.id === prod.id); if(found) { found.order = i; found.lastUpdated = nowTime; } });
      renderAdminView();
    });
  });
}

window.saveAllProductsOrderManually = async () => {
  try {
    alert("⏳ กำลังจัดแพ็กเกจลำดับโครงสร้างสินค้าส่งขึ้น Cloud...");
    const batch = writeBatch(db);
    const nowTime = Date.now();
    allProducts.forEach((prod, idx) => { 
      batch.update(doc(db, "products", prod.id), { order: prod.order ?? idx, lastUpdated: nowTime }); 
    });
    await batch.commit(); await bumpCloudVersion();
    alert("💾 ลำดับโครงสร้างสินค้าทั้งหมดบันทึกเรียบร้อย!"); loadMasterData();
  } catch (err) { alert(err.message); }
};

window.handleProductSubmit = async () => {
  const name = productName.value.trim(), image = productImage.value.trim();
  const price = Number(productPrice.value) || 0, salePrice = Number(productSalePrice.value) || 0;
  if (!name) { alert("กรุณาป้อนชื่อแบรนด์หรือรุ่นสินค้าด้วยครับ"); return; }

  const nowTime = Date.now();
  const productData = {
    name, image, price, salePrice, description: productDescription.value.trim(),
    category: productCategory.value, tier: productTier.value, shopee1: shopee1.value.trim(),
    shopee2: shopee2.value.trim(), lazada: lazada.value.trim(), isNew: isNew.checked,
    isHot: isHot.checked, comingSoon: comingSoon.checked || (price === 0 && salePrice === 0),
    isAdminRecommend: isAdminRecommendInput ? isAdminRecommendInput.checked : false,
    lastUpdated: nowTime
  };

  try {
    if (currentEditId) {
      await updateDoc(doc(db, "products", currentEditId), productData); currentEditId = null; submitBtn.innerText = "เพิ่มสินค้าเข้าระบบ"; removeProductCancelButton(); 
    } else {
      productData.order = allProducts.reduce((max, p) => ((p.order ?? 0) > max ? p.order : max), 0) + 1;
      productData.hotOrder = allProducts.reduce((max, p) => ((p.hotOrder ?? 0) > max ? p.hotOrder : max), 0) + 1;
      productData.newOrder = allProducts.reduce((max, p) => ((p.newOrder ?? 0) > max ? p.newOrder : max), 0) + 1;
      productData.flashSaleEndTime = ""; productData.flashSalePrice = 0;
      await addDoc(productsRef, productData);
    }
    await bumpCloudVersion(); clearProductForm(); alert("บันทึกสินค้าเรียบร้อย!"); loadMasterData();
  } catch (error) { alert(error.message); }
};

function clearProductForm() {
  productName.value = ""; productImage.value = ""; productPrice.value = ""; productSalePrice.value = ""; productDescription.value = "";
  if(productTier) productTier.value = ""; shopee1.value = ""; shopee2.value = ""; lazada.value = ""; isNew.checked = false; isHot.checked = false; comingSoon.checked = false;
  if(isAdminRecommendInput) isAdminRecommendInput.checked = false; 
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
  if(isAdminRecommendInput) isAdminRecommendInput.checked = !!p.isAdminRecommend; 
  
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
      const nowTime = Date.now();
      await addDoc(deletedLogRef, { productId: id, deletedAt: nowTime });

      await deleteDoc(doc(db, "products", id)); 
      if (currentEditId === id) window.cancelProductEdit();
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
  
  if(adminConsoleCategoryPanel) adminConsoleCategoryPanel.style.display = dStyle;
  
  if(adminWidgetPanel) adminWidgetPanel.style.display = dStyle;
  if(adminDragSortPanel) adminDragSortPanel.style.display = dStyle;

  if(goToFlashSaleAdminBtn) {
    goToFlashSaleAdminBtn.style.display = isAdmin ? "inline-flex" : "none";
  if(goToFlashSaleAdminBtn) {
    goToFlashSaleAdminBtn.style.display = isAdmin ? "inline-flex" : "none";
  }
  
  // 🔥 เพิ่มเข้าไปช่วงนี้เพื่อควบคุมการเปิด/ปิดปุ่มสถิติ
  const analyticsBtn = document.getElementById("goToAnalyticsBtn");
  if(analyticsBtn) {
    analyticsBtn.style.display = isAdmin ? "inline-flex" : "none";
  }
  }

  if(!isAdmin) {
    window.cancelProductEdit();
    window.clearConsoleCategoryForm();
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
      const nowTime = Date.now();
      currentGroup.forEach((prod, idx) => { const f = allProducts.find(x => x.id === prod.id); if(f) { f.lastUpdated = nowTime; if(listType === "hot") f.hotOrder = idx; else f.newOrder = idx; } });
      renderAdminView();
    });
  });
}

window.saveSpecialGroupOrdersManually = async () => {
  try {
    alert("⏳ กำลังอัปโหลดสลับตำแหน่ง HOT / NEW ขึ้นคลาวด์...");
    const batch = writeBatch(db);
    const nowTime = Date.now();
    allProducts.forEach(prod => { batch.update(doc(db, "products", prod.id), { hotOrder: prod.hotOrder ?? 0, newOrder: prod.newOrder ?? 0, lastUpdated: nowTime }); });
    await batch.commit(); await bumpCloudVersion(); alert("💾 อัปเดตลำดับกลุ่มสิทธิพิเศษสำเร็จ!"); loadMasterData();
  } catch (err) { alert(err.message); }
};

/* ================= 🖼️ ระบบคิวควบคุมการโหลดรูปภาพอัจฉริยะ (Lazy Loading) ================= */
function observeLazyImages() {
  const lazyImages = document.querySelectorAll(".lazy-load-img");
  if (lazyImages.length === 0) return;
  
  if (!("IntersectionObserver" in window)) {
    lazyImages.forEach(img => {
      const realSrc = img.getAttribute("data-src");
      if (realSrc) {
        img.src = realSrc;
        img.style.opacity = "1";
      }
    });
    return;
  }

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const image = entry.target;
        const realSrc = image.getAttribute("data-src");
        if (realSrc) {
          image.src = realSrc;
          image.onload = () => {
            image.style.opacity = "1"; 
          };
        }
        imageObserver.unobserve(image); 
      }
    });
  }, {
    rootMargin: "250px 0px" 
  });

  lazyImages.forEach(img => imageObserver.observe(img));
}

// เริ่มต้นระบบนับถอยหลังราคาสินค้าแบบ Global แฟลชเซลล์
startFlashSaleClockTicker();

/* ================= 🛠️ เพิ่มปุ่มสถิติและปุ่มบันทึกการลากวางสินค้าอัตโนมัติ ================= */
function ensureAdminActionButtonsExist() {
  // 1. เพิ่มปุ่ม "ดูสถิติ (Analytics)" ไว้ข้างๆ ปุ่มจัดการแฟลชเซลล์เดิม
  const flashSaleAdminBtn = document.getElementById("goToFlashSaleAdminBtn");
  if (flashSaleAdminBtn && !document.getElementById("goToAnalyticsBtn")) {
    const analyticsBtn = document.createElement("button");
    analyticsBtn.id = "goToAnalyticsBtn";
    analyticsBtn.className = "btn edit"; // ใช้คลาสเดียวกับปุ่มแก้ไขเพื่อความสวยงาม
    analyticsBtn.style.display = isAdmin ? "inline-flex" : "none";
    analyticsBtn.style.alignItems = "center";
    analyticsBtn.style.gap = "6px";
    analyticsBtn.style.marginLeft = "10px";
    analyticsBtn.innerHTML = `📊 ดูสถิติระบบ`;
    analyticsBtn.onclick = () => { window.location.href = "./analytics.html"; };
    flashSaleAdminBtn.insertAdjacentElement("afterend", analyticsBtn);
  }

  // 2. เพิ่มปุ่ม "ยืนยันการจัดลำดับสินค้า" ลงในโซน DragNotice แจ้งเตือนการลาก
  const dragNoticeContainer = document.getElementById("dragNotice");
  if (dragNoticeContainer && !document.getElementById("saveOrderDirectBtn")) {
    // ปรับสไตล์ตัวแจ้งเตือนให้รองรับปุ่ม
    dragNoticeContainer.style.display = currentSortMode === "tierlist" && isAdmin ? "flex" : "none";
    dragNoticeContainer.style.justifyContent = "between";
    dragNoticeContainer.style.alignItems = "center";
    dragNoticeContainer.style.gap = "15px";
    dragNoticeContainer.style.padding = "10px 15px";
    
    const saveOrderBtn = document.createElement("button");
    saveOrderBtn.id = "saveOrderDirectBtn";
    saveOrderBtn.className = "btn edit";
    saveOrderBtn.style.padding = "6px 15px";
    saveOrderBtn.style.fontSize = "13px";
    saveOrderBtn.style.background = "#22c55e"; // สีเขียวเซฟ
    saveOrderBtn.style.border = "none";
    saveOrderBtn.style.cursor = "pointer";
    saveOrderBtn.innerText = "💾 ยืนยันบันทึกลำดับสินค้า";
    saveOrderBtn.onclick = (e) => {
      e.preventDefault();
      if(typeof window.saveAllProductsOrderManually === "function") {
        window.saveAllProductsOrderManually();
      }
    };
    dragNoticeContainer.appendChild(saveOrderBtn);
  }
}
/* =========================================================================
   🎯 [🔥 ย้ายค่ายมาล็อกอินที่นี่] ระบบบันทึกยอดคลิกสินค้าประจำวัน (รวมศูนย์เข้า app.js)
   ========================================================================= */

// ฟังก์ชันหาคีย์วันที่โซนเวลาไทย (YYYY-MM-DD)
function getThailandDateKeyForClicks(dateObj = new Date()) {
    const options = { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const [{ value: month }, , { value: day }, , { value: year }] = formatter.formatToParts(dateObj);
    return `${year}-${month}-${day}`;
}

/**
 * ฟังก์ชันยิงข้อมูลคลิกตรงเข้า Firestore
 */
async function trackProductClickCentralized(productId, productName) {
    if (!productId) return;
    const todayStr = getThailandDateKeyForClicks();
    console.log(`📡 [Click Engine] กำลังบันทึกยอดคลิกสินค้าไปยัง Firestore ของวันที่: ${todayStr}`);
    
    // 1. อัปเดตยอดรวมตลอดกาลที่ตัวสินค้า
    try {
        const productDocRef = doc(db, "products", productId);
        await updateDoc(productDocRef, { clickCount: increment(1) });
    } catch (e) {
        try {
            const productDocRef = doc(db, "products", productId);
            await setDoc(productDocRef, { clickCount: 1 }, { merge: true });
        } catch(err) {
            console.error("❌ ไม่สามารถอัปเดตยอดคลิกที่คอลเลกชัน products ได้:", err);
        }
    }

    // 2. อัปเดตยอดแยกรายวันในคอลเลกชัน analytics (ป้องกันบั๊กขึ้นวันใหม่โครงสร้างพัง)
    try {
        const analyticsDocRef = doc(db, "analytics", todayStr);
        const docSnap = await getDoc(analyticsDocRef);
        
        if (docSnap.exists()) {
            const currentData = docSnap.data();
            if (currentData.productClicks && typeof currentData.productClicks === 'object') {
                // โครงสร้างปกติ -> อัปเดตเพิ่มค่าปกติ
                await updateDoc(analyticsDocRef, {
                    [`productClicks.${productId}`]: increment(1)
                });
            } else {
                // บั๊กโครงสร้างเพี้ยน -> บังคับจัด Map ใหม่ใน Memory แล้วส่งทับ
                let productClicksMap = typeof currentData.productClicks === 'object' ? currentData.productClicks : {};
                productClicksMap[productId] = (productClicksMap[productId] || 0) + 1;
                await setDoc(analyticsDocRef, { date: todayStr, productClicks: productClicksMap }, { merge: true });
            }
        } else {
            // วันใหม่เอี่ยม -> สร้างเอกสารพร้อม Map เริ่มต้นทันที
            await setDoc(analyticsDocRef, {
                date: todayStr,
                productClicks: { [productId]: 1 }
            }, { merge: true });
        }
        console.log(`🎉 [Click Saved] บันทึกสถิติมูลสำเร็จ! วันที่ ${todayStr} -> สินค้า: ${productName}`);
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลลงคอลเลกชัน analytics:", error);
    }
}

// ระบบดักจับเหตุการณ์คลิกแบบ Global บนหน้าเว็บ
document.addEventListener("click", (event) => {
    // ดักจับหาการ์ดสินค้า
    const cardEl = event.target.closest("[data-id]") || event.target.closest(".card") || event.target.closest(".product-card") || event.target.closest(".admin-draggable") || event.target.closest("[data-product-id]");
    if (!cardEl) return;

    const clickedElement = event.target;
    const anchorLink = clickedElement.closest("a");
    let isBuyButton = false;
    
    if (anchorLink) {
        const hrefStr = anchorLink.getAttribute("href") || "";
        const classStr = anchorLink.className || "";
        if (hrefStr.includes("shopee") || hrefStr.includes("lazada") || classStr.includes("shopee") || classStr.includes("lazada") || classStr.includes("btn") || classStr.includes("buy")) {
            isBuyButton = true;
        }
    }

    const isProductImage = clickedElement.tagName === "IMG" || clickedElement.closest(".product-img") || clickedElement.closest(".card-img-top") || clickedElement.closest(".image-wrapper");

    // ถ้ากดโดนรูปภาพ หรือ กดโดนปุ่มสั่งซื้อ
    if (isBuyButton || isProductImage) {
        let productId = cardEl.getAttribute("data-id") || cardEl.getAttribute("data-product-id");
        if (!productId) {
            const innerDataEl = cardEl.querySelector("[data-id]") || cardEl.querySelector("[data-product-id]");
            if (innerDataEl) productId = innerDataEl.getAttribute("data-id") || innerDataEl.getAttribute("data-product-id");
        }
        
        let productName = "ไม่ระบุชื่อสินค้า";
        const nameHeader = cardEl.querySelector("h4") || cardEl.querySelector("h3") || cardEl.querySelector(".product-name") || cardEl.querySelector(".card-title");
        if (nameHeader) productName = nameHeader.innerText.trim();

        if (productId) {
            console.log(`🎯 [Global Click Detected] คลิกที่สินค้า: "${productName}" (ID: ${productId})`);
            trackProductClickCentralized(productId, productName);
        }
    }
});

console.log("🚀 [System Load] ผูกระบบบันทึกคลิกรายวันเข้ากับศูนย์กลาง app.js สำเร็จแล้ว!");