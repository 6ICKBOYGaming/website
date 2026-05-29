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
  query,
  orderBy,
  limit,       // ⚡️ V6.6 ควบคุมการจำกัดปริมาณ Read จาก Server จริง
  startAfter,  // ⚡️ V6.6 พอยเตอร์กำหนดจุดตัดหน้าถัดไปของคลาวด์
  getDocs,
  writeBatch,
  increment    // ⚡️ ระบบสะสมยอดคลิกแบบลด Read Cost
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

// ⚡️ เปิดใช้งาน Local Cache ส่วนกลางบนอุปกรณ์เบราว์เซอร์
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

console.log("%c╠══ [Firebase V6.6-Ultimate] ระบบเวกเตอร์ไอคอนรถเข็นทำงานเสร็จสมบูรณ์", "color: #00ffcc; font-weight: bold;");

const auth = getAuth(app);
const productsRef = collection(db, "products");
const categoriesRef = collection(db, "categories_list");

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

// 📱 [SERVER-SIDE PAGINATION CONFIG - V6.6]
let itemsPerPage = 12;            
let lastVisibleDoc = null;         
let hasMoreItems = true;          
let isFetchingNextPage = false; // ⚡️ ป้องกันการยิงโหลดซ้อนตอนกำลังหมุนทำงาน
let clientDisplayedProducts = [];  

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
      localStorage.setItem("last_click_sync_time", Date.now().toString());
      saveLocalPendingClicks({});
    }
  } catch (err) { console.error(err); }
}

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

/* ================= 📡 ฟังก์ชันโหลดข้อมูลอัจฉริยะ ================= */
async function loadMasterData() {
  try {
    const remoteVersionSnap = await getDoc(doc(db, "settings", "version_control"));
    const remoteVersion = remoteVersionSnap.exists() ? remoteVersionSnap.data().lastUpdated || 0 : 0;
    const localVersion = localStorage.getItem("local_db_version") || "0";
    let useCache = !isAdmin && (remoteVersion.toString() === localVersion);

    const allProdSnap = await getDocs(productsRef, { source: useCache ? 'cache' : 'default' });
    allProducts = []; allProdSnap.forEach(d => allProducts.push({ id: d.id, ...d.data() }));

    const catSnap = await getDocs(query(categoriesRef, orderBy("order")), { source: useCache ? 'cache' : 'default' });
    dbCategories = []; catSnap.forEach(d => dbCategories.push({ id: d.id, ...d.data() }));
    updateCategoryDropdown();

    const widgetSnap = await getDoc(doc(db, "settings", "shopee_promo_widget"), { source: useCache ? 'cache' : 'default' });
    applyWidgetSettings(widgetSnap);

    if (!useCache) localStorage.setItem("local_db_version", remoteVersion.toString());

    const hotProducts = allProducts.filter(p => p.isHot).sort((a, b) => (a.hotOrder ?? 0) - (b.hotOrder ?? 0));
    if(hotEl) hotEl.innerHTML = hotProducts.map(p => card(p)).join("");

    const newProducts = allProducts.filter(p => p.isNew).sort((a, b) => (a.newOrder ?? 0) - (b.newOrder ?? 0));
    if(newEl) newEl.innerHTML = newProducts.map(p => card(p)).join("");
    initAutoSliders();

    if (isAdmin) {
      renderAdminView();
    } else {
      resetMobilePaginationState();
      await fetchNextMobilePageFromServer();
    }

    // 🌀 [LOADING SCREEN] สั่งสลายหน้าจอหมุนโหลดเมื่อดึงข้อมูลชุดแรกเสร็จเรียบร้อย
    hideLoadingScreen();

  } catch (err) {
    console.error("ระบบทำงานขัดข้อง:", err);
    // กรณีที่ระบบ Firebase ขัดข้อง ก็ต้องสั่งซ่อนด้วยเช่นกัน เพื่อป้องกันหน้าจอค้าง
    hideLoadingScreen();
  }
}

// 🌀 ฟังก์ชันสำหรับซ่อนหน้าต่าง Loading Screen ป้องกันการค้างบนจอ
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
  }
}

function resetMobilePaginationState() {
  clientDisplayedProducts = [];
  lastVisibleDoc = null;
  hasMoreItems = true;
  isFetchingNextPage = false;
  if(allEl) allEl.innerHTML = "";
}

async function fetchNextMobilePageFromServer() {
  if (!hasMoreItems || isAdmin || isFetchingNextPage) return;
  
  isFetchingNextPage = true;
  toggleInfiniteLoader(true); // เปิดแอนิเมชันหมุนโหลด
  
  try {
    let mobileQuery = productsRef;
    
    if (currentSortMode === "priceAsc") {
      mobileQuery = query(mobileQuery, orderBy("price", "asc"));
    } else if (currentSortMode === "priceDesc") {
      mobileQuery = query(mobileQuery, orderBy("price", "desc"));
    } else {
      mobileQuery = query(mobileQuery, orderBy("order", "asc"));
    }

    if (lastVisibleDoc) {
      mobileQuery = query(mobileQuery, startAfter(lastVisibleDoc), limit(itemsPerPage));
    } else {
      mobileQuery = query(mobileQuery, limit(itemsPerPage));
    }

    const snapshot = await getDocs(mobileQuery);
    if (snapshot.empty) {
      hasMoreItems = false;
      toggleInfiniteLoader(false);
      isFetchingNextPage = false;
      return;
    }

    lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
    let fetchedBatch = [];
    snapshot.forEach(doc => { fetchedBatch.push({ id: doc.id, ...doc.data() }); });

    clientDisplayedProducts = clientDisplayedProducts.concat(fetchedBatch);
    if (snapshot.docs.length < itemsPerPage) {
      hasMoreItems = false;
    }
    renderMobileView();
  } catch (err) {
    console.error("เกิดข้อผิดพลาดในการโหลดจัดทำโครงสร้าง Pagination:", err);
  } finally {
    isFetchingNextPage = false;
    toggleInfiniteLoader(hasMoreItems); // ปิดแอนิเมชันหากไม่มีของให้ดึงแล้ว
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

/* ================= 📦 โครงสร้างการจัดวางการ์ดสินค้า (Vector Shopping Cart) ================= */
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

  let tierBadgeHtml = "";
  if (p.tier) {
    tierBadgeHtml = `<div class="tier-badge rank-${p.tier}">Tier ${p.tier}</div>`;
  } else if (currentSortMode === "tierlist" && selectedCategory !== "ทั้งหมด" && index !== undefined && index >= 0 && index < 5) {
    const displayRank = index + 1;
    tierBadgeHtml = `<div class="tier-badge rank-${displayRank}">${displayRank}</div>`;
  }

  const imageLink = (!isProductComingSoon && (p.shopee1?.trim() || p.shopee2?.trim())) ? (p.shopee1?.trim() || p.shopee2?.trim()) : "";
  const imageHtml = imageLink ? `<a href="${imageLink}" target="_blank" class="card-img-link" onclick="trackProductClick('${p.id}')"><img src="${p.image?.trim() || 'https://via.placeholder.com/180'}" alt="${p.name}"></a>` : `<img src="${p.image?.trim() || 'https://via.placeholder.com/180'}" alt="${p.name}" class="no-link-img">`;

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
  <div ${dragAttr}>
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
          </div>
        ` : ""}
      </div>
    </div>
  </div>
  `;
}

/* ================= ⚡️ ระบบอัปเดตข้อมูลของ Admin ================= */
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

/* ================= ⏰ ฟังก์ชัน Loop รันเวลานับถอยหลัง ================= */
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

/* ================= ⚡️ ระบบเรนเดอร์ร่วมกันระหว่างสองโหมด ================= */
function render() {
  if (isAdmin) {
    renderAdminView();
  } else {
    renderMobileView();
  }
}

function renderMobileView() {
  if (document.getElementById("categoryTitle")) document.getElementById("categoryTitle").innerText = "หมวดหมู่สินค้า: " + selectedCategory;
  let displayed = [...clientDisplayedProducts];
  if (selectedCategory !== "ทั้งหมด") displayed = displayed.filter(p => p.category === selectedCategory);
  const kw = searchInput?.value.trim().toLowerCase();
  if (kw) displayed = displayed.filter(p => p.name?.toLowerCase().includes(kw) || p.description?.toLowerCase().includes(kw));

  if (allEl) allEl.innerHTML = displayed.map((p, index) => card(p, index)).join("");
  renderSidebarCategories();
  renderInfiniteScrollLoader(); // ตรวจสอบและฝังกล่องหมุนโหลดแบบอัตโนมัติแทนปุ่มกดเดิม
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
  
  // โหมดแอดมินให้ซ่อน Loader เสมอ
  toggleInfiniteLoader(false);

  if (dragNoticeEl) {
    dragNoticeEl.innerHTML = `✨ <b>โหมดแอดมิน:</b> ลากสลับตำแหน่งหน้าจอเสร็จแล้วให้กดปุ่ม <button class='btn edit' style='padding:4px 10px; font-size:11px; background:#22c55e; color:#fff; border:none;' onclick='saveAllProductsOrderManually()'>💾 บันทึกลำดับสินค้าทั้งหมด</button> เพื่อยิงบันทึกตำแหน่งลงคลาวด์ถาวรครับ`;
    dragNoticeEl.style.display = "block";
  }
  setupProductDragAndDrop(filtered);
  startFlashSaleClockTicker();
}

window.filterCategory = (category) => { 
  selectedCategory = category; 
  render();
};

/* ================= ⚡️ ระบบหมุนโหลดข้อมูลอัตโนมัติ (Infinite Scroll Loader) ================= */
function renderInfiniteScrollLoader() {
  let loaderContainer = document.getElementById("infiniteScrollLoaderContainer");
  
  // เงื่อนไขการซ่อนองค์ประกอบ: โหมดแอดมิน, สินค้าหมดแล้ว หรือ มีการเลือกตัวกรองหมวดหมู่เฉพาะเจาะจง
  if (isAdmin || !hasMoreItems || selectedCategory !== "ทั้งหมด") {
    if (loaderContainer) loaderContainer.classList.remove("show");
    return;
  }
  
  if (!loaderContainer) {
    loaderContainer = document.createElement("div");
    loaderContainer.id = "infiniteScrollLoaderContainer";
    loaderContainer.className = "infinite-scroll-loader show";
    
    const spinner = document.createElement("div");
    spinner.className = "spinner-neon";
    
    loaderContainer.appendChild(spinner);
    allEl.parentNode.insertBefore(loaderContainer, allEl.nextSibling);
    
    // ⚙️ ติดตั้ง IntersectionObserver ตรวจจับความเคลื่อนไหวเมื่อเลื่อนมาถึงกล่องหมุนโหลดนี้
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage && hasMoreItems && selectedCategory === "ทั้งหมด") {
        fetchNextMobilePageFromServer();
      }
    }, { rootMargin: "150px" }); // เติม margin ด้านล่างล่วงหน้า เพื่อให้เกิดการหมุนทำรอบได้นุ่มนวลขึ้น
    
    observer.observe(loaderContainer);
  } else {
    loaderContainer.classList.add("show");
  }
}

function toggleInfiniteLoader(visible) {
  const loaderContainer = document.getElementById("infiniteScrollLoaderContainer");
  if (loaderContainer) {
    if (visible && !isAdmin && selectedCategory === "ทั้งหมด") {
      loaderContainer.classList.add("show");
    } else {
      loaderContainer.classList.remove("show");
    }
  }
}

if(searchInput) searchInput.addEventListener("input", () => { render(); });
if(sortProductsSelect) sortProductsSelect.addEventListener("change", (e) => { currentSortMode = e.target.value; render(); });

/* ================= 📁 จัดการหมวดหมู่สินค้า ================= */
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

/* ================= 🎁 ระบบกรอบหน้าต่างแบนเนอร์กิจกรรม ================= */
window.handleWidgetUpdate = async () => {
  try {
    await setDoc(doc(db, "settings", "shopee_promo_widget"), { imageUrl: widgetImageInput.value.trim(), buttonLink: widgetLinkInput.value.trim(), visible: widgetVisibleCheck.checked });
    await bumpCloudVersion(); alert("💾 บันทึกข้อมูลวิดเจ็ตกิจกรรมสำเร็จ!"); loadMasterData();
  } catch (err) { alert(err.message); }
};

/* ================= 🔀 ระบบลากและสลับตำแหน่งของแอดมินหลังบ้าน ================= */
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

/* ================= 📝 บันทึกข้อมูลเพิ่ม/แก้ไขรายชื่อสินค้า ================= */
window.handleProductSubmit = async () => {
  const name = productName.value.trim(), image = productImage.value.trim();
  const price = Number(productPrice.value) || 0, salePrice = Number(productSalePrice.value) || 0;
  if (!name) { alert("กรุณาป้อนชื่อแบรนด์หรือรุ่นสินค้าด้วยครับ"); return; }

  const productData = {
    name, image, price, salePrice, description: productDescription.value.trim(),
    category: productCategory.value, tier: productTier.value, shopee1: shopee1.value.trim(),
    shopee2: shopee2.value.trim(), lazada: lazada.value.trim(), isNew: isNew.checked,
    isHot: isHot.checked, comingSoon: comingSoon.checked || (price === 0 && salePrice === 0)
  };

  try {
    if (currentEditId) {
      await updateDoc(doc(db, "products", currentEditId), productData); currentEditId = null; submitBtn.innerText = "เพิ่มสินค้าเข้าระบบ";
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
  if(productTier) productTier.value = ""; shopee1.value = ""; shopee2.value = ""; lazada.value = "";
  isNew.checked = false; isHot.checked = false; comingSoon.checked = false;
}

window.editProduct = (id) => {
  const p = allProducts.find(item => item.id === id); if (!p) return;
  currentEditId = id; productName.value = p.name || ""; productImage.value = p.image || ""; productPrice.value = p.price || ""; productSalePrice.value = p.salePrice || ""; productDescription.value = p.description || ""; productCategory.value = p.category || "";
  if(productTier) productTier.value = p.tier || ""; shopee1.value = p.shopee1 || ""; shopee2.value = p.shopee2 || ""; lazada.value = p.lazada || "";
  isNew.checked = !!p.isNew; isHot.checked = !!p.isHot; comingSoon.checked = !!p.comingSoon;
  submitBtn.innerText = "บันทึกการแก้ไขสินค้า"; document.getElementById("adminPanel").scrollIntoView({ behavior: "smooth" });
};

window.deleteProduct = async (id) => {
  if (confirm("ต้องการลบสินค้าถาวรออกจากฐานข้อมูลคลาวด์?")) {
    try { await deleteDoc(doc(db, "products", id)); await bumpCloudVersion(); loadMasterData(); } catch (error) { alert(error.message); }
  }
};

/* ================= 🔒 ระบบดูแลสิทธิ์และเข้าสู่ระบบควบคุม ================= */
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authModal = document.getElementById("authModal");
const closeAuthBtn = document.getElementById("closeAuthBtn");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const adminPanel = document.getElementById("adminPanel");

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
if(logoutBtn) logoutBtn.onclick = () => { signOut(auth).then(() => alert("ออกจากแผงควบคุมแอดมินเรียบร้อยครับ")); };

onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  const dStyle = isAdmin ? "flex" : "none";
  if(loginBtn) loginBtn.style.display = isAdmin ? "none" : "inline-block";
  if(logoutBtn) logoutBtn.style.display = isAdmin ? "inline-block" : "none";
  if(adminPanel) adminPanel.style.display = dStyle;
  if(adminCategoryPanel) adminCategoryPanel.style.display = dStyle;
  if(adminWidgetPanel) adminWidgetPanel.style.display = dStyle;
  if(adminDragSortPanel) adminDragSortPanel.style.display = dStyle;
  loadMasterData();
});

/* ================= 🚀 ระบบปุ่มเลื่อนขึ้นด้านบนสุดหน้ามือถือ ================= */
const backToTopBtn = document.getElementById("backToTopBtn");
if (backToTopBtn) {
  window.addEventListener("scroll", () => { if (window.scrollY > 300) backToTopBtn.classList.add("show"); else backToTopBtn.classList.remove("show"); });
  backToTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

/* ================= 🔄 ระบบเลื่อนสไลด์กลุ่มไฮไลท์การ์ดอัตโนมัติ ================= */
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

/* ================= 🔀 ส่วนจัดการระบบลากสลับสินค้ากลุ่ม HOT / NEW ================= */
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

/*document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    loadMasterData();
  }
});*/