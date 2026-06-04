// popup.js - ระบบบันทึกข้อมูลและอัปเดตการตั้งค่า Popup ไปยัง Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// รายละเอียดการเชื่อมต่อโปรเจกต์ 6ICKBOY ของคุณ
const firebaseConfig = {
    apiKey: "AIzaSyBEBVjahmE6BMGPglrHRdbktLI9mQKZTls",
    authDomain: "ickboy-store.firebaseapp.com",
    projectId: "ickboy-store",
    storageBucket: "ickboy-store.firebasestorage.app",
    messagingSenderId: "532385576489",
    appId: "1:532385576489:web:c0a99cbeec52db14d6ce38"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ดึง Elements จาก HTML
const activeInput = document.getElementById("popupActive");
const imgUrlInput = document.getElementById("popupImgUrl");
const targetUrlInput = document.getElementById("popupTargetUrl");
const previewImg = document.getElementById("popupPreview");
const previewPlaceholder = document.getElementById("previewPlaceholder");
const saveBtn = document.getElementById("savePopupBtn");

// ฟังก์ชันทำ Live Preview รูปภาพทันทีเมื่อมีการพิมพ์ลิงก์
imgUrlInput.addEventListener("input", () => {
    const url = imgUrlInput.value.trim();
    if (url) {
        previewImg.src = url;
        previewImg.classList.remove("hidden");
        previewPlaceholder.classList.add("hidden");
    } else {
        previewImg.src = "";
        previewImg.classList.add("hidden");
        previewPlaceholder.classList.remove("hidden");
    }
});

// โหลดข้อมูลล่าสุดจาก Firebase มาแสดงในฟอร์มเมื่อเปิดหน้าเว็บ
async function loadPopupSettings() {
    try {
        const docRef = doc(db, "system_settings", "popup_config");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            activeInput.checked = data.isActive || false;
            imgUrlInput.value = data.imgUrl || "";
            targetUrlInput.value = data.targetUrl || "";
            
            // สั่งอัปเดต Preview
            if (data.imgUrl) {
                imgUrlInput.dispatchEvent(new Event("input"));
            }
        }
    } catch (error) {
        console.error("🚨 โหลดข้อมูลส้มเหลว:", error);
    }
}

// ฟังก์ชันบันทึกข้อมูลกลับไปยัง Cloud Firestore
saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    saveBtn.innerText = "⏳ กำลังบันทึกข้อมูล...";

    const popupData = {
        isActive: activeInput.checked,
        imgUrl: imgUrlInput.value.trim(),
        targetUrl: targetUrlInput.value.trim(),
        updatedAt: new Date().toISOString()
    };

    try {
        await setDoc(doc(db, "system_settings", "popup_config"), popupData);
        
        // สั่งเคลียร์ Cache ในเครื่องแอดมิน เพื่อให้เห็นผลลัพธ์ทันที
        localStorage.removeItem("ickboy_popup_cache");
        
        alert("✨ บันทึกการตั้งค่าระบบ Popup เรียบร้อยแล้ว!");
    } catch (error) {
        alert("🚨 เกิดข้อผิดพลาด: " + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = "💾 บันทึกการตั้งค่าระบบ Popup";
    }
});

// รันระบบดึงข้อมูลเริ่มต้น
document.addEventListener("DOMContentLoaded", loadPopupSettings);