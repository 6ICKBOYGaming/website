// ========================================================
// 1. นำเข้าโมดูลและตั้งค่าระบบคลาวด์ FIREBASE SDK (Modular v9+)
// ========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyClGy52zI0bNpA6wB56rh7Lvwxx3KBUWsk",
  authDomain: "thock-king.firebaseapp.com",
  projectId: "thock-king",
  storageBucket: "thock-king.firebasestorage.app",
  messagingSenderId: "931234133318",
  appId: "1:931234133318:web:9aba538ea482b0b2cca147",
  measurementId: "G-Z3CP7BKC3W"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ========================================================
// 2. ตัวแปรเก็บข้อมูล และการอ้างอิง DOM Elements
// ========================================================
let categories = [];
let products = [];
let selectedCategory = "cat_all";
let hasCategoryOrderChanged = false;
let hasProductOrderChanged = false;

const productGrid = document.getElementById('productGrid');
const adminProductGrid = document.getElementById('adminProductGrid');
const categoryNav = document.getElementById('categoryNav');
const adminCategoryList = document.getElementById('adminCategoryList');
const prodCategorySelect = document.getElementById('prodCategory');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const searchStatus = document.getElementById('searchStatus');

const categoryForm = document.getElementById('categoryForm');
const catIdInput = document.getElementById('catId');
const catNameInput = document.getElementById('catName');
const catSubmitBtn = document.getElementById('catSubmitBtn');
const catCancelBtn = document.getElementById('catCancelBtn');
const catFormTitle = document.getElementById('catFormTitle');
const saveCatOrderBtn = document.getElementById('saveCatOrderBtn');
const saveProdOrderBtn = document.getElementById('saveProdOrderBtn');
const productForm = document.getElementById('productForm');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const formTitle = document.getElementById('formTitle');

// ========================================================
// 3. ฟังก์ชันดึงข้อมูลแบบปลอดภัย (สินค้าไม่มีฟิลด์ order ก็ไม่หาย)
// ========================================================
async function loadInitialData() {
    try {
        // ดึงหมวดหมู่สินค้า
        const catRef = collection(db, "categories");
        const catSnapshot = await getDocs(catRef); 
        
        categories = [{ id: "cat_all", name: "ทั้งหมด ✨" }]; 
        let tempCategories = [];
        catSnapshot.forEach((doc) => {
            tempCategories.push({ id: doc.id, ...doc.data() });
        });
        tempCategories.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        categories = [...categories, ...tempCategories];
        
        renderCategoryNav();
        renderAdminCategoryManager();
        updateProductCategoryDropdown();

        // ดึงสินค้าทั้งหมด (ป้องกันบั๊กกรองสินค้าหาย)
        const prodRef = collection(db, "products");
        const prodSnapshot = await getDocs(prodRef); 
        
        products = [];
        prodSnapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });
        
        products.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
        
        products.forEach((prod, idx) => {
            if (prod.order === undefined) {
                prod.order = idx;
            }
        });
        
        filterAndRenderProducts();
        renderAdminProductGrid();
    } catch (err) {
        console.error("โหลดข้อมูลล้มเหลว:", err);
    }
}

loadInitialData();

// ========================================================
// 4. ระบบจัดการหมวดหมู่สินค้า
// ========================================================
function renderCategoryNav() {
    if (!categoryNav) return;
    categoryNav.innerHTML = '';
    categories.forEach(cat => {
        const tab = document.createElement('div');
        tab.className = `cat-tab ${selectedCategory === cat.id ? 'active' : ''}`;
        tab.innerText = cat.name;
        tab.addEventListener('click', () => {
            selectedCategory = cat.id;
            renderCategoryNav();
            filterAndRenderProducts();
        });
        categoryNav.appendChild(tab);
    });
}

function updateProductCategoryDropdown() {
    if (!prodCategorySelect) return;
    prodCategorySelect.innerHTML = '';
    categories.forEach(cat => {
        if(cat.id !== 'cat_all') {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.innerText = cat.name;
            prodCategorySelect.appendChild(opt);
        }
    });
}

if (categoryForm) {
    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return alert("สิทธิ์ไม่เพียงพอ");
        const id = catIdInput.value;
        const name = catNameInput.value.trim();
        try {
            if(id) {
                await updateDoc(doc(db, "categories", id), { name: name });
                const idx = categories.findIndex(c => c.id === id);
                if(idx !== -1) categories[idx].name = name;
                resetCategoryForm();
            } else {
                const newOrder = categories.length;
                const docRef = await addDoc(collection(db, "categories"), { name: name, order: newOrder });
                categories.push({ id: docRef.id, name: name, order: newOrder });
                categoryForm.reset();
            }
            renderCategoryNav();
            renderAdminCategoryManager();
            updateProductCategoryDropdown();
            filterAndRenderProducts();
        } catch (err) { alert(err.message); }
    });
}

window.moveCategory = function(index, direction) {
    let targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 1 || targetIndex >= categories.length) return;
    const temp = categories[index];
    categories[index] = categories[targetIndex];
    categories[targetIndex] = temp;
    for(let i = 1; i < categories.length; i++) categories[i].order = i;
    hasCategoryOrderChanged = true;
    if (saveCatOrderBtn) saveCatOrderBtn.classList.remove('hidden');
    renderAdminCategoryManager();
};

if (saveCatOrderBtn) {
    saveCatOrderBtn.addEventListener('click', async () => {
        try {
            const batch = writeBatch(db);
            for(let i = 1; i < categories.length; i++) {
                batch.update(doc(db, "categories", categories[i].id), { order: categories[i].order });
            }
            await batch.commit();
            hasCategoryOrderChanged = false;
            saveCatOrderBtn.classList.add('hidden');
            alert("บันทึกลำดับหมวดหมู่เรียบร้อย!");
            renderCategoryNav();
        } catch (err) { alert(err.message); }
    });
}

window.setupEditCategory = function(id) {
    const cat = categories.find(c => c.id === id);
    if(!cat) return;
    catIdInput.value = cat.id;
    catNameInput.value = cat.name;
    catFormTitle.innerText = "📝 กำลังแก้ไขหมวดหมู่: " + cat.name;
    catSubmitBtn.innerText = "แก้ไขชื่อ";
    catCancelBtn.classList.remove('hidden');
};

window.deleteCategory = async function(id, name) {
    if(!confirm(`ต้องการลบหมวดหมู่ "${name}" ?`)) return;
    try {
        await deleteDoc(doc(db, "categories", id));
        categories = categories.filter(c => c.id !== id);
        renderCategoryNav();
        renderAdminCategoryManager();
        updateProductCategoryDropdown();
        filterAndRenderProducts();
    } catch (err) { alert(err.message); }
};

if (catCancelBtn) catCancelBtn.addEventListener('click', resetCategoryForm);
function resetCategoryForm() {
    categoryForm.reset();
    catIdInput.value = '';
    catFormTitle.innerText = "➕ เพิ่มหมวดหมู่สินค้าใหม่";
    catSubmitBtn.innerText = "บันทึก";
    catCancelBtn.classList.add('hidden');
}

function renderAdminCategoryManager() {
    if(!adminCategoryList) return;
    adminCategoryList.innerHTML = '';
    for(let i = 1; i < categories.length; i++) {
        const cat = categories[i];
        const item = document.createElement('div');
        item.className = 'category-manager-item';
        item.innerHTML = `
            <span style="font-weight: 600;">${cat.name}</span>
            <div class="cat-move-btns">
                <button type="button" onclick="window.moveCategory(${i}, 'up')" class="btn btn-primary btn-mini" ${i === 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" onclick="window.moveCategory(${i}, 'down')" class="btn btn-primary btn-mini" ${i === categories.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                <button type="button" onclick="window.setupEditCategory('${cat.id}')" class="btn btn-edit btn-mini"><i class="fa-solid fa-pen"></i></button>
                <button type="button" onclick="window.deleteCategory('${cat.id}', '${cat.name}')" class="btn btn-danger btn-mini"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        `;
        adminCategoryList.appendChild(item);
    }
}

// ========================================================
// 5. ระบบค้นหา
// ========================================================
function filterAndRenderProducts() {
    if (!searchInput) return;
    const queryStr = searchInput.value.trim().toLowerCase();
    if(queryStr.length > 0) clearSearchBtn.classList.remove('hidden');
    else clearSearchBtn.classList.add('hidden');

    const filtered = products.filter(prod => {
        const matchesCategory = (selectedCategory === "cat_all" || prod.category === selectedCategory);
        const nameText = prod.name ? prod.name.toLowerCase() : '';
        const descText = prod.desc ? prod.desc.toLowerCase() : '';
        return matchesCategory && (nameText.includes(queryStr) || descText.includes(queryStr));
    });

    if (queryStr.length > 0) {
        searchStatus.classList.remove('hidden');
        searchStatus.innerHTML = `พบข้อมูลสำหรับคำว่า "<strong>${queryStr}</strong>" ทั้งหมด ${filtered.length} รายการ`;
    } else {
        searchStatus.classList.add('hidden');
    }
    renderProductGrid(filtered);
}

if(clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        filterAndRenderProducts();
    });
}
searchInput.addEventListener('input', filterAndRenderProducts);

// ========================================================
// 6. เรนเดอร์หน้าร้าน (ตรวจสอบราคาตามเงื่อนไข ถูกกว่าลดราคา / แพงกว่าราคาปกติ)
// ========================================================
function renderProductGrid(productsToDisplay) {
    if (!productGrid) return;
    productGrid.innerHTML = '';
    if(productsToDisplay.length === 0) {
        productGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted);">ไม่พบสินค้าในขณะนี้</div>`;
        return;
    }

    productsToDisplay.forEach(prod => {
        // เงื่อนไขตรวจสอบ: ถ้าส่วนลดถูกกว่าราคาปกติ ให้เปิดโหมดลดราคา
        let isDiscountActive = prod.discountPrice && Number(prod.discountPrice) < Number(prod.price);
        
        let priceHTML = isDiscountActive ? `
            <span class="product-price">฿${Number(prod.discountPrice).toLocaleString()}</span>
            <span class="original-price">฿${Number(prod.price).toLocaleString()}</span>
        ` : `<span class="product-price">฿${Number(prod.price).toLocaleString()}</span>`;

        let discountBadge = isDiscountActive ? `
            <div class="discount-badge">ลด ${Math.round(((prod.price - prod.discountPrice) / prod.price) * 100)}%</div>
        ` : '';

        let shopeeHTML = prod.shopee1 && prod.shopee2 ? `
            <a href="${prod.shopee1}" target="_blank" class="btn btn-shopee"><i class="fa-solid fa-arrow-up-right-from-square"></i> Shopee 1</a>
            <a href="${prod.shopee2}" target="_blank" class="btn btn-shopee"><i class="fa-solid fa-arrow-up-right-from-square"></i> Shopee 2</a>
        ` : prod.shopee1 ? `<a href="${prod.shopee1}" target="_blank" class="btn btn-shopee"><i class="fa-solid fa-bag-shopping"></i> Shopee</a>` : '';

        let lazadaHTML = prod.lazada ? `<a href="${prod.lazada}" target="_blank" class="btn btn-lazada"><i class="fa-solid fa-shopping-basket"></i> Lazada</a>` : '';

        let targetLink = prod.shopee1 || prod.lazada || "";
        let hasLink = targetLink !== "";

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            ${discountBadge}
            <${hasLink ? `a href="${targetLink}" target="_blank"` : 'div'} class="product-link-wrapper ${!hasLink ? 'disabled' : ''}">
                <img src="${prod.img}" alt="${prod.name}" class="product-img" onerror="this.src='https://placehold.co/600x400?text=ไม่มีรูปสินค้า'">
            </${hasLink ? 'a' : 'div'}>
            <div class="product-info">
                <h2 class="product-title">${prod.name}</h2>
                <div class="price-container">${priceHTML}</div>
                <p class="product-desc">${prod.desc}</p>
                <div style="display:flex; flex-direction:column; gap:6px; margin-top:auto;">${shopeeHTML}${lazadaHTML}</div>
            </div>
        `;
        productGrid.appendChild(card);
    });
}

// ========================================================
// 7. เพิ่มและแก้ไขสินค้าหน้าแอดมิน (ฟอร์มหลัก)
// ========================================================
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!auth.currentUser) return alert("กรุณาล็อกอินก่อน");
        const id = document.getElementById('productId').value;
        
        let normalPrice = Number(document.getElementById('prodPrice').value);
        let discountPriceInput = document.getElementById('prodDiscountPrice').value;
        let discountPrice = discountPriceInput ? Number(discountPriceInput) : "";

        // ถ้ากรอกราคาส่วนลดมา แต่ดันแพงกว่าหรือเท่ากับราคาปกติ ให้ล้างทิ้งกลับไปเป็นราคาปกติ
        if (discountPrice !== "" && discountPrice >= normalPrice) {
            discountPrice = "";
        }
        
        const productData = {
            name: document.getElementById('prodName').value,
            category: document.getElementById('prodCategory').value,
            img: document.getElementById('prodImg').value,
            price: normalPrice,
            discountPrice: discountPrice,
            desc: document.getElementById('prodDesc').value,
            shopee1: document.getElementById('prodShopee1').value,
            shopee2: document.getElementById('prodShopee2').value,
            lazada: document.getElementById('prodLazada').value,
        };

        try {
            if(id) {
                const idx = products.findIndex(p => p.id === id);
                if(idx !== -1) {
                    productData.order = products[idx].order !== undefined ? products[idx].order : idx;
                    await updateDoc(doc(db, "products", id), productData);
                    products[idx] = { id: id, ...productData };
                }
                resetFormState();
            } else {
                productData.order = products.length; 
                const docRef = await addDoc(collection(db, "products"), productData);
                products.push({ id: docRef.id, ...productData });
            }
            filterAndRenderProducts();
            renderAdminProductGrid();
            productForm.reset();
        } catch (err) { alert(err.message); }
    });
}

window.setupEditProduct = function(id) {
    const prod = products.find(p => p.id === id);
    if(!prod) return;
    document.getElementById('productId').value = prod.id;
    document.getElementById('prodName').value = prod.name;
    document.getElementById('prodCategory').value = prod.category;
    document.getElementById('prodImg').value = prod.img;
    document.getElementById('prodPrice').value = prod.price;
    document.getElementById('prodDiscountPrice').value = prod.discountPrice || '';
    document.getElementById('prodDesc').value = prod.desc;
    document.getElementById('prodShopee1').value = prod.shopee1 || '';
    document.getElementById('prodShopee2').value = prod.shopee2 || '';
    document.getElementById('prodLazada').value = prod.lazada || '';
    formTitle.innerText = "📝 กำลังแก้ไข: " + prod.name;
    cancelEditBtn.classList.remove('hidden');
};

window.deleteProduct = async function(id, name) {
    if(!confirm(`ต้องการลบสินค้า "${name}" ?`)) return;
    try {
        await deleteDoc(doc(db, "products", id));
        products = products.filter(p => p.id !== id);
        products.forEach((p, idx) => p.order = idx);
        filterAndRenderProducts();
        renderAdminProductGrid();
    } catch (err) { alert(err.message); }
};

if (cancelEditBtn) cancelEditBtn.addEventListener('click', resetFormState);
function resetFormState() {
    productForm.reset();
    document.getElementById('productId').value = '';
    formTitle.innerText = "เพิ่มสินค้าใหม่";
    cancelEditBtn.classList.add('hidden');
}

// ========================================================
// 🎯 8. ฟังก์ชันระบบ "ปรับราคาด่วน" เมื่อกดปุ่ม Enter หลังบ้าน
// ========================================================
window.handleQuickPriceUpdate = async function(e, productId) {
    if (e.key !== 'Enter') return; // ทำงานเฉพาะตอนกด Enter เท่านั้น
    e.preventDefault(); 
    
    if (!auth.currentUser) return alert("กรุณาล็อกอินแอดมินก่อนดำเนินการแก้ไขราคา");
    
    const inputField = e.target;
    const newPriceValue = inputField.value.trim();
    
    if (newPriceValue === "" || isNaN(newPriceValue)) {
        return alert("กรุณากรอกตัวเลขราคาที่ถูกต้อง");
    }
    
    const targetPrice = Number(newPriceValue);
    const prodIdx = products.findIndex(p => p.id === productId);
    if (prodIdx === -1) return;
    
    let currentNormalPrice = products[prodIdx].price;
    let updateFields = {};
    
    // 💡 เงื่อนไขตรวจสอบราคาตามสั่ง:
    if (targetPrice < currentNormalPrice) {
        // ถ้าถูกกว่าราคาเดิม ให้ไปเป็นราคาส่วนลด (ตัวเลขใหญ่ขึ้น มีขีดฆ่าที่ราคาเดิม)
        updateFields.discountPrice = targetPrice;
    } else {
        // ถ้าแพงกว่าหรือเท่าเดิม ให้เคลียร์ค่าโปรโมชั่นทิ้ง และอัปเดตตัวแปรราคาปกติแทน
        updateFields.price = targetPrice;
        updateFields.discountPrice = "";
    }
    
    try {
        // ส่งบันทึกขึ้นไปเก็บใน Firebase Firestore ทันที
        await updateDoc(doc(db, "products", productId), updateFields);
        
        // อัปเดตข้อมูลบนโครงสร้างหน่วยความจำฝั่ง Client
        products[prodIdx] = { ...products[prodIdx], ...updateFields };
        
        // สั่งกระตุ้นรีเรนเดอร์ UI อัตโนมัติทั้งหน้าร้านและหลังบ้าน
        filterAndRenderProducts();
        renderAdminProductGrid();
        
        alert(`⚡ ปรับราคาด่วนของ "${products[prodIdx].name}" สำเร็จแล้ว!`);
    } catch (err) {
        alert("ไม่สามารถบันทึกราคาด่วนได้: " + err.message);
    }
};

// ========================================================
// 9. เรนเดอร์ฝั่งหลังบ้านสำหรับ Drag & Drop พร้อมฝังกล่องแก้ราคาด่วน
// ========================================================
function renderAdminProductGrid() {
    if (!adminProductGrid) return;
    adminProductGrid.innerHTML = '';
    
    products.forEach((prod, index) => {
        const catObj = categories.find(c => c.id === prod.category);
        const catName = catObj ? catObj.name : 'ทั่วไป';
        
        let isDiscountActive = prod.discountPrice && Number(prod.discountPrice) < Number(prod.price);
        
        let priceHTML = isDiscountActive ? `
            <span class="product-price">฿${prod.discountPrice}</span>
            <span class="original-price" style="font-size:0.75rem; text-decoration:line-through; color:#475569;">฿${prod.price}</span>
        ` : `<span class="product-price">฿${prod.price}</span>`;

        const card = document.createElement('div');
        card.className = 'product-card';
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-id', prod.id);
        
        card.innerHTML = `
            <div class="drag-indicator"><i class="fa-solid fa-grip-vertical"></i></div>
            <img src="${prod.img}" class="product-img">
            <div class="product-info">
                <span style="font-size:0.7rem; background:rgba(0,242,254,0.1); color:var(--primary); padding:2px 6px; border-radius:4px; width:fit-content; margin-bottom:5px;">${catName}</span>
                <h2 class="product-title" style="font-size:0.9rem;">${prod.name}</h2>
                <div class="price-container">${priceHTML}</div>
                
                <div style="display:flex; gap:6px; margin-top:auto;">
                    <button type="button" onclick="window.setupEditProduct('${prod.id}')" class="btn btn-edit" style="flex:1;"><i class="fa-solid fa-pen-to-square"></i> แก้ไขฟอร์ม</button>
                    <button type="button" onclick="window.deleteProduct('${prod.id}', '${prod.name}')" class="btn btn-danger" style="width:auto;"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                
                <div class="quick-price-box">
                    <label><i class="fa-solid fa-bolt"></i> ปรับราคาด่วน (Enter)</label>
                    <input type="number" 
                           class="quick-price-input" 
                           placeholder="พิมพ์ราคาใหม่..." 
                           value="${isDiscountActive ? prod.discountPrice : prod.price}"
                           onkeydown="window.handleQuickPriceUpdate(event, '${prod.id}')">
                </div>
            </div>
        `;
        
        card.addEventListener('dragstart', () => card.classList.add('dragging'));
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            handleProductReorder();
        });
        adminProductGrid.appendChild(card);
    });
}

if (adminProductGrid) {
    adminProductGrid.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingElement = document.querySelector('.admin-view .product-card.dragging');
        if (!draggingElement) return;
        const siblings = [...adminProductGrid.querySelectorAll('.product-card:not(.dragging)')];
        let nextSibling = siblings.find(sibling => {
            const box = sibling.getBoundingClientRect();
            return e.clientX <= box.left + box.width / 2 && e.clientY <= box.top + box.height / 2;
        });
        if (!nextSibling) adminProductGrid.appendChild(draggingElement);
        else adminProductGrid.insertBefore(draggingElement, nextSibling);
    });
}

function handleProductReorder() {
    const renderedCards = [...adminProductGrid.querySelectorAll('.product-card')];
    const newProductsArray = [];
    renderedCards.forEach((card, newIndex) => {
        const prodId = card.getAttribute('data-id');
        const foundProd = products.find(p => p.id === prodId);
        if (foundProd) newProductsArray.push({ ...foundProd, order: newIndex });
    });
    products = newProductsArray;
    hasProductOrderChanged = true;
    if (saveProdOrderBtn) saveProdOrderBtn.classList.remove('hidden');
}

if (saveProdOrderBtn) {
    saveProdOrderBtn.addEventListener('click', async () => {
        try {
            const batch = writeBatch(db);
            products.forEach(prod => {
                batch.update(doc(db, "products", prod.id), { order: prod.order });
            });
            await batch.commit();
            hasProductOrderChanged = false;
            saveProdOrderBtn.classList.add('hidden');
            alert("บันทึกลำดับสินค้าเรียบร้อย!");
            filterAndRenderProducts();
        } catch (err) { alert(err.message); }
    });
}

// ========================================================
// 10. ระบบความปลอดภัยและการเปิดปิด Modals (Auth)
// ========================================================
const adminBtn = document.getElementById('adminBtn');
const loginModal = document.getElementById('loginModal');
const adminModal = document.getElementById('adminModal');

onAuthStateChanged(auth, (user) => {
    if (!adminBtn) return;
    if (user) {
        adminBtn.innerHTML = `<i class="fa-solid fa-sliders"></i> จัดการร้าน`;
        adminBtn.style.color = "var(--secondary)";
    } else {
        adminBtn.innerHTML = `<i class="fa-solid fa-circle-user"></i> แอดมิน`;
        adminBtn.style.color = "var(--text-main)";
        if (adminModal) adminModal.style.display = 'none'; 
    }
});

if (adminBtn) {
    adminBtn.addEventListener('click', () => {
        if(auth.currentUser) adminModal.style.display = 'block'; 
        else loginModal.style.display = 'block'; 
    });
}

const closeLoginBtn = document.getElementById('closeLogin');
if (closeLoginBtn) {
    closeLoginBtn.addEventListener('click', () => loginModal.style.display = 'none');
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value.trim(); 
        const pass = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            loginModal.style.display = 'none';
            adminModal.style.display = 'block';
            alert("เข้าสู่ระบบแอดมินสำเร็จ!");
        } catch (err) { alert("ข้อมูลเข้าสู่ระบบไม่ถูกต้อง"); }
    });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        adminModal.style.display = 'none';
        alert("ออกจากระบบเรียบร้อย");
    });
}