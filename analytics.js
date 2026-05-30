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

// ใช้ firebaseConfig ชุดเดียวกันกับใน app.js ของคุณ
const firebaseConfig = {
    apiKey: "AIzaSyBEBVjahmE6BMGPglrHRdbktLI9mQKZTls",
    authDomain: "ickboy-store.firebaseapp.com",
    projectId: "ickboy-store",
    storageBucket: "ickboy-store.firebasestorage.app",
    messagingSenderId: "532385576489",
    appId: "1:532385576489:web:c0a99cbeec52db14d6ce38",
    measurementId: "G-3MGM3VH0PK"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app);

const dateSelect = document.getElementById("dateSelect");
const txtPageViews = document.getElementById("txtPageViews");
const txtUniqueUsers = document.getElementById("txtUniqueUsers");

let trafficChart = null;

// เรียกทำงานเมื่อโหลดหน้าเว็บ
initAnalyticsDashboard();

async function initAnalyticsDashboard() {
  try {
    // 1. ดึงรายชื่อวันทั้งหมดที่มีข้อมูลบันทึกไว้ในคลาวด์มาใส่ในตัวเลือก Select Dropdown
    const analyticsRef = collection(db, "analytics");
    const q = query(analyticsRef, orderBy("__name__", "desc"), limit(30)); // ย้อนหลังสูงสุด 30 วัน
    const snap = await getDocs(q);

    if (snap.empty) {
      alert("ไม่พบข้อมูลสถิติในระบบคลาวด์ขณะนี้");
      return;
    }

    let dates = [];
    snap.forEach(d => {
      dates.push(d.id);
    });

    // ใส่ตัวเลือกวันลงใน Select element
    dateSelect.innerHTML = dates.map(date => `<option value="${date}">${date}</option>`).join("");
    
    // โหลดข้อมูลของวันล่าสุดมาแสดงผลเป็นค่าเริ่มต้น
    await loadDayData(dates[0]);

    // มัด Event Listener เมื่อแอดมินเปลี่ยนวันที่ต้องการดู
    dateSelect.onchange = (e) => {
      loadDayData(e.target.value);
    };

  } catch (error) {
    console.error("Dashboard Init Error:", error);
  }
}

// ฟังก์ชันดึงดาต้าของวันที่ระบุมาเรนเดอร์ลง UI และกราฟ
async function loadDayData(dateString) {
  try {
    const docSnap = await getDoc(doc(db, "analytics", dateString));
    if (!docSnap.exists()) return;

    const data = docSnap.data();

    // แสดงผลตัวเลขหน้าการ์ดสรุปผล
    txtPageViews.innerText = (data.totalPageViews || 0).toLocaleString();
    txtUniqueUsers.innerText = (data.uniqueUsers || 0).toLocaleString();

    // จัดระเบียบข้อมูลสถิติรายชั่วโมง (0น. - 23น.)
    const hourlyData = data.hourlyTraffic || {};
    const chartLabels = [];
    const chartValues = [];

    for (let h = 0; h < 24; h++) {
      chartLabels.push(`${String(h).padStart(2, '0')}:00`);
      chartValues.push(hourlyData[h] || 0); // หากชั่วโมงไหนไม่มีคนเข้าให้ส่งค่าเป็น 0
    }

    // เรนเดอร์กราฟด้วย Chart.js
    renderHourlyChart(chartLabels, chartValues);

  } catch (err) {
    console.error("Load Day Data Error:", err);
  }
}

// ฟังก์ชันประกอบโครงสร้างกราฟเส้นแสดงผลพฤติกรรมลูกค้า
function renderHourlyChart(labels, values) {
  const ctx = document.getElementById('hourlyTrafficChart').getContext('2d');
  
  // ทำลายกราฟตัวเดิมก่อนวาดใหม่ (ป้องกันปัญหากราฟซ้อนทับกันเวลาเปลี่ยนวัน)
  if (trafficChart) {
    trafficChart.destroy();
  }

  trafficChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'จำนวนการเข้าชมเว็บไซต์ (ครั้ง)',
        data: values,
        borderColor: '#00ffff',
        backgroundColor: 'rgba(0, 255, 255, 0.05)',
        borderWidth: 3,
        tension: 0.3, // ทำให้เส้นกราฟมีความโค้งมนสวยงาม
        fill: true,
        pointBackgroundColor: '#00ffff',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8' } }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' }, beginAtZero: true }
      }
    }
  });
}