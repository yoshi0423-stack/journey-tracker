/* ===================================================================
   Journey Tracker – SPA Controller v2
   全データをデバイスローカル (IndexedDB) で管理。
   サーバーAPIはバックグラウンド同期のみ。
   =================================================================== */

// ─── State ───
const S = {
  tab: 'record',
  tracking: false,
  paused: false,
  watchId: null,
  startTime: null,
  pausedTime: 0,
  pauseStart: null,
  points: [],
  lastPos: null,
  distance: 0,
  timerInterval: null,
  maps: {},
  mapFilter: 'all',
  reviewPeriod: 'week',
  seenMilestones: JSON.parse(localStorage.getItem('seenMs') || '[]'),
};

// ─── Boot ───
document.addEventListener('DOMContentLoaded', async () => {
  await DB.open();
  renderShell();
  switchTab('record');
  // バックグラウンド同期（静かに）
  DB.syncToServer().catch(() => {});
});

// ═══════════════════════════════════════════════════════════════
// Shell
// ═══════════════════════════════════════════════════════════════
function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="page-record" class="page"></div>
    <div id="page-map" class="page"></div>
    <div id="page-review" class="page"></div>
    <div id="page-compare" class="page"></div>
    <div id="tracking-panel"></div>
    <div id="save-modal"></div>
    <div id="milestone-overlay"></div>
  `;
  const bar = document.createElement('div');
  bar.id = 'tab-bar';
  bar.innerHTML = `
    <button class="tab-btn" data-tab="record"><i class="fas fa-circle-dot"></i><span>記録</span></button>
    <button class="tab-btn" data-tab="map"><i class="fas fa-map"></i><span>地図</span></button>
    <button class="tab-btn" data-tab="review"><i class="fas fa-calendar-days"></i><span>ふりかえり</span></button>
    <button class="tab-btn" data-tab="compare"><i class="fas fa-code-compare"></i><span>比較</span><span class="tab-badge" id="compare-badge"></span></button>
  `;
  document.body.appendChild(bar);
  bar.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
}

function switchTab(tab) {
  S.tab = tab;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${tab}`).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'record') renderRecordPage();
  if (tab === 'map') renderMapPage();
  if (tab === 'review') renderReviewPage();
  if (tab === 'compare') renderComparePage();
}

// ═══════════════════════════════════════════════════════════════
// 1. Record (Home)
// ═══════════════════════════════════════════════════════════════
async function renderRecordPage() {
  const page = document.getElementById('page-record');
  const st = await DB.getStats();
  const distKm = ((st.total_distance_m || 0) / 1000).toFixed(1);
  const durH = Math.floor((st.total_duration_sec || 0) / 3600);
  const durM = Math.floor(((st.total_duration_sec || 0) % 3600) / 60);
  const days = st.activity_days || 0;
  const acts = st.total_activities || 0;

  page.innerHTML = `
    <div style="padding:16px 16px 0">
      <div class="card" style="text-align:center;padding:28px 20px">
        <div style="font-size:14px;color:var(--muted);font-weight:600;margin-bottom:4px">あなたの歩み</div>
        <div style="font-size:48px;font-weight:900" class="text-gradient">${distKm}<span style="font-size:18px;opacity:.6"> km</span></div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px">${acts}回の記録 · ${days}日間の積み重ね</div>
        <div style="margin-top:8px"><span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--success);background:#f0fdf4;padding:3px 10px;border-radius:20px"><i class="fas fa-database" style="font-size:9px"></i>デバイスに保存</span></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
        <div class="stat-pill"><div class="value">${durH}<span style="font-size:14px">h</span>${durM}<span style="font-size:14px">m</span></div><div class="label">累計時間</div></div>
        <div class="stat-pill"><div class="value">${days}</div><div class="label">活動日数</div></div>
        <div class="stat-pill"><div class="value">${acts}</div><div class="label">記録回数</div></div>
      </div>

      <div style="text-align:center;margin:24px 0">
        <button class="btn-primary" style="width:100%;max-width:320px;padding:18px;font-size:18px;border-radius:20px" id="btn-start-record">
          <i class="fas fa-location-arrow"></i> 記録をはじめる
        </button>
      </div>

      <div class="card">
        <div style="font-weight:700;font-size:15px;margin-bottom:12px"><i class="fas fa-clock-rotate-left" style="color:var(--primary);margin-right:6px"></i>最近の記録</div>
        <div id="recent-list">読み込み中...</div>
      </div>

      <!-- データ管理セクション -->
      <div class="card" style="margin-top:4px">
        <div style="font-weight:700;font-size:15px;margin-bottom:12px"><i class="fas fa-hard-drive" style="color:var(--muted);margin-right:6px"></i>データ管理</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px">全データはこのデバイスのブラウザに保存されています</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="data-mgmt-btn" id="btn-export"><i class="fas fa-download"></i> エクスポート</button>
          <button class="data-mgmt-btn" id="btn-import"><i class="fas fa-upload"></i> インポート</button>
          <button class="data-mgmt-btn danger" id="btn-clear"><i class="fas fa-trash"></i> 全削除</button>
        </div>
        <input type="file" id="import-file" accept=".json" style="display:none" />
      </div>
    </div>
  `;

  document.getElementById('btn-start-record').addEventListener('click', startTracking);
  document.getElementById('btn-export').addEventListener('click', handleExport);
  document.getElementById('btn-import').addEventListener('click', () => document.getElementById('import-file').click());
  document.getElementById('import-file').addEventListener('change', handleImport);
  document.getElementById('btn-clear').addEventListener('click', handleClear);
  loadRecentActivities();
}

async function loadRecentActivities() {
  const acts = await DB.getActivities({ limit: 8 });
  const el = document.getElementById('recent-list');
  if (!el) return;
  if (acts.length === 0) { el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px">まだ記録がありません</div>'; return; }
  el.innerHTML = acts.map(a => {
    const d = (a.distance_m / 1000).toFixed(2);
    const t = fmtDuration(a.duration_sec);
    const dt = fmtDate(a.started_at);
    return `<div class="activity-row"><div class="activity-dot"></div><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:14px">${esc(a.route_name || a.memo || dt)}</div><div style="font-size:12px;color:var(--muted)">${dt}</div></div><div style="text-align:right"><div style="font-weight:700;font-size:15px">${d} km</div><div style="font-size:12px;color:var(--muted)">${t}</div></div></div>`;
  }).join('');
}

// ─── Data management ───
async function handleExport() {
  const data = await DB.exportAllData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `journey-tracker-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('現在のデータを上書きしてインポートしますか？\n（元のデータは失われます）')) { e.target.value = ''; return; }
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    if (!json.activities) throw new Error('invalid format');
    await DB.importData(json);
    alert(`${json.activities.length}件の記録をインポートしました`);
    renderRecordPage();
  } catch (err) {
    alert('インポートに失敗しました: ' + err.message);
  }
  e.target.value = '';
}

async function handleClear() {
  if (!confirm('全てのデータを削除しますか？\nこの操作は取り消せません。')) return;
  if (!confirm('本当に削除しますか？\n先にエクスポートすることをお勧めします。')) return;
  await DB.clearAllData();
  alert('全データを削除しました');
  renderRecordPage();
}

// ═══════════════════════════════════════════════════════════════
// 2. Tracking
// ═══════════════════════════════════════════════════════════════
function startTracking() {
  if (!navigator.geolocation) { alert('位置情報が利用できません'); return; }
  S.tracking = true; S.paused = false; S.points = []; S.distance = 0;
  S.startTime = Date.now(); S.pausedTime = 0; S.lastPos = null;
  S.watchId = navigator.geolocation.watchPosition(onPos, onPosErr, {
    enableHighAccuracy: true, maximumAge: 0, timeout: 15000
  });
  S.timerInterval = setInterval(updateTrackingUI, 1000);
  showTrackingPanel();
}

function onPos(pos) {
  if (S.paused || !S.tracking) return;
  const { latitude: lat, longitude: lng, accuracy } = pos.coords;
  if (accuracy > 50) return;
  const elapsed = getElapsed();
  if (S.lastPos) {
    const d = haversine(S.lastPos[0], S.lastPos[1], lat, lng);
    const dt = elapsed - (S.points.length > 0 ? S.points[S.points.length - 1][2] : 0);
    if (d < 10 && dt < 5) return;
    S.distance += d;
  }
  S.points.push([lat, lng, elapsed]);
  S.lastPos = [lat, lng];
  updateTrackingUI();
}

function onPosErr(err) { console.warn('Geo error:', err.message); }

function getElapsed() {
  if (!S.startTime) return 0;
  const pausing = S.paused ? (Date.now() - S.pauseStart) : 0;
  return Math.floor((Date.now() - S.startTime - S.pausedTime - pausing) / 1000);
}

function pauseTracking() { S.paused = true; S.pauseStart = Date.now(); updateTrackingUI(); }
function resumeTracking() { if (S.pauseStart) S.pausedTime += Date.now() - S.pauseStart; S.paused = false; S.pauseStart = null; updateTrackingUI(); }
function stopTracking() {
  S.tracking = false;
  if (S.watchId !== null) navigator.geolocation.clearWatch(S.watchId);
  if (S.timerInterval) clearInterval(S.timerInterval);
  S.watchId = null; S.timerInterval = null;
  hideTrackingPanel();
  showSaveModal();
}

function showTrackingPanel() {
  const panel = document.getElementById('tracking-panel');
  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div class="tracking-stat"><div class="val" id="tp-dist">0.00</div><div class="lbl">km</div></div>
      <div class="tracking-stat"><div class="val" id="tp-time">00:00</div><div class="lbl">時間</div></div>
      <div class="tracking-stat"><div class="val" id="tp-pts">0</div><div class="lbl">ポイント</div></div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn-ghost" style="flex:1" id="btn-pause"><i class="fas fa-pause"></i> 一時停止</button>
      <button class="btn-primary btn-danger" style="flex:1" id="btn-stop"><i class="fas fa-stop"></i> 終了</button>
    </div>
  `;
  panel.classList.add('open');
  document.getElementById('btn-pause').addEventListener('click', () => { if (S.paused) resumeTracking(); else pauseTracking(); });
  document.getElementById('btn-stop').addEventListener('click', stopTracking);
}

function updateTrackingUI() {
  const d = document.getElementById('tp-dist');
  const t = document.getElementById('tp-time');
  const p = document.getElementById('tp-pts');
  const pauseBtn = document.getElementById('btn-pause');
  if (!d) return;
  d.textContent = (S.distance / 1000).toFixed(2);
  t.textContent = fmtDurationShort(getElapsed());
  p.textContent = S.points.length;
  if (pauseBtn) pauseBtn.innerHTML = S.paused ? '<i class="fas fa-play"></i> 再開' : '<i class="fas fa-pause"></i> 一時停止';
}

function hideTrackingPanel() { document.getElementById('tracking-panel').classList.remove('open'); }

// ─── Save modal ───
function showSaveModal() {
  const modal = document.getElementById('save-modal');
  const distKm = (S.distance / 1000).toFixed(2);
  const elapsed = getElapsed();
  modal.innerHTML = `
    <div class="save-sheet">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:14px;color:var(--muted);font-weight:600">記録完了</div>
        <div style="font-size:42px;font-weight:900" class="text-gradient">${distKm} km</div>
        <div style="font-size:14px;color:var(--muted)">${fmtDuration(elapsed)}</div>
      </div>
      <div id="save-map" class="map-container" style="height:200px;margin-bottom:16px;border-radius:12px"></div>
      <input type="text" id="save-route-name" placeholder="ルート名（任意）" style="margin-bottom:8px" />
      <textarea id="save-memo" placeholder="ひとことメモ（任意）" rows="2" style="margin-bottom:16px;resize:none"></textarea>
      <div style="display:flex;gap:10px">
        <button class="btn-ghost" style="flex:1;color:var(--text);border-color:#e2e8f0" id="btn-discard">破棄</button>
        <button class="btn-primary" style="flex:1" id="btn-save"><i class="fas fa-hard-drive"></i> デバイスに保存</button>
      </div>
    </div>
  `;
  modal.classList.add('show');
  setTimeout(() => {
    if (S.points.length > 1) {
      const map = L.map('save-map', { zoomControl: false, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      const latlngs = S.points.map(p => [p[0], p[1]]);
      const line = L.polyline(latlngs, { color: '#4f46e5', weight: 4 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [30, 30] });
    }
  }, 100);
  document.getElementById('btn-discard').addEventListener('click', () => modal.classList.remove('show'));
  document.getElementById('btn-save').addEventListener('click', saveActivity);
}

async function saveActivity() {
  const elapsed = getElapsed();
  const payload = {
    started_at: new Date(S.startTime).toISOString(),
    ended_at: new Date().toISOString(),
    distance_m: S.distance,
    duration_sec: elapsed,
    polyline: S.points,
    memo: document.getElementById('save-memo')?.value || '',
    route_name: document.getElementById('save-route-name')?.value || '',
  };

  const result = await DB.saveActivity(payload);
  document.getElementById('save-modal').classList.remove('show');

  if (result.new_milestones && result.new_milestones.length > 0) {
    await showMilestoneOverlay(result.new_milestones[0]);
  }

  // バックグラウンドでサーバー同期（失敗しても問題なし）
  DB.syncToServer().catch(() => {});

  renderRecordPage();
}

// ═══════════════════════════════════════════════════════════════
// 3. My Map
// ═══════════════════════════════════════════════════════════════
async function renderMapPage() {
  const page = document.getElementById('page-map');
  page.innerHTML = `
    <div style="padding:12px 16px 0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-weight:800;font-size:18px"><i class="fas fa-map" style="color:var(--primary);margin-right:6px"></i>マイマップ</div>
      </div>
      <div class="filter-bar" id="map-filters">
        <button class="filter-pill active" data-p="all">全期間</button>
        <button class="filter-pill" data-p="year">今年</button>
        <button class="filter-pill" data-p="month">今月</button>
        <button class="filter-pill" data-p="week">今週</button>
      </div>
    </div>
    <div id="mymap-container" class="map-container fullscreen" style="margin:0"></div>
    <div id="map-legend" style="position:absolute;bottom:calc(var(--tab-h) + var(--safe-b) + 12px);left:16px;right:16px;z-index:500">
      <div class="card" style="padding:12px 16px;display:flex;justify-content:space-around;font-size:13px;font-weight:600">
        <div><span style="display:inline-block;width:12px;height:4px;border-radius:2px;background:rgba(79,70,229,.2);margin-right:4px"></span>1回</div>
        <div><span style="display:inline-block;width:12px;height:4px;border-radius:2px;background:rgba(79,70,229,.5);margin-right:4px"></span>2-3回</div>
        <div><span style="display:inline-block;width:12px;height:4px;border-radius:2px;background:rgba(79,70,229,.8);margin-right:4px"></span>4回+</div>
      </div>
    </div>
  `;
  page.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      page.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.mapFilter = btn.dataset.p;
      loadMyMap();
    });
  });
  loadMyMap();
}

async function loadMyMap() {
  const container = document.getElementById('mymap-container');
  if (!container) return;
  if (S.maps.mymap) { S.maps.mymap.remove(); S.maps.mymap = null; }

  const map = L.map(container, { zoomControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
  S.maps.mymap = map;

  const allRoutes = await DB.getHeatmapRoutes(S.mapFilter);
  if (allRoutes.length === 0) { map.setView([35.68, 139.76], 12); return; }

  const segCount = {};
  const allPts = [];
  allRoutes.forEach(route => {
    if (!Array.isArray(route) || route.length < 2) return;
    for (let i = 0; i < route.length - 1; i++) {
      const key = gridKey(route[i][0], route[i][1]) + '-' + gridKey(route[i + 1][0], route[i + 1][1]);
      segCount[key] = (segCount[key] || 0) + 1;
    }
    route.forEach(p => allPts.push([p[0], p[1]]));
  });

  allRoutes.forEach(route => {
    if (!Array.isArray(route) || route.length < 2) return;
    let maxCnt = 1;
    for (let i = 0; i < route.length - 1; i++) {
      const key = gridKey(route[i][0], route[i][1]) + '-' + gridKey(route[i + 1][0], route[i + 1][1]);
      maxCnt = Math.max(maxCnt, segCount[key] || 1);
    }
    const opacity = Math.min(0.2 + maxCnt * 0.25, 1);
    const weight = Math.min(3 + maxCnt, 8);
    L.polyline(route.map(p => [p[0], p[1]]), {
      color: '#4f46e5', weight, opacity, lineJoin: 'round', lineCap: 'round'
    }).addTo(map);
  });

  if (allPts.length > 0) map.fitBounds(L.latLngBounds(allPts), { padding: [30, 30] });
}

function gridKey(lat, lng) { return `${Math.round(lat * 1000)},${Math.round(lng * 1000)}`; }

// ═══════════════════════════════════════════════════════════════
// 4. Review
// ═══════════════════════════════════════════════════════════════
async function renderReviewPage() {
  const page = document.getElementById('page-review');
  page.innerHTML = `
    <div style="padding:16px">
      <div style="font-weight:800;font-size:18px;margin-bottom:12px"><i class="fas fa-calendar-days" style="color:var(--primary);margin-right:6px"></i>ふりかえり</div>
      <div class="filter-bar" id="review-filters">
        <button class="filter-pill active" data-p="week">今週</button>
        <button class="filter-pill" data-p="month">今月</button>
      </div>
      <div id="review-content">読み込み中...</div>
    </div>
  `;
  page.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      page.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      S.reviewPeriod = btn.dataset.p;
      loadReview();
    });
  });
  loadReview();
}

async function loadReview() {
  const el = document.getElementById('review-content');
  if (!el) return;
  const data = await DB.getReview(S.reviewPeriod);
  const { summary, hour_distribution, daily } = data;
  const distKm = ((summary.total_distance_m || 0) / 1000).toFixed(1);
  const durH = Math.floor((summary.total_duration_sec || 0) / 3600);
  const durM = Math.floor(((summary.total_duration_sec || 0) % 3600) / 60);
  const count = summary.count || 0;
  const periodLabel = S.reviewPeriod === 'week' ? '今週' : '今月';
  const hours = hour_distribution || [];
  const bestHour = hours.length > 0 ? hours.reduce((a, b) => b.cnt > a.cnt ? b : a, hours[0]) : null;
  const dailyData = daily || [];
  const maxDist = Math.max(...dailyData.map(d => d.dist || 0), 1);

  el.innerHTML = `
    <div class="card fade-in" style="text-align:center">
      <div style="font-size:13px;color:var(--muted);font-weight:600">${periodLabel}のまとめ</div>
      <div style="font-size:44px;font-weight:900;margin:8px 0" class="text-gradient">${distKm} km</div>
      <div style="display:flex;justify-content:center;gap:24px;font-size:13px;color:var(--muted)">
        <div><i class="fas fa-clock" style="margin-right:4px"></i>${durH}時間${durM}分</div>
        <div><i class="fas fa-shoe-prints" style="margin-right:4px"></i>${count}回</div>
      </div>
    </div>
    ${dailyData.length > 0 ? `<div class="card fade-in"><div style="font-weight:700;font-size:14px;margin-bottom:12px">日別の距離</div><div class="bar-chart">${dailyData.map(d => { const h = Math.max((d.dist / maxDist) * 100, 2); return `<div class="bar-col"><div class="bar" style="height:${h}%"></div><div class="bar-label">${d.day.slice(5)}</div></div>`; }).join('')}</div></div>` : ''}
    ${bestHour ? `<div class="card fade-in"><div style="font-weight:700;font-size:14px;margin-bottom:8px">よく歩く時間帯</div><div style="font-size:28px;font-weight:800;color:var(--primary)">${bestHour.hour}:00</div><div style="font-size:13px;color:var(--muted)">${bestHour.cnt}回記録</div></div>` : ''}
    <div class="card fade-in"><div style="font-weight:700;font-size:14px;margin-bottom:8px">時間帯の分布</div><div class="bar-chart" style="height:80px">${Array.from({ length: 24 }, (_, h) => { const cnt = (hours.find(x => x.hour === h) || {}).cnt || 0; const maxCnt = Math.max(...hours.map(x => x.cnt), 1); const height = Math.max((cnt / maxCnt) * 100, 2); return `<div class="bar-col"><div class="bar" style="height:${height}%;${cnt === 0 ? 'background:#e2e8f0' : ''}"></div>${h % 6 === 0 ? `<div class="bar-label">${h}</div>` : ''}</div>`; }).join('')}</div></div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// 5. Compare
// ═══════════════════════════════════════════════════════════════
async function renderComparePage() {
  const page = document.getElementById('page-compare');
  const milestones = await DB.getMilestones();
  const st = await DB.getStats();
  const totalKm = ((st.total_distance_m || 0) / 1000).toFixed(1);
  const thresholds = [10, 50, 100, 300, 1000];
  const nextKm = thresholds.find(t => (st.total_distance_m || 0) < t * 1000) || null;

  page.innerHTML = `
    <div style="padding:16px">
      <div style="font-weight:800;font-size:18px;margin-bottom:16px"><i class="fas fa-code-compare" style="color:var(--primary);margin-right:6px"></i>パラレル比較</div>
      <div class="card fade-in" style="padding:24px;text-align:center;margin-bottom:16px">
        <div style="font-size:13px;color:var(--muted);margin-bottom:16px;font-weight:600">いま立っている場所</div>
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center">
          <div>
            <div style="font-size:11px;color:var(--success);font-weight:700;margin-bottom:4px">やった自分</div>
            <div style="font-size:36px;font-weight:900;color:var(--primary)">${totalKm}</div>
            <div style="font-size:12px;color:var(--muted)">km</div>
          </div>
          <div style="font-size:24px;color:var(--muted)">vs</div>
          <div>
            <div style="font-size:11px;color:var(--danger);font-weight:700;margin-bottom:4px">やらなかった自分</div>
            <div style="font-size:36px;font-weight:900;color:#cbd5e1">0</div>
            <div style="font-size:12px;color:var(--muted)">km</div>
          </div>
        </div>
        <div style="margin-top:16px;font-size:14px;font-weight:700;color:var(--primary)">この差は、もう埋まらない。</div>
      </div>
      ${nextKm ? `<div class="card fade-in" style="padding:20px"><div style="font-size:13px;color:var(--muted);font-weight:600;margin-bottom:8px">次のマイルストーン</div><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><div style="font-size:28px;font-weight:900;color:var(--accent)">${nextKm} km</div><div style="font-size:13px;color:var(--muted)">まであと ${(nextKm - totalKm).toFixed(1)} km</div></div><div style="background:#f1f5f9;border-radius:8px;height:8px;overflow:hidden"><div style="background:linear-gradient(90deg,var(--primary),var(--accent));height:100%;border-radius:8px;width:${Math.min((totalKm / nextKm) * 100, 100)}%;transition:width .6s"></div></div></div>` : ''}
      <div style="font-weight:700;font-size:15px;margin:20px 0 12px">達成した節目</div>
      ${milestones.length === 0 ? '<div style="text-align:center;color:var(--muted);padding:32px">まだ節目に到達していません</div>' :
      milestones.map(ms => {
        const km = (ms.threshold_m / 1000).toFixed(0);
        const date = fmtDate(ms.reached_at);
        const totalKmAt = (ms.total_distance_m / 1000).toFixed(1);
        return `<div class="card fade-in" style="border-left:4px solid var(--accent)"><div style="display:flex;align-items:center;gap:12px"><div style="font-size:28px;font-weight:900;color:var(--accent)">${km}km</div><div style="flex:1"><div style="font-size:13px;font-weight:600">${date} 到達</div><div style="font-size:12px;color:var(--muted)">${ms.total_activities}回の記録で累計 ${totalKmAt} km</div></div><i class="fas fa-trophy" style="font-size:20px;color:var(--accent)"></i></div></div>`;
      }).join('')}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// Milestone Overlay
// ═══════════════════════════════════════════════════════════════
async function showMilestoneOverlay(msType) {
  if (S.seenMilestones.includes(msType)) return;
  const milestones = await DB.getMilestones();
  const ms = milestones.find(m => m.type === msType);
  if (!ms) return;

  const km = (ms.threshold_m / 1000).toFixed(0);
  const totalKm = (ms.total_distance_m / 1000).toFixed(1);
  const durH = Math.floor(ms.total_duration_sec / 3600);
  const messages = ['この差は、もう埋まらない。', 'あなたは"前に進んだ"。', 'あの日の一歩目が、ここに繋がった。', '止まらなかった、その事実が全て。'];
  const msg = messages[Math.floor(Math.random() * messages.length)];

  const overlay = document.getElementById('milestone-overlay');
  overlay.innerHTML = `
    <div class="ms-card">
      <div class="ms-achieved">
        <div style="font-size:48px;margin-bottom:8px"><i class="fas fa-trophy"></i></div>
        <div style="font-size:14px;opacity:.7;margin-bottom:4px">MILESTONE REACHED</div>
        <div style="font-size:48px;font-weight:900;margin-bottom:8px">${km} km</div>
        <div style="font-size:16px;opacity:.9;margin-bottom:4px">累計 ${totalKm} km · ${durH}時間+</div>
        <div style="font-size:13px;opacity:.7">${ms.total_activities}回の記録の積み重ね</div>
      </div>
      <div class="ms-empty">
        <div style="font-size:14px;opacity:.5;margin-bottom:8px">やらなかった世界線</div>
        <div style="font-size:48px;font-weight:900;opacity:.3">0 km</div>
        <div style="font-size:14px;opacity:.4">距離も、時間も、地図も — 何もない</div>
      </div>
      <div style="background:var(--primary);padding:20px;text-align:center">
        <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:12px">${msg}</div>
        <button class="btn-primary" style="background:rgba(255,255,255,.2);width:100%" id="ms-close">閉じる</button>
      </div>
    </div>
  `;
  overlay.classList.add('show');
  const badge = document.getElementById('compare-badge');
  if (badge) badge.classList.add('show');
  document.getElementById('ms-close').addEventListener('click', () => {
    overlay.classList.remove('show');
    S.seenMilestones.push(msType);
    localStorage.setItem('seenMs', JSON.stringify(S.seenMilestones));
  });
}

// ═══════════════════════════════════════════════════════════════
// Utils
// ═══════════════════════════════════════════════════════════════
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDuration(sec) { const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); return h > 0 ? `${h}時間${m}分` : `${m}分`; }
function fmtDurationShort(sec) { const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60; return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ─── SW ───
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/static/sw.js').catch(() => {});
