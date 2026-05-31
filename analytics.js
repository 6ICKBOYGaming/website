// analytics.js - โค้ดระบบบันทึกสถิติและคลิกสินค้า โหมดดึงข้อมูลตรง Realtime ล็อกไทม์โซนไทย (Asia/Bangkok)

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
            read: quota.read || 0,
            write: quota.write || 0
        });

        if (typeof window.updateQuotaDOM === 'function') {
            const maxLimit = type === 'read' ? 50000 : 20000;
            window.updateQuotaDOM(type, quota[type], maxLimit);
        }
    } catch (e) {
        console.error("Quota Track Error:", e);
    }
}

// 1. ฟังก์ชันส่งสัญญาณการเข้าชมหน้าเว็บเมื่อโหลดหน้าร้าน
function trackPageView() {
    const viewData = {
        page: window.location.pathname,
        timestamp: new Date().toISOString()
    };
    
    incrementLocalQuota('write', 1);
    window.dispatchEvent(new CustomEvent('storePageView', { detail: viewData }));
}

// 2. ฟังก์ชันส่งสัญญาณยอดกดคลิกปุ่มลิงก์สินค้า
function trackButtonClick(buttonName, productId = null) {
    if (!buttonName) return;
    
    const dateDocId = getThailandDateString();

    const clickData = {
        button: buttonName.trim(),
        productId: productId,
        dateId: dateDocId, 
        page: window.location.pathname,
        timestamp: new Date().toISOString()
    };
    
    incrementLocalQuota('write', 1);
    
    const event = new CustomEvent('storeProductClick', { detail: clickData });
    window.dispatchEvent(event);
    
    console.log(`📢 [Direct Analytics] ยิงข้อมูลเข้าคลาวด์ [${buttonName}] วันที่ล็อกไทย: ${dateDocId}`);
}

// 3. ผูกดักจับ Event ทันทีที่โครงสร้างหน้าเว็บสมบูรณ์
document.addEventListener('DOMContentLoaded', () => {
    trackPageView();
    
    document.body.addEventListener('click', (e) => {
        const buyButton = e.target.closest('.buy-btn') || e.target.closest('[data-id]');
        if (buyButton) {
            const pId = buyButton.getAttribute('data-id');
            const pName = buyButton.getAttribute('data-name') || buyButton.innerText.trim() || 'สินค้าไม่ระบุชื่อ'; 
            if (pId || pName) {
                trackButtonClick(pName, pId);
            }
        }
    });
});

window.trackButtonClick = trackButtonClick;
window.incrementLocalQuota = incrementLocalQuota;