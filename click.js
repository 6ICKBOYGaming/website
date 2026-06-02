// click.js - เวอร์ชันเสถียรสูงสุด: ปรับปรุง Selector ดักจับการคลิกให้ยืดหยุ่น ครอบคลุมทุกการ์ดสินค้าและทุกลิงก์
import { getFirestore, doc, updateDoc, increment, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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

// ระบบดักจับการคลิกบนหน้าเว็บแบบยืดหยุ่นสูง
document.addEventListener("click", (event) => {
    // 1. ค้นหากรอบการ์ดสินค้า (รองรับทั้งคลาส .card, .product-card หรือแท็กที่มี data-id ติดอยู่)
    const cardEl = event.target.closest("[data-id]") || event.target.closest(".card") || event.target.closest(".product-card") || event.target.closest(".admin-draggable");
    if (!cardEl) return;

    const clickedElement = event.target;
    
    // 2. ตรวจสอบเงื่อนไขว่าสิ่งที่คลิกคือ "ปุ่มสั่งซื้อ/ลิงก์ภายนอก" หรือ "รูปภาพสินค้า" หรือไม่
    // ตรวจสอบลิงก์สั่งซื้อ (ดักจับคำว่า shopee, lazada จากคลาส หรือจาก href ปลายทางโดยตรงเพื่อความชัวร์)
    const anchorLink = clickedElement.closest("a");
    let isBuyButton = false;
    
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

    // 3. ถ้าเข้าเงื่อนไข ให้ทำกระบวนการดึงไอดีและชื่อสินค้าไปบันทึกลงคลาวด์
    if (isBuyButton || isProductImage) {
        // ดึงไอดีสินค้า (ค้นหาไล่ระดับจากจุดที่มี data-id เผื่อสคริปต์หน้าแรกแปะไว้คนละชั้น)
        let productId = cardEl.getAttribute("data-id");
        if (!productId) {
            const innerDataEl = cardEl.querySelector("[data-id]");
            if (innerDataEl) productId = innerDataEl.getAttribute("data-id");
        }
        
        // ดึงชื่อสินค้าแบบเผื่อหลาย Selector
        let productName = "ไม่ระบุชื่อสินค้า";
        const nameHeader = cardEl.querySelector("h4") || cardEl.querySelector("h3") || cardEl.querySelector(".product-name") || cardEl.querySelector(".card-title");
        if (nameHeader) {
            productName = nameHeader.innerText.trim();
        }

        if (productId) {
            // สั่งบันทึกยอดคลิกทันที
            trackProductClick(productId, productName);
        } else {
            console.warn("⚠️ ไม่พบรหัสสินค้า (data-id) บนโครงสร้างการ์ดนี้:", cardEl);
        }
    }
});