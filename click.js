// click.js - เวอร์ชันแก้บั๊กไม่โหลดสคริปต์ + ระบบบันทึกข้ามวันใหม่เสถียร 100%
import { getFirestore, doc, updateDoc, increment, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const app = getApp();
const db = getFirestore(app);

// พิมพ์แจ้งเตือนทันทีที่ไฟล์นี้ถูกโหลดสำเร็จ
console.log("✅ [Click System] สคริปต์ click.js ได้รับการโหลดเข้าสู่ระบบเรียบร้อยแล้ว!");

function getThailandDateKey(dateObj = new Date()) {
    const options = { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const [{ value: month }, , { value: day }, , { value: year }] = formatter.formatToParts(dateObj);
    return `${year}-${month}-${day}`;
}

/**
 * ฟังก์ชันบันทึกยอดคลิกสินค้า
 */
async function trackProductClick(productId, productName) {
    if (!productId) return;
    const todayStr = getThailandDateKey();
    console.log(`📡 [Firebase Call] กำลังส่งยอดคลิกสินค้าไปยังฐานข้อมูลของวันที่: ${todayStr}`);
    
    // 1. อัปเดตยอดสะสมรวมที่ตัวสินค้าหลัก
    try {
        const productDocRef = doc(db, "products", productId);
        await updateDoc(productDocRef, { clickCount: increment(1) });
    } catch (e) {
        try {
            const productDocRef = doc(db, "products", productId);
            await setDoc(productDocRef, { clickCount: 1 }, { merge: true });
        } catch(err) {
            console.error("❌ ไม่สามารถบันทึกยอดรวมที่ตัวสินค้าหลักได้:", err);
        }
    }

    // 2. บันทึกประวัติแยกวันลงคอลเลกชัน analytics (ป้องกันบั๊กวันใหม่เปลี่ยนรูปแบบ Type)
    try {
        const analyticsDocRef = doc(db, "analytics", todayStr);
        const docSnap = await getDoc(analyticsDocRef);
        
        if (docSnap.exists()) {
            const currentData = docSnap.data();
            if (currentData.productClicks && typeof currentData.productClicks === 'object') {
                await updateDoc(analyticsDocRef, {
                    [`productClicks.${productId}`]: increment(1)
                });
            } else {
                let productClicksMap = typeof currentData.productClicks === 'object' ? currentData.productClicks : {};
                productClicksMap[productId] = (productClicksMap[productId] || 0) + 1;
                await setDoc(analyticsDocRef, { date: todayStr, productClicks: productClicksMap }, { merge: true });
            }
        } else {
            // วันใหม่แกะกล่อง -> สร้าง Map โครงสร้างเริ่มต้นส่งไปทันที
            await setDoc(analyticsDocRef, {
                date: todayStr,
                productClicks: { [productId]: 1 }
            }, { merge: true });
        }
        console.log(`🎉 [Success] บันทึกยอดคลิกสำเร็จประจำวันที่ ${todayStr} (สินค้า: ${productName})`);
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการบันทึกสถิติรายวัน:", error);
    }
}

/**
 * ฟังก์ชันล้างยอดคลิกประจำวัน
 */
export async function resetProductClick(productId, productName, targetDateStr) {
    if (!productId || !targetDateStr) return false;
    try {
        const docRef = doc(db, "analytics", targetDateStr);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return true;

        let currentData = docSnap.data();
        const directFieldKey1 = `productClicks.${productId}`;
        if (currentData[directFieldKey1] !== undefined) currentData[directFieldKey1] = 0;

        if (currentData.productClicks && typeof currentData.productClicks === 'object') {
            if (currentData.productClicks[productId] !== undefined) currentData.productClicks[productId] = 0;
        }
        await setDoc(docRef, currentData);
        return true;
    } catch (error) {
        console.error(`❌ [Reset Click] พัง:`, error);
        return false;
    }
}

window.resetProductClick = resetProductClick;

// ฟังก์ชันหลักดักจับสิทธิ์การคลิก
function initializeClickTracker() {
    document.addEventListener("click", (event) => {
        // ค้นหากรอบการ์ดสินค้า
        const cardEl = event.target.closest("[data-id]") || event.target.closest(".card") || event.target.closest(".product-card") || event.target.closest(".admin-draggable") || event.target.closest("[data-product-id]");
        if (!cardEl) return;

        const clickedElement = event.target;
        const anchorLink = clickedElement.closest("a");
        let isBuyButton = false;
        
        if (anchorLink) {
            const hrefStr = anchorLink.getAttribute("href") || "";
            const classStr = anchorLink.className || "";
            if (hrefStr.includes("shopee") || hrefStr.includes("lazada") || classStr.includes("shopee") || classStr.includes("lazada") || classStr.includes("btn") || classStr.includes("buy")) {
                isBuyButton = true;
            }
        }

        const isProductImage = clickedElement.tagName === "IMG" || clickedElement.closest(".product-img") || clickedElement.closest(".card-img-top") || clickedElement.closest(".image-wrapper");

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
                console.log(`🎯 [Clicked] ผู้ใช้คลิกสินค้า: "${productName}" (ID: ${productId})`);
                trackProductClick(productId, productName);
            } else {
                console.warn("⚠️ [Click Warning] ตรวจพบการคลิกสินค้า แต่การ์ดไม่มีคุณสมบัติ data-id");
            }
        }
    });
}

// สั่งให้ระบบทำงานทันที
initializeClickTracker();