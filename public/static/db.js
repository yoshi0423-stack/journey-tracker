/* ===================================================================
   Journey Tracker – Server API Layer (db.js) v3
   
   全データをサーバーAPI経由でD1データベースに永続化する。
   認証トークンはlocalStorageに保存。
   =================================================================== */

// ─── Auth Token Management ────────────────────
function getToken() { return localStorage.getItem('jt_token'); }
function setToken(token) { localStorage.setItem('jt_token', token); }
function clearToken() { localStorage.removeItem('jt_token'); }
function getUser() { 
  const u = localStorage.getItem('jt_user');
  return u ? JSON.parse(u) : null;
}
function setUser(user) { localStorage.setItem('jt_user', JSON.stringify(user)); }
function clearUser() { localStorage.removeItem('jt_user'); }

// ─── API Helper ────────────────────
async function api(path, opts = {}) {
  const token = getToken();
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`/api${path}`, { ...opts, headers });
  const json = await res.json();
  if (!res.ok && res.status === 401) {
    // セッション切れ → ログアウト
    clearToken();
    clearUser();
    if (window.__onAuthExpired) window.__onAuthExpired();
  }
  return json;
}

// ─── Open (互換性のため残す: no-op) ────────────
function openDB() { return Promise.resolve(); }

// ═══════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════

async function signup(email, password, displayName) {
  const res = await api('/auth/signup', {
    method: 'POST',
    body: { email, password, display_name: displayName || '' }
  });
  if (res.ok) {
    setToken(res.data.token);
    setUser(res.data.user);
  }
  return res;
}

async function login(email, password) {
  const res = await api('/auth/login', {
    method: 'POST',
    body: { email, password }
  });
  if (res.ok) {
    setToken(res.data.token);
    setUser(res.data.user);
  }
  return res;
}

async function logout() {
  await api('/auth/logout', { method: 'POST' });
  clearToken();
  clearUser();
}

function isLoggedIn() {
  return !!getToken();
}

async function getMe() {
  if (!getToken()) return null;
  const res = await api('/auth/me');
  if (res.ok) return res.data;
  return null;
}

// ═══════════════════════════════════════════════════════════════
// Profile (性格プロフィール)
// ═══════════════════════════════════════════════════════════════

async function saveProfile(profileData) {
  const res = await api('/profile', {
    method: 'POST',
    body: {
      mbti: profileData.mbti,
      bigFive: profileData.bigFive,
      answers: profileData.answers,
      level: profileData.level,
      totalActivities: profileData.totalActivities,
      evolution_log: profileData.evolution_log || profileData.evolutionLog,
    }
  });
  return res.ok ? profileData : null;
}

async function getProfile() {
  const res = await api('/profile');
  if (res.ok && res.data) {
    return {
      mbti: res.data.mbti,
      bigFive: res.data.bigFive,
      answers: res.data.answers,
      level: res.data.level || 1,
      totalActivities: res.data.totalActivities || 0,
      created_at: res.data.created_at,
      updated_at: res.data.updated_at,
    };
  }
  return null;
}

async function hasProfile() {
  const p = await getProfile();
  return !!p && !!p.mbti;
}

async function clearProfile() {
  await api('/profile', { method: 'DELETE' });
}

async function saveEvolutionLog(entry) {
  // プロフィールから現在のログを取得して追記
  const res = await api('/profile');
  if (!res.ok) return;
  const currentLog = (res.data && res.data.evolution_log) ? res.data.evolution_log : [];
  currentLog.push({ ...entry, timestamp: new Date().toISOString() });
  if (currentLog.length > 50) currentLog.splice(0, currentLog.length - 50);
  await api('/profile', {
    method: 'POST',
    body: { evolution_log: currentLog }
  });
}

async function getEvolutionLog() {
  const res = await api('/profile');
  if (res.ok && res.data) {
    return res.data.evolution_log || [];
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════
// Activities CRUD
// ═══════════════════════════════════════════════════════════════

async function saveActivity(data) {
  const res = await api('/activities', {
    method: 'POST',
    body: {
      started_at: data.started_at,
      ended_at: data.ended_at,
      distance_m: data.distance_m,
      duration_sec: data.duration_sec,
      polyline: data.polyline || [],
      memo: data.memo || '',
      route_name: data.route_name || '',
    }
  });
  if (!res.ok) return { activity_id: null, new_milestones: [] };

  // プロフィールのtotalActivitiesも更新
  const stats = await getStats();
  const profile = await getProfile();
  if (profile) {
    profile.totalActivities = stats.total_activities;
    await saveProfile(profile);
    // 進化ログ記録（レベルアップ時）
    if (window.Personality) {
      const levelInfo = window.Personality.calcLevel(stats.total_activities);
      const prevLevel = window.Personality.calcLevel(stats.total_activities - 1);
      if (levelInfo.level > prevLevel.level) {
        await saveEvolutionLog({
          type: 'level_up',
          level: levelInfo.level,
          title: levelInfo.title,
          unlocks: levelInfo.unlocks,
        });
      }
    }
  }

  return res.data; // { activity_id, new_milestones }
}

async function getActivities(opts = {}) {
  const { period = 'all', limit = 500 } = opts;
  const params = new URLSearchParams();
  if (period !== 'all') params.set('period', period);
  params.set('limit', String(limit));
  const res = await api(`/activities?${params}`);
  if (res.ok) return res.data;
  return [];
}

async function getActivity(id) {
  const res = await api(`/activities/${id}`);
  if (res.ok) return res.data;
  return null;
}

async function updateActivity(id, patch) {
  const res = await api(`/activities/${id}`, {
    method: 'PATCH',
    body: patch
  });
  return res.ok;
}

async function deleteActivity(id) {
  await api(`/activities/${id}`, { method: 'DELETE' });
}

// ═══════════════════════════════════════════════════════════════
// Stats
// ═══════════════════════════════════════════════════════════════

async function getStats() {
  const res = await api('/stats');
  if (res.ok && res.data) return res.data;
  return {
    total_distance_m: 0, total_duration_sec: 0,
    total_activities: 0, activity_days: 0,
    first_activity_at: null, last_activity_at: null,
  };
}

// ═══════════════════════════════════════════════════════════════
// Milestones
// ═══════════════════════════════════════════════════════════════

async function getMilestones() {
  const res = await api('/milestones');
  if (res.ok) return res.data;
  return [];
}

// ═══════════════════════════════════════════════════════════════
// Review
// ═══════════════════════════════════════════════════════════════

async function getReview(period = 'week') {
  const res = await api(`/review?period=${period}`);
  if (res.ok) return res.data;
  return { period, summary: { count: 0, total_distance_m: 0, total_duration_sec: 0, avg_distance_m: 0 }, hour_distribution: [], daily: [] };
}

// ═══════════════════════════════════════════════════════════════
// Heatmap
// ═══════════════════════════════════════════════════════════════

async function getHeatmapRoutes(period = 'all') {
  const res = await api(`/heatmap?period=${period}`);
  if (res.ok) return res.data;
  return [];
}

// ═══════════════════════════════════════════════════════════════
// Export / Import / Clear
// ═══════════════════════════════════════════════════════════════

async function exportAllData() {
  const res = await api('/data/export');
  if (res.ok) return res.data;
  return { version: 3, exported_at: new Date().toISOString(), stats: {}, milestones: [], activities: [], profile: null };
}

async function importData(json) {
  const res = await api('/data/import', { method: 'POST', body: json });
  return res.ok;
}

async function clearAllData() {
  await api('/data/all', { method: 'DELETE' });
}

async function clearEverything() {
  await api('/data/everything', { method: 'DELETE' });
}

// ═══════════════════════════════════════════════════════════════
// Server Sync (レガシー互換 – 常にサーバーに保存済みなのでno-op)
// ═══════════════════════════════════════════════════════════════

async function syncToServer() {
  return { synced: 0 };
}

// ─── Public API ─────────────────────────
window.DB = {
  open: openDB,
  // Auth
  signup, login, logout, isLoggedIn, getMe,
  getToken, setToken, clearToken,
  getUser, setUser, clearUser,
  // Profile
  saveProfile, getProfile, hasProfile, clearProfile,
  saveEvolutionLog, getEvolutionLog,
  // Activities
  saveActivity, getActivities, getActivity, updateActivity, deleteActivity,
  // Stats & Milestones
  getStats, getMilestones,
  // Review & Heatmap
  getReview, getHeatmapRoutes,
  // Data management
  exportAllData, importData, clearAllData, clearEverything,
  // Sync (legacy)
  syncToServer,
};
