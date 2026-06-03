// click.js - เวอร์ชันเสถียรสูงสุด: เพิ่มเงื่อนไข Coming Soon + เคลียร์ยอดคลิกรายชิ้นผ่านระบบ Memory Overwrite (แก้บั๊กยอดค้าง 100%)
import { getFirestore, doc, updateDoc, increment, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const app = getApp();
const db = getFirestore(app);

// ฟังก์ชันหาคีย์วันที่โซนเวลาไทย (YYYY-MM-DD)
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
    
    try {
        // 1. อัปเดตยอดสะสมรวมตลอดกาลไว้ที่ตัวสินค้าหลัก
        const productDocRef = doc(db, "products", productId);
        await updateDoc(productDocRef, {
            clickCount: increment(1)
        });

        // 2. บันทึกประวัติแยกวันลงคอลเลกชัน analytics โดยใช้ productId เป็นคีย์ฟิลด์
        const analyticsDocRef = doc(db, "analytics", todayStr);
        await setDoc(analyticsDocRef, {
            date: todayStr,
            [`productClicks.${productId}`]: increment(1)
        }, { merge: true });

        console.log(`🎯 [Track Click] บันทึกสำเร็จประจำวันที่ ${todayStr}: ID [${productId}] (${productName}) (+1 คลิก)`);
    } catch (error) {
        console.error("❌ [Track Click] เกิดข้อผิดพลาดในการบันทึกข้อมูล:", error);
    }
}

/**
 * 🔥 ฟังก์ชันล้างยอดคลิกแบบ "เฉพาะชิ้น" (เวอร์ชันแก้ไขบั๊กยอดค้างสำเร็จ 100%)
 * @param {string} productId - รหัสไอดีของสินค้า
 * @param {string} productName - ชื่อของสินค้า
 * @param {string} targetDateStr - วันที่ที่เลือกจากหน้า Analytics (YYYY-MM-DD)
 */
export async function resetProductClick(productId, productName, targetDateStr) {
    if (!productId || !targetDateStr) {
        console.warn("⚠️ ไม่สามารถล้างข้อมูลได้: ข้อมูล productId หรือระบุวันที่ไม่ครบถ้วน");
        return false;
    }

    try {
        const docRef = doc(db, "analytics", targetDateStr);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.log("ℹ️ ไม่พบเอกสารข้อมูลของวันที่ระบุ ไม่จำเป็นต้องเคลียร์");
            return true;
        }

        // ดึงข้อมูลเดิมทั้งหมดของวันนั้นขึ้นมาจัดการใน Javascript เพื่อล้างข้อมูลที่ค้างคา
        let currentData = docSnap.data();

        // คลีนข้อมูลรูปแบบที่ 1: เคลียร์คีย์ที่เป็นฟิลด์ตรงๆ ในรูปแบบ `productClicks.ID` หรือ `productClicks.ชื่อ`
        const directFieldKey1 = `productClicks.${productId}`;
        const directFieldKey2 = productName ? `productClicks.${productName.trim()}` : null;

        if (currentData[directFieldKey1] !== undefined) currentData[directFieldKey1] = 0;
        if (directFieldKey2 && currentData[directFieldKey2] !== undefined) currentData[directFieldKey2] = 0;

        // คลีนข้อมูลรูปแบบที่ 2: เจาะลึกเข้าไปใน Map Object ชื่อ `productClicks` (ถ้ามี)
        if (currentData.productClicks && typeof currentData.productClicks === 'object') {
            // ล้างโดยอิงรหัสสินค้า (ID)
            if (currentData.productClicks[productId] !== undefined) {
                currentData.productClicks[productId] = 0;
            }
            // ล้างโดยอิงชื่อสินค้า (Name) เผื่อสคริปต์เก่าเคยบันทึกไว้
            if (productName && currentData.productClicks[productName.trim()] !== undefined) {
                currentData.productClicks[productName.trim()] = 0;
            }
        }

        // ใช้ setDoc เขียนข้อมูลที่จัดระเบียบและเคลียร์เป็น 0 ใหม่ทับลงไปใน Firestore (ป้องกันการค้างคาของคีย์บั๊ก)
        await setDoc(docRef, currentData);
        
        console.log(`🧹 [Reset Click] เคลียร์ยอดคลิกของ "${productName || productId}" ในวันที่ ${targetDateStr} ให้เป็น 0 สำเร็จแล้ว`);
        return true;
    } catch (error) {
        console.error(`❌ [Reset Click] เกิดข้อผิดพลาดในการล้างข้อมูลยอดคลิก:`, error);
        return false;
    }
}

// ผูกฟังก์ชันนี้ไว้บน window object เพื่อให้หน้า HTML เรียกใช้ข้ามไฟล์สคริปต์ได้สะดวกขึ้น
window.resetProductClick = resetProductClick;

// ระบบดักจับการคลิกบนหน้าเว็บแบบยืดหยุ่นสูง
document.addEventListener("click", (event) => {
    // 1. ค้นหากรอบการ์ดสินค้า (รองรับทั้งคลาส .card, .product-card หรือแท็กที่มี data-id ติดอยู่)
    const cardEl = event.target.closest("[data-id]") || event.target.closest(".card") || event.target.closest(".product-card") || event.target.closest(".admin-draggable");
    if (!cardEl) return;

    const clickedElement = event.target;
    
    // 2. ตรวจสอบเงื่อนไขว่าสิ่งที่คลิกคือ "ปุ่มสั่งซื้อ/ลิงก์ภายนอก" หรือ "รูปภาพสินค้า" หรือไม่
    const anchorLink = clickedElement.closest("a");
    let isBuyButton = false;
    
    // ตรวจสอบลิงก์สั่งซื้อ
    if (anchorLink) {
        const hrefStr = anchorLink.getAttribute("href") || "";
        const classStr = anchorLink.className || "";
        if (
            hrefStr.includes("shopee") || hrefStr.includes("lazada") || 
            classStr.includes("shopee") || classStr.includes("lazada") || classStr.includes("btn")
        ) {
            isBuyButton = true;
        }
    }

    // ตรวจสอบรูปภาพหรือกล่องครอบรูปภาพสินค้า
    const isProductImage = clickedElement.tagName === "IMG" || clickedElement.closest(".product-img") || clickedElement.closest(".card-img-top") || clickedElement.closest(".image-wrapper");

    // ตรวจสอบว่าเป็นรูปภาพที่เป็น Coming Soon หรือกดเข้าลิงก์ไม่ได้หรือไม่
    if (isProductImage) {
        const imgEl = clickedElement.tagName === "IMG" ? clickedElement : clickedElement.querySelector("img");
        const imgSrc = imgEl ? (imgEl.getAttribute("src") || "").toLowerCase() : "";
        const imgAlt = imgEl ? (imgEl.getAttribute("alt") || "").toLowerCase() : "";
        
        let isInvalidLink = false;
        if (anchorLink) {
            const hrefStr = anchorLink.getAttribute("href") || "";
            if (hrefStr === "#" || hrefStr.trim() === "" || hrefStr.startsWith("javascript:")) {
                isInvalidLink = true;
            }
        } else {
            isInvalidLink = true;
        }

        if (imgSrc.includes("coming") || imgSrc.includes("soon") || imgAlt.includes("coming") || imgAlt.includes("soon") || isInvalidLink) {
            console.log("⏭️ [Skip Click] ข้ามการบันทึกเนื่องจากเป็นรูป Coming Soon หรือเป็นลิงก์ที่กดเข้าไม่ได้");
            return; 
        }
    }

    // 3. กระบวนการดึงไอดีและชื่อสินค้าไปบันทึกลงคลาวด์
    if (isBuyButton || isProductImage) {
        let productId = cardEl.getAttribute("data-id");
        if (!productId) {
            const innerDataEl = cardEl.querySelector("[data-id]");
            if (innerDataEl) productId = innerDataEl.getAttribute("data-id");
        }
        
        let productName = "ไม่ระบุชื่อสินค้า";
        const nameHeader = cardEl.querySelector("h4") || cardEl.querySelector("h3") || cardEl.querySelector(".product-name") || cardEl.querySelector(".card-title");
        if (nameHeader) {
            productName = nameHeader.innerText.trim();
        }

        if (productId) {
            trackProductClick(productId, productName);
        } else {
            console.warn("⚠️ ไม่พบรหัสสินค้า (data-id) บนโครงสร้างการ์ดนี้:", cardEl);
        }
    }
});