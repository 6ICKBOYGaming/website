import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBEBVjahmE6BMGPglrHRdbktLI9mQKZTls",
    authDomain: "ickboy-store.firebaseapp.com",
    projectId: "ickboy-store",
    storageBucket: "ickboy-store.firebasestorage.app",
    messagingSenderId: "532385576489",
    appId: "1:532385576489:web:c0a99cbeec52db14d6ce38",
    measurementId: "G-3MGM3VH0PK"
};

// 1. เริ่มต้นการทำงานของ Firebase App
const app = initializeApp(firebaseConfig);

// 🟢 แก้ไขจุดสำคัญ: บังคับให้หน้าสถิติต่อตรงเข้าคลาวด์ ไม่ผ่าน Local Cache เพื่อแก้ปัญหาแท็บชนกันบนโฮสต์จริง
const db = initializeFirestore(app, {});

const dateSelect = document.getElementById("dateSelect");
const txtPageViews = document.getElementById("txtPageViews");
const txtUniqueUsers = document.getElementById("txtUniqueUsers");

let trafficChart = null;

console.log("%c╠══ [Firebase V8.0] หน้าจอ Analytics ทำงานผ่านระบบ Direct-Cloud เชื่อมต่อสำเร็จ", "color: #00ffff; font-weight: bold;");

// เรียกฟังก์ชันเริ่มทำงานระบบแดชบอร์ด
initAnalyticsDashboard();

async function initAnalyticsDashboard() {
  try {
    const analyticsRef = collection(db, "analytics");
    // ทำการดึงข้อมูลสถิติย้อนหลังสูงสุด 30 วัน เรียงตามชื่อเอกสาร (วันที่) ล่าสุดลงไป
    const q = query(analyticsRef, orderBy("__name__", "desc"), limit(30)); 
    const snap = await getDocs(q);

    if (snap.empty) {
      if(dateSelect) dateSelect.innerHTML = "<option value=''>-- ยังไม่มีข้อมูลสถิติบันทึกเข้ามา --</option>";
      console.log("📈 ไม่พบเอกสารประวัติสถิติใดๆ บนเซิร์ฟเวอร์ Cloud Firestore ขณะนี้");
      return;
    }

    let dates = [];
    snap.forEach(d => {
      dates.push(d.id);
    });

    if (dateSelect) {
      // เอาวันที่ทั้งหมดไปใส่ในตัวเลือก Dropdown บนหน้าเว็บ
      dateSelect.innerHTML = dates.map(date => `<option value="${date}">${date}</option>`).join("");
      
      // ดึงข้อมูลสถิติของวันล่าสุด (วันแรกในอาร์เรย์) มาวาดกราฟและแสดงผลเริ่มต้นทันที
      await loadDayData(dates[0]);
      
      // ผูกกิจกรรมเมื่อแอดมินเลือกเปลี่ยนวันที่ดูสถิติ
      dateSelect.onchange = (e) => {
        if(e.target.value) loadDayData(e.target.value);
      };
    }

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการโหลดแดชบอร์ดสถิติ:", error);
  }
}

async function loadDayData(dateString) {
  try {
    const docSnap = await getDoc(doc(db, "analytics", dateString));
    if (!docSnap.exists()) return;

    const data = docSnap.data();

    // ทำการแสดงตัวเลขยอดรวมแบบมีคอมม่าคั่นค่านับ (เช่น 1,234 ครั้ง)
    if (txtPageViews) txtPageViews.innerText = (data.totalPageViews || 0).toLocaleString();
    if (txtUniqueUsers) txtUniqueUsers.innerText = (data.uniqueUsers || 0).toLocaleString();

    const hourlyData = data.hourlyTraffic || {};
    const chartLabels = [];
    const chartValues = [];

    // ลูปประกอบโครงสร้างข้อมูลให้ครบถ้วนทั้ง 24 ชั่วโมง (00:00 - 23:00)
    for (let h = 0; h < 24; h++) {
      chartLabels.push(`${String(h).padStart(2, '0')}:00`);
      chartValues.push(hourlyData[h] || 0); 
    }

    // ส่งชุดข้อมูลพิกัดเวลาไปให้ระบบ Chart.js วาดกราฟเส้นสีนีออน
    renderHourlyChart(chartLabels, chartValues);

  } catch (err) {
    console.error("เกิดข้อผิดพลาดในการดึงข้อมูลรายวัน:", err);
  }
}

function renderHourlyChart(labels, values) {
  const chartCanvas = document.getElementById('hourlyTrafficChart');
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');
  
  // หากมีกราฟเก่าคาอยู่ให้ทำลายทิ้งก่อนเพื่อป้องกันกราฟเก่าซ้อนซ้ำเวลากดเปลี่ยนวัน
  if (trafficChart) {
    trafficChart.destroy();
  }

  // ตรวจสอบเช็กสถานะตัวแปรไลบรารี Chart.js ป้องกันตัวสคริปต์หยุดทำงานกลางคัน
  if (typeof Chart === 'undefined') {
    console.error("🚨 ไม่พบโครงข่ายไลบรารี Chart.js กรุณาเช็กการดึง Script ในหน้า HTML");
    return;
  }

  trafficChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'จำนวนการเข้าชมเว็บไซต์ (ครั้ง)',
        data: values,
        borderColor: '#00ffff',
        backgroundColor: 'rgba(0, 255, 255, 0.04)',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointBackgroundColor: '#00ffff',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'sans-serif' } } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, beginAtZero: true }
      }
    }
  });
}