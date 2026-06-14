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
const isMall = document.getElementById("isMall"); // 🔥 เพิ่มบรรทัดนี้เพื่อชี้ไปที่ Checkbox ใน HTML ของคุณ
const productKeywords = document.getElementById("productKeywords");//keyword search

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
// ป้ายโปรโมชั่น
let promoTabConfig = { active: false, title: "" };

// ฟังก์ชันดึงค่าป้ายเทศกาลจากระบบหลังบ้าน
async function loadPromoTabConfig() {
    try {
        const docRef = doc(db, "system_settings", "promo_tab_config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            promoTabConfig = docSnap.data();
        }
    } catch (e) {
        console.error("Error loading promo tab config:", e);
    }
}
// เรียกใช้งานฟังก์ชันทันทีเพื่อโหลดค่าตั้งแต่เปิดหน้าเว็บ
await loadPromoTabConfig();
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
        window.location.href = "./flash-sale-admin.html"; // ตรวจสอบว่ามีจุดสแลช (./) และชื่อไฟล์ตรงกันไหม
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
// =========================================================================
// 🚀 ADD-ON SYSTEM: Realtime Dynamic Promotion Popup (1:1 400x400px)
// =========================================================================
async function initPromotionPopupSystem(dbInstance) {
    const CACHE_KEY = "ickboy_popup_cache";
    const CACHE_TIME_KEY = "ickboy_popup_cache_ts";
    const ONE_HOUR = 1 * 60 * 60 * 1000;

    let config = null;
    const now = Date.now();
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTs = localStorage.getItem(CACHE_TIME_KEY);

    if (cachedData && cachedTs && (now - parseInt(cachedTs) < ONE_HOUR)) {
        config = JSON.parse(cachedData);
    } else {
        try {
            // ใช้คำสั่ง doc และ getDoc ตัวหลักของไฟล์โดยตรง ไม่โหลดซ้ำซ้อน
            const docRef = doc(dbInstance, "system_settings", "popup_config");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                config = docSnap.data();
                localStorage.setItem(CACHE_KEY, JSON.stringify(config));
                localStorage.setItem(CACHE_TIME_KEY, now.toString());
            }
        } catch (error) {
            console.error("🚨 ระบบคิว Popup ขัดข้องแต่หน้าร้านทำงานต่อได้ปกติ:", error);
            return;
        }
    }

    if (config && config.isActive && config.imgUrl) {
        const modalEl = document.getElementById("promoPopupModal");
        const imgEl = document.getElementById("promoPopupImg");
        const linkEl = document.getElementById("promoPopupLink");
        const closeBtn = document.getElementById("closePromoPopupBtn");

        if (!modalEl || !imgEl || !linkEl || !closeBtn) return;
        imgEl.src = config.imgUrl;
        
        if (config.targetUrl) {
            linkEl.href = config.targetUrl;
            linkEl.style.cursor = "pointer";
        } else {
            linkEl.removeAttribute("href");
            linkEl.style.cursor = "default";
        }

        setTimeout(() => {
            modalEl.style.setProperty("display", "flex", "important");
            modalEl.classList.remove("hidden");
        }, 1500);

        closeBtn.onclick = () => {
            modalEl.style.setProperty("display", "none", "important");
            modalEl.classList.add("hidden");
        };

        modalEl.onclick = (e) => {
            if (e.target === modalEl) {
                closeBtn.click();
            }
        };

        // 🔥 แก้ไขจุดบอด: เปลี่ยนมาดักจับผ่าน document และสั่งเคลียร์ Event เก่าเพื่อความแม่นยำ
        if (document._hasPromoEscapeListener) {
            document.removeEventListener("keyup", document._hasPromoEscapeListener);
        }
        
        document._hasPromoEscapeListener = (e) => {
            // เช็กทั้ง e.key และ e.keyCode (27 คือปุ่ม ESC) เพื่อรองรับเบราว์เซอร์ทุกเวอร์ชัน
            if ((e.key === "Escape" || e.key === "Esc" || e.keyCode === 27) && !modalEl.classList.contains("hidden")) {
                console.log("⌨️ [Hotkey Active] ลูกค้ากดปุ่ม ESC ทำการปิดหน้าต่าง Popup โฆษณาให้ทันที");
                e.preventDefault(); // ป้องกันไม่ให้ปุ่ม ESC ไปทำงานซ้ำซ้อนกับระบบอื่นของเบราว์เซอร์
                closeBtn.click();
            }
        };

        // สั่งให้เริ่มดักจับปุ่มทันทีบนหน้าเว็บ
        document.addEventListener("keyup", document._hasPromoEscapeListener);
    }
}
/* ================= 📈 ระบบบันทึกสถิติ PageViews รายชั่วโมงแบบประหยัด ================= */
async function recordVisitorTraffic() {
  if (isAdmin) return; 
  
  try {
    // 💡 ใช้ฟังก์ชันรูปแบบวันที่มาตรฐานโซนเอเชีย/กรุงเทพฯ ที่ดึงข้ามไฟล์มาเพื่อไม่ให้วันเพี้ยน
    const todayStr = typeof window.getThailandDateString === 'function' 
        ? window.getThailandDateString() 
        : new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }); // fallback format YYYY-MM-DD
        
    const now = new Date();
    // ดึงชั่วโมงแบบล็อกไทม์โซนไทยตรงๆ ไม่คำนวณมิลลิวินาทีดิบให้บั๊ก
    const currentHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: 'Asia/Bangkok', hour: 'numeric', hour12: false }));
    
    const analyticsDocRef = doc(db, "analytics", todayStr);
    const isNewSession = !sessionStorage.getItem("visited_today");
    
    let updateData = {};
    updateData["totalPageViews"] = increment(1);         
    updateData[`hourlyTraffic.${currentHour}`] = increment(1); 
    
    if (isNewSession) {
      updateData["uniqueUsers"] = increment(1); 
      sessionStorage.setItem("visited_today", "true");
    }

    await setDoc(analyticsDocRef, updateData, { merge: true });
    console.log(`📊 [Analytics] บันทึกยอดเข้าชมรอบชั่วโมงที่ ${currentHour} ของวันที่ ${todayStr} เรียบร้อยแล้ว`);
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
    console.log("✅ โหลดข้อมูลสินค้าและหมวดหมู่หลักเสร็จสิ้น"); // แถว ๆ บรรทัดจบเดิมของคุณ

    // 🔥 ฝากปุ่มกดแอดมินและคำสั่งรันระบบไว้ตรงนี้ เพื่อให้มั่นใจว่าสินค้าขึ้นครบก่อนแล้วค่อยทำ Popup
    const goToPopupAdminBtn = document.getElementById("goToPopupAdminBtn");
    if (goToPopupAdminBtn && !goToPopupAdminBtn.dataset.listenerAdded) {
        goToPopupAdminBtn.addEventListener("click", () => { window.location.href = "popup.html"; });
        goToPopupAdminBtn.dataset.listenerAdded = "true";
    }

    // เรียกฟังก์ชันป๊อปอัพโดยส่งตัวแปรฐานข้อมูล db หลักของโปรเจกต์เข้าไปตรงๆ
    initPromotionPopupSystem(db);
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
  const priceSale = calculateDiscountedPrice(Number(p.price || 0), p.discount);
  const priceFlash = p.flashSalePrice ? Number(p.flashSalePrice) : 0; 
  const currentFlashSaleTimeVal = p.flashSaleEndTime || "";
  
  const isFlashSaleActive = currentFlashSaleTimeVal ? (new Date(currentFlashSaleTimeVal).getTime() - new Date().getTime() > 0) : false;
  const isProductComingSoon = !!p.comingSoon || (priceNormal === 0 && priceSale === 0);
  
  let priceHtmlDisplay = "";
  let promoBadgeHtml = "";

  // 1. Logic ตรวจสอบการแสดงป้ายเทศกาล
  if (typeof promoTabConfig !== "undefined" && promoTabConfig && promoTabConfig.active && !isProductComingSoon && priceSale < priceNormal) {
    promoBadgeHtml = `
      <div class="promo-festival-tag" style="
        background: linear-gradient(135deg, #06b6d4 0%, #2563eb 100%) !important;
        color: #ffffff !important;
        font-size: 13px !important;
        font-weight: 900 !important;
        padding: 6px 12px !important;
        border-radius: 6px !important;
        box-shadow: 0 0 12px rgba(6, 182, 212, 0.5) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        border: 1px solid rgba(255,255,255,0.2) !important;
        letter-spacing: 0.8px !important;
        margin-bottom: 12px !important;
        width: 100% !important;
        box-sizing: border-box !important;
        text-transform: uppercase !important;
      ">
        <i class="fa-solid fa-bolt animate-bounce" style="color: #fffb8f; font-size: 11px;"></i> 
        <span>${promoTabConfig.title}</span>
        <i class="fa-solid fa-bolt animate-bounce" style="color: #fffb8f; font-size: 11px;"></i>
      </div>
    `;
  }

  // 2. Logic จัดการสลับราคาสำหรับโชว์หน้าสินค้า (อัปเดตเป็นสีเขียวระบบแล้ว)
  if (p.isSoldOut) {
    priceHtmlDisplay = "";
  } else if (isProductComingSoon) {
    priceHtmlDisplay = `<div class="price coming-soon-text">Coming Soon...</div>`;
  } else if (isFlashSaleActive && priceFlash > 0) {
    // แก้ไข: เปลี่ยนราคา Flash Sale เป็นสีเขียว พร้อมแสงเรืองโทนเขียวอ่อน
    priceHtmlDisplay = `<div class="price flash-active-price" style="color:var(--price-green); font-weight:bold; text-shadow:0 0 6px rgba(34,197,94,0.25);">${formatPrice(priceFlash)}</div>`;
  } else if (typeof promoTabConfig !== "undefined" && promoTabConfig && promoTabConfig.active && priceSale > 0 && priceNormal > 0) {
    if (priceSale !== priceNormal) {
      // แก้ไข: เปลี่ยนราคาส่วนลดช่วงเทศกาลเป็นสีเขียว พร้อมแสงเรืองโทนเขียวอ่อน
      priceHtmlDisplay = `<div class="price old-price-slashed">${formatPrice(priceNormal)}</div><div class="price" style="color:var(--price-green); font-weight:bold; text-shadow: 0 0 4px rgba(34,197,94,0.2);">${formatPrice(priceSale)}</div>`;
    } else {
      // แก้ไข: เปลี่ยนราคาปกติช่วงเทศกาลเป็นสีเขียว พร้อมแสงเรืองโทนเขียวอ่อน
      priceHtmlDisplay = `<div class="price" style="color:var(--price-green); font-weight:bold; text-shadow: 0 0 4px rgba(34,197,94,0.2);">${formatPrice(priceSale)}</div>`;
    }
  } else {
    if (priceSale > 0 && priceNormal > 0 && priceSale !== priceNormal) {
      // แก้ไข: เปลี่ยนราคาส่วนลดปกติทั่วไปเป็นสีเขียวระบบ
      priceHtmlDisplay = `<div class="price old-price-slashed">${formatPrice(priceNormal)}</div><div class="price" style="color:var(--price-green); font-weight:bold;">${formatPrice(priceSale)}</div>`;
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
  } else if (currentSortMode === "tierlist" && selectedCategory !== "ทั้งหมด" && selectedCategory !== "⚡ Flash Sale" && index !== undefined && index >= 0) {
    const now = Date.now();
    let currentFilteredList = [];
    
    if (!selectedCategory || selectedCategory === "ทั้งหมด") {
      currentFilteredList = [...allProducts];
    } else {
      currentFilteredList = allProducts.filter(prod => prod.category && prod.category.toString().trim() === selectedCategory.toString().trim());
    }
    
    currentFilteredList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    
    const validProducts = currentFilteredList.filter(prod => {
      const priceNormal = prod.price ? Number(prod.price) : 0;
      const priceSale = prod.salePrice ? Number(prod.salePrice) : 0;
      return !(!!prod.comingSoon || (priceNormal === 0 && priceSale === 0));
    });
    
    if (!isProductComingSoon) {
      const actualRankIndex = validProducts.findIndex(prod => prod.id === p.id);
      if (actualRankIndex !== -1 && actualRankIndex < 5) {
        const displayRank = actualRankIndex + 1;
        tierBadgeHtml = `<div class="tier-badge rank-${displayRank}">${displayRank}</div>`;
      }
    }
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

  let soldOutBadgeHtml = "";
  if (p.isSoldOut) {
    soldOutBadgeHtml = `
      <div class="sold-out-overlay-badge" style="
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden !important;
        z-index: 95 !important;
        pointer-events: none;
        border-radius: inherit;
      ">
        <div style="
          position: absolute !important;
          width: 150% !important;
          background: rgba(220, 38, 38, 0.82) !important;
          color: #ffffff !important;
          text-align: center !important;
          padding: 10px 0 !important;
          font-family: 'Impact', 'Arial Black', sans-serif !important;
          font-size: 18px !important;
          font-weight: 900 !important;
          letter-spacing: 4px !important;
          text-shadow: 0px 2px 4px rgba(0, 0, 0, 0.5);
          box-shadow: 0px 0px 12px rgba(0, 0, 0, 0.4);
          transform: rotate(-15deg);
          text-transform: uppercase;
          white-space: nowrap !important;
        ">
          สินค้าหมด
        </div>
      </div>
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

  // ⚡ โค้ดสร้างปุ่ม Icon แก้ไข และ ลบ (กำหนดให้อยู่ด้านล่างขวา)
  let adminImageActionsHtml = "";
  if (isAdmin) {
    adminImageActionsHtml = `
      <div class="admin-image-actions" style="
        position: absolute; 
        bottom: 8px; 
        right: 8px; 
        display: flex; 
        gap: 6px; 
        z-index: 100;
      ">
        <button class="admin-icon-btn edit-icon" onclick='editProduct("${p.id}"); event.stopPropagation(); event.preventDefault();' title="แก้ไขสินค้า" style="width: 32px !important; height: 32px !important; border-radius: 50% !important; border: none !important; display: flex !important; align-items: center !important; justify-content: center !important; color: #ffffff !important; background: #eab308 !important; cursor: pointer !important; box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important; padding: 0 !important; transition: transform 0.2s ease;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="admin-icon-btn delete-icon" onclick='deleteProduct("${p.id}"); event.stopPropagation(); event.preventDefault();' title="ลบสินค้า" style="width: 32px !important; height: 32px !important; border-radius: 50% !important; border: none !important; display: flex !important; align-items: center !important; justify-content: center !important; color: #ffffff !important; background: #ef4444 !important; cursor: pointer !important; box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important; padding: 0 !important; transition: transform 0.2s ease;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    `;
  }

  // 🇲🇷 เพิ่มระบบสร้างไอคอนสำหรับลาก (Drag Handle) ไว้ที่มุมซ้ายล่างของรูปสินค้า
  let adminDragHandleHtml = "";
  if (canDrag) {
    adminDragHandleHtml = `
      <div class="admin-drag-handle-icon" style="
        position: absolute;
        bottom: 8px;
        left: 8px;
        width: 32px;
        height: 32px;
        border-radius: 50% !important;
        background: rgba(11, 11, 12, 0.85) !important;
        color: #ffffff !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4) !important;
        z-index: 100;
        cursor: grab;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        transition: background 0.2s ease;
      " title="ลากตรงนี้เพื่อจัดอันดับอันดับสินค้า">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="5 9 2 12 5 15"></polyline>
          <polyline points="9 5 12 2 15 5"></polyline>
          <polyline points="15 19 12 22 9 19"></polyline>
          <polyline points="19 9 22 12 19 15"></polyline>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <line x1="12" y1="2" x2="12" y2="22"></line>
        </svg>
      </div>
    `;
  }

  // นำปุ่มแก้ไข/ลบ (${adminImageActionsHtml}) และปุ่มลาก (${adminDragHandleHtml}) ไปไว้ต่อท้าย finalImageTag เพื่อให้อยู่เลเยอร์บนสุด
  const imageHtml = imageLink ? 
    `<a href="${imageLink}" target="_blank" class="card-img-link" style="position:relative; display:block; min-height:200px; background:rgba(255,255,255,0.02);">${adminLogoBadgeHtml}${soldOutBadgeHtml}${finalImageTag}${adminImageActionsHtml}${adminDragHandleHtml}</a>` : 
    `<div style="position:relative; display:block; min-height:200px; background:rgba(255,255,255,0.02);">${adminLogoBadgeHtml}${soldOutBadgeHtml}${finalImageTag}${adminImageActionsHtml}${adminDragHandleHtml}</div>`;
  
  let flashSaleTimerHtml = "";
  if (!isProductComingSoon && currentFlashSaleTimeVal && isFlashSaleActive) {
    if (String(currentFlashSaleTimeVal).trim().toLowerCase() === "un") {
      flashSaleTimerHtml = `
        <div class="card-flash-sale-box" id="flash-box-${p.id}" data-untyped="true" style="
          background: #ffffff !important; 
          border: 1px solid #ffffff !important; 
          border-radius: 6px !important; 
          padding: 4px 10px !important; 
          display: flex !important; 
          align-items: center !important; 
          justify-content: center !important; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important;
          min-height: 32px !important;
          width: 100% !important;
        ">
          <span class="flash-sale-badge-text" style="
            color: #ff7a00 !important; 
            font-weight: bold !important; 
            font-size: 13px !important;
            letter-spacing: 0.5px !important;
          ">
            🔥 Flash Sale
          </span>
        </div>
      `;
    } else {
      flashSaleTimerHtml = `
        <div class="card-flash-sale-box" id="flash-box-${p.id}" style="
          background: #ffffff !important; 
          border: 1px solid #ffffff !important; 
          border-radius: 6px !important; 
          padding: 4px 8px !important; 
          display: flex !important; 
          align-items: center !important; 
          justify-content: space-between !important; 
          gap: 6px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important;
          min-height: 32px !important;
          width: 100% !important;
        ">
          <span class="flash-sale-badge-text" style="
            color: #ff7a00 !important; 
            font-weight: bold !important; 
            font-size: 12px !important;
            white-space: nowrap !important;
          ">
            Flash Sale
          </span>
          <div class="flash-sale-countdown-clock dynamic-countdown-timer" data-id="${p.id}" data-endtime="${currentFlashSaleTimeVal}" style="
            background: #ff7a00 !important; 
            color: #000000 !important; 
            padding: 2px 6px !important;  
            border-radius: 4px !important; 
            font-weight: bold !important;    
            font-size: 12px !important;     
            letter-spacing: 0.3px !important;
            display: flex !important;
            align-items: center !important;
            gap: 4px !important;
            white-space: nowrap !important;
          ">
            🕒 00h 00m 00s
          </div>
        </div>
      `;
    }
  }

  return `
    <div ${dragAttr} style="position: relative;">
      ${tierBadgeHtml}
      ${p.isHot ? `<div class="badge hot">🔥 HOT</div>` : ""}
      ${p.isNew ? `<div class="badge">🆕 NEW</div>` : ""}
      ${imageHtml}
      <div class="info" style="display: flex; flex-direction: column; width: 100%; box-sizing: border-box;">
        ${promoBadgeHtml}
        
        <h4>
          ${p.isMall ? `
            <span style="
              background-color: #d0011b !important; /* เปลี่ยนเป็นสี่เหลี่ยมสีแดงทึบ */
              color: #ffffff !important;            /* เปลี่ยนข้อความ MALL เป็นสีขาว */
              font-size: 10px !important; 
              font-weight: bold !important; 
              padding: 2px 5px !important;          /* ปรับระยะขอบให้ได้ทรงสี่เหลี่ยมสวยงาม */
              border-radius: 3px !important; 
              margin-right: 6px !important;
              display: inline-block !important;
              vertical-align: middle !important;
              line-height: 1 !important;
              font-family: sans-serif !important;
              letter-spacing: 0.5px !important;
            ">MALL</span>
          ` : ""}
          ${p.name}
        </h4>
        
        ${flashSaleTimerHtml}
        <div class="price-container">${priceHtmlDisplay}</div>
        ${p.description ? `<p>${p.description}</p>` : ""}
        <div class="btns">
          ${btnsContent}
          ${isAdmin ? `
            <div class="quick-recommend-badge-box" style="margin-top: 4px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px; display: flex; align-items: center; justify-content: space-between; width:100%; box-sizing: border-box;">
              <label style="font-size:12px; color:#a3a3a3; display:flex; align-items:center; gap:8px; cursor:pointer; flex: 1;">
                <img src="${ADMIN_BADGE_LOGO_URL}" style="width:20px !important; height:20px !important; min-width:20px !important; min-height:20px !important; max-width:20px !important; max-height:20px !important; border-radius:50% !important; object-fit: cover !important; display: inline-block !important; vertical-align: middle;">
                <span>เปิดใช้ป้ายโลโก้แอดมิน:</span>
              </label>
              <input type="checkbox" ${p.isAdminRecommend ? "checked" : ""} onchange="toggleQuickAdminRecommend('${p.id}', this.checked)" style="width:18px !important; height:18px !important; min-width:18px !important; cursor:pointer; margin: 0;">
            </div>
            
            <div class="quick-soldout-badge-box" style="margin-top: 6px; padding-top: 6px; display: flex; align-items: center; justify-content: space-between; width:100%; box-sizing: border-box;">
              <label style="font-size:12px; color:#ef4444; display:flex; align-items:center; gap:8px; cursor:pointer; flex: 1; font-weight: bold;">
                <span style="font-size: 14px;">🛑</span>
                <span>ทำเครื่องหมายสินค้าหมด (Sold Out):</span>
              </label>
              <input type="checkbox" ${p.isSoldOut ? "checked" : ""} onchange="toggleQuickSoldOut('${p.id}', this.checked)" style="width:18px !important; height:18px !important; min-width:18px !important; cursor:pointer; margin: 0; accent-color: #ef4444;">
            </div>

            <div class="quick-mall-badge-box" style="margin-top: 6px; padding-top: 6px; display: flex; align-items: center; justify-content: space-between; width:100%; box-sizing: border-box; border-top: 1px dashed rgba(255,255,255,0.1);">
              <label style="font-size:12px; color:#d0011b; display:flex; align-items:center; gap:8px; cursor:pointer; flex: 1; font-weight: bold;">
                <span style="background-color: #d0011b; color: #ffffff; padding: 2px 4px; font-size: 9px; border-radius: 2px; font-weight: bold;">MALL</span>
                <span>เปิดใช้งานสินค้าระบบ Mall ด่วน:</span>
              </label>
              <input type="checkbox" ${p.isMall ? "checked" : ""} onchange="toggleQuickMall('${p.id}', this.checked)" style="width:18px !important; height:18px !important; min-width:18px !important; cursor:pointer; margin: 0; accent-color: #d0011b;">
            </div>
          ` : ""}
        </div>
      </div>
    </div>
  `;
}

window.toggleQuickAdminRecommend = async function(productId, isChecked) {
  try {
    // 1. ค้นหาในตัวแปร Local ก่อนเพื่ออัปเดต UI ทันที
    const productIndex = allProducts.findIndex(p => p.id === productId);
    if (productIndex !== -1) {
      allProducts[productIndex].isAdminRecommend = isChecked;
    }

    // 2. อัปเดตข้อมูลสดไปยัง Cloud Firestore
    const productDocRef = doc(db, "products", productId);
    await updateDoc(productDocRef, {
      isAdminRecommend: isChecked,
      lastUpdated: Date.now()
    });

    // 3. แจ้งเตือนเวอร์ชันข้อมูลเปลี่ยน และทำการเรนเดอร์หน้าจอใหม่
    await bumpCloudVersion();
    render();
    console.log(`✨ อัปเดตสถานะแอดมินแนะนำสินค้า ID: ${productId} เป็น [${isChecked}] สำเร็จ`);
  } catch (error) {
    console.error("🚨 เกิดข้อผิดพลาดในการอัปเดตสถานะแนะนำสินค้า:", error);
    alert("ไม่สามารถบันทึกสถานะได้ กรุณาลองใหม่อีกครั้ง");
  }
};

// 🔴 ฟังก์ชันสลับสถานะ "Sold Out" ด่วน และอัปเดตลง Firebase
window.toggleQuickSoldOut = async function(productId, isChecked) {
  try {
    // 1. ค้นหาในตัวแปร Local เพื่ออัปเดต UI ชั่วคราวก่อน
    const productIndex = allProducts.findIndex(p => p.id === productId);
    if (productIndex !== -1) {
      allProducts[productIndex].isSoldOut = isChecked;
    }

    // 2. อัปเดตข้อมูลตรงไปยัง Cloud Firestore
    const productDocRef = doc(db, "products", productId);
    await updateDoc(productDocRef, {
      isSoldOut: isChecked,
      lastUpdated: Date.now()
    });

    // 3. แจ้งเตือนคลาวด์เวอร์ชัน และสั่งเรนเดอร์ UI ใหม่
    await bumpCloudVersion();
    render();
    console.log(`🔴 อัปเดตสถานะสินค้าหมด ID: ${productId} เป็น [${isChecked}] สำเร็จ`);
  } catch (error) {
    console.error("🚨 เกิดข้อผิดพลาดในการอัปเดตสถานะสินค้าหมด:", error);
    alert("ไม่สามารถบันทึกสถานะได้ กรุณาลองใหม่อีกครั้ง");
  }
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
      const priceFlash = p.flashSalePrice ? Number(p.flashSalePrice) : 0;
      const endTimeStr = p.flashSaleEndTime ? String(p.flashSaleEndTime).trim() : "";
      
      // ถ้าราคา Flash Sale เป็น 0 หรือติดลบ ไม่ต้องแสดง
      if (priceFlash <= 0) return false;
      
      // ถ้าแอดมินตั้งเวลาเป็น "un" (ไม่จำกัดเวลา) ให้แสดงได้เลย
      if (endTimeStr.toLowerCase() === "un" || endTimeStr === "") return true;
      
      // ตรวจสอบเวลาหมดอายุ (ต้องมากกว่าเวลาปัจจุบัน)
      const endTimeTarget = new Date(endTimeStr).getTime();
      if (isNaN(endTimeTarget)) {
        // ป้องกันบั๊กถ้าฟอร์แมตวันที่ผิดพลาด แต่มีราคาแฟลชเซลล์ ให้โชว์ไว้ก่อน
        return true; 
      }
      return (endTimeTarget - now > 0);
    });
  }

  // 🔥 [แก้ไขจุดนี้] ตรรกะแยกกลุ่มสินค้าเฉพาะหมวดหมู่ "ทั้งหมด" (Coming Soon บนสุด -> NEW ตรงกลาง -> สินค้าทั่วไป Dynamic ด้านล่าง)
  if (!selectedCategory || selectedCategory === "ทั้งหมด") {
    
    // เรียงลำดับเบื้องต้นตามค่าลำดับที่จัดไว้ก่อนแยกกลุ่ม
    displayed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // ฟังก์ชันช่วยเช็กเงื่อนไขสถานะ Coming Soon เพื่อความแม่นยำและครอบคลุมทุกรูปแบบตัวแปร
    const checkComingSoon = (p) => {
      return p.comingSoon === true || p.isComingSoon === true || p.status === "coming-soon" || p.status === "Coming Soon";
    };

    // 1. คัดแยกกลุ่ม Coming Soon (ล็อกไว้ด้านบนสุด ไม่สุ่มตำแหน่ง)
    const comingSoonProducts = displayed.filter(p => checkComingSoon(p));
    
    // 2. คัดแยกกลุ่ม NEW (ต่อท้าย Coming Soon ล็อกไว้ ไม่สุ่มตำแหน่ง)
    const newProducts = displayed.filter(p => p.isNew && !checkComingSoon(p));
    
    // 3. คัดแยกกลุ่มสินค้าทั่วไป (อยู่ใต้ NEW กลุ่มนี้กลุ่มเดียวที่จะสุ่ม Dynamic ทุกครั้งที่ F5)
    const normalProducts = displayed.filter(p => !p.isNew && !checkComingSoon(p));
    normalProducts.sort(() => Math.random() - 0.5); // สุ่มตำแหน่งเฉพาะสินค้าทั่วไปด้านล่างสุด

    // 4. นำมารวมกันตามโครงสร้างเลเยอร์ที่ต้องการ
    displayed = [...comingSoonProducts, ...newProducts, ...normalProducts];

  } else {
    // หากเป็นหมวดหมู่อื่นๆ ให้ใช้การเรียงลำดับตามปกติของระบบ (ไม่มีการสุ่มใดๆ)
    if (currentSortMode === "tierlist") {
      displayed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } else if (currentSortMode === "price-asc") {
      displayed.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
    } else if (currentSortMode === "price-desc") {
      displayed.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
    }
  }

  // (โค้ดดักตัวกรองคำค้นหาและการ Map Render เข้าสู่ innerHTML ด้านล่าง ให้คงไว้ตามเดิม...)
  const kw = searchInput?.value.trim().toLowerCase();
  if (kw) {
    displayed = displayed.filter(p => 
      (p.name && p.name.toLowerCase().includes(kw)) || 
      (p.description && p.description.toLowerCase().includes(kw)) ||
      (p.keywords && p.keywords.toLowerCase().includes(kw))
    );
  }

  if (allEl) {
    allEl.innerHTML = displayed.map((p, index) => card(p, index)).join("");
  }
  
  observeLazyImages();
  renderSidebarCategories();
}

/* ================= ⚙️ ระบบเรนเดอร์จัดการหลังบ้านสำหรับ Admin ================= */
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

  // 🔥 [แก้ไขจุดนี้] ตรรกะแยกกลุ่มแบบเดียวกันฝั่งแอดมิน เพื่อให้หลังบ้านแสดงผลตรงกันกับหน้าแรกของลูกค้า
  if (!selectedCategory || selectedCategory === "ทั้งหมด") {
    
    displayed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // ฟังก์ชันช่วยเช็กเงื่อนไขสถานะ Coming Soon เพื่อความแม่นยำและครอบคลุมทุกรูปแบบตัวแปร
    const checkComingSoon = (p) => {
      return p.comingSoon === true || p.isComingSoon === true || p.status === "coming-soon" || p.status === "Coming Soon";
    };

    // 1. คัดแยกกลุ่ม Coming Soon (ล็อกไว้ด้านบนสุด ไม่สุ่มตำแหน่ง)
    const comingSoonProducts = displayed.filter(p => checkComingSoon(p));
    
    // 2. คัดแยกกลุ่ม NEW (ต่อท้าย Coming Soon ล็อกไว้ ไม่สุ่มตำแหน่ง)
    const newProducts = displayed.filter(p => p.isNew && !checkComingSoon(p));
    
    // 3. คัดแยกกลุ่มสินค้าทั่วไป (อยู่ใต้ NEW กลุ่มนี้กลุ่มเดียวที่จะสุ่ม Dynamic ทุกครั้งที่ F5)
    const normalProducts = displayed.filter(p => !p.isNew && !checkComingSoon(p));
    normalProducts.sort(() => Math.random() - 0.5); // สุ่มตำแหน่งเฉพาะสินค้าทั่วไปด้านล่างสุด

    // 4. นำมารวมกันตามโครงสร้างเลเยอร์ที่ต้องการ
    displayed = [...comingSoonProducts, ...newProducts, ...normalProducts];

  } else {
    // หมวดหมู่อื่นๆ เรียงตามลำดับ Order ปกติ
    displayed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  const kw = searchInput?.value.trim().toLowerCase();
  if (kw) {
    displayed = displayed.filter(p => 
      (p.name && p.name.toLowerCase().includes(kw)) || 
      (p.description && p.description.toLowerCase().includes(kw)) || 
      (p.keywords && p.keywords.toLowerCase().includes(kw))
    );
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
  name, 
  image, 
  price, 
  salePrice, 
  description: productDescription.value.trim(),
  keywords: typeof productKeywords !== 'undefined' && productKeywords ? productKeywords.value.trim() : "", // ✨ เพิ่มฟิลด์คำค้นหาเพิ่มเติมที่นี่
  category: productCategory.value, 
  tier: productTier.value, 
  shopee1: shopee1.value.trim(),
  shopee2: shopee2.value.trim(), 
  lazada: lazada.value.trim(), 
  isNew: isNew.checked,
  isHot: isHot.checked, 
  comingSoon: comingSoon.checked || (price === 0 && salePrice === 0),
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
  if(productKeywords) productKeywords.value = ""; // เพิ่มบรรทัดนี้
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
  currentEditId = id; productName.value = p.name || ""; productImage.value = p.image || ""; productPrice.value = p.price || ""; 
  
  // 🔥 [แก้ไขจุดนี้] เปลี่ยนจาก p.salePrice เป็น p.discount เพื่อให้ค่าโค้ดส่วนลดดิบ (เช่น 25%=2000) ยังคงอยู่ให้คุณแก้ไขได้
  productSalePrice.value = p.discount || ""; 
  
  productDescription.value = p.description || ""; productCategory.value = p.category || "";
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
  if (productKeywords) productKeywords.value = p.keywords || "";
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

  // 🛠️ ควบคุมการเปิด/ปิด กล่องแผงจัดการระบบส่วนเสริมอันใหม่ (แสดงผลแบบ block เฉพาะผู้ดูแลเท่านั้น)
  const customToolsPanel = document.getElementById("customAdminToolsPanel");
  if (customToolsPanel) {
      customToolsPanel.style.display = isAdmin ? "block" : "none";
  }

  // ⚙️ ผูกลิงก์การทำงานเมื่อแอดมินคลิกที่ปุ่มต่าง ๆ (และสั่งเช็กความปลอดภัยป้องกันการกดซ้ำ)
  if (isAdmin) {
      const flashSaleBtn = document.getElementById("goToFlashSaleAdminBtn");
      const analyticsBtn = document.getElementById("goToAnalyticsBtn");
      const popupBtn = document.getElementById("openPromoPopupAdminBtn");
      const goToUpdatePriceBtn = document.getElementById("goToUpdatePriceBtn");

      if (flashSaleBtn) {
          flashSaleBtn.onclick = (e) => {
              e.preventDefault();
              window.location.href = "./flash-sale-admin.html";
          };
      }
      if (analyticsBtn) {
          analyticsBtn.onclick = (e) => {
              e.preventDefault();
              window.location.href = "analytics.html";
          };
      }
      if (popupBtn) {
          popupBtn.onclick = (e) => {
              e.preventDefault();
              window.location.href = "popup.html";
          };
      }
      if (goToUpdatePriceBtn) {
          goToUpdatePriceBtn.onclick = (e) => {
              e.preventDefault();
              window.location.href = "updateprice.html";
          };
      }
  }

  if(!isAdmin) {
    window.cancelProductEdit();
    window.clearConsoleCategoryForm();
  }
  
  initUserPresenceSystem();
  
  // 🔥 สั่งโหลด Master Data และเรนเดอร์ UI บนหน้าจอมือถือให้เสร็จสิ้นก่อน
  loadMasterData();

  // 🎯 ด่านความปลอดภัยสุดท้าย: หน่วงเวลาตรวจสอบหน้าจอเผื่อสำหรับอุปกรณ์พกพา
  setTimeout(() => {
    // ลบการเรียกใช้ ensureAdminActionButtonsExist() เพื่อไม่ให้สร้างปุ่มซ้ำซ้อนภายนอกแผง
    const flashSaleBtn = document.getElementById("goToFlashSaleAdminBtn");
    const analyticsBtn = document.getElementById("goToAnalyticsBtn");
    const popupBtn = document.getElementById("openPromoPopupAdminBtn");

    if(flashSaleBtn) flashSaleBtn.style.display = isAdmin ? "inline-block" : "none";
    if(analyticsBtn) analyticsBtn.style.display = isAdmin ? "inline-block" : "none";
    if(popupBtn) popupBtn.style.display = isAdmin ? "inline-block" : "none";
  }, 100); 
});


/* =========================================================================
   💾 บันทึก / อัปเดตสินค้าเข้าฐานข้อมูลร่วมกับฟิลด์ส่วนลดใหม่
========================================================================= */
if (submitBtn) {
  submitBtn.onclick = async (e) => {
    e.preventDefault();

    const isComingSoonActive = typeof comingSoon !== "undefined" && comingSoon ? comingSoon.checked : false;

    // 🔥 แก้ไขเงื่อนไข: ถ้าไม่ได้ติ๊ก Coming Soon แต่เว้นว่างชื่อหรือราคาปกติ ระบบถึงจะทำการแจ้งเตือนให้กรอก
    if (!productName.value.trim() || (!isComingSoonActive && !productPrice.value.trim())) {
      alert("กรุณากรอกชื่อสินค้าและราคาปกติให้เรียบร้อยครับ");
      return;
    }

    try {
      // 1. ดึงค่าจากช่องส่วนลดออกมาเป็นข้อความสตริงตรงๆ (เช่น "25%=2000")
      const discountValue = productSalePrice.value.trim();
      
      // 2. คำนวณราคาสุทธิที่จะเอาไปแสดงผลหน้าแรกของ User
      const calculatedSalePrice = calculateDiscountedPrice(Number(productPrice.value) || 0, discountValue);

      // 3. จัดการโครงสร้างข้อมูลส่งไป Firestore
      const productData = {
        name: productName.value.trim(),
        image: productImage.value.trim(),
        price: Number(productPrice.value) || 0, // ถ้าว่างระบบจะแปลงเป็น 0 ให้โดยไม่เด้งแจ้งเตือนขัดขวาง
        // 🔥 เก็บรหัสส่วนลดดิบเพื่อเอาไว้ Edit
        discount: discountValue,
        // 🔥 เก็บราคาสุทธิที่ลดแล้วเพื่อไปแสดงผลหน้าบ้าน
        salePrice: calculatedSalePrice,
        description: productDescription.value.trim(),
        // ✨ เพิ่มฟิลด์คำค้นหาเพิ่มเติมตรงนี้ เพื่อเก็บค่าลง Firebase
        keywords: typeof productKeywords !== "undefined" && productKeywords ? productKeywords.value.trim() : "",
        category: productCategory.value,
        tier: typeof productTier !== "undefined" && productTier ? productTier.value : "",
        shopee1: typeof shopee1 !== "undefined" && shopee1 ? shopee1.value.trim() : "",
        shopee2: typeof shopee2 !== "undefined" && shopee2 ? shopee2.value.trim() : "",
        lazada: typeof lazada !== "undefined" && lazada ? lazada.value.trim() : "",
        isNew: typeof isNew !== "undefined" && isNew ? isNew.checked : false,
        isHot: typeof isHot !== "undefined" && isHot ? isHot.checked : false,
        comingSoon: isComingSoonActive,
        isAdminRecommend: typeof isAdminRecommendInput !== "undefined" && isAdminRecommendInput ? isAdminRecommendInput.checked : false,
        isMall: typeof isMall !== "undefined" && isMall ? isMall.checked : false, // 🔥 เพิ่มบรรทัดนี้เพื่อเก็บสถานะ Mall ลง Firebase
        lastUpdated: Date.now()
      };

      if (currentEditId) {
        // โหมดแก้ไขสินค้าเดิม
        await updateDoc(doc(db, "products", currentEditId), productData);
      } else {
        // โหมดเพิ่มสินค้าชิ้นใหม่เข้าระบบ
        productData.order = allProducts.reduce((max, p) => ((p.order ?? 0) > max ? p.order : max), 0) + 1;
        productData.hotOrder = allProducts.reduce((max, p) => ((p.hotOrder ?? 0) > max ? p.hotOrder : max), 0) + 1;
        productData.newOrder = allProducts.reduce((max, p) => ((p.newOrder ?? 0) > max ? p.newOrder : max), 0) + 1;
        productData.flashSaleEndTime = "";
        productData.flashSalePrice = 0;
        await addDoc(productsRef, productData);
      }

      await bumpCloudVersion();
      clearProductForm();
      alert("บันทึกสินค้าเรียบร้อย!");
      loadMasterData();
    } catch (error) {
      alert(error.message);
    }
  };
}

const backToTopBtn = document.getElementById("backToTopBtn");
if (backToTopBtn) {
  window.addEventListener("scroll", () => { if (window.scrollY > 300) backToTopBtn.classList.add("show"); else backToTopBtn.classList.remove("show"); });
  backToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

const goToPopupAdminBtn = document.getElementById("goToPopupAdminBtn");
if (goToPopupAdminBtn) {
    goToPopupAdminBtn.addEventListener("click", () => {
        window.location.href = "popup.html";
    });
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

function ensureAdminActionButtonsExist() {
  // 1. ตรวจสอบปุ่ม "ดูสถิติ (Analytics)" และจัดการการซ่อน/แสดง
  const flashSaleAdminBtn = document.getElementById("goToFlashSaleAdminBtn");
  let analyticsBtn = document.getElementById("goToAnalyticsBtn");

  if (flashSaleAdminBtn) {
    if (!analyticsBtn) {
      analyticsBtn = document.createElement("button");
      analyticsBtn.id = "goToAnalyticsBtn";
      analyticsBtn.className = "btn edit"; // ใช้คลาสเดียวกับปุ่มแก้ไขเพื่อความสวยงาม
      analyticsBtn.style.alignItems = "center";
      analyticsBtn.style.gap = "6px";
      analyticsBtn.style.marginLeft = "10px";
      analyticsBtn.innerHTML = `📊 ดูสถิติระบบ`;
      
      // บังคับคำสั่งเปลี่ยนหน้าเว็บไปที่ analytics.html เมื่อแอดมินคลิก
      analyticsBtn.onclick = (e) => { 
        e.preventDefault();
        window.location.href = "analytics.html"; 
      };
      
      flashSaleAdminBtn.insertAdjacentElement("afterend", analyticsBtn);
    }
    
    // 🎯 ด่านความปลอดภัยสูงสุด: ถ้าไม่สิทธิ์แอดมิน ให้ลบหรือซ่อนทิ้งทันทีทุกครั้งที่เรนเดอร์หน้าจอมือถือ
    if (!isAdmin) {
      analyticsBtn.style.setProperty("display", "none", "important");
    } else {
      analyticsBtn.style.display = "inline-flex";
    }
  }

  // 2. ตรวจสอบปุ่ม "ยืนยันการจัดลำดับสินค้า" ในโซน DragNotice แจ้งเตือนการลากสินค้า
  const dragNoticeContainer = document.getElementById("dragNotice");
  if (dragNoticeContainer) {
    let saveOrderBtn = document.getElementById("saveOrderDirectBtn");
    
    if (!saveOrderBtn) {
      dragNoticeContainer.style.justifyContent = "between";
      dragNoticeContainer.style.alignItems = "center";
      dragNoticeContainer.style.gap = "15px";
      dragNoticeContainer.style.padding = "10px 15px";
      
      saveOrderBtn = document.createElement("button");
      saveOrderBtn.id = "saveOrderDirectBtn";
      saveOrderBtn.className = "btn edit";
      saveOrderBtn.style.padding = "6px 15px";
      saveOrderBtn.style.fontSize = "13px";
      saveOrderBtn.style.background = "#22c55e"; // สีเขียวปุ่มเซฟ
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
    
    // 🎯 ควบคุมการซ่อนแถบแจ้งเตือนจัดอันดับสำหรับ User ทั่วไปบนมือถือ
    if (!isAdmin) {
      dragNoticeContainer.style.setProperty("display", "none", "important");
    } else {
      dragNoticeContainer.style.display = (currentSortMode === "tierlist") ? "flex" : "none";
    }
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
    const anchorLink = clickedElement.closest("a"); // หาลิงก์ <a> ที่ครอบองค์ประกอบที่ถูกคลิก (ถ้ามี)
    let isBuyButton = false;
    
    if (anchorLink) {
        const hrefStr = anchorLink.getAttribute("href") || "";
        const classStr = anchorLink.className || "";
        if (hrefStr.includes("shopee") || hrefStr.includes("lazada") || classStr.includes("shopee") || classStr.includes("lazada") || classStr.includes("btn") || classStr.includes("buy")) {
            isBuyButton = true;
        }
    }

    // 🛠️ แก้ไขตรงนี้: เช็กว่าเป็นรูปภาพ และ "ต้องอยู่ภายใต้ลิงก์ <a>" เท่านั้น
    const isImageElement = clickedElement.tagName === "IMG" || clickedElement.closest(".product-img") || clickedElement.closest(".card-img-top") || clickedElement.closest(".image-wrapper");
    const isProductImage = isImageElement && anchorLink !== null; // ถ้าเป็นรูป แต่ไม่มี <a> ครอบ จะได้ false

    // ถ้ากดโดนรูปภาพ (ที่มีลิงก์) หรือ กดโดนปุ่มสั่งซื้อ
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

/* =========================================================
🔄 ระบบดักจับการเรียงลำดับสินค้า (Product Sort Event Listener)
========================================================= */
if (sortProductsSelect) {
  sortProductsSelect.addEventListener("change", (e) => {
    // 1. อัปเดตโหมดการเรียงลำดับปัจจุบันตามที่ผู้ใช้คลิกเลือก
    currentSortMode = e.target.value;
    console.log(`🔄 [Sort System] ผู้ใช้เปลี่ยนโหมดเรียงลำดับเป็น: ${currentSortMode}`);
    
    // 2. สั่งประมวลผลคำนวณลำดับสินค้าและสั่งเรนเดอร์หน้าจอใหม่ทันที
    render();
  });
}

// ผูกฟังก์ชันกรองหมวดหมู่เข้ากับหน้าต่างหลัก (Window Global Scope) เพื่อรองรับการสลับแบบไหลลื่น
window.filterCategory = (categoryName) => {
  selectedCategory = categoryName;
  console.log(`📁 [Category System] เลือกหมวดหมู่: ${selectedCategory}`);
  render();
};


function calculateDiscountedPrice(originalPrice, discountStr) {
    if (!discountStr || typeof discountStr !== "string") {
        return Math.round(originalPrice); 
    }

    try {
        const cleanDiscount = discountStr.trim();
        let calculatedDiscount = 0;
        let maxDiscount = Infinity;

        // แยกตรวจสอบเงื่อนไข Max Discount (ถ้ามีระบุไว้ข้างหลัง เช่น ตัวอย่าง: 25%=200)
        let actualDiscountStr = cleanDiscount;
        if (cleanDiscount.includes("=")) {
            const parts = cleanDiscount.split("=");
            actualDiscountStr = parts[0].trim();
            maxDiscount = parseFloat(parts[1].trim());
        }

        // คำนวณหาจำนวนเงินส่วนลดดิบ
        if (actualDiscountStr.endsWith("%")) {
            const percent = parseFloat(actualDiscountStr.replace("%", "").trim());
            if (!isNaN(percent)) {
                calculatedDiscount = (originalPrice * percent) / 100;
            }
        } else {
            const flat = parseFloat(actualDiscountStr);
            if (!isNaN(flat)) {
                calculatedDiscount = flat;
            }
        }

        // ตรวจสอบกับเพดานส่วนลดสูงสุด
        if (!isNaN(maxDiscount) && calculatedDiscount > maxDiscount) {
            calculatedDiscount = maxDiscount;
        }

        // 🔥 แก้ไขจุดนี้: ปัดเศษส่วนลดขึ้นให้เป็นจำนวนเต็มก่อน (สไตล์ Shopee)
        calculatedDiscount = Math.ceil(calculatedDiscount); 

        // คำนวณราคาสุทธิสุดท้าย
        const finalPrice = originalPrice - calculatedDiscount;
        return Math.max(0, finalPrice); 
    } catch (error) {
        console.error("Error calculating discount:", error);
        return Math.round(originalPrice); 
    }
}
function createProductCard(p) {
    let promoBadgeHtml = "";
    
    // ถ้ามีการเปิดใช้งานป้ายเทศกาลภาพรวม และสินค้าชิ้นนั้นมีข้อมูลโค้ดส่วนลดเซฟไว้
    if (promoTabConfig.active && p.discount) {
        promoBadgeHtml = `
            <div class="promo-festival-tag" style="background: #cf142b; color: #fff; padding: 4px 8px; font-size: 12px; font-weight: bold; border-radius: 4px; display: inline-block; margin-bottom: 6px;">
                🔥 ${promoTabConfig.title}
            </div>
        `;
    }

    // ตอน Render ก็เอาตัวแปร ${promoBadgeHtml} ไปใส่ไว้ด้านบนหรือด้านล่างราคาปกติ
    // พร้อมกับแสดงราคาใหม่ ${p.salePrice} (ซึ่งระบบหลังบ้านคำนวณและบันทึกไว้ให้แล้ว) แทนที่ราคาเดิมครับ
}

/* ================= 🔍 ระบบเปิดใช้งานแถบค้นหา (Search System) ================= */
if (searchInput) {
  searchInput.addEventListener("input", () => {
    // สั่งให้ระบบทำการเรนเดอร์รายชื่อสินค้าใหม่ทุกครั้งที่มีการพิมพ์หรือลบข้อความ
    render(); 
  });
}
// แปะไว้บรรทัดท้ายสุดของไฟล์ app.js ได้เลยครับ
document.getElementById('categories')?.addEventListener('click', function(e) {
    if (e.target.classList.contains('category')) {
        this.classList.remove('show-all');
    }
});

/* =========================================================================
📱 [Mobile Touch Drag & Drop System] ระบบลากจัดเรียงสินค้าบนมือถือด้วยปุ่มจับ
========================================================================= */
(function initMobileDragDrop() {
    let activeDragCard = null;
    let initialY = 0;
    let placeholder = null;

    document.addEventListener('touchstart', function(e) {
        // ทำงานเฉพาะเมื่อเอานิ้วไปแตะที่ปุ่มไอคอนลากสินค้าในโหมดแอดมินเท่านั้น
        const handle = e.target.closest('.admin-drag-handle-icon');
        if (!handle) return;

        // ค้นหาการ์ดสินค้าชิ้นที่กำลังจะถูกลาก
        const card = handle.closest('.card.admin-draggable');
        if (!card) return;

        activeDragCard = card;
        initialY = e.touches[0].clientY;

        // สั่งล็อกไม่ให้หน้าจอมือถือเลื่อนหนีขณะลาก
        e.preventDefault();

        // สร้างเส้นจำลอง (Placeholder) เพื่อบอกตำแหน่งที่จะวางใหม่
        placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.height = card.offsetHeight + 'px';
        placeholder.style.background = 'rgba(234, 179, 8, 0.1)';
        placeholder.style.border = '2px dashed #eab308';
        placeholder.style.borderRadius = '12px';
        placeholder.style.margin = window.getComputedStyle(card).margin;
    }, { passive: false });

    document.addEventListener('touchmove', function(e) {
        if (!activeDragCard) return;
        
        // ล็อกการ Scroll หน้าจอหลัก
        e.preventDefault();

        const touchY = e.touches[0].clientY;
        
        // ค้นหาองค์ประกอบใต้ตำแหน่งนิ้วปัจจุบัน
        const elementUnderTouch = document.elementFromPoint(e.touches[0].clientX, touchY);
        if (!elementUnderTouch) return;

        const targetCard = elementUnderTouch.closest('.card.admin-draggable');
        
        if (targetCard && targetCard !== activeDragCard) {
            const rect = targetCard.getBoundingClientRect();
            const next = (touchY - rect.top) / (rect.bottom - rect.top) > 0.5;
            const parent = targetCard.parentNode;
            
            // แทรกสลับตำแหน่งในหน้าเว็บซ้าย/ขวา หรือ บน/ล่าง ชั่วคราว
            parent.insertBefore(placeholder, next ? targetCard.nextSibling : targetCard);
            parent.insertBefore(activeDragCard, placeholder);
        }
    }, { passive: false });

    document.addEventListener('touchend', async function(e) {
        if (!activeDragCard) return;

        // ลบเส้นจำลองทิ้งเมื่อปล่อยนิ้ว
        if (placeholder && placeholder.parentNode) {
            placeholder.parentNode.removeChild(placeholder);
        }

        activeDragCard = null;
        placeholder = null;

        // อัปเดตลำดับใหม่ลงฐานข้อมูลหลังการลากสิ้นสุดลง
        if (typeof currentSortMode !== "undefined" && currentSortMode === "tierlist") {
            console.log("📱 [Mobile Drag] กำลังบันทึกลำดับสินค้าใหม่บนมือถือ...");
            
            const container = document.getElementById("products");
            if (!container) return;

            const cards = container.querySelectorAll('.card.admin-draggable');
            const batch = typeof writeBatch === "function" ? writeBatch(db) : null;
            
            if (!batch) return;

            cards.forEach((card, index) => {
                const prodId = card.getAttribute('data-id');
                if (prodId) {
                    const docRef = doc(db, "products", prodId);
                    batch.update(docRef, { order: index });
                }
            });

            try {
                await batch.commit();
                console.log("⚡ [Mobile Drag] บันทึกลำดับสินค้าใหม่ลงฐานข้อมูลสำเร็จ!");
                if (typeof bumpCloudVersion === "function") await bumpCloudVersion();
            } catch (err) {
                console.error("Error saving mobile drag order:", err);
            }
        }
    });
})();

// 🔥 ฟังก์ชันสลับเปิด-ปิดระบบ Mall ด่วน และอัปเดตตรงเข้า Firebase Firestore อัตโนมัติ
window.toggleQuickMall = async function(productId, isChecked) {
  try {
    // 1. อัปเดตข้อมูลบน Memory ในแอปพลิเคชันทันทีเพื่อความไว
    const productIndex = allProducts.findIndex(p => p.id === productId);
    if (productIndex !== -1) {
      allProducts[productIndex].isMall = isChecked;
    }

    // 2. ยิงคำสั่งอัปเดตโครงสร้างฟิลด์ isMall ลง Firebase doc ตรงๆ
    const productDocRef = doc(db, "products", productId);
    await updateDoc(productDocRef, {
      isMall: isChecked,
      lastUpdated: Date.now()
    });

    // 3. แจ้งเปลี่ยนเวอร์ชันข้อมูล Cloud เพื่อบังคับโหลดหน้าใหม่
    if (typeof bumpCloudVersion === "function") await bumpCloudVersion();
    
    render(); // สั่งวาดหน้าจอใหม่ทันที
    console.log(`⚡ [Quick Action] อัปเดตสถานะป้าย MALL สินค้าสำเร็จเรียบร้อย!`);
  } catch (error) {
    console.error("🚨 เกิดข้อผิดพลาดในการสลับระบบ Mall ด่วน:", error);
    alert("ไม่สามารถเปลี่ยนสถานะด่วนได้ในขณะนี้");
  }
};