import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

const dateSelect = document.getElementById("dateSelect");
const txtPageViews = document.getElementById("txtPageViews");
const txtUniqueUsers = document.getElementById("txtUniqueUsers");

let trafficChart = null;

initAnalyticsDashboard();

async function initAnalyticsDashboard() {
  try {
    const analyticsRef = collection(db, "analytics");
    const q = query(analyticsRef, orderBy("__name__", "desc"), limit(30)); 
    const snap = await getDocs(q);

    if (snap.empty) {
      if(dateSelect) dateSelect.innerHTML = "<option value=''>-- ยังไม่มีข้อมูลสถิติบันทึกเข้ามา --</option>";
      console.log("📈 ยังไม่มีข้อมูลประวัติผู้ใช้งานบันทึกอยู่บนเซิร์ฟเวอร์คลาวด์ขณะนี้");
      return;
    }

    let dates = [];
    snap.forEach(d => {
      dates.push(d.id);
    });

    if (dateSelect) {
      dateSelect.innerHTML = dates.map(date => `<option value="${date}">${date}</option>`).join("");
      await loadDayData(dates[0]);
      dateSelect.onchange = (e) => {
        if(e.target.value) loadDayData(e.target.value);
      };
    }

  } catch (error) {
    console.error("Dashboard Init Error:", error);
  }
}

async function loadDayData(dateString) {
  try {
    const docSnap = await getDoc(doc(db, "analytics", dateString));
    if (!docSnap.exists()) return;

    const data = docSnap.data();

    if (txtPageViews) txtPageViews.innerText = (data.totalPageViews || 0).toLocaleString();
    if (txtUniqueUsers) txtUniqueUsers.innerText = (data.uniqueUsers || 0).toLocaleString();

    const hourlyData = data.hourlyTraffic || {};
    const chartLabels = [];
    const chartValues = [];

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
  
  if (trafficChart) {
    trafficChart.destroy();
  }

  if (typeof Chart === 'undefined') {
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
        backgroundColor: 'rgba(0, 255, 255, 0.05)',
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