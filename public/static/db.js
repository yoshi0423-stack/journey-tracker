/* ===================================================================
   Journey Tracker – IndexedDB Local Storage Layer (db.js)
   
   デバイスローカルに全データを永続化する。
   サーバーAPIはオプショナルなバックグラウンド同期先。
   ネットワーク接続不要で全機能が動作する。
   =================================================================== */

const DB_NAME = 'JourneyTracker';
const DB_VERSION = 1;
let _db = null;

// ─── DB Open ────────────────────────────────────────
function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      // activities: 1回の記録
      if (!db.objectStoreNames.contains('activities')) {
        const store = db.createObjectStore('activities', { keyPath: 'id', autoIncrement: true });
        store.createIndex('started_at', 'started_at', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }

      // milestones: 節目到達
      if (!db.objectStoreNames.contains('milestones')) {
        const store = db.createObjectStore('milestones', { keyPath: 'type' });
      }

      // meta: key-value (stats等)
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

// ─── Generic helpers ────────────────────────────────
async function tx(storeName, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function req2p(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function cursorAll(store, indexName, range, direction = 'prev') {
  return new Promise((resolve, reject) => {
    const results = [];
    const source = indexName ? store.index(indexName) : store;
    const req = source.openCursor(range, direction);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { results.push(cursor.value); cursor.continue(); }
      else resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

// ═══════════════════════════════════════════════════════════════
// Activities CRUD
// ═══════════════════════════════════════════════════════════════

/** 記録を保存し、stats + milestone を更新して返す */
async function saveActivity(data) {
  // data: { started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name }
  const record = {
    ...data,
    polyline: data.polyline || [],
    avg_speed: data.duration_sec > 0 ? data.distance_m / data.duration_sec : 0,
    created_at: new Date().toISOString(),
    synced: 0,   // 0 = 未同期
  };

  // maxSpeed 計算
  let maxSpeed = 0;
  const pts = record.polyline;
  for (let i = 1; i < pts.length; i++) {
    const dt = (pts[i][2] || 0) - (pts[i - 1][2] || 0);
    if (dt > 0) {
      const d = haversineLocal(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      maxSpeed = Math.max(maxSpeed, d / dt);
    }
  }
  record.max_speed = maxSpeed;

  const store = await tx('activities', 'readwrite');
  const id = await req2p(store.add(record));

  // stats 再計算
  await recalcStats();

  // milestone 判定
  const newMs = await checkMilestones(id);

  return { activity_id: id, new_milestones: newMs };
}

/** 全アクティビティ取得 (フィルタ対応) */
async function getActivities(opts = {}) {
  const { period = 'all', limit = 500 } = opts;
  const store = await tx('activities');
  let all = await cursorAll(store, 'started_at', null, 'prev');

  // 期間フィルタ
  if (period !== 'all') {
    const now = new Date();
    let since;
    if (period === 'week') since = new Date(now - 7 * 86400000);
    else if (period === 'month') since = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'year') since = new Date(now.getFullYear(), 0, 1);
    if (since) {
      const sinceISO = since.toISOString();
      all = all.filter(a => a.started_at >= sinceISO);
    }
  }

  return all.slice(0, limit);
}

/** 単体取得 */
async function getActivity(id) {
  const store = await tx('activities');
  return req2p(store.get(id));
}

/** メモ / ルート名更新 */
async function updateActivity(id, patch) {
  const store = await tx('activities', 'readwrite');
  const record = await req2p(store.get(id));
  if (!record) return null;
  if (patch.memo !== undefined) record.memo = patch.memo;
  if (patch.route_name !== undefined) record.route_name = patch.route_name;
  record.synced = 0;
  await req2p(store.put(record));
  return record;
}

/** アクティビティ削除 */
async function deleteActivity(id) {
  const store = await tx('activities', 'readwrite');
  await req2p(store.delete(id));
  await recalcStats();
  await recheckAllMilestones();
}

// ═══════════════════════════════════════════════════════════════
// Stats (ローカル再計算)
// ═══════════════════════════════════════════════════════════════

async function recalcStats() {
  const store = await tx('activities');
  const all = await cursorAll(store, null, null, 'next');

  let total_distance_m = 0;
  let total_duration_sec = 0;
  let total_activities = all.length;
  const daySet = new Set();
  let first = null, last = null;

  for (const a of all) {
    total_distance_m += a.distance_m || 0;
    total_duration_sec += a.duration_sec || 0;
    const day = (a.started_at || '').slice(0, 10);
    if (day) daySet.add(day);
    if (!first || a.started_at < first) first = a.started_at;
    if (!last || a.started_at > last) last = a.started_at;
  }

  const stats = {
    key: 'user_stats',
    total_distance_m,
    total_duration_sec,
    total_activities,
    activity_days: daySet.size,
    first_activity_at: first,
    last_activity_at: last,
    updated_at: new Date().toISOString(),
  };

  const metaStore = await tx('meta', 'readwrite');
  await req2p(metaStore.put(stats));
  return stats;
}

async function getStats() {
  const store = await tx('meta');
  const stats = await req2p(store.get('user_stats'));
  return stats || {
    total_distance_m: 0, total_duration_sec: 0,
    total_activities: 0, activity_days: 0,
    first_activity_at: null, last_activity_at: null,
  };
}

// ═══════════════════════════════════════════════════════════════
// Milestones (ローカル判定)
// ═══════════════════════════════════════════════════════════════

const MILESTONE_DEFS = [
  { type: 'distance_10km',   threshold: 10000 },
  { type: 'distance_50km',   threshold: 50000 },
  { type: 'distance_100km',  threshold: 100000 },
  { type: 'distance_300km',  threshold: 300000 },
  { type: 'distance_1000km', threshold: 1000000 },
];

async function checkMilestones(activityId) {
  const stats = await getStats();
  const newMs = [];

  for (const def of MILESTONE_DEFS) {
    if (stats.total_distance_m >= def.threshold) {
      const msStore = await tx('milestones');
      const existing = await req2p(msStore.get(def.type));
      if (!existing) {
        const ms = {
          type: def.type,
          threshold_m: def.threshold,
          reached_at: new Date().toISOString(),
          total_distance_m: stats.total_distance_m,
          total_duration_sec: stats.total_duration_sec,
          total_activities: stats.total_activities,
          activity_id: activityId,
        };
        const writeStore = await tx('milestones', 'readwrite');
        await req2p(writeStore.put(ms));
        newMs.push(def.type);
      }
    }
  }
  return newMs;
}

async function recheckAllMilestones() {
  // stats が減った場合にマイルストーンを削除
  const stats = await getStats();
  for (const def of MILESTONE_DEFS) {
    if (stats.total_distance_m < def.threshold) {
      const writeStore = await tx('milestones', 'readwrite');
      await req2p(writeStore.delete(def.type));
    }
  }
}

async function getMilestones() {
  const store = await tx('milestones');
  const all = await cursorAll(store, null, null, 'next');
  return all.sort((a, b) => a.threshold_m - b.threshold_m);
}

// ═══════════════════════════════════════════════════════════════
// Review (ローカル集計)
// ═══════════════════════════════════════════════════════════════

async function getReview(period = 'week') {
  const now = new Date();
  let since;
  if (period === 'week') since = new Date(now - 7 * 86400000);
  else since = new Date(now.getFullYear(), now.getMonth(), 1);
  const sinceISO = since.toISOString();

  const store = await tx('activities');
  const all = await cursorAll(store, 'started_at', null, 'next');
  const filtered = all.filter(a => a.started_at >= sinceISO);

  // 集計
  let total_distance_m = 0, total_duration_sec = 0;
  const hourMap = {};
  const dayMap = {};

  for (const a of filtered) {
    total_distance_m += a.distance_m || 0;
    total_duration_sec += a.duration_sec || 0;

    const dt = new Date(a.started_at);
    const h = dt.getHours();
    hourMap[h] = (hourMap[h] || 0) + 1;

    const day = a.started_at.slice(0, 10);
    dayMap[day] = (dayMap[day] || 0) + (a.distance_m || 0);
  }

  const hour_distribution = Object.entries(hourMap)
    .map(([h, cnt]) => ({ hour: parseInt(h), cnt }))
    .sort((a, b) => a.hour - b.hour);

  const daily = Object.entries(dayMap)
    .map(([day, dist]) => ({ day, dist }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    period,
    summary: {
      count: filtered.length,
      total_distance_m,
      total_duration_sec,
      avg_distance_m: filtered.length > 0 ? total_distance_m / filtered.length : 0,
    },
    hour_distribution,
    daily,
  };
}

// ═══════════════════════════════════════════════════════════════
// Heatmap (ローカル)
// ═══════════════════════════════════════════════════════════════

async function getHeatmapRoutes(period = 'all') {
  const acts = await getActivities({ period, limit: 500 });
  return acts.map(a => {
    if (typeof a.polyline === 'string') {
      try { return JSON.parse(a.polyline); } catch { return []; }
    }
    return a.polyline || [];
  }).filter(r => Array.isArray(r) && r.length > 0);
}

// ═══════════════════════════════════════════════════════════════
// Export / Import / Clear
// ═══════════════════════════════════════════════════════════════

async function exportAllData() {
  const activities = await getActivities({ period: 'all', limit: 99999 });
  const milestones = await getMilestones();
  const stats = await getStats();
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    stats,
    milestones,
    activities,
  };
}

async function importData(json) {
  // 全クリアしてからインポート
  await clearAllData();

  if (json.activities && Array.isArray(json.activities)) {
    for (const a of json.activities) {
      const store = await tx('activities', 'readwrite');
      // IDを保持してインポート
      const record = { ...a, synced: 0 };
      delete record.id;   // autoIncrement に任せる
      await req2p(store.add(record));
    }
  }

  // stats & milestones を再計算
  await recalcStats();
  // milestones もインポートデータから復元
  if (json.milestones && Array.isArray(json.milestones)) {
    for (const ms of json.milestones) {
      const store = await tx('milestones', 'readwrite');
      await req2p(store.put(ms));
    }
  }
}

async function clearAllData() {
  const actStore = await tx('activities', 'readwrite');
  await req2p(actStore.clear());
  const msStore = await tx('milestones', 'readwrite');
  await req2p(msStore.clear());
  const metaStore = await tx('meta', 'readwrite');
  await req2p(metaStore.clear());
}

// ═══════════════════════════════════════════════════════════════
// Server Sync (オプショナル・バックグラウンド)
// ═══════════════════════════════════════════════════════════════

async function syncToServer() {
  try {
    const store = await tx('activities');
    const all = await cursorAll(store, 'synced', IDBKeyRange.only(0), 'next');
    if (all.length === 0) return { synced: 0 };

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activities: all }),
    });

    if (res.ok) {
      // synced フラグ更新
      for (const a of all) {
        const ws = await tx('activities', 'readwrite');
        a.synced = 1;
        await req2p(ws.put(a));
      }
      return { synced: all.length };
    }
    return { synced: 0, error: 'server error' };
  } catch (e) {
    // オフラインでも問題なし
    return { synced: 0, error: 'offline' };
  }
}

// ─── Haversine (meters) ─────────────────────────────
function haversineLocal(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Public API (window.DB) ─────────────────────────
window.DB = {
  open: openDB,
  saveActivity,
  getActivities,
  getActivity,
  updateActivity,
  deleteActivity,
  getStats,
  getMilestones,
  getReview,
  getHeatmapRoutes,
  exportAllData,
  importData,
  clearAllData,
  syncToServer,
};
