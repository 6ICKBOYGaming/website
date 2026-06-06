import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// การตั้งค่าเชื่อมต่อ Firebase Config ของร้านคุณ
const firebaseConfig = {
    apiKey: "AIzaSyBEBVjahmE6BMGPglrHRdbktLI9mQKZTls",
    authDomain: "ickboy-store.firebaseapp.com",
    projectId: "ickboy-store",
    storageBucket: "ickboy-store.firebasestorage.app",
    messagingSenderId: "532385576489",
    appId: "1:532385576489:web:355cbf31cf5435dc012efc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let allProducts = [];
let discountPresets = ["25%=2000", "30%=2000", "10%=500", "50%=3000"];

const tableBody = document.getElementById("bulkProductTableBody");
const searchInput = document.getElementById("bulkSearchInput");
const categorySelect = document.getElementById("bulkCategorySelect");
const selectedCountText = document.getElementById("selectedCountText");
const promoTabName = document.getElementById("promoTabName");
const promoTabStatus = document.getElementById("promoTabStatus");
const presetContainer = document.getElementById("discountPresetContainer");

// รันระบบทำงานทันทีเมื่อหน้าจอแก้ไขราคาถูกเปิดขึ้นมา
window.addEventListener("DOMContentLoaded", async () => {
    await loadGlobalPromoSettings();
    await loadPresetsFromConfig();
    await loadBulkProducts();
    renderPresets();
    setupFilters();
    setupGlobalClearButtons();
});

// 1. ดึงค่าการตั้งค่าป้ายแท็บโปรโมชันเทศกาล
async function loadGlobalPromoSettings() {
    try {
        const docRef = doc(db, "system_settings", "promo_tab_config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if(promoTabName) promoTabName.value = data.title || "ส่วนลดโปร 6.6";
            if(promoTabStatus) promoTabStatus.checked = !!data.active;
        }
    } catch (e) { console.error(e); }
}

// 2. ดึงรหัสพรีเซ็ตส่วนลดจากฐานข้อมูล
async function loadPresetsFromConfig() {
    try {
        const docRef = doc(db, "system_settings", "discount_presets");
        const snap = await getDoc(docRef);
        if(snap.exists() && snap.data().codes) {
            discountPresets = snap.data().codes;
        }
    } catch(e) {}
}

// 3. ดึงสินค้าจากตารางหลัก "products" มาเรนเดอร์ลงตารางแก้ไขราคา
async function loadBulkProducts() {
    if(!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner animate-spin mr-2"></i>กำลังดาวน์โหลดข้อมูลสินค้าล่าสุดจากคลาวด์...</td></tr>`;
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        allProducts = [];
        const categories = new Set();
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            allProducts.push({ id: doc.id, ...data });
            if (data.category) categories.add(data.category);
        });

        if(categorySelect) {
            categorySelect.innerHTML = `<option value="all">ทุกหมวดหมู่สินค้า</option>`;
            categories.forEach(cat => {
                categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
            });
        }

        renderProductTable(allProducts);
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-400">โหลดข้อมูลล้มเหลว: ${error.message}</td></tr>`;
    }
}

// 4. เรนเดอร์สร้างแถวสินค้า และเปลี่ยนกล่องพิมพ์ส่วนลดให้เป็น Dropdown ตัวเลือกใช้งานง่าย
function renderProductTable(productsList) {
    if(!tableBody) return;
    tableBody.innerHTML = "";
    if(productsList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-500">ไม่พบรายการสินค้าที่ตรงตามเงื่อนไข</td></tr>`;
        return;
    }

    productsList.forEach(p => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-900/40 transition border-b border-slate-800/60 product-row-item";
        tr.setAttribute("data-id", p.id);
        
        let optionsHtml = `<option value="">❌ ไม่มีส่วนลด</option>`;
        let hasCurrentDiscountInPreset = false;
        
        discountPresets.forEach(code => {
            const isSelected = p.discount === code ? "selected" : "";
            if(p.discount === code) hasCurrentDiscountInPreset = true;
            optionsHtml += `<option value="${code}" ${isSelected}>🏷️ ${code}</option>`;
        });

        if(p.discount && !hasCurrentDiscountInPreset) {
            optionsHtml += `<option value="${p.discount}" selected>⚙️ ค่าเดิม: ${p.discount}</option>`;
        }

        tr.innerHTML = `
            <td class="p-4 text-center">
                <input type="checkbox" class="product-bulk-checkbox w-4 h-4 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-cyan-500" data-id="${p.id}">
            </td>
            <td class="p-4 flex items-center gap-3">
                <img src="${p.image || 'https://i.postimg.cc/brG5HJBR/123.jpg'}" class="w-10 h-10 object-cover rounded-lg border border-slate-700 bg-slate-950">
                <div>
                    <div class="font-medium text-slate-200 line-clamp-1">${p.name}</div>
                    <div class="text-xs text-slate-500 mt-0.5"><span class="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700/60">${p.category || 'ไม่มีหมวดหมู่'}</span></div>
                </div>
            </td>
            <td class="p-4">
                <input type="number" class="bulk-price-input w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-500" value="${p.price || 0}" data-id="${p.id}">
            </td>
            <td class="p-4">
                <select class="bulk-discount-input w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-amber-400 font-mono focus:outline-none focus:border-amber-500" id="discount-input-${p.id}">
                    ${optionsHtml}
                </select>
            </td>
            <td class="p-4 text-right">
                <button class="clear-single-discount-btn text-xs px-2 py-1 bg-slate-800 text-slate-400 hover:text-white rounded border border-slate-700 transition" data-id="${p.id}">
                    ล้างค่า
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    document.querySelectorAll(".product-bulk-checkbox").forEach(chk => {
        chk.addEventListener("change", updateSelectedCount);
    });

    document.querySelectorAll(".clear-single-discount-btn").forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.getAttribute("data-id");
            const selectEl = document.getElementById(`discount-input-${id}`);
            if(selectEl) selectEl.value = "";
        };
    });
}

// 5. เรนเดอร์เม็ดรหัสส่วนลดด่วนด้านบน
function renderPresets() {
    if(!presetContainer) return;
    presetContainer.innerHTML = "";
    discountPresets.forEach(code => {
        const wrapper = document.createElement("div");
        wrapper.className = "flex items-center bg-slate-900 rounded-lg border border-slate-800 px-2 py-1 gap-1";
        
        const btn = document.createElement("button");
        btn.className = "text-slate-300 hover:text-amber-400 text-xs font-mono transition flex items-center gap-1";
        btn.innerHTML = `<i class="fa-solid fa-tag text-[10px]"></i> ${code}`;
        btn.onclick = () => {
            const checkedBoxes = document.querySelectorAll(".product-bulk-checkbox:checked");
            if(checkedBoxes.length === 0) {
                alert("กรุณาติ๊กเลือกสินค้าในตารางก่อนกดใส่โค้ดด่วนครับ");
                return;
            }
            checkedBoxes.forEach(chk => {
                const id = chk.getAttribute("data-id");
                const selectEl = document.getElementById(`discount-input-${id}`);
                if(selectEl) selectEl.value = code;
            });
        };
        
        const del = document.createElement("button");
        del.className = "text-slate-600 hover:text-red-400 text-[10px] ml-1 pl-1 border-l border-slate-800";
        del.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
        del.onclick = async () => {
            discountPresets = discountPresets.filter(c => c !== code);
            await setDoc(doc(db, "system_settings", "discount_presets"), { codes: discountPresets });
            renderPresets();
            renderProductTable(allProducts);
        };

        wrapper.appendChild(btn);
        wrapper.appendChild(del);
        presetContainer.appendChild(wrapper);
    });
}

const addBtn = document.getElementById("addCodePresetBtn");
if(addBtn) {
    addBtn.onclick = async () => {
        const val = document.getElementById("newCodeInput").value.trim();
        if(!val || !val.includes("%=")) { alert("กรุณากรอกรูปแบบให้ตรงสูตร เช่น 25%=2000"); return; }
        if(!discountPresets.includes(val)) {
            discountPresets.push(val);
            await setDoc(doc(db, "system_settings", "discount_presets"), { codes: discountPresets });
            renderPresets();
            renderProductTable(allProducts);
        }
        document.getElementById("newCodeInput").value = "";
    };
}

// 6. ระบบค้นหาและการคัดกรองข้อมูล
function setupFilters() {
    const runFilter = () => {
        if(!searchInput || !categorySelect) return;
        const keyword = searchInput.value.toLowerCase().trim();
        const cat = categorySelect.value;
        const filtered = allProducts.filter(p => {
            const matchKey = p.name.toLowerCase().includes(keyword);
            const matchCat = (cat === "all" || p.category === cat);
            return matchKey && matchCat;
        });
        renderProductTable(filtered);
        updateSelectedCount();
    };

    if(searchInput) searchInput.addEventListener("input", runFilter);
    if(categorySelect) categorySelect.addEventListener("change", runFilter);

    if(document.getElementById("selectAllCheckboxBtn")) {
        document.getElementById("selectAllCheckboxBtn").onclick = () => {
            document.querySelectorAll(".product-bulk-checkbox").forEach(c => c.checked = true);
            updateSelectedCount();
        };
    }
    if(document.getElementById("clearAllCheckboxBtn")) {
        document.getElementById("clearAllCheckboxBtn").onclick = () => {
            document.querySelectorAll(".product-bulk-checkbox").forEach(c => c.checked = false);
            updateSelectedCount();
        };
    }
}

// 7. 🧹 ระบบเสริม: ปุ่มล้างค่าส่วนลดแบบกลุ่ม (Clear Discounts System)
function setupGlobalClearButtons() {
    const clearSelectedBtn = document.getElementById("applySelectedDiscountBtn"); 
    const floatingBarActions = clearSelectedBtn ? clearSelectedBtn.parentElement : null;
    
    if (floatingBarActions && !document.getElementById("clearDiscountSelectedBulkBtn")) {
        const clearBulkBtn = document.createElement("button");
        clearBulkBtn.id = "clearDiscountSelectedBulkBtn";
        clearBulkBtn.className = "w-full sm:w-auto px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-xs text-red-400 font-bold border border-red-500/30 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm";
        clearBulkBtn.innerHTML = `<i class="fa-solid fa-trash-can text-[11px]"></i> ล้างส่วนลดสินค้าที่เลือก`;
        
        clearBulkBtn.onclick = () => {
            const checkedBoxes = document.querySelectorAll(".product-bulk-checkbox:checked");
            if (checkedBoxes.length === 0) {
                alert("❌ ไม่สามารถดำเนินการได้: กรุณาติ๊กเลือกเครื่องหมายถูกหน้าสินค้าที่ต้องการล้างค่าส่วนลดก่อนครับ");
                return;
            }
            if (confirm(`🧹 คุณต้องการปรับสถานะส่วนลดสินค้าทั้ง ${checkedBoxes.length} ชิ้นที่เลือก ให้เป็น "ไม่มีส่วนลด" ใช่หรือไม่?`)) {
                checkedBoxes.forEach(chk => {
                    const id = chk.getAttribute("data-id");
                    const selectEl = document.getElementById(`discount-input-${id}`);
                    if (selectEl) selectEl.value = "";
                });
            }
        };
        floatingBarActions.insertBefore(clearBulkBtn, document.getElementById("saveAllBulkChangesBtn"));
    }

    const filterActionsContainer = document.getElementById("clearAllCheckboxBtn") ? document.getElementById("clearAllCheckboxBtn").parentElement : null;
    if (filterActionsContainer && !document.getElementById("clearAllDiscountsInTableBtn")) {
        const clearAllDiscountsBtn = document.createElement("button");
        clearAllDiscountsBtn.id = "clearAllDiscountsInTableBtn";
        clearAllDiscountsBtn.className = "px-3 py-2 bg-red-950/40 hover:bg-red-900/40 text-xs rounded-lg text-red-400 border border-red-900/50 font-medium transition-all ml-2";
        clearAllDiscountsBtn.innerText = "🧹 ล้างส่วนลดทุกชิ้นในตาราง";
        
        clearAllDiscountsBtn.onclick = () => {
            const allSelects = document.querySelectorAll(".bulk-discount-input");
            if (allSelects.length === 0) return;
            
            if (confirm("⚠️ คุณต้องการล้างโค้ดส่วนลดของสินค้าทุกชิ้นในตารางตอนนี้ให้กลายเป็น \"ไม่มีส่วนลด\" ใช่หรือไม่?")) {
                allSelects.forEach(selectEl => { selectEl.value = ""; });
                document.querySelectorAll(".product-bulk-checkbox").forEach(c => c.checked = true);
                updateSelectedCount();
                alert("🧹 ล้างค่าในตารางชั่วคราวแล้ว! ระบบได้ติ๊กถูกเลือกสินค้าทั้งหมดให้คุณแล้ว กรุณากดปุ่มบันทึกใหญ่ด้านล่างเพื่ออัปเดตขึ้นหน้าร้านครับ");
            }
        };
        filterActionsContainer.appendChild(clearAllDiscountsBtn);
    }
}

function updateSelectedCount() {
    const activeChecked = document.querySelectorAll(".product-bulk-checkbox:checked").length;
    if(selectedCountText) selectedCountText.innerText = activeChecked;
}

// 8. 🔥 [อัปเดตแล้ว] ฟังก์ชันคำนวณราคาสินค้าหลังจากหักส่วนลดรูปแบบ X%=Yที่คุณให้มา
function calculateDiscountedPrice(originalPrice, discountString) {
    // ถ้าไม่มีส่วนลด หรือไม่ได้กรอกมา ให้คืนค่าราคาปกติ (ปัดเศษทศนิยมออก)
    if (!discountString || typeof discountString !== 'string' || !discountString.includes('%=')) {
        // หากกรอกเป็นตัวเลขธรรมดา หรือรูปแบบอื่นที่ไม่มี %= ให้ลองลบตามปกติ (เผื่อของเก่า)
        const numericDiscount = parseFloat(discountString);
        if (!isNaN(numericDiscount) && numericDiscount > 0) {
            return Math.max(0, Math.round(originalPrice - numericDiscount));
        }
        return Math.round(originalPrice);
    }

    try {
        // แยก 25% และ 2000 ออกจากกันด้วย %=
        const parts = discountString.split('%=');
        const percent = parseFloat(parts[0]);      // ได้ 25
        const maxDiscount = parseFloat(parts[1]);  // ได้ 2000

        if (isNaN(percent)) return Math.round(originalPrice);

        // คำนวณยอดส่วนลดตามเปอร์เซ็นต์
        let calculatedDiscount = (originalPrice * percent) / 100;

        // ถ้ามีการกำหนดส่วนลดสูงสุด (และคำนวณแล้วเกินค่าสูงสุด) ให้ล็อกไว้ที่ค่าสูงสุด
        if (!isNaN(maxDiscount) && calculatedDiscount > maxDiscount) {
            calculatedDiscount = maxDiscount;
        }

        // คืนค่าราคาปกติลบด้วยส่วนลดที่คำนวณได้ และใช้ Math.round() เพื่อตัดเศษทศนิยมทิ้งทั้งหมด
        const finalPrice = originalPrice - calculatedDiscount;
        return Math.max(0, Math.round(finalPrice)); 
    } catch (error) {
        console.error("Error calculating discount:", error);
        return Math.round(originalPrice); // ปัดเศษราคาปกติเผื่อไว้กรณีเกิด Error
    }
}

// 9. 🚀 ระบบเซฟข้อมูลขึ้นประมวลผลบนเซิร์ฟเวอร์
const saveBtn = document.getElementById("saveAllBulkChangesBtn");
if(saveBtn) {
    saveBtn.onclick = async () => {
        const checkedBoxes = document.querySelectorAll(".product-bulk-checkbox:checked");
        if(checkedBoxes.length === 0) {
            if(!confirm("ยืนยันการบันทึกเฉพาะป้ายหัวข้อแท็บส่วนลดเทศกาลใช่หรือไม่?")) return;
        } else {
            if(!confirm(`ต้องการอัปเดตข้อมูลราคาสินค้าทั้งสิ้น ${checkedBoxes.length} ชิ้นพร้อมกันใช่หรือไม่?`)) return;
        }

        try {
            // บันทึกป้ายโปรโมชัน
            if(promoTabName && promoTabStatus) {
                await setDoc(doc(db, "system_settings", "promo_tab_config"), {
                    title: promoTabName.value.trim() || "ส่วนลดโปร 6.6",
                    active: promoTabStatus.checked,
                    lastUpdate: Date.now()
                });
            }

            // บันทึกราคา/ส่วนลดกลุ่มแบบ Batch ไปที่ Collection "products"
            if(checkedBoxes.length > 0) {
                const batch = writeBatch(db);
                checkedBoxes.forEach(chk => {
                    const id = chk.getAttribute("data-id");
                    const priceInp = document.querySelector(`.bulk-price-input[data-id="${id}"]`);
                    const discountInp = document.getElementById(`discount-input-${id}`);
                    
                    if(priceInp && discountInp) {
                        const rawPrice = Number(priceInp.value) || 0;
                        const rawDiscount = discountInp.value.trim();
                        const computedSalePrice = calculateDiscountedPrice(rawPrice, rawDiscount);
                        
                        const productDocRef = doc(db, "products", id);
                        batch.update(productDocRef, {
                            price: rawPrice,
                            discount: rawDiscount,
                            salePrice: computedSalePrice, // ส่งผลลัพธ์ราคาสุทธิที่หักลดล้างเรียบร้อยไปเก็บบนคลาวด์
                            lastUpdated: Date.now()
                        });
                    }
                });
                await batch.commit();
            }

            // อัปเดตเลขเวอร์ชันคลาวด์เพื่อให้ระบบฝั่ง User รับรู้และล้างแคชทันที
            await setDoc(doc(db, "system_settings", "cloud_version"), { version: Date.now() });

            alert("🚀 อัปเดตราคาใหม่และเคลียร์แคชหน้าร้านให้แสดงผลทันทีเรียบร้อยแล้วครับ!");
            location.reload();
        } catch(err) {
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + err.message);
        }
    };
}