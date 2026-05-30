const firebaseConfig = {
    apiKey: "AIzaSyBEBVjahmE6BMGPglrHRdbktLI9mQKZTls",
    authDomain: "ickboy-store.firebaseapp.com",
    projectId: "ickboy-store",
    storageBucket: "ickboy-store.firebasestorage.app",
    messagingSenderId: "532385576489",
    appId: "1:532385576489:web:c0a99cbeec52db14d6ce38",
    measurementId: "G-3MGM3VH0PK"
};

let db = null;
let trafficChart = null;

const dateSelect = document.getElementById("dateSelect");
const txtPageViews = document.getElementById("txtPageViews");
const txtUniqueUsers = document.getElementById("txtUniqueUsers");

// 🟢 แก้ไขจุดสำคัญ: ห่อคำสั่งด้วย window.onload เพื่อรอให้ดาวน์โหลด Firebase SDK เสร็จสิ้นก่อนเริ่มรันโค้ด
window.onload = function() {
    try {
        if (typeof firebase === "undefined") {
            console.error("🚨 ไม่สามารถโหลดไลบรารี Firebase SDK ได้ กรุณาเช็กการเชื่อมต่ออินเทอร์เน็ต");
            if(dateSelect) dateSelect.innerHTML = "<option>โหลดระบบฐานข้อมูลล้มเหลว</option>";
            return;
        }

        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        
        console.log("%c╠══ [Firebase Live-V10.0] โหลดคลาวด์ไลบรารีและเชื่อมต่อฐานข้อมูลตรงสำเร็จ", "color: #00ffff; font-weight: bold;");
        
        // เริ่มต้นทำงานดึงข้อมูลแดชบอร์ด
        initAnalyticsDashboard();

    } catch (e) {
        console.error("Firebase Init Crash:", e);
    }
};

async function initAnalyticsDashboard() {
  try {
    if(!db) return;
    // ดึงข้อมูลสถิติ 30 วันย้อนหลังจากคลาวด์แบบ Direct
    const snap = await db.collection("analytics").orderBy("__name__", "desc").limit(30).get();

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
      
      // ดึงสถิติของวันล่าสุดขึ้นมาจัดแสดงและวาดกราฟเริ่มต้น
      await loadDayData(dates[0]);
      
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
    if(!db) return;
    const docSnap = await db.collection("analytics").doc(dateString).get();
    if (!docSnap.exists) return;

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