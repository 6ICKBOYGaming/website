// analytics.js - โค้ดระบบบันทึกสถิติและคลิกสินค้า โหมดดึงข้อมูลตรง Realtime ล็อกไทม์โซนไทย (Asia/Bangkok)
// ปรับปรุงใหม่: นับยอดสะสมรายวันแยกตามวัน (ครบวันรีเซ็ต 0 อัตโนมัติ) + ดูย้อนหลังได้ + จัดการ Top 10

const quotaChannel = new BroadcastChannel('firebase_quota_channel');

function getThailandDateString(dateObj = new Date()) {
    const options = { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const [{ value: month }, , { value: day }, , { value: year }] = formatter.formatToParts(dateObj);
    return `${year}-${month}-${day}`;
}

function incrementLocalQuota(type, count = 1) {
    try {
        const todayStr = getThailandDateString(); 
        let quota = { date: todayStr, read: 0, write: 0 };
        
        const saved = localStorage.getItem('firebase_quota_tracker');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.date === todayStr) {
                quota = parsed;
            }
        }
        
        quota[type] = (quota[type] || 0) + count;
        quota.date = todayStr; 
        localStorage.setItem('firebase_quota_tracker', JSON.stringify(quota));
        
        quotaChannel.postMessage({
            type: 'sync',
            date: todayStr,
            read: quota.read,
            write: quota.write
        });
    } catch (e) {
        console.error("Quota Track Error:", e);
    }
}

// 1. ฟังก์ชันส่งสัญญาณบันทึกการเข้าชมหน้าเว็บรายชั่วโมง (แยกเอกสารตามวันของไทย)
function trackPageView() {
    const now = new Date();
    const tzOffset = 7 * 60 * 60 * 1000; 
    const localTime = new Date(now.getTime() + tzOffset);
    const dateDocId = getThailandDateString(now); 
    const currentHour = localTime.getUTCHours();
    
    const isNewSession = !sessionStorage.getItem("visited_today");
    
    const viewData = {
        dateId: dateDocId,
        hour: currentHour,
        isNewSession: isNewSession,
        timestamp: new Date().toISOString()
    };
    
    if (isNewSession) {
        sessionStorage.setItem("visited_today", "true");
    }
    
    incrementLocalQuota('write', 1);
    window.dispatchEvent(new CustomEvent('storePageView', { detail: viewData }));
}

// 2. ฟังก์ชันส่งสัญญาณยอดกดคลิกปุ่มลิงก์สินค้า (ปรับปรุงแยกนับรายวัน และเก็บย้อนหลังใน Object ของวันนั้น ๆ)
function trackButtonClick(buttonName, productId = null, productName = "สินค้า") {
    if (!buttonName && !productId) return;
    
    const dateDocId = getThailandDateString();

    const clickData = {
        button: buttonName ? buttonName.trim() : "Shopee/Lazada Link",
        productId: productId,
        productName: productName.trim(),
        dateId: dateDocId, 
        page: window.location.pathname,
        timestamp: new Date().toISOString()
    };
    
    incrementLocalQuota('write', 1);
    
    // ยิง Event ให้ฝั่ง Firebase (ใน app.js หรือหน้า analytics.html) ไปบวก increment ในเจาะจง document ของวันนั้น
    const event = new CustomEvent('storeProductClick', { detail: clickData });
    window.dispatchEvent(event);
    
    console.log(`📢 [Analytics Click Tracked] บันทึกยอดคลิกประจำวันย้อนหลังได้ [${productName}] วันที่: ${dateDocId}`);
}

// 3. ผูกดักจับ Event ทันทีเมื่อโหลดหน้าเว็บสำเร็จ
document.addEventListener('DOMContentLoaded', () => {
    trackPageView();
    
    document.body.addEventListener('click', (e) => {
        // ดักจับปุ่มลิงก์สั่งซื้อ ทั้ง Shopee 1, Shopee 2, Lazada
        const buyButton = e.target.closest('.btn.shopee') || e.target.closest('.btn.lazada') || e.target.closest('[onclick*="trackProductClick"]');
        if (buyButton) {
            // ดึงข้อมูล ID สินค้า จาก Context แวดล้อมของการ์ด
            const cardEl = buyButton.closest('.card');
            let pId = null;
            let pName = "ไม่ระบุชื่อสินค้า";
            
            if (cardEl) {
                // พยายามแกะ id สินค้าจากฟังก์ชันคลิก
                const clickAttr = buyButton.getAttribute('onclick') || "";
                const idMatch = clickAttr.match(/'([^']+)'/) || clickAttr.match(/"([^"]+)"/);
                if (idMatch) pId = idMatch[1];
                
                // พยายามดึงชื่อสินค้ามาเก็บเป็น Metadata สำหรับใช้จัดอันดับ Top 10
                const nameHeader = cardEl.querySelector('h4');
                if (nameHeader) pName = nameHeader.innerText.trim();
            }
            
            if (pId) {
                trackButtonClick(buyButton.innerText.trim(), pId, pName);
            }
        }
    });
});