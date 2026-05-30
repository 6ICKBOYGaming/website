let db = null;
let trafficChart = null;

const dateSelect = document.getElementById("dateSelect");
const txtPageViews = document.getElementById("txtPageViews");
const txtUniqueUsers = document.getElementById("txtUniqueUsers");

// 🟢 บังคับโหลดระบบผ่านตัวเชื่อมต่อหลักของโฮสติ้ง เพื่อตัดปัญหาระบบความปลอดภัยบล็อกสคริปต์
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // ดึงการเชื่อมต่อ Firebase ที่เปิดใช้งานอยู่แล้วบนโฮสต์
        if (typeof firebase !== 'undefined') {
            // ไม่ต้องใส่คอนฟิกซ้ำซ้อน ดึงค่าอัตโนมัติผ่านตัวโฮสต์ได้เลย ปลอดภัย 100%
            db = firebase.firestore();
            console.log("%c╠══ [Firebase Host-Link] ทำงานร่วมกับ Firebase Hosting สำเร็จ", "color: #00ffff; font-weight: bold;");
            initAnalyticsDashboard();
        } else {
            console.error("Firebase SDK โหลดไม่สำเร็จ");
            if(dateSelect) dateSelect.innerHTML = "<option>ระบบบล็อกความปลอดภัยภายนอก</option>";
        }
    } catch (e) {
        console.error("Initial Error: ", e);
    }
});

async function initAnalyticsDashboard() {
  try {
    if (!db) return;
    // ดึงข้อมูลรายชื่อวันที่บันทึกสถิติล่าสุดยิงตรงจากคลาวด์
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
      
      // ดึงข้อมูลวันแรกสุดขึ้นจัดกราฟนำร่องทันที
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
    if (!db) return;
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