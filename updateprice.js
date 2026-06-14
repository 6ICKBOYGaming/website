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
let sortByCheckedAsc = false; // ตัวแปรจัดการสลับคัดเรียง (true = เอาตัวที่เลือกขึ้นข้างบน)

const tableBody = document.getElementById("bulkProductTableBody");
const searchInput = document.getElementById("bulkSearchInput");
const categorySelect = document.getElementById("bulkCategorySelect");
const selectedCountText = document.getElementById("selectedCountText");
const promoTabName = document.getElementById("promoTabName");
const promoTabStatus = document.getElementById("promoTabStatus");
const presetContainer = document.getElementById("discountPresetContainer");

// Element ส่วนส่องดูด้านบน
const discountSummaryTableBody = document.getElementById("discountSummaryTableBody");
const bulkApplyDiscountSelect = document.getElementById("bulkApplyDiscountSelect");
const executeBulkApplyDiscountBtn = document.getElementById("executeBulkApplyDiscountBtn");
const inspectCodeSelect = document.getElementById("inspectCodeSelect");
const inspectCountText = document.getElementById("inspectCountText");
const inspectProductList = document.getElementById("inspectProductList");
const checkAllInInspectBtn = document.getElementById("checkAllInInspectBtn");
// 🔥 ฟังก์ชันปุ่มสำหรับเลือกติ๊ก Checkbox เฉพาะสินค้าที่เป็นระบบ MALL ทั้งหมด (เวอร์ชันแก้ไขเพื่อระบบ updateprice)
const selectAllMallBtn = document.getElementById("selectAllMallBtn");
if (selectAllMallBtn) {
    selectAllMallBtn.addEventListener("click", () => {
        let selectedCount = 0;

        allProducts.forEach(prod => {
            // ตรวจสอบสถานะว่าเป็นสินค้า Mall หรือไม่
            if (prod.isMall === true || prod.isMall === "true") {
                prod.is_checked = true; // 🎯 เปลี่ยนเป็น is_checked ให้ตรงกับโครงสร้างของระบบเดิม
                selectedCount++;
                
                // 🎯 ปรับการค้นหา Checkbox บนหน้าจอผ่านคลาสและ data-id ที่ตรงตามโค้ดดั้งเดิมในตาราง
                const checkboxElement = document.querySelector(`.product-bulk-checkbox[data-id="${prod.id}"]`);
                if (checkboxElement) {
                    checkboxElement.checked = true;
                }
            }
        });

        // 🎯 เรียกคำสั่งนับจำนวนและแสดงผลแถบสรุปของระบบเดิมขึ้นหน้าจอทันที
        if (typeof updateSelectedCount === "function") {
            updateSelectedCount();
        }
        
        // บังคับให้ระบบอัปเดตสถิติกราฟและตัวกรองอื่นๆ (ถ้ามี)
        renderDiscountSummary();

        console.log(`🎯 เลือกสินค้า Mall สำเร็จทั้งหมด ${selectedCount} รายการ`);
    });
}
window.addEventListener("DOMContentLoaded", async () => {
    await loadGlobalPromoSettings();
    await loadPresetsFromConfig();
    await loadBulkProducts();
    renderPresets();
    setupFilters();
    setupGlobalClearButtons();
    setupBulkApplyAction();
    setupInspectListener(); 
});

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

async function loadPresetsFromConfig() {
    try {
        const docRef = doc(db, "system_settings", "discount_presets");
        const snap = await getDoc(docRef);
        if(snap.exists() && snap.data().codes) {
            discountPresets = snap.data().codes;
        }
    } catch(e) {}
}

async function loadBulkProducts() {
    if(!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner animate-spin mr-2"></i>กำลังดาวน์โหลดข้อมูลสินค้าล่าสุดจากคลาวด์...</td></tr>`;
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        allProducts = [];
        const categories = new Set();
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            allProducts.push({ id: doc.id, is_checked: false, ...data });
            if (data.category) categories.add(data.category);
        });

        if(categorySelect) {
            categorySelect.innerHTML = `<option value="all">ทุกหมวดหมู่สินค้า</option>`;
            categories.forEach(cat => {
                categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
            });
        }

        renderProductTable(allProducts);
        updateBulkSelectOptions();
        updateInspectSelectOptions(); 
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-400">โหลดข้อมูลล้มเหลว: ${error.message}</td></tr>`;
    }
}

function updateBulkSelectOptions() {
    if(!bulkApplyDiscountSelect) return;
    bulkApplyDiscountSelect.innerHTML = `<option value="">❌ ปรับเป็น: ไม่มีส่วนลด</option>`;
    discountPresets.forEach(code => {
        bulkApplyDiscountSelect.innerHTML += `<option value="${code}" class="bg-slate-900 text-white">🏷️ ${code}</option>`;
    });
}

function updateInspectSelectOptions() {
    if(!inspectCodeSelect) return;
    inspectCodeSelect.innerHTML = `
        <option value="all">🌐 แสดงของโค้ดทุกตัว</option>
        <option value="_none_">❌ สินค้าที่ไม่มีส่วนลด</option>
    `;
    discountPresets.forEach(code => {
        inspectCodeSelect.innerHTML += `<option value="${code}">🏷️ ${code}</option>`;
    });
}

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
                <input type="checkbox" class="product-bulk-checkbox w-4 h-4 rounded text-cyan-500 bg-slate-950 border-slate-700 cursor-pointer focus:ring-0 focus:ring-offset-0" data-id="${p.id}" ${p.is_checked ? 'checked' : ''}>
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

    // ดักจับการทำงานเมื่อมีการกดติ๊กกล่อง Checkbox
    document.querySelectorAll(".product-bulk-checkbox").forEach(chk => {
        chk.addEventListener("change", (e) => {
            const id = e.target.getAttribute("data-id");
            const prod = allProducts.find(p => p.id === id);
            if (prod) {
                prod.is_checked = e.target.checked;
            }
            updateSelectedCount();
        });
    });

    document.querySelectorAll(".bulk-price-input").forEach(inp => {
        inp.addEventListener("input", (e) => {
            const id = e.target.getAttribute("data-id");
            const prod = allProducts.find(p => p.id === id);
            if (prod) prod.price = Number(e.target.value) || 0;
        });
    });

    document.querySelectorAll(".bulk-discount-input").forEach(sel => {
        sel.addEventListener("change", (e) => {
            const id = e.target.id.replace("discount-input-", "");
            const prod = allProducts.find(p => p.id === id);
            if (prod) prod.discount = e.target.value.trim();
            renderDiscountSummary(); 
        });
    });

    document.querySelectorAll(".clear-single-discount-btn").forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.getAttribute("data-id");
            const selectEl = document.getElementById(`discount-input-${id}`);
            if(selectEl) {
                selectEl.value = "";
                const prod = allProducts.find(p => p.id === id);
                if (prod) prod.discount = "";
                renderDiscountSummary();
            }
        };
    });

    updateSelectedCount();
    renderDiscountSummary(); 
}

function renderDiscountSummary() {
    if(!discountSummaryTableBody) return;
    discountSummaryTableBody.innerHTML = "";

    const summary = {};
    summary["_none_"] = { label: "❌ ไม่มีส่วนลด", items: [] };
    discountPresets.forEach(code => {
        summary[code] = { label: `🏷️ ${code}`, items: [] };
    });

    allProducts.forEach(p => {
        const disc = (p.discount || "").trim();
        if(!disc) {
            summary["_none_"].items.push(p);
        } else {
            if(!summary[disc]) {
                summary[disc] = { label: `⚙️ กำหนดเอง: ${disc}`, items: [] };
            }
            summary[disc].items.push(p);
        }
    });

    Object.keys(summary).forEach(key => {
        const group = summary[key];
        if(group.items.length === 0 && key === "_none_") return; 
        if(group.items.length === 0 && !discountPresets.includes(key)) return; 

        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-900/40 border-b border-slate-900 transition cursor-pointer";
        
        if (inspectCodeSelect && inspectCodeSelect.value === key) {
            tr.classList.add("summary-row-active");
        }

        tr.onclick = () => {
            if(inspectCodeSelect) {
                inspectCodeSelect.value = key;
                renderDiscountSummary();
            }
        };
        
        const isNone = key === "_none_";
        const codeClass = isNone ? "text-slate-400 font-medium text-xs" : "text-amber-400 font-bold font-mono text-xs";

        tr.innerHTML = `
            <td class="p-2.5 ${codeClass}">${group.label}</td>
            <td class="p-2.5 text-center text-slate-300 font-bold font-mono bg-slate-900/30">${group.items.length}</td>
        `;
        discountSummaryTableBody.appendChild(tr);
    });

    runInspectFilter(summary);
}

let currentlyInspectedProducts = [];

function runInspectFilter(currentSummaryMap) {
    if(!inspectCodeSelect || !inspectProductList || !inspectCountText) return;
    
    const selectedTarget = inspectCodeSelect.value;
    inspectProductList.innerHTML = "";
    
    currentlyInspectedProducts = [];

    if (selectedTarget === "all") {
        allProducts.forEach(p => {
            if((p.discount || "").trim() !== "") currentlyInspectedProducts.push(p);
        });
    } else if (selectedTarget === "_checked_") {
        currentlyInspectedProducts = allProducts.filter(p => p.is_checked === true);
    } else {
        if(currentSummaryMap && currentSummaryMap[selectedTarget]) {
            currentlyInspectedProducts = currentSummaryMap[selectedTarget].items;
        }
    }

    inspectCountText.innerText = currentlyInspectedProducts.length;

    if(currentlyInspectedProducts.length === 0) {
        inspectProductList.innerHTML = `<li class="p-2 text-slate-500 italic text-center col-span-2">📭 ไม่พบสินค้าที่ตรงตามเงื่อนไขนี้</li>`;
        return;
    }

    currentlyInspectedProducts.forEach((p, index) => {
        const li = document.createElement("li");
        li.className = "py-1 flex justify-between items-center border-b border-slate-900 hover:bg-slate-900/20";
        
        const codeBadge = p.discount ? `text-amber-400 font-mono text-[10px]` : `text-slate-600`;

        li.innerHTML = `
            <span class="truncate pr-2 text-slate-300 text-xs font-medium">${index + 1}. ${p.name}</span>
            <span class="shrink-0 text-[10px] uppercase font-bold ${codeBadge}">${p.discount || "ไม่มีโค้ด"}</span>
        `;
        inspectProductList.appendChild(li);
    });
}

function setupInspectListener() {
    if(inspectCodeSelect) {
        inspectCodeSelect.onchange = () => {
            renderDiscountSummary();
        };
    }

    if(checkAllInInspectBtn) {
        checkAllInInspectBtn.onclick = () => {
            if (currentlyInspectedProducts.length === 0) {
                alert("❌ ไม่มีสินค้าในลิสต์กลุ่มโค้ดส่วนลดนี้ให้เลือกครับ");
                return;
            }

            allProducts.forEach(p => p.is_checked = false);
            currentlyInspectedProducts.forEach(inspectedProd => {
                const prod = allProducts.find(p => p.id === inspectedProd.id);
                if (prod) prod.is_checked = true;
            });

            syncCurrentChangesToState();
            runCurrentFilter();
            
            document.getElementById("bulkSearchInput").scrollIntoView({ behavior: 'smooth' });
            alert(`✅ ทำการเลือกกลุ่มสินค้าจำนวน ${currentlyInspectedProducts.length} ชิ้นในตารางให้เรียบร้อยแล้วครับ!`);
        };
    }
}

function setupBulkApplyAction() {
    if(!executeBulkApplyDiscountBtn) return;
    
    executeBulkApplyDiscountBtn.onclick = () => {
        syncCurrentChangesToState();
        
        const selectedProducts = allProducts.filter(p => p.is_checked === true);
        if(selectedProducts.length === 0) {
            alert("❌ กรุณากดเลือกหน้าสินค้าที่ต้องการเปลี่ยนโค้ดกลุ่มในตารางก่อนครับ!");
            return;
        }

        const targetDiscount = bulkApplyDiscountSelect.value;
        const targetLabel = targetDiscount ? `"${targetDiscount}"` : `"ไม่มีส่วนลด"`;

        if(confirm(`🔮 คุณต้องการเปลี่ยนโค้ดส่วนลดของสินค้าที่เลือกทั้ง ${selectedProducts.length} รายการ ให้เป็น ${targetLabel} พร้อมกันหรือไม่?`)) {
            selectedProducts.forEach(prod => {
                prod.discount = targetDiscount;
                const element = document.getElementById(`discount-input-${prod.id}`);
                if(element) element.value = targetDiscount;
            });

            renderDiscountSummary();
            alert(`⚡ อัปเดตค่าชั่วคราวบนหน้าจอสำเร็จแล้ว! อย่าลืมกดปุ่ม "บันทึกข้อมูลเปลี่ยนแหลงทั้งเว็บทันที" ด้านล่างด้วยครับ`);
        }
    };
}

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
            const selectedItems = allProducts.filter(p => p.is_checked === true);
            if(selectedItems.length === 0) {
                alert("กรุณาเลือกสินค้าในตารางก่อนกดใส่โค้ดด่วนครับ");
                return;
            }
            selectedItems.forEach(prod => {
                prod.discount = code;
                const selectEl = document.getElementById(`discount-input-${prod.id}`);
                if(selectEl) selectEl.value = code;
            });
            renderDiscountSummary();
        };
        
        const del = document.createElement("button");
        del.className = "text-slate-600 hover:text-red-400 text-[10px] ml-1 pl-1 border-l border-slate-800";
        del.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
        del.onclick = async () => {
            discountPresets = discountPresets.filter(c => c !== code);
            await setDoc(doc(db, "system_settings", "discount_presets"), { codes: discountPresets });
            renderPresets();
            updateBulkSelectOptions();
            updateInspectSelectOptions();
            syncCurrentChangesToState();
            runCurrentFilter();
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
            updateBulkSelectOptions();
            updateInspectSelectOptions();
            syncCurrentChangesToState();
            runCurrentFilter();
        }
        document.getElementById("newCodeInput").value = "";
    };
}

function syncCurrentChangesToState() {
    const rows = document.querySelectorAll(".product-row-item");
    rows.forEach(row => {
        const id = row.getAttribute("data-id");
        const priceInp = row.querySelector(".bulk-price-input");
        const discountInp = document.getElementById(`discount-input-${id}`);

        const prod = allProducts.find(p => p.id === id);
        if (prod) {
            if (priceInp) prod.price = Number(priceInp.value) || 0;
            if (discountInp) prod.discount = discountInp.value.trim();
        }
    });
}

function runCurrentFilter() {
    if(!searchInput || !categorySelect) return;
    const keyword = searchInput.value.toLowerCase().trim();
    const cat = categorySelect.value;
    
    // คัดกรองคำค้นหาและหมวดหมู่ปกติ
    let filtered = allProducts.filter(p => {
        const matchKey = p.name.toLowerCase().includes(keyword);
        const matchCat = (cat === "all" || p.category === cat);
        return matchKey && matchCat;
    });

    // เงื่อนไขเรียงลำดับ: หากกดเปิดสถานะไว้ ให้ผลลัพธ์ของสินค้าที่ถูก 'is_checked = true' ขยับขึ้นบนสุด
    if (sortByCheckedAsc) {
        filtered.sort((a, b) => {
            return (b.is_checked === true ? 1 : 0) - (a.is_checked === true ? 1 : 0);
        });
    }

    renderProductTable(filtered);
}

function setupFilters() {
    const filterHandler = () => {
        syncCurrentChangesToState();
        runCurrentFilter();
    };

    if(searchInput) searchInput.addEventListener("input", filterHandler);
    if(categorySelect) categorySelect.addEventListener("change", filterHandler);

    // ดึง Element ปุ่มหัวตาราง "เลือก" เพื่อทำคำสั่งสลับจัดเรียงเมื่อโดนคลิก
    const thSelectSortBtn = document.getElementById("thSelectSortBtn");
    if (thSelectSortBtn) {
        thSelectSortBtn.onclick = () => {
            syncCurrentChangesToState();
            sortByCheckedAsc = !sortByCheckedAsc; // สลับโหมดทรู/ฟอลส์

            if (sortByCheckedAsc) {
                thSelectSortBtn.innerHTML = `เลือก <i class="fa-solid fa-sort-up text-cyan-400 ml-0.5"></i>`;
            } else {
                thSelectSortBtn.innerHTML = `เลือก <i class="fa-solid fa-sort-down text-slate-400 ml-0.5"></i>`;
            }
            runCurrentFilter();
        };
    }

    if(document.getElementById("selectAllCheckboxBtn")) {
        document.getElementById("selectAllCheckboxBtn").onclick = () => {
            allProducts.forEach(p => p.is_checked = true);
            syncCurrentChangesToState();
            runCurrentFilter();
        };
    }
    if(document.getElementById("clearAllCheckboxBtn")) {
        document.getElementById("clearAllCheckboxBtn").onclick = () => {
            allProducts.forEach(p => p.is_checked = false);
            syncCurrentChangesToState();
            runCurrentFilter();
        };
    }
}

function setupGlobalClearButtons() {
    const clearSelectedBtn = document.getElementById("applySelectedDiscountBtn"); 
    const floatingBarActions = clearSelectedBtn ? clearSelectedBtn.parentElement : null;
    
    if (floatingBarActions && !document.getElementById("clearDiscountSelectedBulkBtn")) {
        const clearBulkBtn = document.createElement("button");
        clearBulkBtn.id = "clearDiscountSelectedBulkBtn";
        clearBulkBtn.className = "w-full sm:w-auto px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-xs text-red-400 font-bold border border-red-500/30 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm";
        clearBulkBtn.innerHTML = `<i class="fa-solid fa-trash-can text-[11px]"></i> ล้างส่วนลดสินค้าที่เลือก`;
        
        clearBulkBtn.onclick = () => {
            const selectedItems = allProducts.filter(p => p.is_checked === true);
            if (selectedItems.length === 0) {
                alert("❌ ไม่สามารถดำเนินการได้: กรุณาเลือกสินค้าที่ต้องการล้างค่าส่วนลดในตารางก่อนครับ");
                return;
            }
            if (confirm(`🧹 คุณต้องการปรับสถานะส่วนลดสินค้าทั้ง ${selectedItems.length} ชิ้นที่เลือก ให้เป็น "ไม่มีส่วนลด" ใช่หรือไม่?`)) {
                selectedItems.forEach(prod => {
                    prod.discount = "";
                    const selectEl = document.getElementById(`discount-input-${prod.id}`);
                    if (selectEl) selectEl.value = "";
                });
                renderDiscountSummary();
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
                allSelects.forEach(selectEl => { 
                    selectEl.value = ""; 
                    const id = selectEl.id.replace("discount-input-", "");
                    const prod = allProducts.find(p => p.id === id);
                    if (prod) prod.discount = "";
                });
                
                allProducts.forEach(p => p.is_checked = true);
                
                updateSelectedCount();
                renderDiscountSummary();
                runCurrentFilter();
                alert("🧹 ล้างค่าในตารางชั่วคราวแล้ว! ระบบได้เลือกสินค้าทั้งหมดให้คุณแล้ว กรุณากดปุ่มบันทึกใหญ่ด้านล่างเพื่ออัปเดตขึ้นหน้าร้านครับ");
            }
        };
        filterActionsContainer.appendChild(clearAllDiscountsBtn);
    }
}

function updateSelectedCount() {
    const activeChecked = allProducts.filter(p => p.is_checked === true).length;
    if(selectedCountText) selectedCountText.innerText = activeChecked;
}

function calculateDiscountedPrice(originalPrice, discountString) {
    if (!discountString || typeof discountString !== 'string' || !discountString.includes('%=')) {
        const numericDiscount = parseFloat(discountString);
        if (!isNaN(numericDiscount) && numericDiscount > 0) {
            return Math.max(0, Math.round(originalPrice - numericDiscount));
        }
        return Math.round(originalPrice);
    }

    try {
        const parts = discountString.split('%=');
        const percent = parseFloat(parts[0]);      
        const maxDiscount = parseFloat(parts[1]);  

        if (isNaN(percent)) return Math.round(originalPrice);

        let calculatedDiscount = (originalPrice * percent) / 100;

        if (!isNaN(maxDiscount) && calculatedDiscount > maxDiscount) {
            calculatedDiscount = maxDiscount;
        }

        const finalPrice = originalPrice - calculatedDiscount;
        return Math.max(0, Math.round(finalPrice)); 
    } catch (error) {
        console.error("Error calculated discount:", error);
        return Math.round(originalPrice); 
    }
}

const saveBtn = document.getElementById("saveAllBulkChangesBtn");
if(saveBtn) {
    saveBtn.onclick = async () => {
        syncCurrentChangesToState();

        const checkedProducts = allProducts.filter(p => p.is_checked === true);

        if(checkedProducts.length === 0) {
            if(!confirm("ยืนยันการบันทึกเฉพาะป้ายหัวข้อแท็บส่วนลดเทศกาลใช่หรือไม่?")) return;
        } else {
            if(!confirm(`ต้องการอัปเดตข้อมูลราคาสินค้าทั้งสิ้น ${checkedProducts.length} ชิ้นพร้อมกันใช่หรือไม่?`)) return;
        }

        try {
            if(promoTabName && promoTabStatus) {
                await setDoc(doc(db, "system_settings", "promo_tab_config"), {
                    title: promoTabName.value.trim() || "ส่วนลดโปร 6.6",
                    active: promoTabStatus.checked,
                    lastUpdate: Date.now()
                });
            }

            if(checkedProducts.length > 0) {
                const batch = writeBatch(db);
                checkedProducts.forEach(prod => {
                    const rawPrice = Number(prod.price) || 0;
                    const rawDiscount = (prod.discount || "").trim();
                    const computedSalePrice = calculateDiscountedPrice(rawPrice, rawDiscount);
                    
                    const productDocRef = doc(db, "products", prod.id);
                    batch.update(productDocRef, {
                        price: rawPrice,
                        discount: rawDiscount,
                        salePrice: computedSalePrice, 
                        lastUpdated: Date.now()
                    });
                });
                await batch.commit();
            }

            await setDoc(doc(db, "system_settings", "cloud_version"), { version: Date.now() });

            alert("🚀 อัปเดตราคาใหม่และเคลียร์แคชหน้าร้านให้แสดงผลทันทีเรียบร้อยแล้วครับ!");
            location.reload();
        } catch(err) {
            alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + err.message);
        }
    };
}