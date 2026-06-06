// 🔄 เรียก Firebase Core SDK และ Firestore Module
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  writeBatch, 
  updateDoc,
  addDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// รายละเอียดการเชื่อมต่อโปรเจกต์ 6ICKBOY
const firebaseConfig = {
    apiKey: "AIzaSyBEBVjahmE6BMGPglrHRdbktLI9mQKZTls",
    authDomain: "ickboy-store.firebaseapp.com",
    projectId: "ickboy-store",
    storageBucket: "ickboy-store.firebasestorage.app",
    messagingSenderId: "532385576489",
    appId: "1:532385576489:web:c0a99cbeec52db14d6ce38"
};

let app, db, productsRef, analyticsRef;
let allProductsList = []; // โครงสร้างหลัก: เก็บข้อมูลสถานะล่าสุด { id, ..., flashSalePriceInput, checked }
let selectedProductIds = new Set();
let currentFilterCategory = "all"; 
let currentSearchTerm = ""; // 🔍 ตัวแปรเก็บคำค้นหาปัจจุบัน
let cloudStatusSortDirection = "none"; // 🔄 สถานะการเรียงลำดับคลาวด์: "none", "activeFirst", "inactiveFirst"

function showDebugError(title, message) {
  const consoleEl = document.getElementById("debugConsole");
  if (consoleEl) {
    consoleEl.style.display = "block";
    consoleEl.innerHTML = `<strong>🚨 SYSTEM ERROR [${title}]:</strong> ${message}`;
  }
}

async function trackAdminAnalyticsEvent(actionType, details) {
  try {
    await addDoc(analyticsRef, {
      event_type: "flash_sale_management",
      action: actionType,
      details: details,
      timestamp: serverTimestamp(),
      platform: "admin_panel"
    });
  } catch (err) { console.warn("Analytics Error:", err.message); }
}

// 📥 ฟังก์ชันโหลดฐานข้อมูลสินค้าทั้งหมดจาก Cloud Store
async function loadFlashSaleManagerData() {
  const tableBody = document.getElementById("flashProductTableBody");
  if (!tableBody) return;
  
  tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#a3a3a3; padding: 25px;">⏳ กำลังเชื่อมต่อระบบและดึงฐานข้อมูลสินค้าจาก Cloud...</td></tr>`;
  
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    productsRef = collection(db, "products");
    analyticsRef = collection(db, "analytics_events");
    
    const snap = await getDocs(productsRef);
    allProductsList = [];
    selectedProductIds.clear(); // เคลียร์ค่าเก่าเมื่อโหลดใหม่
    
    snap.forEach(d => {
      const data = d.data();
      const endTimeStr = data.flashSaleEndTime || "";
      const isActive = endTimeStr ? (new Date(endTimeStr).getTime() - Date.now() > 0) : false;
      
      // กำหนดสถานะเริ่มต้นให้กับสินค้าแต่ละชิ้นเพื่อกันข้อมูลหาย
      allProductsList.push({ 
        id: d.id, 
        ...data,
        flashSalePriceInput: (isActive && data.flashSalePrice) ? data.flashSalePrice : "", // เก็บราคาที่แสดงในช่องกรอก
        checked: false
      });
    });
    
    setupCategoryFilter();
    setupSearchInput(); // 🔍 เรียกฟังก์ชันเปิดระบบค้นหา
    setupCloudStatusSort(); // 🔄 เรียกฟังก์ชันเปิดระบบผูกตัวคลิกหัวตาราง
    renderTable();
    updateSelectedCountDisplay();
    
    trackAdminAnalyticsEvent("view_flash_sale_manager", { total_products_loaded: allProductsList.length });
    
  } catch (err) {
    console.error(err);
    showDebugError("FETCH_FAILED", err.message);
    tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#ef4444; font-weight: bold; padding: 25px;">❌ ไม่สามารถโหลดข้อมูลสินค้าได้: ${err.message}</td></tr>`;
  }
}

// 📁 ตั้งค่าตัวกรองหมวดหมู่อัตโนมัติ
function setupCategoryFilter() {
  const filterDropdown = document.getElementById("categoryFilter");
  if (!filterDropdown) return;

  const categories = new Set();
  allProductsList.forEach(p => {
    if (p.category && p.category.trim() !== "") {
      categories.add(p.category.trim());
    }
  });

  let optionsHtml = `<option value="all">🌟 แสดงทั้งหมด (${allProductsList.length} รายการ)</option>`;
  categories.forEach(cat => {
    const count = allProductsList.filter(p => p.category === cat).length;
    optionsHtml += `<option value="${cat}">📦 หมวดหมู่: ${cat} (${count} ชิ้น)</option>`;
  });

  filterDropdown.innerHTML = optionsHtml;
  filterDropdown.value = currentFilterCategory;

  filterDropdown.onchange = (e) => {
    currentFilterCategory = e.target.value;
    renderTable(); 
  };
}

// 🔍 ฟังก์ชันตั้งค่าและตรวจจับการพิมพ์ในช่องค้นหา (Search)
function setupSearchInput() {
  const searchInput = document.getElementById("productSearchInput");
  if (!searchInput) return;

  // เคลียร์ค่าเดิมในช่องกรอกเมื่อโหลดข้อมูลใหม่
  searchInput.value = currentSearchTerm;

  searchInput.oninput = (e) => {
    currentSearchTerm = e.target.value.trim().toLowerCase();
    renderTable(); // ทำการ Re-render ตารางใหม่ตามคำค้นหาทันทีความเร็วสูง
  };
}

// 🔄 ฟังก์ชันตั้งค่าตรวจจับการคลิกที่หัวตารางเพื่อเปลี่ยนสถานะจัดเรียง
function setupCloudStatusSort() {
  const thCloudStatus = document.getElementById("thCloudStatus");
  const sortIcon = document.getElementById("sortIcon");
  if (!thCloudStatus || !sortIcon) return;

  thCloudStatus.onclick = () => {
    if (cloudStatusSortDirection === "none") {
      cloudStatusSortDirection = "activeFirst";
      sortIcon.innerText = "🔼 เปิดใช้งานก่อน";
      sortIcon.style.color = "#22c55e";
    } else if (cloudStatusSortDirection === "activeFirst") {
      cloudStatusSortDirection = "inactiveFirst";
      sortIcon.innerText = "🔽 ปิดใช้งานก่อน";
      sortIcon.style.color = "#a3a3a3";
    } else {
      cloudStatusSortDirection = "none";
      sortIcon.innerText = "↕";
      sortIcon.style.color = "";
    }
    renderTable(); // วาดตารางใหม่พร้อมลำดับที่เลือก
  };
}

// 📊 ฟังก์ชันประกอบตารางรายชื่อสินค้า (ระบบกรอง ค้นหา และรักษาค่า Input)
function renderTable() {
  const tableBody = document.getElementById("flashProductTableBody");
  if (!tableBody) return;
  
  // 🔄 1. กรองข้อมูลพร้อมกันทั้ง หมวดหมู่ และ คำค้นหา (ชื่อสินค้า หรือ ไอดีคลาวด์)
  const filteredProducts = allProductsList.filter(p => {
    const matchesCategory = currentFilterCategory === "all" || p.category === currentFilterCategory;
    
    const productName = (p.name || "").toLowerCase();
    const productId = (p.id || "").toLowerCase();
    const matchesSearch = currentSearchTerm === "" || productName.includes(currentSearchTerm) || productId.includes(currentSearchTerm);
    
    return matchesCategory && matchesSearch;
  });

  // 🔄 2. ระบบจัดเรียงลำดับตามสถานะคลาวด์ (เปิดใช้งาน / ปิดใช้งาน)
  if (cloudStatusSortDirection !== "none") {
    filteredProducts.sort((a, b) => {
      // ตรวจสอบเช็กสถานะการเปิดทำงานแบบเดียวกับตัว Badge ในตาราง
      const isAActive = a.flashSaleEndTime ? (new Date(a.flashSaleEndTime).getTime() - Date.now() > 0) && (a.flashSalePrice || 0) > 0 : false;
      const isBActive = b.flashSaleEndTime ? (new Date(b.flashSaleEndTime).getTime() - Date.now() > 0) && (b.flashSalePrice || 0) > 0 : false;
      
      if (cloudStatusSortDirection === "activeFirst") {
        return (isAActive === isBActive) ? 0 : isAActive ? -1 : 1; // ดันเปิดใช้งานขึ้นด้านบน
      } else if (cloudStatusSortDirection === "inactiveFirst") {
        return (isAActive === isBActive) ? 0 : isAActive ? 1 : -1; // ดันปิดใช้งานขึ้นด้านบน
      }
      return 0;
    });
  }

  // 🔄 3. ตรวจสอบผลลัพธ์หลังกรอก/จัดเรียง หากว่างเปล่าให้แจ้งเตือน
  if (filteredProducts.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 25px; color: #eab308;">⚠️ ไม่พบข้อมูลสินค้าที่ตรงกับเงื่อนไขการค้นหา</td></tr>`;
    return;
  }
  
  tableBody.innerHTML = filteredProducts.map(p => {
    // ดึงค่า checked และ flashSalePriceInput ล่าสุดจาก Array เสมอ ข้อมูลจึงไม่หาย
    const isChecked = p.checked ? "checked" : "";
    const currentFlashPrice = p.flashSalePriceInput;
    
    const endTimeStr = p.flashSaleEndTime || "";
    const isActive = endTimeStr ? (new Date(endTimeStr).getTime() - Date.now() > 0) : false;
    
    let statusBadge = `
      <span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:20px; background:#1f1f1f; font-size:12px; color:#a3a3a3; border: 1px solid #262626; font-weight:500;">
        ❌ ปิดใช้งาน
      </span>`;
    let timeDisplay = `<span style="color:#525252; font-size:12px;">- ไม่มีกำหนดเวลา -</span>`;
    
    if (isActive && (p.flashSalePrice || 0) > 0) {
      statusBadge = `
        <span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:20px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.4); font-size:12px; color:#22c55e; font-weight:bold;">
          🟢 เปิดใช้งาน
        </span>`;
      const localTime = new Date(endTimeStr);
      timeDisplay = `<span style="color:#f87171; font-size:12px; font-weight:500;">⏰ ดับ: ${localTime.toLocaleDateString()} ${localTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
    }

    return `
      <tr id="row-${p.id}">
        <td style="text-align: center; padding: 12px 5px;">
          <input type="checkbox" class="row-select-check" data-id="${p.id}" ${isChecked} style="width:18px; height:18px; cursor:pointer;">
        </td>
        <td style="padding: 8px;"><img src="${p.image || 'https://via.placeholder.com/50'}" style="width:45px; height:45px; object-fit:cover; border-radius:6px; background:#171717; border: 1px solid #262626;"></td>
        <td style="padding: 8px;">
          <strong style="font-size:14px; display:block; color:#ffffff;">${p.name || 'ไม่มีชื่อสินค้า'}</strong>
          <small style="color:#737373; font-size:11px;">ID: ${p.id}</small>
        </td>
        <td style="padding: 8px;"><span style="color:#a3a3a3; font-size:13px; background:#262626; padding:3px 8px; border-radius:4px;">${p.category || 'ทั่วไป'}</span></td>
        <td style="padding: 8px;">
          <span style="text-decoration:${p.salePrice ? 'line-through' : 'none'}; color:${p.salePrice ? '#737373' : '#ffffff'}">฿${Number(p.price || 0).toLocaleString()}</span> 
          ${p.salePrice ? `<span style="color:#eab308; display:block; font-weight:500;">฿${Number(p.salePrice).toLocaleString()}</span>` : ''}
        </td>
        <td style="padding: 8px;">
          <input type="number" class="input-flash-price-live" data-id="${p.id}" value="${currentFlashPrice}" placeholder="ตั้งราคาที่นี่">
        </td>
        <td style="padding: 8px;">${timeDisplay}</td>
        <td style="padding: 8px;">${statusBadge}</td>
        <td style="padding: 8px; text-align:center;">
          ${isActive ? `<button class="btn-flash-clear" data-clearid="${p.id}" style="background:#262626; color:#ffffff; border:1px solid #404040; padding:3px 8px; border-radius:4px; font-size:12px; cursor:pointer;">ล้างเดี่ยว</button>` : `<span style="color:#404040;">-</span>`}
        </td>
      </tr>
    `;
  }).join("");
  
  // 🔄 ตรวจจับและบันทึกค่าสถานะ Checkbox ลง Array กลางทันทีเมื่อมีการเปลี่ยนแปลง
  document.querySelectorAll(".row-select-check").forEach(chk => {
    chk.addEventListener("change", (e) => {
      const pId = e.target.getAttribute("data-id");
      const isTargetChecked = e.target.checked;
      
      // อัปเดตข้อมูลใน Set และ Array ตัวจริง
      if (isTargetChecked) {
        selectedProductIds.add(pId);
      } else {
        selectedProductIds.delete(pId);
      }
      
      const targetProduct = allProductsList.find(item => item.id === pId);
      if (targetProduct) targetProduct.checked = isTargetChecked;

      updateSelectedCountDisplay();
    });
  });

  // 🔄 ตรวจจับและบันทึกราคาทุกครั้งที่คุณพิมพ์ (oninput) ป้องกันข้อมูลหายเวลาพิมพ์ค้นหาใหม่
  document.querySelectorAll(".input-flash-price-live").forEach(input => {
    input.addEventListener("input", (e) => {
      const pId = e.target.getAttribute("data-id");
      const currentVal = e.target.value;
      
      const targetProduct = allProductsList.find(item => item.id === pId);
      if (targetProduct) {
        targetProduct.flashSalePriceInput = currentVal;
      }
    });
  });

  // คำสั่งสั่งล้างเวลารายตัว (Single Clear)
  document.querySelectorAll("[data-clearid]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const pId = e.target.getAttribute("data-clearid");
      if(confirm(`คุณต้องการสั่งระงับแคมเปญ Flash Sale สำหรับสินค้าชิ้นนี้ใช่หรือไม่?`)) {
        try {
          await updateDoc(doc(db, "products", pId), { flashSaleEndTime: "", flashSalePrice: 0 });
          trackAdminAnalyticsEvent("clear_single_flash_sale", { product_id: pId });
          loadFlashSaleManagerData();
        } catch(err) { alert("ล้างสถานะล้มเหลว: " + err.message); }
      }
    });
  });
}

function updateSelectedCountDisplay() {
  const displayEl = document.getElementById("selectedCountDisplay");
  if (displayEl) displayEl.innerText = selectedProductIds.size;
}

function parseTimeToMilliseconds(timeStr) {
  let ms = 0;
  const matches = timeStr.toLowerCase().match(/(\d+(\.\d+)?)\s*([hms])/g);
  if (matches) {
    matches.forEach(m => {
      const unit = m.slice(-1);
      const val = parseFloat(m.slice(0, -1)) || 0;
      if (unit === 'h') ms += val * 3600000;
      if (unit === 'm') ms += val * 60000;
      if (unit === 's') ms += val * 1000;
    });
  } else {
    const hours = parseFloat(timeStr);
    if (!isNaN(hours)) ms = hours * 3600000;
  }
  return ms;
}

// ⚡ ฟังก์ชันรันคำสั่งกลุ่มแบบดึงราคาแยกตามแต่ละชิ้น (ดึงจากอาเรย์ส่วนกลางแทนการดึง DOM)
async function processBulkFlashSaleUpdate() {
  if (selectedProductIds.size === 0) {
    alert("❌ กรุณาติ๊กเลือกสินค้าที่ต้องการเปิดแคมเปญในตารางอย่างน้อย 1 รายการก่อนครับ");
    return;
  }

  const durationText = document.getElementById("bulkDurationInput").value.trim();
  if (!durationText) {
    alert("❌ กรุณาระบุระยะเวลานับถอยหลังแคมเปญด้านบนก่อนครับ (ตัวอย่าง: 1h หรือ 30m)");
    return;
  }

  const addedMs = parseTimeToMilliseconds(durationText);
  if (addedMs <= 0) {
    alert("❌ รูปแบบเวลาแคมเปญไม่ถูกต้อง! กรุณาใช้รูปแบบ เช่น 2h หรือ 45m");
    return;
  }

  const targetEndTimeISO = new Date(Date.now() + addedMs).toISOString();

  let hasPriceError = false;
  // ตรวจสอบความถูกต้องของราคาจาก Array หลักโดยตรง (ทำให้ตรวจสอบสินค้าชิ้นที่ถูกซ่อนอยู่จากการ Filter ได้ด้วย)
  selectedProductIds.forEach(productId => {
    const productData = allProductsList.find(p => p.id === productId);
    const priceValue = productData ? parseFloat(productData.flashSalePriceInput) : 0;
    
    if (isNaN(priceValue) || priceValue <= 0) {
      alert(`❌ สินค้า "${productData ? productData.name : productId}" ยังไม่ได้ใส่ราคา Flash Sale หรือระบุราคาไม่ถูกต้อง!`);
      hasPriceError = true;
    }
  });

  if (hasPriceError) return;

  if (!confirm(`⚠️ ยืนยันปล่อยแคมเปญกลุ่ม? สินค้าที่เลือกทั้งหมดจำนวน ${selectedProductIds.size} รายการ จะเข้าสู่ระบบจัดโปรโมชั่นทันที`)) return;

  try {
    const batch = writeBatch(db);
    let counter = 0;
    let updatedProductsLog = [];

    selectedProductIds.forEach(productId => {
      const productData = allProductsList.find(p => p.id === productId);
      const customFlashPrice = productData ? parseFloat(productData.flashSalePriceInput) : 0;

      if (productData && customFlashPrice > 0) {
        const productDocRef = doc(db, "products", productId);
        
        batch.update(productDocRef, {
          flashSaleEndTime: targetEndTimeISO,
          flashSalePrice: Number(customFlashPrice),
          comingSoon: false
        });
        
        updatedProductsLog.push({
          id: productId,
          name: productData.name || "Unknown",
          assigned_flash_price: customFlashPrice
        });

        counter++;
      }
    });

    await batch.commit();

    trackAdminAnalyticsEvent("bulk_flash_sale_custom_prices", {
      total_items_updated: counter,
      duration_requested: durationText,
      end_time_iso: targetEndTimeISO,
      products_list: updatedProductsLog
    });

    try {
      await updateDoc(doc(db, "settings", "version_control"), { lastUpdated: Date.now() });
    } catch (e) { console.warn(e); }

    alert(`🎉 ประมวลผลสำเร็จ! เปิดใช้งานแคมเปญ Flash Sale สินค้าจำนวน ${counter} รายการ เรียบร้อยแล้วครับ`);
    
    selectedProductIds.clear();
    currentSearchTerm = "";
    const searchInput = document.getElementById("productSearchInput");
    if (searchInput) searchInput.value = "";
    
    document.getElementById("bulkDurationInput").value = "";
    loadFlashSaleManagerData();
    
  } catch (error) {
    alert("เกิดข้อผิดพลาดในการบันทึกข้อมูลกลุ่ม: " + error.message);
  }
}

// ผูกอีเวนต์ปุ่มต่าง ๆ
if (document.getElementById("submitBulkBtn")) {
  document.getElementById("submitBulkBtn").onclick = processBulkFlashSaleUpdate;
}

if (document.getElementById("selectAllBtn")) {
  document.getElementById("selectAllBtn").onclick = () => {
    const filteredProducts = currentFilterCategory === "all" 
      ? allProductsList 
      : allProductsList.filter(p => p.category === currentFilterCategory);
      
    filteredProducts.forEach(p => {
      selectedProductIds.add(p.id);
      p.checked = true; // อัปเดตสถานะในวัตถุหลัก
    });
    renderTable();
    updateSelectedCountDisplay();
  };
}

if (document.getElementById("clearAllSelectBtn")) {
  document.getElementById("clearAllSelectBtn").onclick = () => {
    selectedProductIds.clear();
    allProductsList.forEach(p => p.checked = false); // เคลียร์สถานะในวัตถุหลักทั้งหมด
    renderTable();
    updateSelectedCountDisplay();
  };
}

// โหลดฐานข้อมูลทันทีเมื่อเปิดหน้าจอ
loadFlashSaleManagerData();