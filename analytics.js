const firebaseConfig = {
    apiKey: "AIzaSyBEBVjahmE6BMGPglrHRdbktLI9mQKZTls",
    authDomain: "ickboy-store.firebaseapp.com",
    projectId: "ickboy-store",
    storageBucket: "ickboy-store.firebasestorage.app",
    messagingSenderId: "532385576489",
    appId: "1:532385576489:web:c0a99cbeec52db14d6ce38",
    measurementId: "G-3MGM3VH0PK"
};

// เริ่มต้นเปิดระบบ Firebase ( Direct Cloud Connection )
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const dateSelect = document.getElementById("dateSelect");
const txtPageViews = document.getElementById("txtPageViews");
const txtUniqueUsers = document.getElementById("txtUniqueUsers");

let trafficChart = null;

console.log("%c╠══ [Firebase Live-V9.9] ดึงข้อมูลสถิติสดตรงจากคลาวด์เซิร์ฟเวอร์", "color: #00ffff; font-weight: bold;");

initAnalyticsDashboard();

async function initAnalyticsDashboard() {
  try {
    // ดึงข้อมูลรายชื่อวันสถิติย้อนหลัง 30 วันจากระบบ Cloud โดยตรง ไม่ผ่าน Cache
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
      
      // แสดงข้อมูลและวาดกราฟของวันล่าสุดขึ้นมาเป็นค่าเริ่มต้น
      await loadDayData(dates[0]);
      
      // อัปเดตกราฟอัตโนมัติเมื่อแอดมินเปลี่ยนตัวเลือกวันที่
      dateSelect.onchange = (e) => {
        if(e.target.value) loadDayData(e.target.value);
      };
    }

  } catch (error) {
    console.error("Dashboard Init Error:", error);
    if(dateSelect) dateSelect.innerHTML = "<option value=''>เกิดข้อผิดพลาดในการดึงข้อมูล</option>";
  }
}

async function loadDayData(dateString) {
  try {
    const docSnap = await db.collection("analytics").doc(dateString).get();
    if (!docSnap.exists) return;

    const data = docSnap.data();

    // แสดงตัวเลขแบบใส่คอมม่าคั่นหลัก (เช่น 1,500)
    if (txtPageViews) txtPageViews.innerText = (data.totalPageViews || 0).toLocaleString();
    if (txtUniqueUsers) txtUniqueUsers.innerText = (data.uniqueUsers || 0).toLocaleString();

    const hourlyData = data.hourlyTraffic || {};
    const chartLabels = [];
    const chartValues = [];

    // เติมข้อมูลให้เต็มแกนเวลา 24 ชั่วโมง (00:00 - 23:00)
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
  
  // ทำลายกราฟอันเก่าก่อนสร้างอันใหม่ เพื่อป้องกันข้อมูลซ้อนทับกัน
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