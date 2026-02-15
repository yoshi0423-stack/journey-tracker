// =====================================
// グローバル変数
// =====================================
let tracking = false;
let watchId = null;
let trackingData = {
  activityType: 'walk',
  startTime: null,
  locations: [],
  totalDistance: 0
};
let lastPosition = null;
let trackingInterval = null;
let weeklyChart = null;

// =====================================
// 初期化
// =====================================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

async function initializeApp() {
  // 統計データ読み込み
  await loadStats();
  
  // イベントリスナー設定
  setupEventListeners();
  
  // 位置情報許可チェック
  checkGeolocationPermission();
}

// =====================================
// イベントリスナー設定
// =====================================
function setupEventListeners() {
  const startBtn = document.getElementById('start-tracking-btn');
  const stopBtn = document.getElementById('stop-tracking-btn');
  const modal = document.getElementById('activity-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const activityTypeBtns = document.querySelectorAll('.activity-type-btn');

  // トラッキング開始ボタン
  startBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  });

  // モーダル閉じるボタン
  closeModalBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  });

  // アクティビティタイプ選択
  activityTypeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.dataset.type;
      startTracking(type);
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  });

  // トラッキング停止ボタン
  stopBtn.addEventListener('click', () => {
    stopTracking();
  });
}

// =====================================
// 統計データ読み込み
// =====================================
async function loadStats() {
  try {
    const response = await axios.get('/api/stats');
    if (response.data.success) {
      const { user, recent_activities, weekly_stats, milestones } = response.data.data;
      
      // ユーザー統計表示
      if (user) {
        document.getElementById('total-distance').textContent = user.total_distance?.toFixed(1) || '0.0';
        document.getElementById('activity-days').textContent = user.activity_days || '0';
        const hours = user.total_duration ? Math.floor(user.total_duration / 3600) : 0;
        document.getElementById('total-duration').textContent = hours;
        document.getElementById('days-since-start').textContent = user.days_since_start || '0';
      }
      
      // 最近のアクティビティ表示
      displayRecentActivities(recent_activities);
      
      // 週間グラフ表示
      displayWeeklyChart(weekly_stats);
      
      // マイルストーン表示
      displayMilestones(milestones);
    }
  } catch (error) {
    console.error('統計データ読み込みエラー:', error);
  }
}

// =====================================
// 最近のアクティビティ表示
// =====================================
function displayRecentActivities(activities) {
  const container = document.getElementById('recent-activities');
  
  if (!activities || activities.length === 0) {
    container.innerHTML = '<div class="text-gray-500 text-center py-8">まだアクティビティがありません</div>';
    return;
  }

  const activityIcons = {
    walk: 'fa-walking',
    run: 'fa-running',
    cycle: 'fa-biking'
  };

  const activityColors = {
    walk: 'blue',
    run: 'green',
    cycle: 'purple'
  };

  const activityNames = {
    walk: 'ウォーキング',
    run: 'ランニング',
    cycle: 'サイクリング'
  };

  container.innerHTML = activities.map(activity => {
    const icon = activityIcons[activity.activity_type] || 'fa-walking';
    const color = activityColors[activity.activity_type] || 'blue';
    const name = activityNames[activity.activity_type] || activity.activity_type;
    const duration = Math.floor(activity.duration / 60);
    const date = dayjs(activity.start_time).format('YYYY/MM/DD HH:mm');

    return `
      <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
        <div class="flex items-center gap-4">
          <div class="bg-${color}-100 text-${color}-600 w-12 h-12 rounded-full flex items-center justify-center">
            <i class="fas ${icon} text-xl"></i>
          </div>
          <div>
            <div class="font-bold text-gray-800">${name}</div>
            <div class="text-sm text-gray-500">${date}</div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-lg font-bold text-gray-800">${activity.distance.toFixed(1)} km</div>
          <div class="text-sm text-gray-500">${duration}分</div>
        </div>
      </div>
    `;
  }).join('');
}

// =====================================
// 週間グラフ表示
// =====================================
function displayWeeklyChart(weeklyStats) {
  if (!weeklyStats || weeklyStats.length === 0) return;

  const ctx = document.getElementById('weekly-chart');
  if (!ctx) return;

  // 古いチャートを破棄
  if (weeklyChart) {
    weeklyChart.destroy();
  }

  const labels = weeklyStats.reverse().map(w => w.week);
  const distances = weeklyStats.map(w => w.total_distance);

  weeklyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '週間距離 (km)',
        data: distances,
        backgroundColor: 'rgba(99, 102, 241, 0.6)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return value + ' km';
            }
          }
        }
      }
    }
  });
}

// =====================================
// マイルストーン表示
// =====================================
function displayMilestones(milestones) {
  const container = document.getElementById('milestones-list');
  
  if (!milestones || milestones.length === 0) {
    container.innerHTML = '<div class="text-gray-500 text-center py-8">まだマイルストーンがありません</div>';
    return;
  }

  container.innerHTML = milestones.map(milestone => {
    const date = dayjs(milestone.achieved_at).format('YYYY/MM/DD');
    return `
      <div class="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border-l-4 border-yellow-500">
        <div class="flex items-start gap-3">
          <i class="fas fa-trophy text-2xl text-yellow-500 mt-1"></i>
          <div class="flex-1">
            <div class="font-bold text-gray-800">${milestone.title}</div>
            <div class="text-sm text-gray-600 mt-1">${milestone.description}</div>
            <div class="text-xs text-gray-500 mt-2">${date}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// =====================================
// 位置情報許可チェック
// =====================================
function checkGeolocationPermission() {
  if (!navigator.geolocation) {
    alert('お使いのブラウザは位置情報に対応していません');
    return;
  }
}

// =====================================
// トラッキング開始
// =====================================
function startTracking(activityType) {
  if (tracking) return;

  trackingData = {
    activityType: activityType,
    startTime: new Date().toISOString(),
    locations: [],
    totalDistance: 0
  };
  lastPosition = null;
  tracking = true;

  // UI更新
  document.getElementById('start-tracking-btn').classList.add('hidden');
  document.getElementById('stop-tracking-btn').classList.remove('hidden');
  document.getElementById('tracking-status').classList.remove('hidden');

  // 位置情報トラッキング開始
  watchId = navigator.geolocation.watchPosition(
    (position) => handlePositionUpdate(position),
    (error) => handlePositionError(error),
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    }
  );

  // 経過時間更新
  let startTimestamp = Date.now();
  trackingInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('current-duration').textContent = 
      `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);

  console.log('トラッキング開始:', activityType);
}

// =====================================
// 位置情報更新処理
// =====================================
function handlePositionUpdate(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const timestamp = new Date(position.timestamp).toISOString();

  // 位置情報を記録
  trackingData.locations.push({
    latitude,
    longitude,
    accuracy,
    timestamp
  });

  // 距離計算（前回の位置がある場合）
  if (lastPosition) {
    const distance = calculateDistance(
      lastPosition.latitude,
      lastPosition.longitude,
      latitude,
      longitude
    );
    trackingData.totalDistance += distance;
  }

  lastPosition = { latitude, longitude };

  // UI更新
  document.getElementById('current-distance').textContent = trackingData.totalDistance.toFixed(2);
  document.getElementById('point-count').textContent = trackingData.locations.length;
  document.getElementById('current-accuracy').textContent = Math.round(accuracy);

  console.log('位置更新:', { latitude, longitude, accuracy, distance: trackingData.totalDistance });
}

// =====================================
// 位置情報エラー処理
// =====================================
function handlePositionError(error) {
  console.error('位置情報エラー:', error.message);
  alert(`位置情報の取得に失敗しました: ${error.message}`);
}

// =====================================
// トラッキング停止
// =====================================
async function stopTracking() {
  if (!tracking) return;

  // トラッキング停止
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }

  tracking = false;

  // UI更新
  document.getElementById('start-tracking-btn').classList.remove('hidden');
  document.getElementById('stop-tracking-btn').classList.add('hidden');
  document.getElementById('tracking-status').classList.add('hidden');

  // データ保存
  if (trackingData.locations.length > 0) {
    await saveActivity();
  } else {
    alert('位置情報が記録されませんでした');
  }

  console.log('トラッキング停止');
}

// =====================================
// アクティビティ保存
// =====================================
async function saveActivity() {
  try {
    const endTime = new Date().toISOString();
    const startTime = new Date(trackingData.startTime);
    const duration = Math.floor((new Date(endTime) - startTime) / 1000);

    const payload = {
      activity_type: trackingData.activityType,
      distance: trackingData.totalDistance,
      duration: duration,
      start_time: trackingData.startTime,
      end_time: endTime,
      locations: trackingData.locations
    };

    console.log('アクティビティ保存:', payload);

    const response = await axios.post('/api/activities', payload);

    if (response.data.success) {
      alert(`🎉 アクティビティを保存しました！\n距離: ${trackingData.totalDistance.toFixed(2)} km\n時間: ${Math.floor(duration / 60)}分`);
      
      // データリロード
      await loadStats();
    } else {
      alert('保存に失敗しました: ' + response.data.error);
    }
  } catch (error) {
    console.error('保存エラー:', error);
    alert('保存中にエラーが発生しました');
  }
}

// =====================================
// 距離計算（Haversine公式）
// =====================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球の半径（km）
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
