// 🟢 เรียกใช้งาน Firebase SDK ผ่านโครงข่าย CDN ความเร็วสูงในรูปแบบ Module
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

// เริ่มต้นระบบเชื่อมต่อฐานข้อมูลตรงเข้าสู่คลาวด์เซิร์ฟเวอร์ โดยไม่เปิดระบบแคชออฟไลน์ เพื่อไม่ให้ชนกับหน้าหลัก
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {});

const dateSelect = document.getElementById("dateSelect");
const txtPageViews = document.getElementById("txtPageViews");
const txtUniqueUsers = document.getElementById("txtUniqueUsers");

let trafficChart = null;

console.log("%c╠══ [Firebase Modular-V10.2] ระบบสถิติทำงานร่วมกับโฮสติ้งจริงสำเร็จ", "color: #00ffff; font-weight: bold;");

initAnalyticsDashboard();

async function initAnalyticsDashboard() {
  try {
    const analyticsRef = collection(db, "analytics");
    // ดึงรายชื่อวันที่สถิติย้อนหลังสูงสุด 30 วัน
    const q = query(analyticsRef, orderBy("__name__", "desc"), limit(30));
    const snap = await getDocs(q);

    if (snap.empty) {
      if(dateSelect) dateSelect.innerHTML = "<option value=''>-- ยังไม่มีข้อมูลสถิติบันทึกเข้ามา --</option>";
      return;
    }

    let dates = [];
    snap.forEach(d => {
      dates.push(d.id);
    });

    if (dateSelect) {
      dateSelect.innerHTML = dates.map(date => `<option value="${date}">${date}</option>`).join("");
      
      // ดึงข้อมูลและวาดกราฟของวันล่าสุดขึ้นมาแสดงผลนำร่องก่อนทันที
      await loadDayData(dates[0]);
      
      // อัปเดตข้อมูลและกราฟอัตโนมัติเมื่อแอดมินเปลี่ยนตัวเลือกวันที่
      dateSelect.onchange = (e) => {
        if(e.target.value) loadDayData(e.target.value);
      };
    }

  } catch (error) {
    console.error("Dashboard Init Error:", error);
    if(dateSelect) dateSelect.innerHTML = "<option value=''>เกิดข้อผิดพลาดในการโหลดข้อมูล</option>";
  }
}

async function loadDayData(dateString) {
  try {
    const docRef = doc(db, "analytics", dateString);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data();

    // แสดงผลตัวเลขยอดรวมแบบมีคอมม่าคั่นหลักนับ
    if (txtPageViews) txtPageViews.innerText = (data.totalPageViews || 0).toLocaleString();
    if (txtUniqueUsers) txtUniqueUsers.innerText = (data.uniqueUsers || 0).toLocaleString();

    const hourlyData = data.hourlyTraffic || {};
    const chartLabels = [];
    const chartValues = [];

    // ประกอบโครงสร้างข้อมูลเวลาให้ครบถ้วน 24 ชั่วโมง (00:00 - 23:00)
    for (let h = 0; h < 24; h++) {
      chartLabels.push(`${String(h).padStart(2, '0')}:00`);
      chartValues.push(hourlyData[h] || 0); 
    }

    renderHourlyChart(chartLabels, chartValues);

  } catch (err) {
    console.error("Load Day Data Error:", err);
  }
}

function renderHourlyChart(labels, values) {
  const chartCanvas = document.getElementById('hourlyTrafficChart');
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');
  
  // ล้างค่าและทำลายกราฟเก่าทิ้งก่อนวาดใหม่ เพื่อป้องกันอาการกราฟซ้อนกันเวลาสลับวัน
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
        backgroundColor: 'rgba(0, 255, 255, 0.03)',
        borderWidth: 3,
        tension: 0.3,
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