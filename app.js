import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, updateDoc, deleteDoc, runTransaction, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// เพิ่มตัวแปรสำหรับใช้งาน

// Firebase App Configurations
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
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Application Memory Stores Global Variables Context State Maps
let globalProducts = [];
let globalCategories = { main: [], sub: [], brand: [] };
let activeAdmin = false;
let currentFilters = { main: 'all', sub: 'all', brand: 'all', query: '' };
let currentActiveDetailProduct = null;
let currentLightboxIndex = 0;
let modalHistoryStack = [];
let currentDiscountQuery = ''; // ➕ เพิ่มบรรทัดนี้ เพื่อจำคำค้นหาหน้าส่วนลด
let currentKeywordQuery = '';  // ➕ เพิ่มบรรทัดนี้ เพื่อจำคำค้นหาหน้าคีย์เวิร์ด

// ================= INITIALIZATIONS ENTRY SYSTEM POINT =================
document.addEventListener("DOMContentLoaded", () => {
    // ➕ เพิ่มบรรทัดนี้เพื่อจองสถานะหน้าแรกสุดไว้ในระบบเบราว์เซอร์
    if (!window.history.state) {
        history.replaceState({ tier: 'homepage' }, '');
    }

    initAppListeners();
    initIPViewStatsCounter();
    syncRealtimeDatabase();
});

function syncRealtimeDatabase() {
    // 1. Listen Products Engine Core Realtime Sync Pipeline
    onSnapshot(collection(db, "products"), (snapshot) => {
        globalProducts = [];
        snapshot.forEach(doc => {
            globalProducts.push({ id: doc.id, ...doc.data() });
        });
        
        // 🛠️ แก้ไข: เรียงลำดับตาม sortOrder เป็นค่าเริ่มต้น (ถ้าไม่มีให้เป็น 0) สำหรับ "จัดเรียงปกติ"
        globalProducts.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        renderProductsGrid();
        renderSidebarCategoriesStructure();
        renderDiscountManager();
        renderKeywordManager();
    });

    // 2. Listen Category Configuration Trees Mapping Definitions Data Engine Rows
    onSnapshot(doc(db, "configurations", "categories"), (snapshot) => {
        if (snapshot.exists()) {
            globalCategories = snapshot.data();
        } else {
            globalCategories = { main: ["คีย์บอร์ด", "เมาส์", "ลำโพง", "หูฟัง"], sub: ["Wireless", "Mechanical"], brand: ["Logitech", "Razer", "Artisan"] };
            setDoc(doc(db, "configurations", "categories"), globalCategories);
        }
        renderSidebarCategoriesStructure();
        populateFormDropdownSelections();
    });
}

function initAppListeners() {
    // Left Menu Drawer triggers closures handlers maps
    document.getElementById("menu-btn").addEventListener("click", () => toggleDrawer(true));
    document.getElementById("close-drawer").addEventListener("click", () => toggleDrawer(false));
    document.getElementById("drawer-overlay").addEventListener("click", (e) => {
        if(e.target === document.getElementById("drawer-overlay")) toggleDrawer(false);
    });

    document.getElementById("menu-login-btn").addEventListener("click", () => { toggleDrawer(false); openModal('modal-login'); });
    document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));
    document.getElementById("submit-login-btn").addEventListener("click", executeAdminLoginAuth);
    
    document.getElementById("login-form").addEventListener("keydown", (e) => {
        if(e.key === 'Enter') executeAdminLoginAuth();
    });

    // Search Engine listeners configurations profiles
    document.getElementById("search-input").addEventListener("keydown", (e) => {
        if(e.key === 'Enter') {
            currentFilters.query = e.target.value.trim().toLowerCase();
            renderProductsGrid();
        }
    });
    document.getElementById("sort-select").addEventListener("change", () => renderProductsGrid());

    const inputDate = document.getElementById("stats-date-picker");
    inputDate.value = new Date().toISOString().split('T')[0];
    inputDate.addEventListener("change", () => loadRealtimeStatsOverviewRecords(inputDate.value));

    // ==========================================
    // ➕ ดักจับเหตุการณ์กดยกเลิก หรือปิด Modal สินค้าเพื่อล้างค่าฟอร์ม
    // ==========================================
    const cancelProductBtn = document.getElementById("cancel-product-btn");
    if (cancelProductBtn) {
        cancelProductBtn.addEventListener("click", () => {
            resetProductForm();              // 1. ล้างค่าและสลับโหมดเป็นเพิ่มสินค้าใหม่
            closeModal('modal-add-product'); // 2. สั่งปิดหน้าต่าง Modal
        });
    }

    const closeProductModalBtn = document.getElementById("close-product-modal-btn");
    if (closeProductModalBtn) {
        closeProductModalBtn.addEventListener("click", () => {
            resetProductForm();              // 1. ล้างค่าและสลับโหมดเป็นเพิ่มสินค้าใหม่
            closeModal('modal-add-product'); // 2. สั่งปิดหน้าต่าง Modal
        });
    }
    // ==========================================

    // Mobile Back Button State Management Controls Layer Router intercepts
    window.addEventListener("popstate", (event) => {
        // ตรวจเช็กว่า ณ ปัจจุบันมีตัวกรองถูกเลือกอยู่ หรือมี Modal เปิดค้างอยู่หรือไม่
        const hasActiveFilters = currentFilters.main !== 'all' || currentFilters.sub !== 'all' || currentFilters.brand !== 'all';
        
        // 1. จัดการปิด Modal หรือ Lightbox ออกทีละชั้นก่อนหากเปิดอยู่
        if (modalHistoryStack.length > 0) {
            event.preventDefault();
            const topModal = modalHistoryStack.pop();
            if (topModal === 'lightbox') {
                window.closeLightbox(true);
            } else {
                // ➕ เพิ่มเติม: หากผู้ใช้กดย้อนกลับบนมือถือในขณะที่เปิดหน้าต่างสินค้า ให้ล้างค่าฟอร์มด้วย
                if (topModal === 'modal-add-product') {
                    resetProductForm();
                }
                window.closeModal(topModal, true);
            }
            
            if (modalHistoryStack.length === 0 && hasActiveFilters) {
                history.pushState({ tier: 'subcategory' }, '');
            }
            return; 
        }

        // 2. ตรวจเช็กเพิ่ม: ถ้าผู้ใช้กดย้อนกลับจากหน้า subcategory จริงๆ ถึงค่อยรีเซ็ตค่า
        if (hasActiveFilters && event.state && event.state.tier === 'homepage') {
            event.preventDefault();
            resetToAllCategories();
            return;
        }
        // 2. ถ้าไม่มี Modal เปิดอยู่ แต่มีการเลือกหมวดหมู่ย่อย/แบรนด์ ค้างไว้ ให้ดึงกลับสู่เมนูทั้งหมดแทนการออกจากเว็บ
        if (hasActiveFilters) {
            event.preventDefault();
            resetToAllCategories();
            return;
        }

        // โค้ดดั้งเดิมของระบบคุณที่ใช้แสดงผลสินค้าทั่วไป
        try {
            renderProductsGrid();
        } catch(e) {
            console.log("Navigation render bypass:", e);
        }
    });

    // ฟังก์ชันส่วนกลางสำหรับล้างค่าตัวกรองกลับสู่เมนู "ทั้งหมด" อย่างปลอดภัย
    function resetToAllCategories() {
        currentFilters = { main: 'all', sub: 'all', brand: 'all', query: '' };
        
        const searchInput = document.getElementById("search-input");
        if (searchInput) searchInput.value = "";
        
        // เคลียร์สถานะ Active ของปุ่มที่เคยเลือกไว้ทั้งหมด (รองรับทั้งระบบคลาสเดิมและระบบสีฟ้าไฮไลต์ใหม่)
        document.querySelectorAll(".category-btn-active, .bg-\\[\\#f0f7ff\\]").forEach(el => {
            el.classList.remove("bg-purple-600", "text-white", "category-btn-active", "bg-[#f0f7ff]", "text-[#0066ff]");
            el.classList.add("bg-transparent", "text-gray-700", "hover:bg-gray-50");
        });
        
        // คืนค่า Active ให้กับปุ่ม "ทั้งหมด" ใน Sidebar
        const allBtn = document.getElementById("btn-category-all") || 
                       Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === 'ทั้งหมด');
        if (allBtn) {
            allBtn.classList.remove("bg-transparent", "text-gray-700", "hover:bg-gray-50");
            allBtn.classList.add("bg-[#f0f7ff]", "text-[#0066ff]");
        }

        try { 
            renderProductsGrid(); 
            renderSidebarCategoriesStructure();
            
            // ดึงประวัติเบราว์เซอร์กลับมาอยู่ที่สถานะ homepage หลัก เพื่อให้การกดย้อนกลับครั้งต่อไปสามารถออกจากเว็บได้ตามปกติ
            history.replaceState({ tier: 'homepage' }, '');
        } catch(e) {}
    }
}

onAuthStateChanged(auth, (user) => {
    const adminBadge = document.getElementById("admin-badge");
    const adminOptions = document.getElementById("admin-menu-options");
    const drawerFooter = document.getElementById("drawer-auth-footer");
    const loginMenuBtn = document.getElementById("menu-login-btn");

    if (user) {
        activeAdmin = true;
        adminBadge.classList.replace("hidden", "flex");
        adminOptions.classList.remove("hidden");
        drawerFooter.classList.remove("hidden");
        loginMenuBtn.classList.add("hidden");
    } else {
        activeAdmin = false;
        adminBadge.classList.replace("flex", "hidden");
        adminOptions.classList.add("hidden");
        drawerFooter.classList.add("hidden");
        loginMenuBtn.classList.remove("hidden");
    }
    renderProductsGrid();
});

// ================= MODAL DISPLAY CONTROLS ENGINE =================
window.openModal = function(modalId) {
    const target = document.getElementById(modalId);
    if (!target) return;
    target.classList.replace("hidden", "flex");
    
    // ดันสถานะและจัดคิวเข้า Stack
    history.pushState({ tier: modalId }, '');
    modalHistoryStack.push(modalId);

    if(modalId === 'modal-stats') loadRealtimeStatsOverviewRecords(document.getElementById("stats-date-picker").value);
    if(modalId === 'modal-manage-categories') renderCategoryManagementUI();

    // ป้องกันการผูก Event ซ้ำซ้อนโดยเช็คล่วงหน้า
    if (!target.dataset.clickOutsideListener) {
        target.addEventListener("click", (e) => {
            if (e.target === target) {
                window.closeModal(modalId);
            }
        });
        target.dataset.clickOutsideListener = "true";
    }
}

window.closeModal = function(modalId, backwardInterrupted = false) {
    const target = document.getElementById(modalId);
    if (!target) return;
    target.classList.replace("flex", "hidden");

    // ➕ เพิ่มเช็กตรงนี้: ถ้าสั่งปิด modal-add-product ให้ทำการรีเซ็ตฟอร์มทันที
    if (modalId === 'modal-add-product') {
        resetProductForm();
    }

    if (!backwardInterrupted) {
        modalHistoryStack = modalHistoryStack.filter(id => id !== modalId);
        if (window.history.state && window.history.state.tier === modalId) {
            history.back();
        }
    }
}
function toggleDrawer(openStatus) {
    const overlay = document.getElementById("drawer-overlay");
    const drawer = document.getElementById("drawer");
    if (openStatus) {
        overlay.classList.remove("hidden");
        setTimeout(() => drawer.classList.remove("-translate-x-full"), 10);
    } else {
        drawer.classList.add("-translate-x-full");
        setTimeout(() => overlay.classList.add("hidden"), 300);
    }
}

// ================= SYSTEM ENGINE: PRICING & DISCOUNT CALCULATOR =================
function calculateDiscountValue(basePrice, discountStringRule) {
    if (!discountStringRule || !discountStringRule.includes("=")) return { finalPrice: Math.round(basePrice), discountAppliedAmount: 0 };
    try {
        const [percentagePart, maxCapPart] = discountStringRule.split("=");
        const rate = parseFloat(percentagePart.replace("%", "")) / 100;
        const cap = parseFloat(maxCapPart);
        
        let calculatedDeduction = basePrice * rate;
        if (calculatedDeduction > cap) calculatedDeduction = cap;
        
        return { finalPrice: Math.round(basePrice - calculatedDeduction), discountAppliedAmount: Math.round(calculatedDeduction) };
    } catch {
        return { finalPrice: Math.round(basePrice), discountAppliedAmount: 0 };
    }
}

// ================= CORE CLIENT PRODUCTS RENDER FEED (MATCHING IMAGE PREVIEW) =================
function renderProductsGrid() {
    const grid = document.getElementById("product-grid");
    if (!grid) return; // ➕ ดักเอาไว้เผื่อไม่มี Element หน้าเว็บจะได้ไม่พัง
    grid.innerHTML = "";

    let targetDataset = [...globalProducts];

    if (currentFilters.main !== 'all') {
        targetDataset = targetDataset.filter(p => p.categoryMain === currentFilters.main);
        if (currentFilters.sub !== 'all') targetDataset = targetDataset.filter(p => p.categorySub === currentFilters.sub);
        if (currentFilters.brand !== 'all') targetDataset = targetDataset.filter(p => p.brand === currentFilters.brand);
    }

    if (currentFilters.query) {
        const query = currentFilters.query;
        targetDataset = targetDataset.filter(p => p.title.toLowerCase().includes(query) || (p.keywords && p.keywords.toLowerCase().includes(query)));
    }

    // 🛠️ แก้ไข: ป้องกันกรณีไม่มีหน้า select หรือหน้าเว็บเพิ่งโหลดเสร็จ และเพิ่มการเรียงลำดับเริ่มต้น (Default)
    const sortSelectEl = document.getElementById("sort-select");
    const sorterVal = sortSelectEl ? sortSelectEl.value : "normal"; 

    if (sorterVal === "latest") {
        targetDataset.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } else if (sorterVal === "price-desc") {
        targetDataset.sort((a,b) => (b.badges?.soon ? 0 : calculateDiscountValue(b.price, b.discountRule).finalPrice) - (a.badges?.soon ? 0 : calculateDiscountValue(a.price, a.discountRule).finalPrice));
    } else if (sorterVal === "price-asc") {
        targetDataset.sort((a,b) => (a.badges?.soon ? Infinity : calculateDiscountValue(a.price, a.discountRule).finalPrice) - (b.badges?.soon ? Infinity : calculateDiscountValue(b.price, b.discountRule).finalPrice));
    } else {
        // ➕ เพิ่มเงื่อนไขนี้ เพื่อรองรับ "จัดเรียงปกติ" และป้องกันโค้ดเออร์เรอร์หลุดการทำงาน
        targetDataset.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    if(targetDataset.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-20 text-center text-gray-400 font-medium bg-white rounded-3xl border border-dashed border-gray-200">ไม่พบข้อมูลสินค้าเกมมิ่งในรายการดังกล่าว...</div>`;
        return;
    }

    targetDataset.forEach((product, index) => {
        const pricingMeta = calculateDiscountValue(product.price, product.discountRule);
        const card = document.createElement("div");
        
        // 🛠️ ผูก Event Drag and Drop สำหรับ Admin บนหน้าเว็บหลัก
        if (activeAdmin) {
            // 💡 บังคับเอาสถานะพฤติกรรมการลาก (draggable) ออกจากการ์ดหลัก เพื่อเปิดทางให้สไลด์จอบนมือถือได้อิสระ
            card.className = "bg-white rounded-[24px] shadow-sm overflow-hidden relative flex flex-col justify-between group border border-gray-100/60 transition-all duration-300 hover:shadow-md select-none";
            card.draggable = false; 
            
            // 🔒 ป้องกันปัญหาการกดโดนส่วนอื่นๆ ของสินค้าแล้วกลายเป็นการลากวัตถุค้าง (Drag Ghost) บนเบราว์เซอร์มือถือ
            card.addEventListener('dragstart', (e) => {
                const isHandle = e.target.closest('.drag-handle');
                if (!isHandle) {
                    e.preventDefault();
                    return false;
                }
            });
            
            card.dataset.id = product.id;
            card.dataset.index = index;
            if (typeof setupProductDragAndDropListeners === "function") {
                setupProductDragAndDropListeners(card);
            }
        } else {
            card.className = "bg-white rounded-[24px] shadow-sm overflow-hidden relative flex flex-col justify-between group border border-gray-100/60 transition-all duration-300 hover:shadow-md";
        }
        
        // Dynamic Badges Placement Matrix matching parameters layout
        let inlineBadgesLayout = "";
        if (product.badges?.soon) {
            inlineBadgesLayout = `<div class="absolute top-3 left-3 z-10 flex gap-1"><span class="bg-[#242b35]/80 backdrop-blur-sm text-white text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase">COMING SOON...</span>`;
            if (product.badges?.new) inlineBadgesLayout += `<span class="bg-[#10b981] text-white text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase">NEW</span>`;
            inlineBadgesLayout += `</div>`;
        } else if (product.badges?.new || product.badges?.hot) {
            inlineBadgesLayout += `<div class="absolute top-3 left-3 z-10 flex gap-1">`;
            if (product.badges?.new) inlineBadgesLayout += `<span class="bg-[#10b981] text-white text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase">NEW</span>`;
            if (product.badges?.hot) inlineBadgesLayout += `<span class="bg-[#f97316] text-white text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase">HOT</span>`;
            inlineBadgesLayout += `</div>`;
        }

        let adminActionOverlayBlock = "";
        if (activeAdmin) {
            // 💡 กำหนดให้เฉพาะปุ่มไอคอน ☰ (drag-handle) เท่านั้นที่มีสถานะ draggable="true" เพื่อใช้สำหรับลากเปลี่ยนลำดับ
            adminActionOverlayBlock = `
                <div class="absolute top-3 right-3 z-20 flex gap-1 bg-white/90 backdrop-blur-sm p-1 rounded-xl shadow-sm items-center">
                    <div class="drag-handle text-gray-400 hover:bg-gray-100 w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-grab active:cursor-grabbing" 
                         draggable="true" 
                         title="ลากเพื่อสลับตำแหน่ง">
                        <i class="fa-solid fa-bars text-xs pointer-events-none"></i>
                    </div>
                    <button onclick="triggerProductEditSetup('${product.id}', event)" class="text-blue-600 hover:bg-blue-50 w-7 h-7 rounded-lg flex items-center justify-center transition-all"><i class="fa-solid fa-pen text-xs"></i></button>
                    <button onclick="executeProductDeletionAction('${product.id}', event)" class="text-rose-600 hover:bg-rose-50 w-7 h-7 rounded-lg flex items-center justify-center transition-all"><i class="fa-solid fa-trash text-xs"></i></button>
                </div>
            `;
        }

        const breadcrumbStr = product.badges?.soon ? "" : `${product.categoryMain || ''} > ${product.categorySub || ''} > ${product.brand || ''}`;
        const displayPrice = product.badges?.soon ? "Coming Soon..." : `${pricingMeta.finalPrice.toLocaleString()} บาท`;
        
        const btnColorClass = product.badges?.soon ? "bg-[#71d4a4] hover:bg-[#5ec493] text-white" : "bg-[#10b981] hover:bg-[#0ea5e9] text-white";
        const btnLabelString = product.badges?.soon ? "เร็วๆ นี้" : "สั่งซื้อ";

        card.innerHTML = `
            ${inlineBadgesLayout}
            ${adminActionOverlayBlock}
            <div class="p-4 cursor-pointer flex-1 flex flex-col justify-between" onclick="launchProductDetailsModal('${product.id}')">
                <div class="aspect-square bg-[#fbfbfb] rounded-2xl overflow-hidden mb-4 flex items-center justify-center p-4">
                    <img src="${product.thumbnailUrl}" draggable="false" class="object-contain w-full h-full transform transition-transform duration-500 group-hover:scale-[1.02] pointer-events-none" loading="lazy">
                </div>
                <div class="space-y-1">
                    <h3 class="font-bold text-gray-900 text-sm line-clamp-2 leading-snug flex items-center flex-wrap gap-1">
                        ${product.badges?.mall ? `<span class="bg-[#e11d48] text-white font-extrabold text-[9px] px-1.5 py-0.2 rounded-md shrink-0 shadow-sm mr-1 tracking-tight">MALL</span>` : ''}
                        ${product.title}
                    </h3>
                    
                    <p class="text-[11px] text-gray-400 font-medium product-category">${breadcrumbStr}</p>

                    ${product.badges?.soon ? '' : `
                        <div class="md:hidden mobile-shipping-wrapper ${product.shippingMode === 'ต่างประเทศ' ? 'bg-amber-50 text-amber-600 border border-amber-200/40' : 'bg-blue-50 text-blue-600 border border-blue-200/40'}">
                            <i class="${product.shippingMode === 'ต่างประเทศ' ? 'fa-solid fa-plane-departure' : 'fa-solid fa-truck-fast'} mr-0.5 scale-75"></i>${product.shippingMode || "จัดส่งในไทย"}
                        </div>
                    `}
                </div>
            </div>
            <div class="px-4 pb-4 pt-1 space-y-2">
                <div class="flex justify-between items-center">
                    <div class="text-sm font-black ${product.badges?.soon ? 'text-gray-900 font-extrabold text-xs' : 'text-gray-900'}">
                        ${displayPrice}
                    </div>
                    
                    ${product.badges?.soon ? '' : `
                        <div class="hidden md:inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded tracking-tighter opacity-90 scale-95 origin-right ${product.shippingMode === 'ต่างประเทศ' ? 'bg-amber-50 text-amber-600 border border-amber-200/40' : 'bg-blue-50 text-blue-600 border border-blue-200/40'}">
                            <i class="${product.shippingMode === 'ต่างประเทศ' ? 'fa-solid fa-plane-departure' : 'fa-solid fa-truck-fast'} mr-0.5 scale-75"></i>${product.shippingMode || "จัดส่งในไทย"}
                        </div>
                    `}
                </div>
                <a href="${product.buyUrl || '#'}" target="_blank" onclick="if(typeof trackButtonLinkMetricEvent === 'function') { trackButtonLinkMetricEvent('${product.id}', '${product.buyUrl}') }" class="w-full ${btnColorClass} font-bold text-xs py-2.5 rounded-xl transition-all text-center flex items-center justify-center gap-2 shadow-sm">
                    <i class="fa-solid fa-cart-shopping"></i>
                    <span>${btnLabelString}</span>
                </a>
            </div>
        `;
        grid.appendChild(card);
    });
}

// ================= SIDEBAR RENDER NAVIGATION LOGIC (MATCHING IMAGE SPEC) =================
function renderSidebarCategoriesStructure() {
    const list = document.getElementById("sidebar-categories");
    list.innerHTML = "";

    // 1. All Items Anchor Rows Elements Models Sets Properties
    const totalCount = globalProducts.length;
    const allLi = document.createElement("li");
    const isAllActive = currentFilters.main === 'all';
    allLi.innerHTML = `
        <button onclick="filterCategory('all')" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${isAllActive ? 'bg-[#f0f7ff] text-[#0066ff]' : 'bg-transparent text-gray-700 hover:bg-gray-50'}">
            <span>ทั้งหมด</span>
            <span class="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full min-w-[20px] text-center font-bold">${totalCount}</span>
        </button>
    `;
    list.appendChild(allLi);

    // 2. Loop Through Global Main Categories Registry Mapping Block Structures Lists Tags Properties Maps
    globalCategories.main.forEach(mainCategory => {
        const count = globalProducts.filter(p => p.categoryMain === mainCategory).length;
        const listItem = document.createElement("li");
        const isCurrentActive = currentFilters.main === mainCategory;

        listItem.innerHTML = `
            <button onclick="filterCategory('${mainCategory}')" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${isCurrentActive ? 'bg-[#f0f7ff] text-[#0066ff]' : 'bg-transparent text-gray-700 hover:bg-gray-50'}">
                <span>${mainCategory}</span>
                <span class="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full min-w-[20px] text-center font-bold">${count}</span>
            </button>
        `;
        list.appendChild(listItem);
    });
}

window.filterCategory = function(mainCat) {
    if(mainCat === 'all') {
        currentFilters = { main: 'all', sub: 'all', brand: 'all', query: '' };
        renderProductsGrid();
        renderSidebarCategoriesStructure();
        return;
    }

    const applicableSubs = globalProducts.filter(p => p.categoryMain === mainCat).map(p => p.categorySub).filter(Boolean);
    const applicableBrands = globalProducts.filter(p => p.categoryMain === mainCat).map(p => p.brand).filter(Boolean);

    if (applicableSubs.length === 0 && applicableBrands.length === 0) {
        currentFilters = { main: mainCat, sub: 'all', brand: 'all', query: '' };
        renderProductsGrid();
        renderSidebarCategoriesStructure();
    } else {
        launchSubCategoryPopupModal(mainCat, [...new Set(applicableSubs)], [...new Set(applicableBrands)]);
    }
}

function launchSubCategoryPopupModal(mainCategory, subCategoriesList, brandsList) {
    document.getElementById("sub-cat-title").innerText = `หมวดหมู่ ${mainCategory}`;
    
    const subContainer = document.getElementById("sub-cat-container");
    subContainer.innerHTML = `<button onclick="executeDeepFilter('${mainCategory}','all','all')" class="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-semibold">ดูทั้งหมดในหมวดหมู่นี้</button>`;
    subCategoriesList.forEach(sub => {
        subContainer.innerHTML += `<button onclick="executeDeepFilter('${mainCategory}','${sub}','all')" class="bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 px-3 py-1.5 rounded-xl text-xs font-medium">${sub}</button>`;
    });

    const brandContainer = document.getElementById("brand-container");
    brandContainer.innerHTML = "";
    brandsList.sort((a,b) => a.localeCompare(b));
    
    if(brandsList.length === 0) {
        brandContainer.innerHTML = `<span class="text-xs text-gray-400">ไม่มีข้อมูลแบรนด์</span>`;
    } else {
        brandsList.forEach(brd => {
            brandContainer.innerHTML += `<button onclick="executeDeepFilter('${mainCategory}','all','${brd}')" class="bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-600 px-3 py-1.5 rounded-xl text-xs font-medium">${brd}</button>`;
        });
    }

    openModal('modal-sub-category');
}

window.executeDeepFilter = function(main, sub, brand) {
    currentFilters = { main, sub, brand, query: '' };
    
    // 1. สั่งปิด Modal โดยส่งค่า true เข้าไปด้วย เพื่อบอกว่าเป็น backwardInterrupted 
    // จะได้ไม่ต้องไปเรียก history.back() ซ้ำซ้อนจนไปกระตุ้น popstate
    closeModal('modal-sub-category', true);
    
    // 2. เคลียร์ Stack ของ Modal ตัวนี้ออกด้วยตัวเอง
    modalHistoryStack = modalHistoryStack.filter(id => id !== 'modal-sub-category');

    // 3. ดัน State ใหม่เข้าไป เพื่อจองสิทธิ์ในการกดย้อนกลับบนมือถือให้ถูกต้อง
    history.pushState({ tier: 'subcategory' }, '');

    renderProductsGrid();
    renderSidebarCategoriesStructure();
}

// ================= PRODUCT DETAIL & GALLERY LIGHTBOX COMPONENT POPUP SYSTEM =================
window.launchProductDetailsModal = function(id) {
    const p = globalProducts.find(item => item.id === id);
    if (!p) return;
    
    currentActiveDetailProduct = p;
    document.getElementById("detail-title").innerText = p.title;
    
    // 🛠️ แก้ไขจุดนี้: ถ้าเป็น Coming Soon ให้ซ่อนข้อความการจัดส่ง (หรือใส่ค่าว่าง)
    const shippingEl = document.getElementById("detail-shipping");
    if (shippingEl) {
        if (p.badges?.soon) {
            shippingEl.innerText = ""; 
        } else {
            shippingEl.innerText = p.shippingMode || "จัดส่งในไทย";
        }
    }
    
    document.getElementById("detail-desc").innerText = p.description || "ไม่มีรายละเอียดสินค้า";
    
    const pricingMeta = calculateDiscountValue(p.price, p.discountRule);
    document.getElementById("detail-price").innerText = p.badges?.soon ? "Coming Soon..." : `${pricingMeta.finalPrice.toLocaleString()} บาท`;
    
    const badgesArea = document.getElementById("detail-badges");
    badgesArea.innerHTML = "";
    if (p.badges?.mall) badgesArea.innerHTML += `<span class="bg-[#e11d48] text-white font-extrabold text-xs px-2 py-0.5 rounded shadow-sm mr-1">MALL</span>`;
    if (p.badges?.new) badgesArea.innerHTML += `<span class="bg-[#10b981] text-white text-xs font-black px-2 py-0.5 rounded shadow-sm mr-1">NEW</span>`;
    if (p.badges?.hot) badgesArea.innerHTML += `<span class="bg-[#f97316] text-white text-xs font-black px-2 py-0.5 rounded shadow-sm mr-1">HOT</span>`;

    let imagesPool = [p.thumbnailUrl];
    if (p.galleryUrls && Array.isArray(p.galleryUrls)) {
        imagesPool = [...imagesPool, ...p.galleryUrls.filter(Boolean)].slice(0, 8);
    } else if (p.galleryUrls && typeof p.galleryUrls === 'string') {
        imagesPool = [...imagesPool, ...p.galleryUrls.split(",").map(u => u.trim()).filter(Boolean)].slice(0, 8);
    }

    currentActiveDetailProduct.imagesArray = imagesPool;

    // 🛠️ แก้ไขจุดนี้: ตรวจสอบและสร้างกล่องสำหรับไอคอนจุด (detail-dots) ในกรณีที่ในหน้า HTML ไม่มี หรือถูกเคลียร์ไป
    let dotsArea = document.getElementById("detail-dots");
    if (!dotsArea) {
        const mainImgEl = document.getElementById("detail-main-img");
        if (mainImgEl && mainImgEl.parentElement) {
            dotsArea = document.createElement("div");
            dotsArea.id = "detail-dots";
            dotsArea.className = "flex justify-center items-center gap-1.5 mt-3";
            mainImgEl.parentElement.insertAdjacentElement('afterend', dotsArea);
        }
    } else {
        dotsArea.className = "flex justify-center items-center gap-1.5 mt-3";
    }

    // เรียก Render รูปภาพและจุดนำทางพร้อมกัน
    setupProductGallerySliderUI(0);

    // === ระบบ Touch Swipe สำหรับรูปภาพหลัก (มือถือ) ===
    const mainImgEl = document.getElementById("detail-main-img");
    if (mainImgEl && !mainImgEl.dataset.swipeBound) {
        bindTouchSwipeElement(
            mainImgEl,
            () => { 
                const images = currentActiveDetailProduct.imagesArray || [];
                let nextIdx = currentLightboxIndex + 1;
                if (nextIdx < images.length) setupProductGallerySliderUI(nextIdx);
            },
            () => { 
                let prevIdx = currentLightboxIndex - 1;
                if (prevIdx >= 0) setupProductGallerySliderUI(prevIdx);
            }
        );
        mainImgEl.dataset.swipeBound = "true"; 
    }

    // === ระบบกดปุ่มคีย์บอร์ด ซ้าย-ขวา สำหรับ PC ===
    const handleDetailKeyDown = (e) => {
        const images = currentActiveDetailProduct.imagesArray || [];
        if (images.length <= 1) return;

        if (e.key === "ArrowRight") {
            let nextIdx = currentLightboxIndex + 1;
            if (nextIdx < images.length) setupProductGallerySliderUI(nextIdx);
        } else if (e.key === "ArrowLeft") {
            let prevIdx = currentLightboxIndex - 1;
            if (prevIdx >= 0) setupProductGallerySliderUI(prevIdx);
        }
    };

    // ลงทะเบียน Event กดปุ่มคีย์บอร์ด
    window.addEventListener("keydown", handleDetailKeyDown);

    // ปรับปรุงฟังก์ชันปิด Modal เพื่อทำลาย Event ลบหน่วยความจำทิ้งเมื่อปิดหน้าต่าง
    const originalCloseModal = window.closeModal;
    window.closeModal = function(modalId, backwardInterrupted = false) {
        if (modalId === 'modal-detail') {
            window.removeEventListener("keydown", handleDetailKeyDown);
        }
        if (typeof originalCloseModal === "function") {
            originalCloseModal(modalId, backwardInterrupted);
        }
    };

    // === ระบบปุ่มกดซื้อสินค้า ===
    const buyBtn = document.getElementById("detail-buy-btn");
    buyBtn.onclick = () => trackButtonLinkMetricEvent(p.id, p.buyUrl);
    
    if (p.badges?.soon) {
        buyBtn.removeAttribute('href'); 
        buyBtn.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> <span>เร็วๆ นี้</span>`;
        buyBtn.className = "w-full bg-[#71d4a4] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-sm pointer-events-none";
    } else {
        buyBtn.href = p.buyUrl || "#"; 
        
        const isAppLink = p.buyUrl && !p.buyUrl.startsWith('http://') && !p.buyUrl.startsWith('https://');
        if (isAppLink) {
            buyBtn.removeAttribute('target');
        } else {
            buyBtn.target = "_blank";
        }
        
        buyBtn.innerHTML = `<i class="fa-solid fa-cart-shopping"></i> <span>สั่งซื้อสินค้าตอนนี้</span>`;
        buyBtn.className = "w-full bg-[#10b981] hover:bg-blue-600 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-md transition-all";
        
        buyBtn.onclick = function() {
            if (typeof trackButtonLinkMetricEvent === "function") {
                trackButtonLinkMetricEvent(p.id, p.buyUrl);
            }
        };
    }

    openModal('modal-detail');
}

function setupProductGallerySliderUI(index) {
    const images = currentActiveDetailProduct.imagesArray;
    if(!images || images.length === 0) return;
    
    currentLightboxIndex = index;
    
    // 1. อัปเดตรูปภาพหลัก
    const mainImg = document.getElementById("detail-main-img");
    if (mainImg) mainImg.src = images[index];

    // 2. ระบบไอคอนจุดตรงกลาง (Dots Container)
    const dotsContainer = document.getElementById("detail-dots");
    if (dotsContainer) {
        dotsContainer.innerHTML = "";
        images.forEach((_, idx) => {
            const dot = document.createElement("button");
            dot.className = `w-2 h-2 rounded-full transition-all duration-300 ${idx === index ? 'bg-gray-800 w-4' : 'bg-gray-300 hover:bg-gray-400'}`;
            dot.onclick = () => setupProductGallerySliderUI(idx);
            dotsContainer.appendChild(dot);
        });
    }

    // 3. ปรับแต่งโครงสร้างรูปย่อย (Thumbnails) ให้สไลด์แนวนอนได้ ไม่ตกไปแถวที่ 2
    const thumbContainer = document.getElementById("detail-thumbnails");
    if (thumbContainer) {
        thumbContainer.innerHTML = "";
        
        // 🛠️ เพิ่ม Tailwind CSS เพื่อล็อกให้เป็นแถวเดียว และเปิดการสไลด์แนวนอน (Horizontal Scroll)
        thumbContainer.className = "flex flex-row flex-nowrap gap-2 overflow-x-auto pb-2 scrollbar-none w-full";
        // บังคับให้ใช้สไตล์สไลด์ของมือถือแบบนุ่มนวล
        thumbContainer.style.webkitOverflowScrolling = "touch"; 
        
        images.forEach((url, idx) => {
            const thumbBox = document.createElement("div");
            
            // ตั้งค่าคุณสมบัติสำหรับ Admin และ บุคคลทั่วไป โดยล็อกขนาดไว้ที่ w-16 h-16 และไม่ให้บีบขนาดตัวเอง (shrink-0)
            if (activeAdmin) {
                thumbBox.className = `w-16 h-16 bg-[#fbfbfb] border rounded-xl overflow-hidden p-1 shrink-0 cursor-grab active:cursor-grabbing transition-all ${idx === index ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-gray-200/80 hover:border-gray-400'}`;
                thumbBox.draggable = true;
                thumbBox.dataset.index = idx;
                setupGalleryDragListeners(thumbBox); // ระบบลากจัดเรียงรูปภาพเดิมของ Admin[cite: 2]
            } else {
                thumbBox.className = `w-16 h-16 bg-[#fbfbfb] border rounded-xl overflow-hidden p-1 shrink-0 cursor-pointer transition-all ${idx === index ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-gray-200/80 hover:border-gray-400'}`;
            }
            
            thumbBox.innerHTML = `<img src="${url}" class="object-contain w-full h-full pointer-events-none" loading="lazy">`;
            
            // คลิกเปลี่ยนรูปภาพหลัก
            thumbBox.onclick = (e) => {
                if (e.target.tagName !== 'DIV' && thumbBox.draggable) return; 
                setupProductGallerySliderUI(idx);
            };
            
            thumbContainer.appendChild(thumbBox);
        });

        // ➕ เสริมตัวช่วยสไลด์อัตโนมัติ: เลื่อนแถวสไลด์ให้โฟกัสที่รูปภาพที่เรากดเลือกอยู่เสมอ
        const activeThumb = thumbContainer.children[index];
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}

let dragGallerySourceRef = null;

function setupGalleryDragListeners(element) {
    element.addEventListener('dragstart', (e) => {
        dragGallerySourceRef = element;
        element.classList.add('opacity-40');
        e.dataTransfer.effectAllowed = 'move';
    });

    element.addEventListener('dragover', (e) => e.preventDefault());

    element.addEventListener('drop', async (e) => {
        e.stopPropagation();
        if (dragGallerySourceRef !== element) {
            const sourceIndex = parseInt(dragGallerySourceRef.dataset.index);
            const targetIndex = parseInt(element.dataset.index);
            
            // สลับตำแหน่ง URL รูปภาพใน Array ภายใน Memory
            const images = currentActiveDetailProduct.imagesArray;
            const movedUrl = images.splice(sourceIndex, 1)[0];
            images.splice(targetIndex, 0, movedUrl);
            
            // แยกโครงสร้างกลับเป็น รูปหลักรูปแรก (thumbnailUrl) และรูปย่อยที่เหลือ (galleryUrls)
            const newThumbnailUrl = images[0] || "";
            const newGalleryUrls = images.slice(1); // ดึงตั้งแต่ตัวที่ 2 เป็นต้นไป
            
            try {
                // ยิงคำสั่งเซฟลง Firestore ทันทีที่สลับ URL เสร็จ
                const productRef = doc(db, "products", currentActiveDetailProduct.id);
                await updateDoc(productRef, {
                    thumbnailUrl: newThumbnailUrl,
                    galleryUrls: newGalleryUrls
                });
                
                // อัปเดตข้อมูลใน object หลักของแอปและวาด UI ใหม่
                currentActiveDetailProduct.thumbnailUrl = newThumbnailUrl;
                currentActiveDetailProduct.galleryUrls = newGalleryUrls;
                currentActiveDetailProduct.imagesArray = images;
                
                // สั่ง Render หน้า Gallery ใหม่เพื่อให้เห็นลำดับปัจจุบัน
                setupProductGallerySliderUI(targetIndex);
                console.log("อัปเดตสลับ URL รูปภาพบนระบบสำเร็จ");
            } catch (err) {
                alert("เกิดข้อผิดพลาดในการบันทึกตำแหน่งรูปภาพ: " + err.message);
            }
        }
    });

    element.addEventListener('dragend', () => {
        element.classList.remove('opacity-40');
        // ➕ ถ้ามี class ตอนลากค้างอื่นๆ ให้ระบุสั่งลบออกที่นี่ด้วย
    });
}

// ====================================================
// 🛠️ แก้ไขปัญหาการกระโดดข้ามรูป: ใช้ระบบ Single Event Listener ที่สมบูรณ์
// ====================================================
if (window.lightboxKeydownBound) {
    // ป้องกันไม่ให้ไฟล์สคริปต์โหลดซ้ำแล้วผูกเพิ่ม
    window.removeEventListener("keydown", window.lightboxKeydownHandler);
}

window.lightboxKeydownHandler = function(e) {
    const imgs = currentActiveDetailProduct?.imagesArray || [];
    if (imgs.length <= 1) return;

    // เช็คว่าหน้าต่าง Lightbox กำลังแสดงอยู่จริงหรือไม่
    const lightboxEl = document.getElementById("lightbox");
    if (!lightboxEl || lightboxEl.classList.contains("hidden")) return;

    if (e.key === "ArrowRight" || e.key === "Right") {
        e.preventDefault();
        e.stopImmediatePropagation(); // 🛑 หยุดการทำงานซ้อนจากตัวดักจับอื่น ๆ ทันที
        let nextIdx = currentLightboxIndex + 1;
        if (nextIdx < imgs.length) {
            navigateLightboxView(nextIdx);
        }
    } else if (e.key === "ArrowLeft" || e.key === "Left") {
        e.preventDefault();
        e.stopImmediatePropagation(); // 🛑 หยุดการทำงานซ้อนจากตัวดักจับอื่น ๆ ทันที
        let prevIdx = currentLightboxIndex - 1;
        if (prevIdx >= 0) {
            navigateLightboxView(prevIdx);
        }
    } else if (e.key === "Escape") {
        e.preventDefault();
        window.closeLightbox();
    }
};

// ลงทะเบียนแบบ Global เพียงที่เดียว
window.addEventListener("keydown", window.lightboxKeydownHandler, true); // ใช้ true (Capture phase) เพื่อให้ดักได้ไวที่สุด
window.lightboxKeydownBound = true;


window.openLightbox = function() {
    const images = currentActiveDetailProduct.imagesArray;
    if(!images) return;

    const lightboxEl = document.getElementById("lightbox");
    document.getElementById("lightbox-img").src = images[currentLightboxIndex];
    
    const thumbTrack = document.getElementById("lightbox-thumbnails");
    thumbTrack.innerHTML = "";
    images.forEach((url, idx) => {
        const item = document.createElement("div");
        item.id = `lightbox-thumb-${idx}`;
        item.className = `w-14 h-14 bg-white/10 rounded-lg p-1 shrink-0 cursor-pointer transition-all border ${idx === currentLightboxIndex ? 'border-blue-500 scale-105 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`;
        item.innerHTML = `<img src="${url}" class="object-contain w-full h-full rounded-md">`;
        item.onclick = () => navigateLightboxView(idx);
        thumbTrack.appendChild(item);
    });

    lightboxEl.classList.replace("hidden", "flex");
    
    // ดันประวัติสำหรับ Lightbox เข้าไปในระบบ
    history.pushState({ tier: 'lightbox' }, '');
    modalHistoryStack.push('lightbox');

    // === ระบบ Touch Swipe (ดักจับเฉพาะปัดหน้าจอบนมือถือ ไม่ยุ่งกับคีย์บอร์ด PC) ===
    const lightboxImgEl = document.getElementById("lightbox-img");
    if (lightboxImgEl && !lightboxImgEl.dataset.swipeBound) {
        bindTouchSwipeElement(
            lightboxImgEl,
            () => { 
                const imgs = currentActiveDetailProduct.imagesArray || [];
                let nextIdx = currentLightboxIndex + 1;
                if (nextIdx < imgs.length) navigateLightboxView(nextIdx);
            },
            () => { 
                let prevIdx = currentLightboxIndex - 1;
                if (prevIdx >= 0) navigateLightboxView(prevIdx);
            }
        );
        lightboxImgEl.dataset.swipeBound = "true";
    }

    // === ระบบ Click Outside (คลิกพื้นหลังเพื่อปิด) ===
    if (!lightboxEl.dataset.clickOutsideListener) {
        lightboxEl.addEventListener("click", (e) => {
            if (e.target === lightboxEl) {
                window.closeLightbox();
            }
        });
        lightboxEl.dataset.clickOutsideListener = "true";
    }
}

window.closeLightbox = function(backwardInterrupted = false) {
    const lightboxEl = document.getElementById("lightbox");
    if (!lightboxEl) return;
    lightboxEl.classList.replace("flex", "hidden");

    // หากเป็นการปิดโดยไม่ใช่การกดย้อนกลับจากโทรศัพท์
    if (!backwardInterrupted) {
        modalHistoryStack = modalHistoryStack.filter(id => id !== 'lightbox');
        if (window.history.state && window.history.state.tier === 'lightbox') {
            history.back();
        }
    }
}

function navigateLightboxView(index) {
    const images = currentActiveDetailProduct.imagesArray;
    if (!images || !images[index]) return; 
    
    // อัปเดตสถานะ Index ปัจจุบันทันที
    currentLightboxIndex = index;
    
    // เปลี่ยนรูปภาพหลักของ Lightbox
    const lightboxImg = document.getElementById("lightbox-img");
    if (lightboxImg) {
        lightboxImg.src = images[index];
    }
    
    // ไฮไลต์เลือกกรอบภาพเล็ก (Thumbnails)
    const thumbTrack = document.getElementById("lightbox-thumbnails");
    if (thumbTrack) {
        const children = thumbTrack.children;
        Array.from(children).forEach((el, idx) => {
            if (idx === index) {
                el.className = "w-14 h-14 bg-white/10 rounded-lg p-1 shrink-0 cursor-pointer transition-all border border-blue-500 scale-105 opacity-100";
            } else {
                el.className = "w-14 h-14 bg-white/10 rounded-lg p-1 shrink-0 cursor-pointer transition-all border border-transparent opacity-60 hover:opacity-100";
            }
        });

        // สไลด์จัดตำแหน่งแถบรูปเล็กให้อยู่ตรงกลางหน้าจออัตโนมัติ
        const activeThumb = thumbTrack.children[index];
        if (activeThumb) {
            activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
    
    // ซิงค์ตำแหน่งสไลเดอร์หลักที่อยู่ด้านหลังด้วย
    if (typeof setupProductGallerySliderUI === "function") {
        setupProductGallerySliderUI(index);
    }
}

// ================= ADMIN FUNCTIONS CONTROLS PIPELINE LAYOUT RULES =================
window.saveProduct = async function(e) {
    e.preventDefault();
    if(!activeAdmin) return alert("โปรดเข้าสู่ระบบผู้ดูแลก่อนทำรายการดังกล่าว");

    const id = document.getElementById("edit-product-id").value;
    
    // ➕ ดึงค่ารูปภาพหลักมาเช็ก หากไม่ได้กรอก (ค่าว่าง) ให้ใส่ URL รูปภาพทดแทน (Placeholder Image)
    let thumbInput = document.getElementById("form-thumb").value.trim();
    if (!thumbInput) {
        thumbInput = "https://placehold.co/600x600?text=No+Image"; // แอดมินสามารถเปลี่ยน URL รูปภาพทดแทนได้ตามต้องการ
    }

    const productPayload = {
        title: document.getElementById("form-title").value.trim(),
        price: parseFloat(document.getElementById("form-price").value) || 0, // ➕ ป้องกันกรณีไม่ได้กรอกราคา ให้เป็น 0
        discountRule: document.getElementById("form-discount").value.trim(),
        thumbnailUrl: thumbInput, // ใช้ค่าที่เช็กแล้วข้างต้น
        galleryUrls: [
            document.getElementById("form-gallery-1").value.trim(),
            document.getElementById("form-gallery-2").value.trim(),
            document.getElementById("form-gallery-3").value.trim(),
            document.getElementById("form-gallery-4").value.trim(),
            document.getElementById("form-gallery-5").value.trim(),
            document.getElementById("form-gallery-6").value.trim(),
            document.getElementById("form-gallery-7").value.trim(),
            document.getElementById("form-gallery-8").value.trim()
        ].filter(Boolean), // กรองเอาเฉพาะช่องที่มีการกรอกข้อมูลจริง (รูปย่อยใส่ไม่ครบ 8 รูปก็เซฟได้)
        categoryMain: document.getElementById("form-cat-main").value,
        categorySub: document.getElementById("form-cat-sub").value,
        brand: document.getElementById("form-brand").value,
        shippingMode: document.getElementById("form-shipping").value,
        keywords: document.getElementById("form-keywords").value.trim(),
        buyUrl: document.getElementById("form-buy-url").value.trim(),
        description: document.getElementById("form-desc").value.trim(),
        badges: {
            mall: document.getElementById("badge-mall").checked,
            new: document.getElementById("badge-new").checked,
            hot: document.getElementById("badge-hot").checked,
            soon: document.getElementById("badge-soon").checked
        },
        updatedAt: Date.now()
    };

    try {
        const targetDocRef = id ? doc(db, "products", id) : doc(collection(db, "products"));
        await setDoc(targetDocRef, productPayload, { merge: true });
        alert("บันทึกข้อมูลสินค้าเรียบร้อยแล้ว");
        resetProductForm();
        closeModal('modal-add-product');
    } catch(err) { alert(err.message); }
}

window.triggerProductEditSetup = function(id, event) {
    if(event) event.stopPropagation();
    const p = globalProducts.find(item => item.id === id);
    if (!p) return;

    document.getElementById("product-form-title").innerText = "แก้ไขข้อมูลสินค้า";
    document.getElementById("edit-product-id").value = p.id;
    document.getElementById("form-title").value = p.title || "";
    document.getElementById("form-price").value = p.price || 0;
    document.getElementById("form-discount").value = p.discountRule || "";
    document.getElementById("form-thumb").value = p.thumbnailUrl || "";
    for (let i = 1; i <= 8; i++) {
    document.getElementById(`form-gallery-${i}`).value = "";
    }
    // นำข้อมูลอาร์เรย์รูปภาพที่มี ใส่แยกเข้าไปในแต่ละช่อง
    if (p.galleryUrls && Array.isArray(p.galleryUrls)) {
        p.galleryUrls.forEach((url, index) => {
            if (index < 8) {
                document.getElementById(`form-gallery-${index + 1}`).value = url;
            }
        });
    } else if (p.galleryUrls && typeof p.galleryUrls === 'string') {
        // รองรับกรณีข้อมูลเก่าที่เป็น string คั่นด้วยเครื่องหมายจุลภาค ,
        const oldUrls = p.galleryUrls.split(",").map(u => u.trim()).filter(Boolean);
        oldUrls.forEach((url, index) => {
            if (index < 8) {
                document.getElementById(`form-gallery-${index + 1}`).value = url;
            }
        });
    }
    
    document.getElementById("form-cat-main").value = p.categoryMain || "";
    updateFormSubCategories();
    document.getElementById("form-cat-sub").value = p.categorySub || "";
    document.getElementById("form-brand").value = p.brand || "";
    
    document.getElementById("form-shipping").value = p.shippingMode || "จัดส่งในไทย";
    document.getElementById("form-keywords").value = p.keywords || "";
    document.getElementById("form-buy-url").value = p.buyUrl || "";
    document.getElementById("form-desc").value = p.description || "";

    document.getElementById("badge-mall").checked = !!p.badges?.mall;
    document.getElementById("badge-new").checked = !!p.badges?.new;
    document.getElementById("badge-hot").checked = !!p.badges?.hot;
    document.getElementById("badge-soon").checked = !!p.badges?.soon;

    openModal('modal-add-product');
}

window.executeProductDeletionAction = async function(id, event) {
    if(event) event.stopPropagation();
    if(!confirm("คุณต้องการลบรายการสินค้านี้ออกใช่หรือไม่?")) return;
    try {
        await deleteDoc(doc(db, "products", id));
        alert("ลบสินค้าเรียบร้อยแล้ว");
    } catch(err) { alert(err.message); }
}

function resetProductForm() {
    const formTitle = document.getElementById("product-form-title");
    const editId = document.getElementById("edit-product-id");
    const productForm = document.getElementById("product-form");

    // เปลี่ยนหัวข้อกลับเป็น เพิ่มสินค้าใหม่ เสมอ
    if (formTitle) formTitle.innerText = "เพิ่มสินค้าใหม่"; 
    
    // ล้างค่า ID สินค้าที่ใช้แก้ ให้เป็นค่าว่างเพื่อกลับสู่โหมดเพิ่มสินค้า
    if (editId) editId.value = ""; 
    
    // ล้างข้อมูลในช่องกรอก (Input) ทั้งหมดในฟอร์ม
    if (productForm) productForm.reset(); 
    
    if (typeof updateFormSubCategories === "function") {
        updateFormSubCategories();
    }
}

function populateFormDropdownSelections() {
    const mainSelect = document.getElementById("form-cat-main");
    const brandSelect = document.getElementById("form-brand");
    const filterKeywordCat = document.getElementById("filter-keyword-cat");

    mainSelect.innerHTML = "";
    globalCategories.main.forEach(m => mainSelect.innerHTML += `<option value="${m}">${m}</option>`);

    brandSelect.innerHTML = "";
    const sortedBrands = [...globalCategories.brand].sort((a,b)=>a.localeCompare(b));
    sortedBrands.forEach(b => brandSelect.innerHTML += `<option value="${b}">${b}</option>`);

    if (filterKeywordCat) {
        filterKeywordCat.innerHTML = `<option value="all">แสดงทุกหมวดหมู่สินค้าหลัก</option>`;
        globalCategories.main.forEach(m => filterKeywordCat.innerHTML += `<option value="${m}">${m}</option>`);
    }
    updateFormSubCategories();
}

function updateFormSubCategories() {
    const subSelect = document.getElementById("form-cat-sub");
    subSelect.innerHTML = "";
    globalCategories.sub.forEach(s => subSelect.innerHTML += `<option value="${s}">${s}</option>`);
}

// ================= DRAG SORT & CATEGORIES CONTROL ARCHITECTURE =================
function renderCategoryManagementUI() {
    const mainList = document.getElementById("manage-main-list");
    const subList = document.getElementById("manage-sub-list");
    const brandList = document.getElementById("manage-brand-list");

    mainList.innerHTML = "";
    globalCategories.main.forEach((cat, index) => {
        const li = document.createElement("li");
        li.className = "bg-white p-2.5 rounded-xl border border-gray-200 shadow-sm text-xs flex items-center justify-between cursor-grab active:cursor-grabbing transition-all";
        li.draggable = true;
        li.dataset.index = index;
        li.innerHTML = `
            <div class="flex items-center gap-2 flex-1 mr-2"><i class="fa-solid fa-grip-vertical text-gray-300"></i>
                <input type="text" value="${cat}" onchange="inlineUpdateCategoryField('main', ${index}, this.value)" class="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none py-0.5 font-medium">
            </div>
            <button onclick="removeCategoryFieldItem('main', ${index})" class="text-rose-500 p-1"><i class="fa-solid fa-trash-can"></i></button>
        `;
        setupDragAndDropSortingListeners(li);
        mainList.appendChild(li);
    });

    subList.innerHTML = "";
    globalCategories.sub.forEach((cat, index) => {
        subList.innerHTML += `
            <li class="bg-white p-2.5 rounded-xl border border-gray-200 text-xs flex items-center justify-between">
                <input type="text" value="${cat}" onchange="inlineUpdateCategoryField('sub', ${index}, this.value)" class="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none py-0.5 font-medium">
                <button onclick="removeCategoryFieldItem('sub', ${index})" class="text-rose-500 p-1"><i class="fa-solid fa-trash-can"></i></button>
            </li>
        `;
    });

    brandList.innerHTML = "";
    const sortedBrandsMetadataMap = globalCategories.brand.map((b, originalIndex) => ({ b, originalIndex }));
    sortedBrandsMetadataMap.sort((a,b) => a.b.localeCompare(b.b));
    sortedBrandsMetadataMap.forEach(item => {
        brandList.innerHTML += `
            <li class="bg-white p-2.5 rounded-xl border border-gray-200 text-xs flex items-center justify-between">
                <input type="text" value="${item.b}" onchange="inlineUpdateCategoryField('brand', ${item.originalIndex}, this.value)" class="w-full bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none py-0.5 font-medium">
                <button onclick="removeCategoryFieldItem('brand', ${item.originalIndex})" class="text-rose-500 p-1"><i class="fa-solid fa-trash-can"></i></button>
            </li>
        `;
    });
}

window.addCategoryField = async function(type) {
    const inputNode = document.getElementById(`add-${type}-cat`);
    const val = inputNode.value.trim();
    if(!val) return;
    globalCategories[type].push(val);
    try {
        await setDoc(doc(db, "configurations", "categories"), globalCategories);
        inputNode.value = "";
        renderCategoryManagementUI();
    } catch(err){ alert(err.message); }
}

window.inlineUpdateCategoryField = async function(type, index, newVal) {
    const cleaned = newVal.trim();
    if(!cleaned) return renderCategoryManagementUI();
    globalCategories[type][index] = cleaned;
    try { await setDoc(doc(db, "configurations", "categories"), globalCategories); } catch(err){ alert(err.message); }
}

window.removeCategoryFieldItem = async function(type, index) {
    if(!confirm("คุณต้องการลบรายการนี้ใช่หรือไม่?")) return;
    globalCategories[type].splice(index, 1);
    try {
        await setDoc(doc(db, "configurations", "categories"), globalCategories);
        renderCategoryManagementUI();
    } catch(err){ alert(err.message); }
}

let dragSourceElementReference = null;
function setupDragAndDropSortingListeners(element) {
    element.addEventListener('dragstart', (e) => {
        dragSourceElementReference = element;
        element.classList.add('dragging-item');
        e.dataTransfer.effectAllowed = 'move';
    });
    element.addEventListener('dragover', (e) => e.preventDefault());
    element.addEventListener('drop', async (e) => {
        e.stopPropagation();
        if (dragSourceElementReference !== element) {
            const sourceIndex = parseInt(dragSourceElementReference.dataset.index);
            const targetIndex = parseInt(element.dataset.index);
            const movedElementItem = globalCategories.main.splice(sourceIndex, 1)[0];
            globalCategories.main.splice(targetIndex, 0, movedElementItem);
            try {
                await setDoc(doc(db, "configurations", "categories"), globalCategories);
                renderCategoryManagementUI();
            } catch(err) { alert(err.message); }
        }
    });
    element.addEventListener('dragend', () => element.classList.remove('dragging-item'));
}

// ================= CODES & BULK OPERATIONS (DISCOUNTS / KEYWORDS) =================
function renderDiscountManager(searchQuery = "") {
    const body = document.getElementById("discount-table-body");
    if (!body) return; 
    body.innerHTML = "";
    
    if (searchQuery !== "") currentDiscountQuery = searchQuery;

    let subset = [...globalProducts];
    
    if (currentDiscountQuery.trim()) {
        const q = currentDiscountQuery.trim().toLowerCase();
        // 🛠️ แก้ไขบรรทัดนี้: ค้นหาโดยเช็กทั้งชื่อสินค้า (title) หรือ แบรนด์ (brand)
        subset = subset.filter(p => 
            (p.title && p.title.toLowerCase().includes(q)) || 
            (p.brand && p.brand.toLowerCase().includes(q))
        );
    }
    
    if (subset.length === 0) {
        body.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-400 text-xs">ไม่พบรายการสินค้าที่ค้นหา...</td></tr>`;
        return;
    }

    subset.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="p-3 text-center"><input type="checkbox" value="${p.id}" class="discount-item-chk rounded text-blue-600 w-4 h-4" data-mall="${!!p.badges?.mall}"></td>
            <td class="p-3 flex items-center gap-3 font-medium text-gray-900">
                <img src="${p.thumbnailUrl}" class="w-8 h-8 object-contain bg-gray-50 rounded-lg border p-0.5">
                <span class="line-clamp-1">${p.title} <span class="text-xs text-gray-400">(${p.brand || 'ไม่ระบุแบรนด์'})</span></span>
            </td>
            <td class="p-3"><input type="text" value="${p.discountRule || ''}" placeholder="เช่น 25%=2000" onkeydown="saveInlineDiscountRule('${p.id}', event)" class="w-full px-3 py-1 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"></td>
        `;
        body.appendChild(tr);
    });
}

// ผูก Event ให้ช่องค้นหาหน้าส่วนลดทำงานแบบ Realtime ทันทีที่พิมพ์
document.getElementById("search-discount-items").addEventListener("input", (e) => {
    renderDiscountManager(e.target.value);
});

window.saveInlineDiscountRule = async function(id, event) {
    if (event.key === 'Enter') {
        try {
            await updateDoc(doc(db, "products", id), { discountRule: event.target.value.trim() });
            alert("อัปเดตส่วนลดสินค้าสำเร็จ");
        } catch(err) { alert(err.message); }
    }
}

window.selectDiscountCheckboxes = function(actionType) {
    document.querySelectorAll(".discount-item-chk").forEach(chk => {
        if(actionType === 'all') chk.checked = true;
        else if(actionType === 'none') chk.checked = false;
        else if(actionType === 'mall') chk.checked = chk.dataset.mall === "true";
    });
}

window.applyBulkDiscount = async function() {
    const bulkVal = document.getElementById("bulk-discount-val").value.trim();
    const checkedIds = Array.from(document.querySelectorAll(".discount-item-chk:checked")).map(chk => chk.value);
    if(checkedIds.length === 0 || !bulkVal) return alert("กรุณาเลือกรายการและระบุโค้ดส่วนลดกลุ่มให้ครบถ้วน");

    try {
        // สร้าง Batch ขึ้นมาเพื่อมัดรวมคำสั่ง
        const batch = writeBatch(db);
        
        checkedIds.forEach(id => {
            const productRef = doc(db, "products", id);
            batch.update(productRef, { discountRule: bulkVal });
        });

        // สั่งทำงานพร้อมกันทีเดียว (รันตูมเดียว)
        await batch.commit();
        
        alert("อัปเดตกลุ่มโค้ดส่วนลดสำเร็จ");
        document.getElementById("bulk-discount-val").value = "";
        renderDiscountManager();
    } catch(err) {
        alert("เกิดข้อผิดพลาด: " + err.message);
    }
}

function renderKeywordManager(searchQuery = "") {
    const body = document.getElementById("keyword-table-body");
    if (!body) return; 
    body.innerHTML = "";
    
    if (searchQuery !== "") currentKeywordQuery = searchQuery;

    const selectedCategoryMainFilter = document.getElementById("filter-keyword-cat")?.value || "all";
    let subset = [...globalProducts];
    
    if (selectedCategoryMainFilter !== 'all') {
        subset = subset.filter(p => p.categoryMain === selectedCategoryMainFilter);
    }
    
    if (currentKeywordQuery.trim()) {
        const q = currentKeywordQuery.trim().toLowerCase();
        // 🛠️ แก้ไขบรรทัดนี้: ค้นหาโดยเช็กทั้งชื่อสินค้า (title) หรือ แบรนด์ (brand)
        subset = subset.filter(p => 
            (p.title && p.title.toLowerCase().includes(q)) || 
            (p.brand && p.brand.toLowerCase().includes(q))
        );
    }

    if (subset.length === 0) {
        body.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-gray-400 text-xs">ไม่พบรายการสินค้าที่ค้นหา...</td></tr>`;
        return;
    }

    subset.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="p-3 text-center"><input type="checkbox" value="${p.id}" class="keyword-item-chk rounded text-blue-600 w-4 h-4"></td>
            <td class="p-3 flex items-center gap-3 font-medium text-gray-900">
                <img src="${p.thumbnailUrl}" class="w-8 h-8 object-contain bg-gray-50 rounded-lg border p-0.5">
                <span class="line-clamp-1">${p.title} <span class="text-xs text-gray-400">(${p.brand || 'ไม่ระบุแบรนด์'})</span></span>
            </td>
            <td class="p-3"><input type="text" value="${p.keywords || ''}" onkeydown="saveInlineKeywordsRule('${p.id}', event)" class="w-full px-3 py-1 bg-gray-50 border border-gray-200 rounded-xl text-xs"></td>
        `;
        body.appendChild(tr);
    });
}

// ผูก Event ให้ช่องค้นหาหน้าคีย์เวิร์ดทำงานแบบ Realtime ทันทีที่พิมพ์
document.getElementById("search-keyword-items").addEventListener("input", (e) => {
    renderKeywordManager(e.target.value);
});

// ตรวจจับกรณีเปลี่ยนหมวดหมู่สินค้า ให้รีเซ็ตคำค้นหาให้ถูกต้องด้วย
document.getElementById("filter-keyword-cat")?.addEventListener("change", () => {
    renderKeywordManager(document.getElementById("search-keyword-items").value);
});

window.saveInlineKeywordsRule = async function(id, event) {
    if (event.key === 'Enter') {
        try {
            await updateDoc(doc(db, "products", id), { keywords: event.target.value.trim() });
            alert("อัปเดตคีย์เวิร์ดสำเร็จ");
        } catch(err) { alert(err.message); }
    }
}

window.applyBulkKeywords = async function() {
    const bulkVal = document.getElementById("bulk-keyword-val").value.trim();
    const checkedIds = Array.from(document.querySelectorAll(".keyword-item-chk:checked")).map(chk => chk.value);
    if(checkedIds.length === 0 || !bulkVal) return alert("กรุณาระบุข้อมูลกล่องเลือกรายการคีย์เวิร์ด");

    try {
        // 1. สร้าง Batch ขึ้นมาเพื่อมัดรวมคำสั่งอัปเดตทั้งหมด
        const batch = writeBatch(db);
        
        // 2. วนลูปจับสินค้าทุกตัวที่ถูกติ๊กถูก มัดรวมคำสั่งใส่ลงไปใน Batch
        checkedIds.forEach(id => {
            const productRef = doc(db, "products", id);
            batch.update(productRef, { keywords: bulkVal });
        });

        // 3. สั่งให้ Firebase รันคำสั่งทั้งหมดพร้อมกันทีเดียวใน Request เดียว
        await batch.commit();
        
        alert("อัปเดตคีย์เวิร์ดกลุ่มเสร็จสิ้น");
        document.getElementById("bulk-keyword-val").value = "";
        renderKeywordManager(); // โหลดตารางใหม่เพื่อให้เห็นค่าที่อัปเดตทันที
    } catch(err) {
        alert("เกิดข้อผิดพลาดในการอัปเดตคีย์เวิร์ด: " + err.message);
    }
}

// ================= ANALYTICS LAYER & VISITOR CONTROLS =================
async function initIPViewStatsCounter() {
    // ดึงวันที่ปัจจุบันโดยอิงเวลาท้องถิ่น (Local Time) เป็นหลัก เพื่อให้ตรงกับวันที่ผู้ใช้งานเห็นจริง ๆ
    const localDate = new Date();
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`; // จะได้ฟอร์แมต "YYYY-MM-DD"

    try {
        // 1. เรียกขอ IP จริงจาก API หน้าบ้าน
        const response = await fetch('https://api.ipify.org?format=json');
        if (!response.ok) throw new Error("Network response was not ok");
        
        const data = await response.json();
        const userIP = data.ip;

        if (!userIP) return; 

        // 2. ตรวจสอบและบันทึกลง Firestore ของ "วันปัจจุบัน"
        await runTransaction(db, async (transaction) => {
            const statsDocRef = doc(db, "statistics", todayStr);
            const snap = await transaction.get(statsDocRef);
            
            let list = snap.exists() && snap.data().visitorsList ? snap.data().visitorsList : [];
            
            // เช็กว่าใน "วันนี้" มี IP นี้เข้ามารึยัง ถ้ายังไม่มีเลย ค่อยนับยอดวิว (+1) เข้าไปในอาร์เรย์
            if (!list.includes(userIP)) {
                list.push(userIP);
                transaction.set(statsDocRef, { visitorsList: list }, { merge: true });
            }
        });
    } catch(e) {
        console.error("Error tracking IP stats:", e);
    }
}

window.trackButtonLinkMetricEvent = async function(productId, targetUrl) {
    if (!targetUrl || targetUrl === "undefined") return;

    try {
        const metricRef = doc(db, "metrics", "button_clicks");
        await runTransaction(db, async (transaction) => {
            const metricDoc = await transaction.get(metricRef);
            let currentClicks = 0;
            if (metricDoc.exists()) {
                currentClicks = metricDoc.data()[productId] || 0;
            }
            transaction.set(metricRef, { [productId]: currentClicks + 1 }, { merge: true });
        });
        console.log(`บันทึกสถิติการคลิกสำหรับสินค้า ${productId} สำเร็จ`);
        
        // ❌ ลบ window.open(targetUrl, '_blank'); ตรงนี้ออกไปเลยครับ!
        
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการบันทึกสถิติ:", error);
        
        // ❌ ลบ window.open(targetUrl, '_blank'); ตรงนี้ออกไปด้วยเช่นกันครับ!
    }
};

async function loadRealtimeStatsOverviewRecords(selectedDateString) {
    if(!selectedDateString) return;
    const snapshot = await getDoc(doc(db, "statistics", selectedDateString));
    let views = 0, clicks = 0, reg = {};
    if (snapshot.exists()) {
        views = snapshot.data().visitorsList?.length || 0;
        reg = snapshot.data().clicksRegistry || {};
        clicks = Object.values(reg).reduce((a,b)=>a+b, 0);
    }
    document.getElementById("stats-summary-views").innerText = views;
    document.getElementById("stats-summary-clicks").innerText = clicks;

    const rankingTableBody = document.getElementById("stats-clicks-ranking");
    rankingTableBody.innerHTML = "";
    let arr = [];
    for (let pId in reg) {
        const p = globalProducts.find(item => item.id === pId);
        arr.push({ title: p ? p.title : `Deleted Item ID: ${pId}`, clicks: reg[pId] });
    }
    arr.sort((a,b) => b.clicks - a.clicks);
    if(arr.length === 0) {
        rankingTableBody.innerHTML = `<tr><td colspan="2" class="p-3 text-center text-gray-400 text-xs">ไม่มีสถิติสำหรับวันนี้</td></tr>`;
        return;
    }
    arr.forEach(row => {
        rankingTableBody.innerHTML += `<tr><td class="p-3 font-medium text-gray-800 line-clamp-1">${row.title}</td><td class="p-3 text-center font-bold text-purple-600">${row.clicks}</td></tr>`;
    });
}

window.clearStatsData = async function(type) {
    if(!activeAdmin) return;
    const d = document.getElementById("stats-date-picker").value;
    try {
        if (type === 'views') await updateDoc(doc(db, "statistics", d), { visitorsList: [] });
        else await updateDoc(doc(db, "statistics", d), { clicksRegistry: {} });
        alert("ล้างประวัติข้อมูลสถิติประจำวันเสร็จสิ้น");
        loadRealtimeStatsOverviewRecords(d);
    } catch(e){}
}

async function executeAdminLoginAuth() {
    const u = document.getElementById("login-user").value.trim();
    const p = document.getElementById("login-pass").value;
    try {
        await signInWithEmailAndPassword(auth, u, p);
        closeModal('modal-login');
    } catch(e) { alert("ข้อมูลเข้าสู่ระบบผู้ดูแลระบบไม่ถูกต้อง"); }
}

// ฟังก์ชันสากลสำหรับผูก Event Touch Swipe ให้กับ Element
function bindTouchSwipeElement(element, onSwipeLeft, onSwipeRight) {
    let touchStartX = 0;
    let touchEndX = 0;
    
    element.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    element.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    }, { passive: true });

    function handleSwipeGesture() {
        const swipeThreshold = 50; // ระยะพิกเซลขั้นต่ำที่กวาดนิ้วแล้วจะนับว่าเป็นการปัด
        if (touchEndX < touchStartX - swipeThreshold) {
            if (typeof onSwipeLeft === 'function') onSwipeLeft();
        }
        if (touchEndX > touchStartX + swipeThreshold) {
            if (typeof onSwipeRight === 'function') onSwipeRight();
        }
    }
}
// ================= PRODUCT DRAG & DROP SORTING SYSTEM =================
let dragProductSourceRef = null;

// ฟังก์ชันเคลียร์ Effect ทั้งหน้าจอ ป้องกันอาการค้าง
function clearAllDragEffects() {
    const allCards = document.querySelectorAll('#admin-products-grid > div');
    allCards.forEach(card => {
        card.classList.remove('opacity-40', 'scale-95');
    });
}

window.setupProductDragAndDropListeners = function(cardElement) {
    // 🔍 หาไอคอนลากภายในตัวการ์ดใบนี้
    const dragHandle = cardElement.querySelector('.drag-handle');
    
    // ถ้าไม่มีไอคอนลาก (เช่น ไม่ได้ล็อกอิน Admin) ไม่ต้องทำอะไร
    if (!dragHandle) return;

    // 1. เริ่มลาก: ดักจับเหตุการณ์ที่ "ไอคอนจับลาก" เท่านั้น!
    dragHandle.addEventListener('dragstart', (e) => {
        clearAllDragEffects();
        
        // 💡 สำคัญมาก: ตัวแปรอ้างอิงยังคงเก็บ "ตัวการ์ดหลัก" เพื่อเอาข้อมูลไปสลับตำแหน่ง
        dragProductSourceRef = cardElement; 
        cardElement.classList.add('opacity-40', 'scale-95');
        e.dataTransfer.effectAllowed = 'move';
    });

    // 2. ลากผ่าน: ตัวการ์ดหลักยังคงรองรับการวาง (Drop Zone)
    cardElement.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    // 3. ปล่อยเพื่อวางสินค้า
    cardElement.addEventListener('drop', async (e) => {
        e.stopPropagation();
        clearAllDragEffects();

        if (dragProductSourceRef !== cardElement && dragProductSourceRef !== null) {
            const sourceIndex = parseInt(dragProductSourceRef.dataset.index);
            const targetIndex = parseInt(cardElement.dataset.index);

            let targetDataset = [...globalProducts];

            // กรองสินค้าตามหน้าจอแอดมินปัจจุบัน (ดึงมาจากโค้ดเดิมของคุณในไฟล์ app.js)
            if (currentFilters.main !== 'all') {
                targetDataset = targetDataset.filter(p => p.categoryMain === currentFilters.main);
                if (currentFilters.sub !== 'all') targetDataset = targetDataset.filter(p => p.categorySub === currentFilters.sub);
                if (currentFilters.brand !== 'all') targetDataset = targetDataset.filter(p => p.brand === currentFilters.brand);
            }
            if (currentFilters.query) {
                const query = currentFilters.query;
                targetDataset = targetDataset.filter(p => p.title.toLowerCase().includes(query) || (p.keywords && p.keywords.toLowerCase().includes(query)));
            }

            const sourceProduct = targetDataset[sourceIndex];
            const targetProduct = targetDataset[targetIndex];

            if (!sourceProduct || !targetProduct) {
                dragProductSourceRef = null;
                return;
            }

            const globalSourceIdx = globalProducts.findIndex(p => p.id === sourceProduct.id);
            
            // ตรรกะการสลับตำแหน่งอิงตาม Sort Mode ล่าสุดของคุณในโค้ad
            const isLatestSortMode = document.getElementById('sort-mode-select')?.value === 'latest';
            
            if (isLatestSortMode) {
                // โหมดจัดเรียงตามเวลาล่าสุด
                const targetUpdatedAt = targetProduct.updatedAt || 0;
                let calculatedNewTime = targetUpdatedAt;
                
                if (sourceIndex < targetIndex) {
                    const nextProduct = targetDataset[targetIndex + 1];
                    if (nextProduct) {
                        calculatedNewTime = targetUpdatedAt - ((targetUpdatedAt - (nextProduct.updatedAt || 0)) / 2);
                    } else {
                        calculatedNewTime = targetUpdatedAt - 500;
                    }
                } else {
                    const prevProduct = targetDataset[targetIndex - 1];
                    if (prevProduct) {
                        calculatedNewTime = targetUpdatedAt + (((prevProduct.updatedAt || 0) - targetUpdatedAt) / 2);
                    } else {
                        calculatedNewTime = targetUpdatedAt + 500;
                    }
                }

                try {
                    await updateDoc(doc(db, "products", sourceProduct.id), { updatedAt: calculatedNewTime });
                    console.log("บันทึกลำดับสินค้าล่าสุดลง Firestore เรียบร้อยแล้ว");
                } catch (err) {
                    alert("เกิดข้อผิดพลาดในการบันทึกตำแหน่งสินค้าล่าสุด: " + err.message);
                }
            } else {
                // โหมดจัดเรียงปกติ (sortOrder บล็อกเดิมของคุณ)
                const globalTargetIdx = globalProducts.findIndex(p => p.id === targetProduct.id);
                const [movedItem] = globalProducts.splice(globalSourceIdx, 1);
                globalProducts.splice(globalTargetIdx, 0, movedItem);

                try {
                    const batch = writeBatch(db);
                    globalProducts.forEach((product, idx) => {
                        const productRef = doc(db, "products", product.id);
                        batch.update(productRef, { sortOrder: idx });
                    });
                    await batch.commit();
                    console.log("บันทึกลำดับจัดเรียงปกติลง Firestore เรียบร้อยแล้ว");
                } catch (err) {
                    alert("เกิดข้อผิดพลาดในการบันทึกตำแหน่งสินค้า: " + err.message);
                }
            }
        }
        dragProductSourceRef = null;
    });

    // 4. สิ้นสุดการลาก (ดักจับที่ไอคอน)
    dragHandle.addEventListener('dragend', () => {
        clearAllDragEffects();
        dragProductSourceRef = null;
    });
}

// ==========================================================================
// ADVANCED PRODUCT DRAG & DROP FOR BOTH SORTING MODES (PC & MOBILE SUPPORT)
// ==========================================================================

// ฟังก์ชันเสริมค้นหา Element ณ พิกเซลที่นิ้วสัมผัสบนมือถือ
function getTouchTargetElement(e) {
    if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        return document.elementFromPoint(touch.clientX, touch.clientY);
    }
    return null;
}

// ผูก Event การลากจัดเรียงสินค้า (อัปเกรดให้รองรับ PC + Mobile + สลับโหมดล่าสุดได้)
setupProductDragAndDropListeners = function(element) {
    
    // --- [ ส่วนที่ 1: สำหรับการใช้งานบนหน้าจอคอมพิวเตอร์ PC ] ---
    element.addEventListener('dragstart', (e) => {
        // 🔒 PC: เช็คว่าเมาส์ต้องคลิกลากที่ปุ่มไอคอน ☰ เท่านั้น
        if (!e.target.closest('.drag-handle')) {
            e.preventDefault();
            return false;
        }
        dragProductSourceRef = element;
        element.classList.add('opacity-40', 'scale-95');
        e.dataTransfer.effectAllowed = 'move';
    });

    element.addEventListener('dragover', (e) => e.preventDefault());

    element.addEventListener('drop', async (e) => {
        e.stopPropagation();
        if (dragProductSourceRef !== element) {
            await executeProductReorderLogic(dragProductSourceRef, element);
        }
    });

    element.addEventListener('dragend', () => {
        element.classList.remove('opacity-40', 'scale-95');
    });

    // --- [ ส่วนที่ 2: สำหรับการใช้งานบนหน้าจอมือถือ TOUCH SCREEN ] ---
    element.addEventListener('touchstart', (e) => {
        if (!activeAdmin) return;

        // 🔒 MOBILE: เช็คว่านิ้วต้องแตะโดนปุ่มไอคอน ☰ เท่านั้น!! 
        // ถ้าแตะโดนรูปภาพ ชื่อสินค้า หรือขอบตัวการ์ด จะ return ออกไปทันที เพื่อให้หน้าจอเลื่อนได้ปกติ
        const isHandle = e.target.closest('.drag-handle');
        if (!isHandle) {
            dragProductSourceRef = null; // เคลียร์ค่าทิ้ง ปล่อยให้หน้าเว็บสไลด์ได้
            return;
        }

        dragProductSourceRef = element;
        element.classList.add('opacity-40', 'scale-95', 'ring-4', 'ring-blue-500/20');
    }, { passive: true });

    element.addEventListener('touchmove', (e) => {
        // หน้าจอจะล็อกไม่ให้ขยับเฉพาะตอนที่แอดมิน "ตั้งใจใช้นิ้วลากที่ปุ่ม ☰ เท่านั้น"
        if (dragProductSourceRef === element && e.cancelable) {
            e.preventDefault(); 
        }
    }, { passive: false });

    element.addEventListener('touchend', async (e) => {
        if (!dragProductSourceRef) return;
        element.classList.remove('opacity-40', 'scale-95', 'ring-4', 'ring-blue-500/20');

        const targetEl = getTouchTargetElement(e.changedTouches ? { touches: [e.changedTouches[0]] } : e);
        if (!targetEl) return;

        const closestTarget = targetEl.closest('div[data-id]');
        if (closestTarget && dragProductSourceRef !== closestTarget) {
            await executeProductReorderLogic(dragProductSourceRef, closestTarget);
        }
        dragProductSourceRef = null;
    });
};

// ฟังก์ชันหลักในการคำนวณและบันทึกค่าลง Firebase ทันทีที่การลากเสร็จสิ้น
async function executeProductReorderLogic(sourceCard, targetCard) {
    const sortSelectEl = document.getElementById("sort-select");
    // หากไม่พบ Element หรือค่าว่าง ให้ถือว่าเป็นโหมดจัดเรียงเริ่มต้น ("normal") 
    let sorterVal = sortSelectEl ? sortSelectEl.value : "normal";
    if (!sorterVal) sorterVal = "normal";

    const sourceIndex = parseInt(sourceCard.dataset.index);
    const targetIndex = parseInt(targetCard.dataset.index);

    // ดึง Dataset สินค้าตามฟิลเตอร์หน้าจอปัจจุบันออกมาคำนวณ
    let targetDataset = [...globalProducts];
    if (currentFilters.main !== 'all') {
        targetDataset = targetDataset.filter(p => p.categoryMain === currentFilters.main);
        if (currentFilters.sub !== 'all') targetDataset = targetDataset.filter(p => p.categorySub === currentFilters.sub);
        if (currentFilters.brand !== 'all') targetDataset = targetDataset.filter(p => p.brand === currentFilters.brand);
    }
    if (currentFilters.query) {
        const query = currentFilters.query;
        targetDataset = targetDataset.filter(p => p.title.toLowerCase().includes(query) || (p.keywords && p.keywords.toLowerCase().includes(query)));
    }

    // จัดเรียง Dataset จำลองให้ตรงกับรูปแบบสายตาที่แอดมินกำลังเห็นอยู่ขณะนั้น
    if (sorterVal === "latest") {
        targetDataset.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } else {
        targetDataset.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    const sourceProduct = targetDataset[sourceIndex];
    const targetProduct = targetDataset[targetIndex];
    if (!sourceProduct || !targetProduct) return;

    // หาตำแหน่งดัชนีของสินค้าในอาเรย์หลัก (globalProducts)
    const globalSourceIdx = globalProducts.findIndex(p => p.id === sourceProduct.id);
    
    if (sorterVal === "latest") {
        // ==========================================================================
        // ตรรกะกรณีลากจัดเรียงในโหมด "สินค้าล่าสุด" (อิงจากค่าเวลา updatedAt)
        // ==========================================================================
        const targetUpdatedAt = targetProduct.updatedAt || Date.now();
        let calculatedNewTime = targetUpdatedAt;

        if (targetIndex === 0) {
            // กรณีลากมาอยู่บนสุดของหน้าจอ: ปรับให้เวลาล่าสุดมากกว่าตัวบนสุดเดิม 1 วินาที
            calculatedNewTime = targetUpdatedAt + 1000;
        } else if (targetIndex === targetDataset.length - 1) {
            // กรณีลากมาไว้ท้ายสุดของหน้าจอ: ปรับให้เวลาน้อยกว่าตัวล่างสุดเดิม 1 วินาที
            calculatedNewTime = targetUpdatedAt - 1000;
        } else {
            // กรณีลากมาแทรกตรงกลางระหว่างการ์ด: คำนวณหาค่าเฉลี่ยกึ่งกลางเวลาระหว่างสินค้าตัวบนและตัวล่างเพื่อแทรกตำแหน่ง
            const neighborIndex = sourceIndex > targetIndex ? targetIndex - 1 : targetIndex + 1;
            const neighborProduct = targetDataset[neighborIndex];
            if (neighborProduct) {
                const neighborTime = neighborProduct.updatedAt || Date.now();
                calculatedNewTime = Math.round((targetUpdatedAt + neighborTime) / 2);
            } else {
                calculatedNewTime = sourceIndex > targetIndex ? targetUpdatedAt + 500 : targetUpdatedAt - 500;
            }
        }

        try {
            // อัปเดตเวลาชิ้นที่ลากชิ้นเดียวลงฐานข้อมูล โครงสร้างฐานข้อมูลจะเรียงลำดับใหม่ทันที
            await updateDoc(doc(db, "products", sourceProduct.id), { updatedAt: calculatedNewTime });
            console.log("บันทึกลำดับสินค้าล่าสุดลง Firestore เรียบร้อยแล้ว");
        } catch (err) {
            alert("เกิดข้อผิดพลาดในการบันทึกตำแหน่งสินค้าล่าสุด: " + err.message);
        }

    } else {
        // ==========================================================================
        // ตรรกะกรณีลากจัดเรียงในโหมด "จัดเรียงปกติ" (อิงจากค่าเลข sortOrder เดิมของคุณ)
        // ==========================================================================
        const globalTargetIdx = globalProducts.findIndex(p => p.id === targetProduct.id);
        const [movedItem] = globalProducts.splice(globalSourceIdx, 1);
        globalProducts.splice(globalTargetIdx, 0, movedItem);

        try {
            const batch = writeBatch(db);
            globalProducts.forEach((product, idx) => {
                const productRef = doc(db, "products", product.id);
                batch.update(productRef, { sortOrder: idx });
            });
            await batch.commit();
            console.log("บันทึกลำดับจัดเรียงปกติลง Firestore เรียบร้อยแล้ว");
        } catch (err) {
            alert("เกิดข้อผิดพลาดในการบันทึกตำแหน่งสินค้า: " + err.message);
        }
    }
}

// ฟังก์ชันล้างค่ารูปภาพรายช่อง (ระบุไว้ระดับ Global)
window.clearSingleImage = function(targetId) {
    const targetInput = document.getElementById(targetId);
    if (targetInput) targetInput.value = "";
    
    const previewDiv = document.getElementById(`preview-div-${targetId}`);
    const imgView = document.getElementById(`img-view-${targetId}`);
    if (previewDiv) previewDiv.classList.add("hidden");
    if (imgView) imgView.src = "";
}

document.addEventListener("DOMContentLoaded", () => {
    const API_KEY = "095c39746011f543a08e9ce88e8c65f9";

    // 1. ตรรกะตรวจจับการเลือกไฟล์และทำการอัปโหลดผ่าน ImgBB API
    const fileInputs = document.querySelectorAll(".imgbb-file-element");
    fileInputs.forEach(input => {
        input.addEventListener("change", async (e) => {
            const targetId = e.target.getAttribute("data-target");
            const file = e.target.files[0];
            if (!file) return;

            const targetInput = document.getElementById(targetId);
            const previewDiv = document.getElementById(`preview-div-${targetId}`);
            const imgView = document.getElementById(`img-view-${targetId}`);

            // ล็อกการทำงานหน้าฟอร์มชั่วคราวขณะอัปโหลด
            const originalPlaceholder = targetInput.placeholder;
            targetInput.value = "กำลังอัปโหลดรูปภาพ...";
            targetInput.disabled = true;

            const formData = new FormData();
            formData.append("image", file);

            try {
                const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
                    method: "POST",
                    body: formData
                });
                const result = await response.json();

                if (result.success) {
                    const directUrl = result.data.url;
                    
                    // หยอด direct URL ลงช่อง Input
                    targetInput.value = directUrl;
                    
                    // เปิดแสดงภาพ Preview เล็กๆ ด้านล่างช่องกรอก
                    if (imgView) imgView.src = directUrl;
                    if (previewDiv) previewDiv.classList.remove("hidden");
                } else {
                    throw new Error(result.error ? result.error.message : "การอัปโหลดผิดพลาด");
                }
            } catch (err) {
                alert("เกิดข้อผิดพลาดในการอัปโหลด: " + err.message);
                targetInput.value = "";
            } finally {
                targetInput.disabled = false;
                targetInput.placeholder = originalPlaceholder;
                input.value = ""; // เคลียร์ค่าของอินพุตไฟล์เดิมออกให้เลือกซ้ำได้
            }
        });
    });

    // 2. ตรรกะกรณีพิมพ์ URL เอง หรือระบบเรียกแก้ไขสินค้าเดิมขึ้นมา 
    // ตรวจจับให้แสดงผลภาพ Preview ด้านล่างให้สอดคล้องกันโดยอัตโนมัติ
    const monitorTargets = ["form-thumb", "form-gallery-1", "form-gallery-2", "form-gallery-3", "form-gallery-4", "form-gallery-5", "form-gallery-6", "form-gallery-7", "form-gallery-8"];
    
    // ตั้งตัวตรวจจับลูปสั้นๆ เพื่อคอยเช็กการเปลี่ยนแปลงค่า (Value) ในอินพุต
    setInterval(() => {
        monitorTargets.forEach(id => {
            const inputEl = document.getElementById(id);
            const previewDiv = document.getElementById(`preview-div-${id}`);
            const imgView = document.getElementById(`img-view-${id}`);
            
            if (inputEl && previewDiv && imgView) {
                const currentVal = inputEl.value.trim();
                // เช็กว่าเป็นลิงก์จริงและไม่ได้อยู่ในสภาวะกำลังดาวน์โหลด
                if (currentVal && currentVal.startsWith("http")) {
                    if (imgView.src !== currentVal) {
                        imgView.src = currentVal;
                        previewDiv.classList.remove("hidden");
                    }
                } else if (currentVal === "" || currentVal === "กำลังอัปโหลดรูปภาพ...") {
                    previewDiv.classList.add("hidden");
                }
            }
        });
    }, 500);
});

// UPLOAD ImgBB
async function uploadImageToStorage(file) {
    if (!file) return null;
    // สร้างชื่อไฟล์ไม่ให้ซ้ำกันด้วยเวลา
    const fileRef = ref(storage, `products/${Date.now()}_${file.name}`);
    
    // อัปโหลดไฟล์ดิบ
    await uploadBytes(fileRef, file);
    // ดึง URL ที่เป็นสาธารณะออกมา
    const downloadURL = await getDownloadURL(fileRef);
    return downloadURL;
}

async function uploadToImgBB(file) {
    const apiKey = '095c39746011f543a08e9ce88e8c65f9';
    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.success) {
            return data.data.url; // จะได้ลิงก์ URL รูปภาพกลับมาใช้งานทันที
        } else {
            throw new Error(data.error.message);
        }
    } catch (error) {
        console.error("ImgBB Upload Error:", error);
        alert("อัปโหลดรูปภาพล้มเหลว: " + error.message);
    }
}

// ==========================================================================
// PASTE IMAGE TO UPLOAD WITH IMGBB API ENGINE
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const IMGBB_API_KEY = "095c39746011f543a08e9ce88e8c65f9";
    
    // รายชื่อ ID ของช่อง Input รูปภาพทั้งหมดในฟอร์มของคุณ
    const targetInputIds = [
        "form-thumb", 
        "form-gallery-1", "form-gallery-2", "form-gallery-3", "form-gallery-4",
        "form-gallery-5", "form-gallery-6", "form-gallery-7", "form-gallery-8"
    ];

    targetInputIds.forEach(id => {
        const inputEl = document.getElementById(id);
        if (!inputEl) return;

        // ดักจับเหตุการณ์การ "วาง (Paste)" ลงในช่องกรอก
        inputEl.addEventListener("paste", async (e) => {
            // ดึงข้อมูลจาก Clipboard
            const clipboardData = e.clipboardData || window.clipboardData;
            const items = clipboardData.items;
            
            let imageFile = null;
            
            // วนลูปหาไฟล์รูปภาพจากสิ่งที่คุณก็อปปี้มา
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    imageFile = items[i].getAsFile();
                    break;
                }
            }

            // ถ้าสิ่งที่แอดมินกดวางเป็นรูปภาพจริง ให้ทำงานต่อทันที
            if (imageFile) {
                // ป้องกันไม่ให้ Text หรือ String เดิมแสดง (เช่น พิมพ์ค้างไว้ หรือวาง URL ดิบสับสน)
                e.preventDefault();

                const previewDiv = document.getElementById(`preview-div-${id}`);
                const imgView = document.getElementById(`img-view-${id}`);

                // แสดงสถานะระหว่างอัปโหลด
                const originalPlaceholder = inputEl.placeholder;
                inputEl.value = "กำลังอัปโหลดรูปภาพที่คัดลอกมา...";
                inputEl.disabled = true;

                const formData = new FormData();
                formData.append("image", imageFile);

                try {
                    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                        method: "POST",
                        body: formData
                    });
                    const result = await response.json();

                    if (result.success) {
                        const directUrl = result.data.url;
                        
                        // หยอด URL สาธารณะจาก ImgBB ลงช่อง Input สำเร็จ
                        inputEl.value = directUrl;
                        
                        // แสดงรูปภาพ Preview ขนาดเล็กทันที
                        if (imgView) imgView.src = directUrl;
                        if (previewDiv) previewDiv.classList.remove("hidden");
                        
                        console.log(`วางและอัปโหลดรูปภาพไปยัง ImgBB สำเร็จ (${id}): ${directUrl}`);
                    } else {
                        throw new Error(result.error ? result.error.message : "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ ImgBB");
                    }
                } catch (err) {
                    alert("ไม่สามารถวางเพื่ออัปโหลดรูปภาพได้: " + err.message);
                    inputEl.value = "";
                } finally {
                    inputEl.disabled = false;
                    inputEl.placeholder = originalPlaceholder;
                }
            }
        });
    });
});