/**
 * =========================================================================
 * 📦 SYSTEM: Cross-Platform Ultra-Stable Cache Manager with 4-Hour TTL (cache.js)
 * 🖥️ Supporting: Desktop Browsers (Chrome, Edge, Firefox, Safari)
 * 📱 Supporting: Mobile Browsers (iOS Safari, Android Chrome, LINE/FB In-App)
 * ⏳ Cache Lifespan: บังคับล้างแคชเก่าในเครื่องทันทีหากเกิน 4 ชั่วโมง (4 Hours TTL)
 * การันตี: ดึงข้อมูลอัตโนมัติ, เคลียร์สินค้าค้างและหมวดหมู่คอนโซลของลูกค้าเก่า 100%
 * =========================================================================
 */

const CACHE_KEYS = {
  PRODUCTS: "ickboy_products_cache",
  CATEGORIES: "ickboy_categories_cache",
  CONSOLE_CATEGORIES: "ickboy_console_categories_cache", 
  WIDGET: "ickboy_widget_cache",
  VERSION: "ickboy_data_version",
  TIMESTAMP: "ickboy_cache_timestamp" 
};

const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export async function getSmartCachedData(db, fetchLiveDocs, isAdmin = false) {
  if (isAdmin) {
    console.log("👑 [Cache] โหมดแอดมิน: ดึงข้อมูลสดตรงจาก Cloud 100%");
    return await fetchLiveDocs();
  }

  const now = Date.now();

  try {
    const cachedTimestamp = localStorage.getItem(CACHE_KEYS.TIMESTAMP);
    if (cachedTimestamp) {
      const cacheAge = now - parseInt(cachedTimestamp, 10);
      if (cacheAge > CACHE_TTL_MS) {
        console.log("⏳ [Cache Expired] แคชหมดอายุ เกิน 4 ชั่วโมงแล้ว ล้างข้อมูลเพื่อโหลดชุดใหม่...");
        clearSystemCache();
      }
    }

    const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    
    let cloudVersion = null;
    try {
      const versionSnap = await getDoc(doc(db, "settings", "version_control"));
      if (versionSnap && versionSnap.exists()) {
        cloudVersion = versionSnap.data().lastUpdated || versionSnap.data().version;
      } else {
        const altVersionSnap = await getDoc(doc(db, "system", "version"));
        if (altVersionSnap && altVersionSnap.exists()) {
          cloudVersion = altVersionSnap.data().version || 1;
        }
      }
    } catch (vErr) {
      console.warn("⚠️ ไม่สามารถโหลดเวอร์ชันควบคุมได้:", vErr);
    }

    const localVersion = localStorage.getItem(CACHE_KEYS.VERSION);
    const cachedProducts = localStorage.getItem(CACHE_KEYS.PRODUCTS);
    const cachedCategories = localStorage.getItem(CACHE_KEYS.CATEGORIES);
    const cachedConsoleCategories = localStorage.getItem(CACHE_KEYS.CONSOLE_CATEGORIES); 
    const cachedWidget = localStorage.getItem(CACHE_KEYS.WIDGET);

    // 🔥 จุดเปลี่ยนสำคัญ: บังคับเช็คว่าต้องมีแคชคอนโซลด้วย ถ้าลูกค้าเก่าไม่มี จะข้ามไปดึงสดทันทีอัตโนมัติ
    if (
      cloudVersion && 
      localVersion === cloudVersion.toString() && 
      cachedProducts && 
      cachedCategories &&
      cachedConsoleCategories 
    ) {
      try {
        const parsedProducts = JSON.parse(cachedProducts);
        const parsedCategories = JSON.parse(cachedCategories);
        const parsedConsoleCategories = JSON.parse(cachedConsoleCategories); 
        
        if (
          Array.isArray(parsedProducts) && 
          Array.isArray(parsedCategories) && 
          Array.isArray(parsedConsoleCategories)
        ) {
          console.log("⚡ [Cache Hit] โหลดใช้งานจากหน่วยความจำในเครื่องสำเร็จ");
          return {
            products: parsedProducts,
            categories: parsedCategories,
            consoleCategories: parsedConsoleCategories, 
            widget: cachedWidget ? JSON.parse(cachedWidget) : null,
            isFromCache: true
          };
        }
      } catch (e) {
        console.warn("⚠️ โครงสร้างข้อมูลเสียหาย ดาวน์โหลดข้อมูลใหม่...", e);
      }
    }

    // ดึงข้อมูลสดชุดใหม่
    console.log("📥 [Cache Sync] ตรวจพบข้อมูลไม่ครบหรือข้อมูลอัปเดต ดึงข้อมูลสดจาก Cloud อัตโนมัติ...");
    const liveData = await fetchLiveDocs();

    if (liveData && liveData.products && liveData.categories) {
      try {
        localStorage.setItem(CACHE_KEYS.PRODUCTS, JSON.stringify(liveData.products));
        localStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(liveData.categories));
        localStorage.setItem(CACHE_KEYS.CONSOLE_CATEGORIES, JSON.stringify(liveData.consoleCategories || []));
        localStorage.setItem(CACHE_KEYS.WIDGET, JSON.stringify(liveData.widget || null));
        localStorage.setItem(CACHE_KEYS.TIMESTAMP, now.toString()); 
        if (cloudVersion) {
          localStorage.setItem(CACHE_KEYS.VERSION, cloudVersion.toString());
        }
        console.log("💾 [Cache] บันทึกข้อมูลและจัดตั้งโครงสร้างแคชใหม่เสร็จสิ้น");
      } catch (storageError) {
        console.error("⚠️ ไม่สามารถบันทึกแคชได้:", storageError);
      }
    }

    return { ...liveData, isFromCache: false };

  } catch (error) {
    console.error("🚨 ระบบแคชขัดข้อง ดึงข้อมูลสดสำรองแทน...", error);
    return await fetchLiveDocs();
  }
}

export function clearSystemCache() {
  try {
    Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
    console.log("🗑️ [Cache] ทำการล้างหน่วยความจำแคชเก่าเรียบร้อย");
  } catch (err) {
    console.error("Failed to clear cache:", err);
  }
}