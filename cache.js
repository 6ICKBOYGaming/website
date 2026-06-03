/**
 * =========================================================================
 * 📦 SYSTEM: Cross-Platform Ultra-Stable Cache Manager with 4-Hour TTL (cache.js)
 * 🖥️ Supporting: Desktop Browsers (Chrome, Edge, Firefox, Safari)
 * 📱 Supporting: Mobile Browsers (iOS Safari, Android Chrome, LINE/FB In-App)
 * ⏳ Cache Lifespan: บังคับล้างแคชเก่าในเครื่องทันทีหากเกิน 4 ชั่วโมง (4 Hours TTL)
 * การันตี: ประหยัด Read สูงสุด, อัปเดตทันทีเมื่อ Refresh, เคลียร์สินค้าค้างของลูกค้าเก่า 100%
 * =========================================================================
 */

const CACHE_KEYS = {
  PRODUCTS: "ickboy_products_cache",
  CATEGORIES: "ickboy_categories_cache",
  CONSOLE_CATEGORIES: "ickboy_console_categories_cache", // 🔥 คีย์สำหรับเก็บหน่วยความจำแคชหมวดหมู่คอนโซล
  WIDGET: "ickboy_widget_cache",
  VERSION: "ickboy_data_version",
  TIMESTAMP: "ickboy_cache_timestamp" 
};

// กำหนดอายุของแคชสูงสุด: 4 ชั่วโมง (4 * 60 * 60 * 1000 มิลลิวินาที)
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

/**
 * 📥 ดึงข้อมูลผ่านระบบตรวจสอบแคชอัจฉริยะ (จำกัดอายุแคช 4 ชั่วโมง + ตรวจจับความสดใหม่)
 * @param {Firestore} db - อินสแตนซ์ของ Firestore
 * @param {Function} fetchLiveDocs - ฟังก์ชันดึงข้อมูลสดจาก Cloud (จาก app.js)
 * @param {boolean} isAdmin - สถานะแอดมิน (บังคับดึงสดเสมอ)
 */
export async function getSmartCachedData(db, fetchLiveDocs, isAdmin = false) {
  // 1. โหมดแอดมิน: ดึงข้อมูลสดจาก Cloud เสมอ ไม่ผ่านและไม่บันทึกแคช
  if (isAdmin) {
    console.log("👑 [Cache] โหมดแอดมิน: ดึงข้อมูลสดตรงจาก Cloud 100%");
    return await fetchLiveDocs();
  }

  const now = Date.now();

  try {
    // 2. [⏳ ตรวจสอบอายุขัยแคช 4 ชั่วโมง] อ่านเวลาที่เคยบันทึกแคชไว้ล่าสุด
    const cachedTimestamp = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
    
    if (cachedTimestamp) {
      const cacheAge = now - parseInt(cachedTimestamp, 10);
      if (cacheAge > CACHE_TTL_MS) {
        console.log("%c⏳ [Cache Expired] แคชในเครื่องหมดอายุ (เกิน 4 ชั่วโมงแล้ว) กำลังเคลียร์เพื่อโหลดชุดใหม่...", "color: #f59e0b; font-weight: bold;");
        clearSystemCache(); // ล้างแคชเก่าที่หมดอายุทิ้งทันที
      }
    }

    // 3. ดึงค่าเวอร์ชันล่าสุดจาก Firebase Cloud (ใช้ยอด Read เพียง 1 Doc เสมอเมื่อเปิดหน้าเว็บ/F5/รีโหลด)
    const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    
    let cloudVersion = null;
    try {
      // พยายามดึงจาก settings/version_control ตามโครงสร้างระบบ
      const versionSnap = await getDoc(doc(db, "settings", "version_control"));
      if (versionSnap && versionSnap.exists()) {
        cloudVersion = versionSnap.data().lastUpdated || versionSnap.data().version;
      } else {
        // หากไม่พบ ให้ลองดึงจาก system/version สำรอง (โครงสร้างระบบเก่า)
        const altVersionSnap = await getDoc(doc(db, "system", "version"));
        if (altVersionSnap && altVersionSnap.exists()) {
          cloudVersion = altVersionSnap.data().version || 1;
        }
      }
    } catch (vErr) {
      console.warn("⚠️ ไม่สามารถโหลดเวอร์ชันควบคุมได้:", vErr);
    }

    // 4. อ่านค่าแคชเดิมที่เหลืออยู่มาตรวจสอบ
    const localVersion = localStorage.getItem(CACHE_KEYS.VERSION);
    const cachedProducts = localStorage.getItem(CACHE_KEYS.PRODUCTS);
    const cachedCategories = localStorage.getItem(CACHE_KEYS.CATEGORIES);
    const cachedConsoleCategories = localStorage.getItem(CACHE_KEYS.CONSOLE_CATEGORIES); // 🔥 อ่านแคชคอนโซลของเครื่อง
    const cachedWidget = localStorage.getItem(CACHE_KEYS.WIDGET);

    // 5. [🎯 ตรวจสอบความสดใหม่และความสมบูรณ์ของโครงสร้างระบบ]
    // หากข้อมูลในเครื่องมีครบ และเลขเวอร์ชันตรงกับคลาวด์ ดึงจากแคชใช้งานทันทีใน 0.01 วินาที
    if (
      cloudVersion && 
      localVersion === cloudVersion.toString() && 
      cachedProducts && 
      cachedCategories &&
      cachedConsoleCategories // 🔥 บังคับเช็ค: หากลูกค้าเก่า "ไม่มีคีย์นี้" เงื่อนไขจะเป็นเท็จ เพื่อบังคับให้ไปดึงข้อมูลสด
    ) {
      try {
        const parsedProducts = JSON.parse(cachedProducts);
        const parsedCategories = JSON.parse(cachedCategories);
        const parsedConsoleCategories = JSON.parse(cachedConsoleCategories); // 🔥 แปลงค่าแคชคอนโซล
        
        if (
          Array.isArray(parsedProducts) && 
          Array.isArray(parsedCategories) && 
          Array.isArray(parsedConsoleCategories) &&
          parsedProducts.length > 0
        ) {
          console.log("%c⚡ [Cache Hit] แคชอายุยังไม่เกิน 4 ชม. + ข้อมูลสมบูรณ์! โหลดใช้งานทันทีไม่ต้องรอเน็ต", "color: #10b981; font-weight: bold;");
          return {
            products: parsedProducts,
            categories: parsedCategories,
            consoleCategories: parsedConsoleCategories, // 🔥 ส่งค่าหมวดหมู่คอนโซลที่แคชไว้ออกไปให้สคริปต์หลักวาดหน้าจอ
            widget: cachedWidget ? JSON.parse(cachedWidget) : null,
            isFromCache: true
          };
        }
      } catch (e) {
        console.warn("⚠️ [Cache Warning] โครงสร้างข้อมูลเสียหาย กำลังดาวน์โหลดใหม่...", e);
      }
    }

    // 6. [🔄 Force Sync] ถ้าแคชหมดอายุ / เวอร์ชันไม่ตรง / หรือลูกค้าเก่าไม่มีแคชคอนโซล -> ยิงโหลดสดชุดเต็มจาก Cloud
    console.log("%c📥 [Cache Miss/Expired/Sync] ระบบตรวจพบความเปลี่ยนแปลงหรือไม่มีแคชคอนโซล กำลังดึงข้อมูลสดใหม่ให้ผู้ใช้...", "color: #3b82f6; font-weight: bold;");
    const liveData = await fetchLiveDocs();

    // 7. บันทึกข้อมูลชุดใหม่ลงแคช พร้อมบันทึกเวลาเริ่มต้น (Timestamp) เอาไว้นับถอยหลัง 4 ชั่วโมง
    if (liveData && liveData.products && liveData.categories) {
      try {
        localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(liveData.products));
        localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(liveData.categories));
        // 🔥 ทำการบันทึกหมวดหมู่คอนโซลลงแคชของเครื่องไว้ใช้รอบถัดไป
        localStorage.setItem(CACHE_KEYS.CONSOLE_CATEGORIES, JSON.stringify(liveData.consoleCategories || []));
        localStorage.setItem(CACHE_KEYS.WIDGET, JSON.stringify(liveData.widget || null));
        localStorage.setItem(CACHE_KEYS.TIMESTAMP, now.toString()); // บันทึกเวลาปัจจุบัน
        if (cloudVersion) {
          localStorage.setItem(CACHE_KEYS.VERSION, cloudVersion.toString());
        }
        console.log("💾 [Cache] เริ่มนับถอยหลังอายุแคช 4 ชั่วโมง และบันทึกข้อมูลคอนโซลลงอุปกรณ์สำเร็จ");
      } catch (storageError) {
        console.error("⚠️ [Cache Storage Blocked] ไม่สามารถบันทึกแคชได้ (พื้นที่เต็มหรืออยู่ในโหมดไม่จำตัวตน):", storageError);
      }
    }

    return { ...liveData, isFromCache: false };

  } catch (error) {
    console.error("🚨 [Cache System Error] ระบบแคชขัดข้อง ดึงข้อมูลสดสำรองแทนเพื่อความปลอดภัย...", error);
    return await fetchLiveDocs();
  }
}

/**
 * 🗑️ ฟังก์ชันล้างแคชระบบแบบแมนนวล (เคลียร์หมดจดทั้งบนคอมและมือถือ)
 */
export function clearSystemCache() {
  try {
    Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
    console.log("🗑️ [Cache] ทำการล้างหน่วยความจำแคชเก่าออกจากอุปกรณ์เสร็จสิ้น");
  } catch (err) {
    console.error("Failed to clear cache:", err);
  }
}