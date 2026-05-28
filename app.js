import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc,
  setDoc,
  getDoc
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
const db = getFirestore(app);
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

document.documentElement.setAttribute("data-theme", currentTheme);

if (themeToggleBtn) {
  themeToggleBtn.onclick = () => {
    const targetTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", targetTheme);
    localStorage.setItem("theme", targetTheme);
  };
}

/* ================= 📦 การจัดรูปสินค้า (Component Card) ================= */
function formatPrice(p){
  if(!p) return "";
  return "฿" + Number(p).toLocaleString("th-TH");
}

function card(p, index){
  const priceNormal = p.price ? Number(p.price) : 0;
  const priceSale = p.salePrice ? Number(p.salePrice) : 0;
  
  const isProductComingSoon = !!p.comingSoon || (priceNormal === 0 && priceSale === 0);
  
  let priceHtmlDisplay = "";
  if (isProductComingSoon) {
    priceHtmlDisplay = `<div class="price coming-soon-text">Coming Soon...</div>`;
  } else {
    if (priceSale > 0 && priceNormal > 0) {
      priceHtmlDisplay = `
        <div class="price old-price-slashed">${formatPrice(priceNormal)}</div>
        <div class="price">${formatPrice(priceSale)}</div>
      `;
    } else {
      priceHtmlDisplay = `<div class="price">${formatPrice(priceNormal || priceSale)}</div>`;
    }
  }

  let btnsContent = "";
  if (isProductComingSoon) {
    btnsContent = `<div class="btn coming-soon-btn">Coming Soon...</div>`;
  } else {
    const link1 = p.shopee1 ? p.shopee1.trim() : "";
    const link2 = p.shopee2 ? p.shopee2.trim() : "";
    
    let shopeeBtns = "";
    if (link1 && link2) {
      shopeeBtns += `<a class="btn shopee" href="${link1}" target="_blank">Shopee 1</a>`;
      shopeeBtns += `<a class="btn shopee" href="${link2}" target="_blank">Shopee 2</a>`;
    } else if (link1 || link2) {
      shopeeBtns += `<a class="btn shopee" href="${link1 || link2}" target="_blank">Shopee</a>`;
    } else {
      shopeeBtns += `<a class="btn disabled" href="javascript:void(0);">Shopee</a>`;
    }

    const lazadaBtn = p.lazada?.trim() 
      ? `<a class="btn lazada" href="${p.lazada.trim()}" target="_blank">Lazada</a>` 
      : `<a class="btn disabled" href="javascript:void(0);">Lazada</a>`;
      
    btnsContent = shopeeBtns + lazadaBtn;
  }

  const canDrag = isAdmin && currentSortMode === "tierlist";
  const dragAttr = canDrag ? `draggable="true" data-id="${p.id}" class="card admin-draggable"` : `class="card"`;
  const currentQuickPriceVal = priceSale > 0 ? priceSale : (priceNormal > 0 ? priceNormal : "");
  const currentFlashSaleTimeVal = p.flashSaleEndTime || "";

  let tierBadgeHtml = "";
  if (currentSortMode === "tierlist" && selectedCategory !== "ทั้งหมด" && index !== undefined && index >= 0 && index < 5) {
    const displayRank = index + 1;
    tierBadgeHtml = `<div class="tier-badge rank-${displayRank}">${displayRank}</div>`;
  }

  const imageLink = (!isProductComingSoon && (p.shopee1?.trim() || p.shopee2?.trim())) ? (p.shopee1?.trim() || p.shopee2?.trim()) : "";
  let imageHtml = "";
  if (imageLink) {
    imageHtml = `<a href="${imageLink}" target="_blank" class="card-img-link"><img src="${p.image?.trim() || 'https://via.placeholder.com/180'}" alt="${p.name}"></a>`;
  } else {
    imageHtml = `<img src="${p.image?.trim() || 'https://via.placeholder.com/180'}" alt="${p.name}" class="no-link-img">`;
  }

  // ⚡ แถบแสดงเวลานับถอยหลัง Flash Sale ใต้ชื่อสินค้า
  let flashSaleTimerHtml = "";
  if (!isProductComingSoon && currentFlashSaleTimeVal) {
    flashSaleTimerHtml = `
      <div class="card-flash-sale-box">
        <span class="flash-sale-badge-text">Flash Sale</span>
        <div class="flash-sale-countdown-clock dynamic-countdown-timer" data-endtime="${currentFlashSaleTimeVal}">00h 00m 00s</div>
      </div>
    `;
  }

  return `
  <div ${dragAttr}>
    ${tierBadgeHtml}
    ${p.isHot ? `<div class="badge hot">HOT</div>` : ""}
    ${p.isNew ? `<div class="badge">NEW</div>` : ""}
    ${imageHtml}
    <div class="info">
      <h4>${p.name}</h4>
      ${flashSaleTimerHtml}
      <div class="price-container">
        ${priceHtmlDisplay}
      </div>
      ${p.description ? `<p>${p.description}</p>` : ""}
      <div class="btns">
        ${btnsContent}
        ${isAdmin ? `
          <div class="admin-card-actions">
            <button class="btn edit" onclick='editProduct("${p.id}")'>Edit</button>
            <button class="btn delete" onclick='deleteProduct("${p.id}")'>Delete</button>
          </div>
          
          <div class="quick-admin-controls-wrapper">
            <div class="quick-price-box">
              <label>⚡️ ราคาด่วน (Enter):</label>
              <div class="quick-price-row">
                <input type="text" class="quick-price-input" 
                       value="${currentQuickPriceVal}" 
                       placeholder="ระบุราคา..." 
                       onkeydown="handleQuickPriceKey(event, '${p.id}')">
                <button class="quick-price-clear-btn" title="เคลียร์ค่าเป็น Coming Soon" onclick="clearQuickPrice('${p.id}')">✕</button>
              </div>
            </div>
            
            <div class="quick-flash-sale-box">
              <label>⏰ ตั้งเวลา Flash Sale (เช่น 2 หรือ 45m) + Enter:</label>
              <div class="quick-price-row">
                <input type="text" class="quick-date-input" 
                       value="" 
                       placeholder="ระบุจำนวนชั่วโมง หรือ 45m..." 
                       onkeydown="handleQuickFlashSaleKey(event, '${p.id}')">
                <button class="quick-price-clear-btn" title="ลบเวลา Flash Sale ออก" onclick="clearQuickFlashSale('${p.id}')">✕</button>
              </div>
              ${currentFlashSaleTimeVal ? `<div style="font-size:11px; color:var(--price-green); margin-top:4px; font-weight:bold;">⏱️ มีการล็อกเวลานับถอยหลังอยู่</div>` : ""}
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  </div>
  `;
}

/* ================= 🎯 ระบบตั้งค่าด่วนบน Card (ราคาด่วน / เวลา Flash Sale) ================= */
window.handleQuickPriceKey = async (event, productId) => {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault();
    const inputVal = event.target.value.trim();
    
    if (!inputVal || isNaN(inputVal)) {
      alert("กรุณากรอกเฉพาะตัวเลขราคาที่ถูกต้องครับ");
      return;
    }

    const newPriceNum = Number(inputVal);

    try {
      const pDoc = await getDoc(doc(db, "products", productId));
      if (pDoc.exists()) {
        const oldData = pDoc.data();
        const oldPrice = oldData.price ? Number(oldData.price) : 0;
        
        let updateData = {};
        if (oldPrice > 0 && newPriceNum < oldPrice) {
          updateData = { salePrice: newPriceNum, comingSoon: false };
        } else {
          updateData = { price: newPriceNum, salePrice: 0, comingSoon: false };
        }
        
        await updateDoc(doc(db, "products", productId), updateData);
        alert("⚡️ ปรับเปลี่ยนราคาสินค้าด่วนสำเร็จ!");
        event.target.blur();
      }
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการอัปเดตราคาด่วน: " + err.message);
    }
  }
};

window.clearQuickPrice = async (productId) => {
  if (confirm("คุณต้องการล้างราคาสินค้านี้และตั้งเป็น Coming Soon ใช่หรือไม่?")) {
    try {
      await updateDoc(doc(db, "products", productId), {
        price: 0,
        salePrice: 0,
        comingSoon: true
      });
      alert("⚡️ เคลียร์ค่าสินค้าและตั้งเป็น Coming Soon สำเร็จแล้ว!");
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  }
};

// ⏰ ฟังก์ชันกด Enter เพื่อบันทึกเวลานับถอยหลังรายชิ้นทันที (คำนวณอัตโนมัติจากปัจจุบัน)
window.handleQuickFlashSaleKey = async (event, productId) => {
  if (event.key === "Enter" || event.keyCode === 13) {
    event.preventDefault();
    const inputVal = event.target.value.trim().toLowerCase();

    if (!inputVal) {
      alert("กรุณากรอกตัวเลขเวลาที่ต้องการนับถอยหลังก่อนครับ");
      return;
    }

    let targetMs = 0;

    // ตรวจสอบเงื่อนไขว่ากรอกเป็นนาที (m) หรือกรอกเป็นชั่วโมงตรงๆ
    if (inputVal.endsWith("m")) {
      const minutes = parseFloat(inputVal.replace("m", ""));
      if (isNaN(minutes) || minutes <= 0) {
        alert("กรุณากรอกจำนวนนาทีให้ถูกต้อง เช่น 30m หรือ 45m");
        return;
      }
      targetMs = minutes * 60 * 1000;
    } else {
      const hours = parseFloat(inputVal);
      if (isNaN(hours) || hours <= 0) {
        alert("กรุณากรอกจำนวนชั่วโมงให้ถูกต้อง เช่น 2 หรือ 1.5");
        return;
      }
      targetMs = hours * 60 * 60 * 1000;
    }

    // คำนวณวันหมดอายุโดยการนำเวลาปัจจุบันมาบวกมิลลิวินาทีที่กรอกเพิ่มเข้าไป
    const nowTime = new Date().getTime();
    const endTimeIsoString = new Date(nowTime + targetMs).toISOString();

    try {
      await updateDoc(doc(db, "products", productId), {
        flashSaleEndTime: endTimeIsoString
      });
      alert("⏰ ตั้งเวลานับถอยหลังเรียบร้อยและเริ่มเปิดบอร์ดโปรโมชันทันที!");
      event.target.value = ""; 
      event.target.blur();
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  }
};

// ✕ ฟังก์ชันกดปุ่มกากบาทเพื่อลบเวลา Flash Sale
window.clearQuickFlashSale = async (productId) => {
  try {
    await updateDoc(doc(db, "products", productId), {
      flashSaleEndTime: ""
    });
    alert("🗑️ ลบเวลา Flash Sale ของสินค้านี้ออกเรียบร้อย!");
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + err.message);
  }
};

/* ================= ⏰ ฟังก์ชัน Loop ทำงานรันเวลานับถอยหลัง Real-time ================= */
function startFlashSaleClockTicker() {
  if (globalFlashSaleTimerInterval) clearInterval(globalFlashSaleTimerInterval);
  
  globalFlashSaleTimerInterval = setInterval(() => {
    const timerElements = document.querySelectorAll(".dynamic-countdown-timer");
    if (timerElements.length === 0) return;
    
    timerElements.forEach(el => {
      const endTimeAttr = el.getAttribute("data-endtime");
      if (!endTimeAttr) return;
      
      const targetTime = new Date(endTimeAttr).getTime();
      const now = new Date().getTime();
      const timeRemaining = targetTime - now;
      
      if (timeRemaining <= 0) {
        el.innerHTML = "หมดเวลาแจกโปร";
        el.style.color = "var(--text-muted)";
      } else {
        const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
        
        const hDisplay = hours < 10 ? "0" + hours : hours;
        const mDisplay = minutes < 10 ? "0" + minutes : minutes;
        const sDisplay = seconds < 10 ? "0" + seconds : seconds;
        
        if (days > 0) {
          el.innerHTML = `${days}d ${hDisplay}h ${mDisplay}m ${sDisplay}s`;
        } else {
          el.innerHTML = `${hDisplay}h ${mDisplay}m ${sDisplay}s`;
        }
      }
    });
  }, 1000);
}

/* ================= 📁 จัดการหมวดหมู่สินค้า ================= */
function renderSidebarCategories() {
  if (!categoriesEl) return;
  let html = `
    <div class="category ${selectedCategory === 'ทั้งหมด' ? 'active' : ''}" onclick="filterCategory('ทั้งหมด')">
      ทั้งหมด (${allProducts.length})
    </div>
  `;

  dbCategories.forEach(cat => {
    const count = allProducts.filter(p => p.category === cat.name).length;
    html += `
      <div class="category ${selectedCategory === cat.name ? 'active' : ''}" onclick="filterCategory('${cat.name}')">
        ${cat.name} (${count})
      </div>
    `;
  });
  categoriesEl.innerHTML = html;
}

window.filterCategory = (category) => {
  selectedCategory = category;
  render();
};

function updateCategoryDropdown() {
  if (!productCategory) return;
  const currentValue = productCategory.value;
  
  const html = dbCategories.map(cat => `<option value="${cat.name}">${cat.name}</option>`).join("");
  productCategory.innerHTML = html;
  
  if (currentValue && dbCategories.some(c => c.name === currentValue)) {
    productCategory.value = currentValue;
  }
}

function renderAdminCategoryList() {
  if(!adminCategoryList) return;
  
  if (dbCategories.length === 0) {
    adminCategoryList.innerHTML = "<div style='color:var(--text-muted); font-size:13px; text-align:center; padding:8px;'>ยังไม่มีหมวดหมู่สินค้า</div>";
    return;
  }

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
  adminCategoryInput.value = "";
  currentEditCategoryId = null;
  adminCategoryTitle.innerText = "📁 แผงจัดการระบบหมวดหมู่สินค้า";
  categorySubmitBtn.innerText = "เพิ่มหมวดหมู่";
  if(categoryCancelBtn) categoryCancelBtn.style.display = "none";
};

window.editCategory = (id) => {
  const cat = dbCategories.find(c => c.id === id);
  if (!cat) return;

  currentEditCategoryId = id;
  adminCategoryInput.value = cat.name || "";
  
  adminCategoryTitle.innerText = "📝 แก้ไขชื่อหมวดหมู่สินค้า";
  categorySubmitBtn.innerText = "บันทึกการแก้ไข";
  if(categoryCancelBtn) categoryCancelBtn.style.display = "block";

  adminCategoryInput.focus();
};

window.handleCategorySubmit = async () => {
  const name = adminCategoryInput.value.trim();
  if (!name) {
    alert("กรุณากรอกชื่อหมวดหมู่ด้วยครับ");
    return;
  }

  const exists = dbCategories.some(cat => cat.name.toLowerCase() === name.toLowerCase() && cat.id !== currentEditCategoryId);
  if (exists || name === "ทั้งหมด") {
    alert("มีหมวดหมู่นี้อยู่ในระบบเรียบร้อยแล้ว");
    return;
  }

  try {
    if (currentEditCategoryId) {
      await updateDoc(doc(db, "categories_list", currentEditCategoryId), { name: name });
      alert("แก้ไขชื่อหมวดหมู่เรียบร้อย!");
    } else {
      const maxOrder = dbCategories.reduce((max, c) => ((c.order ?? 0) > max ? c.order : max), 0);
      await addDoc(categoriesRef, { name: name, order: maxOrder + 1 });
      alert("เพิ่มหมวดหมู่สำเร็จ!");
    }
    clearCategoryForm();
  } catch (error) {
    alert("เกิดข้อผิดพลาด: " + error.message);
  }
};

window.deleteCategory = async (id, name) => {
  if (confirm(`คุณแน่ใจใช่ไหมที่จะลบหมวดหมู่ "${name}"?`)) {
    try {
      await deleteDoc(doc(db, "categories_list", id));
      if (selectedCategory === name) selectedCategory = "ทั้งหมด";
      if (currentEditCategoryId === id) clearCategoryForm();
    } catch (error) {
      alert("ไม่สามารถลบหมวดหมู่ได้: " + error.message);
    }
  }
};

function setupCategoryDragAndDrop() {
  const catItems = document.querySelectorAll("#adminCategoryList .admin-cat-item");
  catItems.forEach(item => {
    item.addEventListener("dragstart", (e) => {
      draggedCategoryId = item.getAttribute("data-catid");
      e.dataTransfer.effectAllowed = "move";
    });
    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      item.classList.add("cat-drag-over");
    });
    item.addEventListener("dragleave", () => {
      item.classList.remove("cat-drag-over");
    });
    item.addEventListener("drop", async (e) => {
      e.preventDefault();
      item.classList.remove("cat-drag-over");
      const targetCategoryId = item.getAttribute("data-catid");
      if (!draggedCategoryId || draggedCategoryId === targetCategoryId) return;

      let currentCats = [...dbCategories];
      const draggedIndex = currentCats.findIndex(c => c.id === draggedCategoryId);
      const targetIndex = currentCats.findIndex(c => c.id === targetCategoryId);
      if (draggedIndex === -1 || targetIndex === -1) return;

      const [removed] = currentCats.splice(draggedIndex, 1);
      currentCats.splice(targetIndex, 0, removed);

      try {
        for (let i = 0; i < currentCats.length; i++) {
          const catDocRef = doc(db, "categories_list", currentCats[i].id);
          await updateDoc(catDocRef, { order: i });
        }
      } catch (err) {
        console.error(err);
      }
    });
  });
}

/* ================= 🎁 ระบบกรอบแจกโค้ดส่วนลด ================= */
function listenToWidgetSettings() {
  const widgetDocRef = doc(db, "settings", "shopee_promo_widget");
  onSnapshot(widgetDocRef, (docSnap) => {
    if (docSnap.exists()) {
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
      if (widgetImageInput && document.activeElement !== widgetImageInput) {
        widgetImageInput.value = currentWidgetState.imageUrl;
      }
      if (widgetLinkInput && document.activeElement !== widgetLinkInput) {
        widgetLinkInput.value = currentWidgetState.buttonLink;
      }
      if (widgetVisibleCheck) {
        widgetVisibleCheck.checked = !!currentWidgetState.visible;
      }
    }
  });
}

window.handleWidgetUpdate = async () => {
  const imgUrlValue = widgetImageInput.value.trim() || "https://i.postimg.cc/9F4P0hX8/gift-box.png";
  const linkValue = widgetLinkInput.value.trim() || "https://s.shopee.co.th/1VwHRlinNy";
  const isVisibleValue = widgetVisibleCheck.checked;

  try {
    await setDoc(doc(db, "settings", "shopee_promo_widget"), {
      imageUrl: imgUrlValue,
      buttonLink: linkValue,
      visible: isVisibleValue
    });
    alert("💾 อัปเดตข้อมูลกิจกรรมและสถานะการแสดงผลวิดเจ็ตสำเร็จ!");
  } catch (err) {
    alert("เกิดข้อผิดพลาดในการบันทึกวิดเจ็ต: " + err.message);
  }
};

/* ================= ⚡️ เรนเดอร์หน้าจอหลัก & เรียงลำดับสินค้า ================= */
function render(){
  if (document.getElementById("categoryTitle")) {
    document.getElementById("categoryTitle").innerText = "หมวดหมู่: " + selectedCategory;
  }
  
  const hotProducts = allProducts.filter(p => p.isHot).sort((a, b) => (a.hotOrder ?? 0) - (b.hotOrder ?? 0));
  const newProducts = allProducts.filter(p => p.isNew).sort((a, b) => (a.newOrder ?? 0) - (b.newOrder ?? 0));

  if(hotEl) hotEl.innerHTML = hotProducts.map(p => card(p)).join("");
  if(newEl) newEl.innerHTML = newProducts.map(p => card(p)).join("");

  initAutoSliders();

  let filtered = [...allProducts];
  if (selectedCategory !== "ทั้งหมด") {
    filtered = allProducts.filter(p => p.category === selectedCategory);
  }

  const kw = searchInput?.value.trim().toLowerCase();
  if(kw) {
    filtered = filtered.filter(p => p.name?.toLowerCase().includes(kw) || p.description?.toLowerCase().includes(kw));
  }

  if (currentSortMode === "priceAsc") {
    filtered.sort((a, b) => {
      const aIsCS = !!a.comingSoon || (!a.price && !a.salePrice);
      const bIsCS = !!b.comingSoon || (!b.price && !b.salePrice);
      if (aIsCS && !bIsCS) return 1; 
      if (!aIsCS && bIsCS) return -1;
      if (aIsCS && bIsCS) return 0;
      const aPrice = a.salePrice > 0 ? a.salePrice : a.price;
      const bPrice = b.salePrice > 0 ? b.salePrice : b.price;
      return aPrice - bPrice;
    });
  } else if (currentSortMode === "priceDesc") {
    filtered.sort((a, b) => {
      const aIsCS = !!a.comingSoon || (!a.price && !a.salePrice);
      const bIsCS = !!b.comingSoon || (!b.price && !b.salePrice);
      if (aIsCS && !bIsCS) return 1; 
      if (!aIsCS && bIsCS) return -1;
      if (aIsCS && bIsCS) return 0;
      const aPrice = a.salePrice > 0 ? a.salePrice : a.price;
      const bPrice = b.salePrice > 0 ? b.salePrice : b.price;
      return bPrice - aPrice;
    });
  } else {
    filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  if(allEl) {
    allEl.innerHTML = filtered.map((p, index) => card(p, index)).join("");
  }

  renderSidebarCategories();
  renderAdminCategoryList();
  
  if (isAdmin && currentSortMode === "tierlist") {
    if (dragNoticeEl) dragNoticeEl.style.display = "block";
    setupProductDragAndDrop(filtered);
  } else {
    if (dragNoticeEl) dragNoticeEl.style.display = "none";
  }

  startFlashSaleClockTicker();
}

/* ================= 🎯 ระบบลากและวางสินค้าสำหรับแอดมิน ================= */
function setupProductDragAndDrop(currentFilteredProducts) {
  const cards = document.querySelectorAll("#products .card.admin-draggable");
  cards.forEach(cardItem => {
    cardItem.addEventListener("dragstart", (e) => {
      draggedProductId = cardItem.getAttribute("data-id");
      e.dataTransfer.effectAllowed = "move";
    });

    cardItem.addEventListener("dragover", (e) => {
      e.preventDefault();
      cardItem.classList.add("product-drag-over");
    });

    cardItem.addEventListener("dragleave", () => {
      cardItem.classList.remove("product-drag-over");
    });

    cardItem.addEventListener("drop", async (e) => {
      e.preventDefault();
      cardItem.classList.remove("product-drag-over");
      
      const targetProductId = cardItem.getAttribute("data-id");
      if (!draggedProductId || draggedProductId === targetProductId) return;

      let updatedList = [...currentFilteredProducts];
      const draggedIdx = updatedList.findIndex(p => p.id === draggedProductId);
      const targetIdx = updatedList.findIndex(p => p.id === targetProductId);

      if (draggedIdx === -1 || targetIdx === -1) return;

      const [removedProduct] = updatedList.splice(draggedIdx, 1);
      updatedList.splice(targetIdx, 0, removedProduct);

      try {
        for (let i = 0; i < updatedList.length; i++) {
          const productDocRef = doc(db, "products", updatedList[i].id);
          await updateDoc(productDocRef, { order: i });
        }
      } catch (err) {
        console.error("Firebase Drag Product Update Error:", err);
      }
    });
  });
}

/* ================= 📝 บันทึกข้อมูลเพิ่ม/แก้ไขสินค้า ================= */
window.handleProductSubmit = async () => {
  const name = productName.value.trim();
  const image = productImage.value.trim();
  const priceVal = productPrice.value.trim();
  const salePriceVal = productSalePrice.value.trim();
  const description = productDescription.value.trim();
  const category = productCategory.value;
  const s1 = shopee1.value.trim();
  const s2 = shopee2.value.trim();
  const lz = lazada.value.trim();
  const n = isNew.checked;
  const h = isHot.checked;
  const cs = comingSoon.checked;

  if (!name) {
    alert("กรุณากรอกชื่อสินค้าด้วยครับ");
    return;
  }

  const pPrice = priceVal ? Number(priceVal) : 0;
  const pSalePrice = salePriceVal ? Number(salePriceVal) : 0;
  const autoComingSoon = cs || (pPrice === 0 && pSalePrice === 0);

  const productData = {
    name,
    image,
    price: pPrice,
    salePrice: pSalePrice,
    description,
    category,
    shopee1: s1,
    shopee2: s2,
    lazada: lz,
    isNew: n,
    isHot: h,
    comingSoon: autoComingSoon
  };

  try {
    if (currentEditId) {
      await updateDoc(doc(db, "products", currentEditId), productData);
      alert("แก้ไขข้อมูลสินค้าสำเร็จ!");
      currentEditId = null;
      submitBtn.innerText = "เพิ่มสินค้าเข้าระบบ";
    } else {
      const maxOrder = allProducts.reduce((max, p) => ((p.order ?? 0) > max ? p.order : max), 0);
      productData.order = maxOrder + 1;
      
      const maxHotOrder = allProducts.reduce((max, p) => ((p.hotOrder ?? 0) > max ? p.hotOrder : max), 0);
      const maxNewOrder = allProducts.reduce((max, p) => ((p.newOrder ?? 0) > max ? p.newOrder : max), 0);
      productData.hotOrder = maxHotOrder + 1;
      productData.newOrder = maxNewOrder + 1;
      productData.flashSaleEndTime = ""; 

      await addDoc(productsRef, productData);
      alert("เพิ่มสินค้าใหม่สำเร็จ!");
    }
    clearProductForm();
  } catch (error) {
    alert("เกิดข้อผิดพลาด: " + error.message);
  }
};

function clearProductForm() {
  productName.value = "";
  productImage.value = "";
  productPrice.value = "";
  productSalePrice.value = "";
  productDescription.value = "";
  shopee1.value = "";
  shopee2.value = "";
  lazada.value = "";
  isNew.checked = false;
  isHot.checked = false;
  comingSoon.checked = false;
}

window.editProduct = async (id) => {
  const p = allProducts.find(item => item.id === id);
  if (!p) return;

  currentEditId = id;
  productName.value = p.name || "";
  productImage.value = p.image || "";
  productPrice.value = p.price || "";
  productSalePrice.value = p.salePrice || "";
  productDescription.value = p.description || "";
  productCategory.value = p.category || "";
  shopee1.value = p.shopee1 || "";
  shopee2.value = p.shopee2 || "";
  lazada.value = p.lazada || "";
  isNew.checked = !!p.isNew;
  isHot.checked = !!p.isHot;
  comingSoon.checked = !!p.comingSoon;

  submitBtn.innerText = "บันทึกการแก้ไขสินค้า";
  document.getElementById("adminPanel").scrollIntoView({ behavior: "smooth" });
};

window.deleteProduct = async (id) => {
  if (confirm("คุณแน่ใจใช่ไหมว่าจะลบสินค้ารายการนี้ออกจากระบบ?")) {
    try {
      await deleteDoc(doc(db, "products", id));
      alert("ลบสินค้าเรียบร้อยครับ");
    } catch (error) {
      alert("ไม่สามารถลบได้: " + error.message);
    }
  }
};

/* ================= 🔒 ระบบสิทธิ์และการล็อกอิน ================= */
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authModal = document.getElementById("authModal");
const closeAuthBtn = document.getElementById("closeAuthBtn");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authEmailInput = document.getElementById("authEmail");
const authPasswordInput = document.getElementById("authPassword");
const adminPanel = document.getElementById("adminPanel");

if(loginBtn) loginBtn.onclick = () => authModal.style.display = "flex";
if(closeAuthBtn) closeAuthBtn.onclick = () => { authModal.style.display = "none"; };

if(authSubmitBtn) {
  authSubmitBtn.onclick = async () => {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value.trim();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      authModal.style.display = "none";
      authEmailInput.value = "";
      authPasswordInput.value = "";
    } catch (error) {
      alert("อีเมลหรือรหัสผ่านผู้ดูแลระบบไม่ถูกต้อง!");
    }
  };
}

if(logoutBtn) {
  logoutBtn.onclick = () => {
    signOut(auth).then(() => {
      alert("ออกจากระบบผู้ดูแลเรียบร้อย");
    });
  };
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    isAdmin = true;
    if(loginBtn) loginBtn.style.display = "none";
    if(logoutBtn) logoutBtn.style.display = "inline-block";
    if(adminPanel) adminPanel.style.display = "flex";
    if(adminCategoryPanel) adminCategoryPanel.style.display = "flex";
    if(adminWidgetPanel) adminWidgetPanel.style.display = "flex";
    if(adminDragSortPanel) adminDragSortPanel.style.display = "flex"; 
  } else {
    isAdmin = false;
    if(loginBtn) loginBtn.style.display = "inline-block";
    if(logoutBtn) logoutBtn.style.display = "none";
    if(adminPanel) adminPanel.style.display = "none";
    if(adminCategoryPanel) adminCategoryPanel.style.display = "none";
    if(adminWidgetPanel) adminWidgetPanel.style.display = "none";
    if(adminDragSortPanel) adminDragSortPanel.style.display = "none"; 
  }
  
  if (user) {
    if(widgetImageInput) widgetImageInput.value = currentWidgetState.imageUrl;
    if(widgetLinkInput) widgetLinkInput.value = currentWidgetState.buttonLink;
    if(widgetVisibleCheck) widgetVisibleCheck.checked = !!currentWidgetState.visible;
  }
  
  render();
});

/* ================= 🛰️ Firestore Realtime Listeners ================= */
onSnapshot(categoriesRef, (snapshot) => {
  dbCategories = [];
  snapshot.forEach(docSnap => {
    dbCategories.push({ id: docSnap.id, ...docSnap.data() });
  });
  dbCategories.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  updateCategoryDropdown();
  render();
});

onSnapshot(productsRef, (snapshot) => {
  allProducts = [];
  snapshot.forEach(docSnap => {
    allProducts.push({ id: docSnap.id, ...docSnap.data() });
  });
  render();
  renderAdminDragSortLists(); 
});

listenToWidgetSettings();

if(searchInput) {
  searchInput.addEventListener("input", () => {
    render();
  });
}

if(sortProductsSelect) {
  sortProductsSelect.addEventListener("change", (e) => {
    currentSortMode = e.target.value;
    render();
  });
}

/* ================= 🚀 เลื่อนขึ้นบนสุด (Back to Top) ================= */
const backToTopBtn = document.getElementById("backToTopBtn");
if (backToTopBtn) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 300) backToTopBtn.classList.add("show");
    else backToTopBtn.classList.remove("show");
  });
  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ================= 🔄 ระบบสไลด์แบบปุ่มกดและ Auto-slide เนียนตา ================= */
window.scrollSlide = (elementId, direction) => {
  const el = document.getElementById(elementId);
  if (!el || el.children.length <= 1) return;

  const cardWidth = el.children[0].offsetWidth + 10; 
  const maxScrollLeft = el.scrollWidth - el.clientWidth;

  if (direction === "right") {
    if (el.scrollLeft >= maxScrollLeft - 10) {
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      el.scrollTo({ left: el.scrollLeft + cardWidth, behavior: "smooth" });
    }
  } else {
    if (el.scrollLeft <= 10) {
      el.scrollTo({ left: maxScrollLeft, behavior: "smooth" });
    } else {
      el.scrollTo({ left: el.scrollLeft - cardWidth, behavior: "smooth" });
    }
  }
};

function initAutoSliders() {
  if (hotSlideInterval) clearInterval(hotSlideInterval);
  if (newSlideInterval) clearInterval(newSlideInterval);

  hotSlideInterval = setInterval(() => {
    window.scrollSlide("hotProducts", "right");
  }, 6000);

  newSlideInterval = setInterval(() => {
    window.scrollSlide("newProducts", "right");
  }, 7000);
}

/* ================= 🔀 ระบบลากเรียงลำดับสินค้า HOT และ NEW ================= */
function renderAdminDragSortLists() {
  const adminHotDragList = document.getElementById("adminHotDragList");
  const adminNewDragList = document.getElementById("adminNewDragList");

  if (!adminHotDragList || !adminNewDragList) return;

  const hotProducts = allProducts.filter(p => p.isHot).sort((a, b) => (a.hotOrder ?? 0) - (b.hotOrder ?? 0));
  const newProducts = allProducts.filter(p => p.isNew).sort((a, b) => (a.newOrder ?? 0) - (b.newOrder ?? 0));

  if (hotProducts.length === 0) {
    adminHotDragList.innerHTML = "<div style='color:var(--text-muted); font-size:13px; text-align:center; padding:8px;'>ไม่มีสินค้า HOT</div>";
  } else {
    adminHotDragList.innerHTML = hotProducts.map(p => `
      <div class="admin-cat-item admin-draggable" draggable="true" data-sortid="${p.id}" data-type="hot">
        <span>☰ ${p.name}</span>
      </div>
    `).join("");
  }

  if (newProducts.length === 0) {
    adminNewDragList.innerHTML = "<div style='color:var(--text-muted); font-size:13px; text-align:center; padding:8px;'>ไม่มีสินค้า NEW</div>";
  } else {
    adminNewDragList.innerHTML = newProducts.map(p => `
      <div class="admin-cat-item admin-draggable" draggable="true" data-sortid="${p.id}" data-type="new">
        <span>☰ ${p.name}</span>
      </div>
    `).join("");
  }

  setupNewHotDragAndDrop();
}

function setupNewHotDragAndDrop() {
  const dragItems = document.querySelectorAll("#adminHotDragList .admin-cat-item, #adminNewDragList .admin-cat-item");

  dragItems.forEach(item => {
    item.addEventListener("dragstart", (e) => {
      draggedSortId = item.getAttribute("data-sortid");
      e.dataTransfer.effectAllowed = "move";
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      item.classList.add("cat-drag-over");
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("cat-drag-over");
    });

    item.addEventListener("drop", async (e) => {
      e.preventDefault();
      item.classList.remove("cat-drag-over");

      const targetId = item.getAttribute("data-sortid");
      const listType = item.getAttribute("data-type");

      if (!draggedSortId || draggedSortId === targetId) return;

      let currentFilteredGroup = allProducts
        .filter(p => listType === "hot" ? p.isHot : p.isNew)
        .sort((a, b) => (listType === "hot" ? (a.hotOrder ?? 0) - (b.hotOrder ?? 0) : (a.newOrder ?? 0) - (b.newOrder ?? 0)));

      const draggedIndex = currentFilteredGroup.findIndex(p => p.id === draggedSortId);
      const targetIndex = currentFilteredGroup.findIndex(p => p.id === targetId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      const [removed] = currentFilteredGroup.splice(draggedIndex, 1);
      currentFilteredGroup.splice(targetIndex, 0, removed);

      try {
        for (let i = 0; i < currentFilteredGroup.length; i++) {
          const productDocRef = doc(db, "products", currentFilteredGroup[i].id);
          if (listType === "hot") {
            await updateDoc(productDocRef, { hotOrder: i });
          } else {
            await updateDoc(productDocRef, { newOrder: i });
          }
        }
      } catch (err) {
        console.error("Firebase Order Update Error:", err);
      }
    });
  });
}