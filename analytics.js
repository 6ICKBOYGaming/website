// analytics.js - โค้ดฉบับสมบูรณ์พร้อมระบบตรวจจับข้ามวันเพื่อรีเซ็ตค่า ณ เวลา 00:00 น.

function incrementLocalQuota(type, count = 1) {
    try {
        const todayStr = new Date().toLocaleDateString('en-US'); // วันที่ปัจจุบัน "MM/DD/YYYY"
        let quota = { date: todayStr, read: 0, write: 0 };
        
        const saved = localStorage.getItem('firebase_quota_tracker');
        if (saved) {
            const parsed = JSON.parse(saved);
            // 🕒 ตรวจสอบเวลาข้ามเที่ยงคืน: ถ้าวันที่บันทึกไว้ไม่ตรงกับวันนี้ ให้เซ็ทนับใหม่จาก 0 ทันที
            if (parsed.date === todayStr) {
                quota = parsed;
            }
        }
        
        // เพิ่มจำนวนแต้มใช้งานสะสม
        quota[type] = (quota[type] || 0) + count;
        quota.date = todayStr; // ยืนยันกำกับวันที่ใช้งานล่าสุด
        localStorage.setItem('firebase_quota_tracker', JSON.stringify(quota));
        
        // พ่นข้อมูลส่งต่อไปยัง DOM ถ้าฟังก์ชันหน้า Analytics ทำงานอยู่ขณะนั้น
        if (typeof window.updateQuotaDOM === 'function') {
            const maxLimit = type === 'read' ? 50000 : 20000;
            window.updateQuotaDOM(type, quota[type], maxLimit);
        }
    } catch (e) {
        console.error("Quota Track Error:", e);
    }
}

// 1. ฟังก์ชันส่งสัญญาณการเข้าชมหน้าเว็บ 
function trackPageView() {
    const viewData = {
        page: window.location.pathname,
        timestamp: new Date().toISOString()
    };
    
    // บันทึกสถิติการยิงเขียนบันทึกทราฟฟิกลงคลาวด์
    incrementLocalQuota('write', 1);
    window.dispatchEvent(new CustomEvent('storePageView', { detail: viewData }));
}

// 2. ฟังก์ชันส่งสัญญาณเมื่อมีการกดปุ่มลิงก์สั่งซื้อสินค้าต่างๆ
function trackButtonClick(buttonName, productId = null) {
    const clickData = {
        button: buttonName,
        productId: productId,
        page: window.location.pathname,
        timestamp: new Date().toISOString()
    };
    
    // บันทึกแต้มโควตา Write ฝั่งสินค้า
    incrementLocalQuota('write', 1);
    
    const event = new CustomEvent('storeProductClick', { detail: clickData });
    window.dispatchEvent(event);
    console.log(`📢 [Analytics Store] ส่งยอดคลิกปุ่ม [${buttonName}] ไปยังระบบหลัก`);
}

// 3. ผูกคำสั่งรับแรงกด Action บนหน้าจอเมื่อ DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    trackPageView();
    
    document.body.addEventListener('click', (e) => {
        const buyButton = e.target.closest('.buy-btn') || e.target.closest('[data-id]');
        if (buyButton) {
            const pId = buyButton.getAttribute('data-id');
            const pName = buyButton.getAttribute('data-name') || 'ปุ่มสั่งซื้อสินค้า';
            if (pId) {
                trackButtonClick(pName, pId);
            }
        }
    });
});

window.trackButtonClick = trackButtonClick;
window.incrementLocalQuota = incrementLocalQuota;