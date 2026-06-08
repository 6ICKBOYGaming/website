import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  writeBatch 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔥 ใช้ชุดการเชื่อมต่อเดียวกันกับไฟล์หลักของคุณ
const firebaseConfig = {
    apiKey: "AIzaSyBEBVjahmE6BMGPglrHRdbktLI9mQKZTls",
    authDomain: "ickboy-store.firebaseapp.com",
    projectId: "ickboy-store",
    storageBucket: "ickboy-store.firebasestorage.app",
    messagingSenderId: "532385576489",
    appId: "1:532385"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let localProducts = [];

const productTableBody = document.getElementById("productTableBody");
const filterCategory = document.getElementById("filterCategory");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const newKeywordsInput = document.getElementById("newKeywordsInput");
const bulkUpdateBtn = document.getElementById("bulkUpdateBtn");
const selectedCountText = document.getElementById("selectedCountText");

// โหลดข้อมูลสินค้า
async function loadProductsData() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        localProducts = [];
        const categories = new Set();

        querySnapshot.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            localProducts.push({ id: docSnapshot.id, ...data });
            if (data.category) categories.add(data.category);
        });

        filterCategory.innerHTML = '<option value="ทั้งหมด">ทั้งหมด (แสดงทุกหมวดหมู่)</option>';
        categories.forEach(cat => {
            filterCategory.innerHTML += `<option value="${cat}">${cat}</option>`;
        });

        renderTable();
    } catch (error) {
        alert("โหลดข้อมูลผิดพลาด: " + error.message);
    }
}

// เรนเดอร์ตารางสินค้า
function renderTable() {
    const selectedCat = filterCategory.value;
    const filtered = localProducts.filter(p => selectedCat === "ทั้งหมด" || p.category === selectedCat);

    if (filtered.length === 0) {
        productTableBody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-slate-500">❌ ไม่พบสินค้าในระบบ</td></tr>`;
        return;
    }

    productTableBody.innerHTML = filtered.map(p => `
        <tr class="hover:bg-slate-700/30 transition">
            <td class="p-4 text-center">
                <input type="checkbox" value="${p.id}" class="product-select-item w-4 h-4 rounded accent-amber-500 cursor-pointer">
            </td>
            <td class="p-4 flex items-center gap-3">
                <img src="${p.image || 'https://via.placeholder.com/40'}" class="w-10 h-10 object-cover rounded bg-slate-900 border border-slate-700" onerror="this.src='https://via.placeholder.com/40'">
                <div>
                    <div class="font-medium text-slate-200">${p.name}</div>
                    <div class="text-xs text-slate-500">${p.comingSoon ? '⏳ Coming Soon...' : '💰 ฿' + p.price}</div>
                </div>
            </td>
            <td class="p-4"><span class="px-2 py-1 bg-slate-900 text-slate-400 rounded-md text-xs">${p.category || 'ไม่มี'}</span></td>
            <td class="p-4 text-slate-300 font-mono text-xs">${p.keywords || '<span class="text-slate-600">ไม่มีคีย์เวิร์ด</span>'}</td>
        </tr>
    `).join("");

    selectAllCheckbox.checked = false;
    updateSelectedCount();
    bindRowEvents();
}

function bindRowEvents() {
    const checkboxes = document.querySelectorAll(".product-select-item");
    checkboxes.forEach(cb => {
        cb.addEventListener("change", updateSelectedCount);
    });
}

function updateSelectedCount() {
    const checkedCount = document.querySelectorAll(".product-select-item:checked").length;
    selectedCountText.innerText = `เลือกสินค้าไว้ทั้งหมด ${checkedCount} ชิ้น`;
}

selectAllCheckbox.addEventListener("change", (e) => {
    const checkboxes = document.querySelectorAll(".product-select-item");
    checkboxes.forEach(cb => {
        cb.checked = e.target.checked;
    });
    updateSelectedCount();
});

filterCategory.addEventListener("change", renderTable);

// ฟังก์ชันสั่งอัปเดตข้อมูลแบบกลุ่ม (Bulk Update)
bulkUpdateBtn.addEventListener("click", async () => {
    const selectedCheckboxes = document.querySelectorAll(".product-select-item:checked");
    const newKeywords = newKeywordsInput.value.trim();

    if (selectedCheckboxes.length === 0) {
        alert("⚠️ กรุณาเลือกสินค้าอย่างน้อย 1 ชิ้นเพื่อทำการอัปเดตครับ");
        return;
    }
    if (!newKeywords) {
        alert("⚠️ กรุณากรอกคีย์เวิร์ดใหม่ลงในกล่องข้อความก่อนครับ");
        return;
    }

    if (!confirm(`คุณต้องการเปลี่ยนคีย์เวิร์ดของสินค้าที่เลือกทั้ง ${selectedCheckboxes.length} ชิ้น เป็น "${newKeywords}" ใช่หรือไม่?`)) {
        return;
    }

    try {
        bulkUpdateBtn.disabled = true;
        bulkUpdateBtn.innerText = "⏳ กำลังบันทึกข้อมูล...";

        const batch = writeBatch(db);
        
        selectedCheckboxes.forEach(cb => {
            const productDocRef = doc(db, "products", cb.value);
            batch.update(productDocRef, {
                keywords: newKeywords,
                lastUpdated: Date.now()
            });
        });

        await batch.commit();

        // สั่งเคลียร์และอัปเดต Cache ของระบบหลังบ้านเพื่ออัปเดตเวอร์ชันข้อมูลสดใหม่บนคลาวด์
        try {
            const versionRef = doc(db, "settings", "cacheVersion");
            await updateDoc(versionRef, { version: Math.floor(Date.now() / 1000) });
        } catch(e) {}

        alert("🎉 เปลี่ยนแปลงคีย์เวิร์ดสินค้าทั้งหมดเรียบร้อยแล้ว!");
        newKeywordsInput.value = "";
        await loadProductsData();
    } catch (error) {
        alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
        bulkUpdateBtn.disabled = false;
        bulkUpdateBtn.innerText = "🚀 อัปเดตพร้อมกัน";
    }
});

// รันคำสั่งทันทีที่เปิดหน้าเว็บ
loadProductsData();