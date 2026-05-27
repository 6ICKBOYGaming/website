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

let draggedProductId = null;
let draggedCategoryId = null;

// DOM Elements สินค้าหลัก
const hotEl = document.getElementById("hotProducts");
const newEl = document.getElementById("newProducts");
const allEl = document.getElementById("products");
const categoriesEl = document.getElementById("categories");
const dragNoticeEl = document.getElementById("dragNotice");

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

// DOM Elements หมวดหมู่
const adminCategoryTitle = document.getElementById("adminCategoryTitle");
const adminCategoryInput = document.getElementById("adminCategoryInput");
const adminCategoryList = document.getElementById("adminCategoryList");
const adminCategoryPanel = document.getElementById("adminCategoryPanel");
const categorySubmitBtn = document.getElementById("categorySubmitBtn");
const categoryCancelBtn = document.getElementById("categoryCancelBtn");
const searchInput = document.getElementById("search");

// DOM Elements ระบบวิดเจ็ตแจกโค้ดส่วนลด (กรอบล่าง)
const shopeePromoWidget = document.getElementById("shopeePromoWidget");
const widgetGiftImg = document.getElementById("widgetGiftImg");
const widgetMainLink = document.getElementById("widgetMainLink");
const adminWidgetPanel = document.getElementById("adminWidgetPanel");
const widgetImageInput = document.getElementById("widgetImageInput");
const widgetLinkInput = document.getElementById("widgetLinkInput");
const widgetVisibleCheck = document.getElementById("widgetVisibleCheck");

// ค่าเริ่มต้นและโครงสร้างข้อมูลของกล่องโปรโมชั่นรับโค้ด
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

function card(p){
  const priceNormal = p.price ? Number(p.price) : 0;
  const priceSale = p.salePrice ? Number(p.salePrice) : 0;
  
  // ตรวจสอบว่าเป็นสินค้า Coming Soon หรือไม่
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

  const dragAttr = isAdmin ? `draggable="true" data-id="${p.id}" class="card admin-draggable"` : `class="card"`;
  const currentQuickPriceVal = priceSale > 0 ? priceSale : (priceNormal > 0 ? priceNormal : "");

  return `
  <div ${dragAttr}>
    ${p.isHot ? `<div class="badge hot">HOT</div>` : ""}
    ${p.isNew ? `<div class="badge">NEW</div>` : ""}
    <img src="${p.image?.trim() || 'https://via.placeholder.com/180'}" alt="${p.name}">
    <div class="info">
      <h4>${p.name}</h4>
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
          <div class="quick-price-box">
            <label>⚡️ ราคาด่วน (Enter):</label>
            <div class="quick-price-row">
              <input type="text" class="quick-price-input" 
                     value="${currentQuickPriceVal}" 
                     placeholder="ระบุราคา..." 
                     data-pid="${p.id}"
                     onkeydown="handleQuickPriceKey(event, '${p.id}')">
              <button class="quick-price-clear-btn" title="เคลียร์ค่าเป็น Coming Soon" onclick="clearQuickPrice('${p.id}')">✕</button>
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  </div>
  `;
}

/* ================= 🎯 ระบบคีย์บอร์ดลัดสำหรับช่องตั้งราคาด่วน (Quick Price Setup) ================= */
window.handleQuickPriceKey = async (event, productId) => {
  // กดคีย์ Enter -> บันทึกราคาปรับปรุงใหม่ทันที (นำเงื่อนไข Spacebar เดิมออกแล้ว ทำให้กดเว้นวรรคพิมพ์ได้อิสระ)
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
          updateData = {
            salePrice: newPriceNum,
            comingSoon: false
          };
        } else {
          updateData = {
            price: newPriceNum,
            salePrice: 0,
            comingSoon: false
          };
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

/* ================= ✕ ฟังก์ชันปุ่มกากบาท เคลียร์ค่าเป็น Coming Soon ================= */
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
      console.error("Quick Clear Error:", err);
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  }
};

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

/* ================= 🎁 ระบบกรอบแจกโค้ดส่วนลด (Realtime Sync & Update) ================= */
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
    const widgetDocRef = doc(db, "settings", "shopee_promo_widget");
    await setDoc(widgetDocRef, {
      imageUrl: imgUrlValue,
      buttonLink: linkValue,
      visible: isVisibleValue
    });
    alert("💾 บันทึกตั้งค่ากรอบรูปภาพกิจกรรมและลิงก์รับโค้ดส่วนลด Shopee สำเร็จแล้ว!");
  } catch (error) {
    alert("ไม่สามารถบันทึกการตั้งค่าได้เนื่องจาก: " + error.message);
  }
};

/* ================= 📊 Core Rendering System ================= */
function render(){
  let sortedProducts = [...allProducts].sort((a, b) => {
    const orderA = a.productOrder !== undefined ? Number(a.productOrder) : 99999;
    const orderB = b.productOrder !== undefined ? Number(b.productOrder) : 99999;
    return orderA - orderB;
  });

  let filtered = sortedProducts;
  if (selectedCategory !== "ทั้งหมด") {
    filtered = sortedProducts.filter(p => p.category === selectedCategory);
  }

  const searchWord = searchInput ? searchInput.value.trim().toLowerCase() : "";
  if (searchWord) {
    filtered = filtered.filter(p => p.name.toLowerCase().includes(searchWord));
  }

  const hot = filtered.filter(p => p.isHot);
  const news = filtered.filter(p => p.isNew);

  if(hotEl) hotEl.innerHTML = hot.map(card).join("");
  if(newEl) newEl.innerHTML = news.map(card).join("");
  if(allEl) allEl.innerHTML = filtered.map(card).join("");
  
  renderSidebarCategories();

  if (isAdmin) setupDragAndDrop();
}

function setupDragAndDrop() {
  const cards = document.querySelectorAll(".grid .admin-draggable");
  
  cards.forEach(card => {
    card.addEventListener("dragstart", (e) => {
      draggedProductId = card.getAttribute("data-id");
      e.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      card.classList.add("drag-over");
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });

    card.addEventListener("drop", async (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      
      const targetProductId = card.getAttribute("data-id");
      if (!draggedProductId || draggedProductId === targetProductId) return;

      let currentFiltered = allProducts.sort((a, b) => (a.productOrder ?? 99999) - (b.productOrder ?? 99999));
      if (selectedCategory !== "ทั้งหมด") {
        currentFiltered = currentFiltered.filter(p => p.category === selectedCategory);
      }
      
      const draggedIndex = currentFiltered.findIndex(p => p.id === draggedProductId);
      const targetIndex = currentFiltered.findIndex(p => p.id === targetProductId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      const [removed] = currentFiltered.splice(draggedIndex, 1);
      currentFiltered.splice(targetIndex, 0, removed);

      try {
        for (let i = 0; i < currentFiltered.length; i++) {
          const productDocRef = doc(db, "products", currentFiltered[i].id);
          await updateDoc(productDocRef, { productOrder: i });
        }
      } catch (err) {
        console.error(err);
      }
    });
  });
}

/* ================= 📡 Database Listeners ================= */
onSnapshot(productsRef, (snap) => {
  allProducts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
});

onSnapshot(categoriesRef, (snap) => {
  dbCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  dbCategories.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  updateCategoryDropdown();
  renderAdminCategoryList();
  render();
});

listenToWidgetSettings();

/* ================= 📝 ส่วนงานควบคุมแบบฟอร์ม (CRUD) ================= */
function clearForm() {
  productName.value = "";
  productImage.value = "";
  productPrice.value = "";
  if(productSalePrice) productSalePrice.value = "";
  productDescription.value = "";
  if(productCategory && productCategory.options.length > 0) productCategory.selectedIndex = 0;
  shopee1.value = "";
  shopee2.value = "";
  lazada.value = "";
  isNew.checked = false;
  isHot.checked = false;
  comingSoon.checked = false;
  currentEditId = null;
  submitBtn.innerText = "เพิ่มสินค้าเข้าระบบ";
  submitBtn.style.background = "var(--btn-bg)";
  submitBtn.style.color = "var(--btn-text)";
}

window.handleProductSubmit = async () => {
  const nameValue = productName.value.trim();
  if (!nameValue) {
    alert("กรุณากรอกชื่อสินค้าด้วยครับ");
    return;
  }
  if (!productCategory.value) {
    alert("กรุณาสร้างหมวดหมู่สินค้าก่อนครับ");
    return;
  }

  const finalPrice = productPrice.value ? Number(productPrice.value) : 0;
  const finalSalePrice = productSalePrice.value ? Number(productSalePrice.value) : 0;
  const maxOrder = allProducts.reduce((max, p) => (p.productOrder > max ? p.productOrder : max), 0);

  const data = {
    name: nameValue,
    image: productImage.value.trim(),
    price: finalPrice,
    salePrice: finalSalePrice,
    description: productDescription.value.trim(),
    category: productCategory.value,
    shopee1: shopee1.value.trim(),
    shopee2: shopee2.value.trim(),
    lazada: lazada.value.trim(),
    isNew: isNew.checked,
    isHot: isHot.checked,
    comingSoon: comingSoon.checked || (finalPrice === 0 && finalSalePrice === 0)
  };

  try {
    if (currentEditId) {
      await updateDoc(doc(db, "products", currentEditId), data);
      alert("แก้ไขข้อมูลสินค้าเรียบร้อยแล้ว!");
    } else {
      data.productOrder = maxOrder + 1;
      await addDoc(productsRef, data);
      alert("เพิ่มสินค้าสำเร็จ!");
    }
    clearForm();
  } catch (error) {
    alert("เกิดข้อผิดพลาด: " + error.message);
  }
};

window.deleteProduct = async(id) => {
  if(confirm("คุณแน่ใจที่จะลบสินค้านี้ใช่ไหม?")){
    try {
      await deleteDoc(doc(db, "products", id));
      if (currentEditId === id) clearForm();
    } catch(err) {
      alert(err.message);
    }
  }
};

window.editProduct = async(id) => {
  const p = allProducts.find(x => x.id === id);
  if(!p) return;

  currentEditId = id;
  productName.value = p.name || "";
  productImage.value = p.image || "";
  productPrice.value = p.price && p.price !== 0 ? p.price : "";
  if(productSalePrice) productSalePrice.value = p.salePrice && p.salePrice !== 0 ? p.salePrice : "";
  productDescription.value = p.description || "";
  if(productCategory) productCategory.value = p.category || "";
  shopee1.value = p.shopee1 || "";
  shopee2.value = p.shopee2 || "";
  lazada.value = p.lazada || "";
  isNew.checked = !!p.isNew;
  isHot.checked = !!p.isHot;
  comingSoon.checked = !!p.comingSoon;

  submitBtn.innerText = "💾 บันทึกการแก้ไขข้อมูลสินค้า";
  submitBtn.style.background = "var(--input-bg)";
  submitBtn.style.color = "var(--text-main)";
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* ================= 🔍 ระบบค้นหา ================= */
if(searchInput){
  searchInput.addEventListener("input", () => render());
}

/* ================= 🔐 การยืนยันตัวตน (Authentication) ================= */
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminPanel = document.getElementById("adminPanel");

if(loginBtn) {
  loginBtn.onclick = async () => {
    const email = prompt("Email");
    if (!email) return;
    const pass = prompt("Password");
    if (!pass) return;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch(err) {
      alert("เข้าสู่ระบบล้มเหลว: " + err.message);
    }
  };
}

if(logoutBtn) {
  logoutBtn.onclick = () => {
    signOut(auth);
    clearForm();
    clearCategoryForm();
  };
}

onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  if(adminPanel) adminPanel.style.display = user ? "flex" : "none";
  if(adminCategoryPanel) adminCategoryPanel.style.display = user ? "flex" : "none";
  if(adminWidgetPanel) adminWidgetPanel.style.display = user ? "flex" : "none";
  if(logoutBtn) logoutBtn.style.display = user ? "block" : "none";
  if(loginBtn) loginBtn.style.display = user ? "none" : "block";
  if(dragNoticeEl) dragNoticeEl.style.display = user ? "block" : "none";
  
  if (user) {
    if(widgetImageInput) widgetImageInput.value = currentWidgetState.imageUrl;
    if(widgetLinkInput) widgetLinkInput.value = currentWidgetState.buttonLink;
    if(widgetVisibleCheck) widgetVisibleCheck.checked = !!currentWidgetState.visible;
  }
  
  render();
});

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

/* ================= 🔄 Auto Scroll Slider ================= */
window.scrollSlide = (elementId, direction) => {
  const el = document.getElementById(elementId);
  if (!el || el.children.length <= 1) return;
  const cardWidth = el.children[0].offsetWidth + 10; 
  const maxScrollLeft = el.scrollWidth - el.clientWidth;

  if (direction === "right") {
    if (el.scrollLeft >= maxScrollLeft - 5) el.scrollLeft = 0;
    else el.scrollLeft += cardWidth;
  } else {
    if (el.scrollLeft <= 5) el.scrollLeft = maxScrollLeft;
    else el.scrollLeft -= cardWidth;
  }
};

function startAutoScroll(elementId) {
  setInterval(() => window.scrollSlide(elementId, "right"), 10000); 
}
startAutoScroll("hotProducts");
startAutoScroll("newProducts");