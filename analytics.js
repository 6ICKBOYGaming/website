// analytics.js - โค้ดระบบบันทึกสถิติการเข้าชมหน้าเว็บ โหมดดึงข้อมูลตรง Realtime ล็อกไทม์โซนไทย (Asia/Bangkok)
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