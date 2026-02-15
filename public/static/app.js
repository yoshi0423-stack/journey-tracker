/* ===================================================================
   Journey Tracker – SPA Controller v4
   全データ: サーバーAPI (window.DB)
   性格パーソナライズ: window.Personality
   認証: アカウントベース
   =================================================================== */

// ─── State ───
const S = {
  tab: 'record',
  tracking: false, paused: false, watchId: null,
  startTime: null, pausedTime: 0, pauseStart: null,
  points: [], lastPos: null, distance: 0,
  timerInterval: null, maps: {},
  mapFilter: 'all', reviewPeriod: 'week',
  seenMilestones: JSON.parse(localStorage.getItem('seenMs') || '[]'),
  profile: null,
  personalization: null,
};

// ─── Auth expired callback ───
window.__onAuthExpired = () => {
  showToast('セッションが切れました。再ログインしてください');
  setTimeout(() => renderAuthScreen(), 500);
};

// ─── Boot ───
document.addEventListener('DOMContentLoaded', async () => {
  await DB.open();
  if (!DB.isLoggedIn()) {
    renderAuthScreen();
    return;
  }
  // ログイン済み → ユーザー情報チェック
  const me = await DB.getMe();
  if (!me) {
    renderAuthScreen();
    return;
  }
  await bootApp();
});

async function bootApp() {
  S.profile = await DB.getProfile();
  if (S.profile && S.profile.mbti) {
    S.personalization = Personality.getPersonalization({
      ...S.profile,
      totalActivities: (await DB.getStats()).total_activities,
    });
    Personality.applyTheme(S.personalization);
    renderShell();
    switchTab('record');
  } else {
    renderOnboarding();
  }
}

// ═══════════════════════════════════════════════════════════════
// Auth Screen: ログイン / サインアップ
// ═══════════════════════════════════════════════════════════════
function renderAuthScreen() {
  // タブバーを隠す
  const oldBar = document.getElementById('tab-bar');
  if (oldBar) oldBar.remove();

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-header">
        <div style="font-size:48px;margin-bottom:8px">🧭</div>
        <div style="font-size:24px;font-weight:900;margin-bottom:4px">Journey Tracker</div>
        <div style="font-size:14px;color:var(--muted);line-height:1.6">あなたの歩みを記録し<br>時間とともに深まる資産を築こう</div>
      </div>
      
      <div class="auth-tabs">
        <button class="auth-tab active" data-mode="login">ログイン</button>
        <button class="auth-tab" data-mode="signup">新規登録</button>
      </div>

      <form id="auth-form" class="auth-form">
        <div id="auth-name-field" style="display:none">
          <label class="auth-label">表示名</label>
          <input type="text" id="auth-name" placeholder="ニックネーム（任意）" class="auth-input" autocomplete="name" />
        </div>
        <div>
          <label class="auth-label">メールアドレス</label>
          <input type="email" id="auth-email" placeholder="you@example.com" class="auth-input" required autocomplete="email" />
        </div>
        <div>
          <label class="auth-label">パスワード</label>
          <input type="password" id="auth-password" placeholder="6文字以上" class="auth-input" required minlength="6" autocomplete="current-password" />
        </div>
        <div id="auth-error" class="auth-error" style="display:none"></div>
        <button type="submit" class="btn-primary auth-submit" id="auth-submit">
          ログイン
        </button>
      </form>

      <div class="auth-footer">
        <div style="font-size:12px;color:var(--muted);line-height:1.5">
          アカウントに保存されるので<br>どのデバイスからでもアクセスできます
        </div>
      </div>
    </div>
  `;

  let authMode = 'login';

  // タブ切り替え
  app.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      authMode = tab.dataset.mode;
      app.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === authMode));
      document.getElementById('auth-name-field').style.display = authMode === 'signup' ? 'block' : 'none';
      document.getElementById('auth-submit').textContent = authMode === 'login' ? 'ログイン' : 'アカウント作成';
      document.getElementById('auth-password').autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
      document.getElementById('auth-error').style.display = 'none';
    });
  });

  // フォーム送信
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value.trim();
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit');

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';
    errEl.style.display = 'none';

    try {
      let res;
      if (authMode === 'login') {
        res = await DB.login(email, password);
      } else {
        res = await DB.signup(email, password, name);
      }
      if (res.ok) {
        await bootApp();
      } else {
        errEl.textContent = res.error || 'エラーが発生しました';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = authMode === 'login' ? 'ログイン' : 'アカウント作成';
      }
    } catch (err) {
      errEl.textContent = 'ネットワークエラーが発生しました';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = authMode === 'login' ? 'ログイン' : 'アカウント作成';
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Onboarding: Big Five 10問診断
// ═══════════════════════════════════════════════════════════════
function renderOnboarding() {
  // タブバーを隠す
  const oldBar = document.getElementById('tab-bar');
  if (oldBar) oldBar.remove();

  const app = document.getElementById('app');
  const qs = Personality.BIG5_QUESTIONS;
  app.innerHTML = `
    <div class="onboarding">
      <div style="text-align:center;padding:40px 20px 24px">
        <div style="font-size:40px;margin-bottom:8px">🧭</div>
        <div style="font-size:22px;font-weight:900;margin-bottom:6px">あなたを知ることから</div>
        <div style="font-size:14px;color:var(--muted);line-height:1.6">10の質問で、あなたに最適化された<br>習慣化アプリに進化します</div>
      </div>
      <div id="ob-questions" style="padding:0 20px"></div>
      <div style="padding:20px;text-align:center">
        <div id="ob-progress-text" style="font-size:12px;color:var(--muted);margin-bottom:8px">0 / 10</div>
        <div style="background:#e2e8f0;border-radius:8px;height:6px;overflow:hidden;margin-bottom:20px">
          <div id="ob-progress-bar" style="background:var(--primary);height:100%;width:0%;border-radius:8px;transition:width .4s"></div>
        </div>
        <button class="btn-primary" style="width:100%;max-width:320px;padding:16px;font-size:16px;border-radius:16px;opacity:.4;pointer-events:none" id="ob-submit">
          診断する
        </button>
      </div>
    </div>
  `;

  const container = document.getElementById('ob-questions');
  const answers = new Array(10).fill(0);

  qs.forEach((q, i) => {
    container.innerHTML += `
      <div class="ob-q card fade-in" style="animation-delay:${i * .06}s">
        <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Q${i + 1}</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:12px;line-height:1.5">${q.text}</div>
        <div class="likert" data-qi="${i}">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-bottom:4px"><span>全く違う</span><span>とても当てはまる</span></div>
          <div style="display:flex;gap:6px;justify-content:center">
            ${[1,2,3,4,5,6,7].map(v => `<button type="button" class="likert-btn" data-v="${v}">${v}</button>`).join('')}
          </div>
        </div>
      </div>
    `;
  });

  container.querySelectorAll('.likert').forEach(lik => {
    lik.querySelectorAll('.likert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qi = parseInt(lik.dataset.qi);
        const v = parseInt(btn.dataset.v);
        answers[qi] = v;
        lik.querySelectorAll('.likert-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateObProgress(answers);
      });
    });
  });

  document.getElementById('ob-submit').addEventListener('click', () => finishOnboarding(answers));
}

function updateObProgress(answers) {
  const answered = answers.filter(a => a > 0).length;
  const pct = (answered / 10) * 100;
  document.getElementById('ob-progress-bar').style.width = pct + '%';
  document.getElementById('ob-progress-text').textContent = `${answered} / 10`;
  const btn = document.getElementById('ob-submit');
  if (answered === 10) {
    btn.style.opacity = '1';
    btn.style.pointerEvents = 'auto';
  } else {
    btn.style.opacity = '.4';
    btn.style.pointerEvents = 'none';
  }
}

async function finishOnboarding(answers) {
  const bigFive = Personality.calcBigFive(answers);
  const mbti = Personality.bigFiveToMBTI(bigFive);
  const profile = { bigFive, mbti, answers, level: 1, totalActivities: 0, created_at: new Date().toISOString() };
  await DB.saveProfile(profile);
  await DB.saveEvolutionLog({ type: 'diagnosis', mbti, bigFive });

  S.profile = profile;
  S.personalization = Personality.getPersonalization(profile);

  showDiagnosisResult(mbti, bigFive, true);
}

function showDiagnosisResult(mbti, bigFive, isFirstTime) {
  const info = Personality.MBTI_PROFILES[mbti];
  const app = document.getElementById('app');
  const b5Labels = { E: '外向性', A: '協調性', C: '計画性', N: '感受性', O: '開放性' };

  app.innerHTML = `
    <div class="onboarding" style="padding:0 20px 100px">
      <div style="text-align:center;padding:40px 0 24px">
        <div style="font-size:56px;margin-bottom:8px">${info.emoji}</div>
        <div style="font-size:13px;color:var(--muted);font-weight:600;margin-bottom:4px">あなたは</div>
        <div style="font-size:32px;font-weight:900;margin-bottom:4px">${info.label}</div>
        <div style="font-size:18px;font-weight:700;color:${info.color};margin-bottom:12px">${mbti}</div>
        <div style="font-size:14px;color:var(--muted);line-height:1.6;max-width:300px;margin:0 auto">${info.desc}</div>
      </div>

      <div class="card fade-in">
        <div style="font-weight:700;font-size:14px;margin-bottom:12px">Big Five プロフィール</div>
        ${Object.entries(bigFive).map(([dim, val]) => `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
              <span style="font-weight:600">${b5Labels[dim]}</span>
              <span style="color:var(--muted)">${val.toFixed(1)} / 7</span>
            </div>
            <div style="background:#f1f5f9;border-radius:6px;height:8px;overflow:hidden">
              <div style="background:${info.color};height:100%;width:${(val / 7) * 100}%;border-radius:6px;transition:width .6s"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="card fade-in">
        <div style="font-weight:700;font-size:14px;margin-bottom:8px">あなたの強み</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${info.strengths.map(s => `<span style="background:${info.color}15;color:${info.color};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600">${s}</span>`).join('')}
        </div>
      </div>

      <div class="card fade-in">
        <div style="font-weight:700;font-size:14px;margin-bottom:8px">習慣化の注意点</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${info.riskFactors.map(r => `<span style="background:#fef2f2;color:var(--danger);padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600">${r}</span>`).join('')}
        </div>
      </div>

      <div style="text-align:center;margin-top:24px">
        <button class="btn-primary" style="width:100%;max-width:320px;padding:16px;font-size:16px;border-radius:16px;background:${info.color}" id="ob-start">
          ${isFirstTime ? 'この設定で始める' : '閉じる'}
        </button>
      </div>
    </div>
  `;

  document.getElementById('ob-start').addEventListener('click', async () => {
    S.personalization = Personality.getPersonalization({
      ...S.profile,
      totalActivities: (await DB.getStats()).total_activities,
    });
    Personality.applyTheme(S.personalization);
    renderShell();
    switchTab('record');
  });
}

// ═══════════════════════════════════════════════════════════════
// Shell (5 tabs)
// ═══════════════════════════════════════════════════════════════
function renderShell() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div id="page-record" class="page"></div>
    <div id="page-map" class="page"></div>
    <div id="page-review" class="page"></div>
    <div id="page-compare" class="page"></div>
    <div id="page-profile" class="page"></div>
    <div id="tracking-panel"></div>
    <div id="save-modal"></div>
    <div id="milestone-overlay"></div>
  `;
  const oldBar = document.getElementById('tab-bar');
  if (oldBar) oldBar.remove();

  const bar = document.createElement('div');
  bar.id = 'tab-bar';
  bar.innerHTML = `
    <button class="tab-btn" data-tab="record"><i class="fas fa-circle-dot"></i><span>記録</span></button>
    <button class="tab-btn" data-tab="map"><i class="fas fa-map"></i><span>地図</span></button>
    <button class="tab-btn" data-tab="review"><i class="fas fa-calendar-days"></i><span>振返り</span></button>
    <button class="tab-btn" data-tab="compare"><i class="fas fa-code-compare"></i><span>比較</span><span class="tab-badge" id="compare-badge"></span></button>
    <button class="tab-btn" data-tab="profile"><i class="fas fa-user-gear"></i><span>自分</span></button>
  `;
  document.body.appendChild(bar);
  bar.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
}

function switchTab(tab) {
  S.tab = tab;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(`page-${tab}`);
  if (el) el.classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'record') renderRecordPage();
  if (tab === 'map') renderMapPage();
  if (tab === 'review') renderReviewPage();
  if (tab === 'compare') renderComparePage();
  if (tab === 'profile') renderProfilePage();
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ═══════════════════════════════════════════════════════════════
// 1. Record (Home)
// ═══════════════════════════════════════════════════════════════
async function renderRecordPage() {
  const page = document.getElementById('page-record');
  const st = await DB.getStats();
  const p = S.personalization || Personality.getPersonalization(null);
  const distKm = ((st.total_distance_m || 0) / 1000).toFixed(1);
  const durH = Math.floor((st.total_duration_sec || 0) / 3600);
  const durM = Math.floor(((st.total_duration_sec || 0) % 3600) / 60);
  const days = st.activity_days || 0;
  const acts = st.total_activities || 0;
  const lvl = p.levelInfo;
  const mbti = p.mbtiInfo;
  const homeMsg = p.homeMessages;
  const user = DB.getUser();

  page.innerHTML = `
    <div style="padding:16px 16px 0">
      ${mbti ? `<div class="card" style="text-align:center;padding:28px 20px;background:linear-gradient(135deg,${p.theme.gradientFrom}08,${p.theme.gradientTo}12)">
        <div style="font-size:13px;color:var(--muted);font-weight:600;margin-bottom:2px">${mbti.emoji} ${mbti.label}</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:var(--text)">${homeMsg.greeting}</div>
        <div style="font-size:48px;font-weight:900" class="text-gradient">${distKm}<span style="font-size:18px;opacity:.6"> km</span></div>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">${acts}回の記録 · ${days}日間の積み重ね</div>
        ${homeMsg.sub ? `<div style="margin-top:6px;font-size:11px;color:var(--muted)">${homeMsg.sub}</div>` : ''}
        <div style="margin-top:8px;display:flex;justify-content:center;gap:8px">
          <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--success);background:#f0fdf4;padding:3px 10px;border-radius:20px"><i class="fas fa-cloud-arrow-up" style="font-size:9px"></i>クラウド保存</span>
          <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:${p.theme.primary};background:${p.theme.primary}10;padding:3px 10px;border-radius:20px"><i class="fas fa-star" style="font-size:9px"></i>Lv.${lvl.level} ${lvl.title}</span>
        </div>
      </div>` : `<div class="card" style="text-align:center;padding:28px 20px">
        <div style="font-size:48px;font-weight:900" class="text-gradient">${distKm}<span style="font-size:18px;opacity:.6"> km</span></div>
      </div>`}

      ${lvl.nextLevel ? `<div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px">
          <span>Lv.${lvl.level} ${lvl.title}</span>
          <span>Lv.${lvl.nextLevel} ${lvl.nextTitle} まであと${lvl.nextMin - acts}回</span>
        </div>
        <div style="background:#f1f5f9;border-radius:6px;height:6px;overflow:hidden">
          <div style="background:linear-gradient(90deg,${p.theme.gradientFrom},${p.theme.gradientTo});height:100%;width:${lvl.progress}%;border-radius:6px;transition:width .6s"></div>
        </div>
      </div>` : ''}

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
        <div class="stat-pill"><div class="value">${durH}<span style="font-size:14px">h</span>${durM}<span style="font-size:14px">m</span></div><div class="label">累計時間</div></div>
        <div class="stat-pill"><div class="value">${days}</div><div class="label">活動日数</div></div>
        <div class="stat-pill"><div class="value">${acts}</div><div class="label">記録回数</div></div>
      </div>

      ${p.riskAlerts.length > 0 ? `<div class="card fade-in" style="border-left:3px solid ${p.theme.primary};padding:14px 16px">
        <div style="font-size:13px;font-weight:600;color:${p.theme.primary};margin-bottom:4px">${mbti ? mbti.emoji : '💡'} あなたへのヒント</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.6">${p.riskAlerts[0].msg}</div>
      </div>` : ''}

      <div style="text-align:center;margin:20px 0">
        <div class="start-record-wrapper">
          ${mbti ? `<div class="start-record-hint">${pick(p.startMessages)}</div>` : ''}
          <button class="btn-primary btn-start-record-main" id="btn-start-record">
            <span class="start-record-icon-ring"><i class="fas fa-person-walking"></i></span>
            <span>記録をはじめる</span>
          </button>
        </div>
      </div>

      <div class="card">
        <div style="font-weight:700;font-size:15px;margin-bottom:12px"><i class="fas fa-clock-rotate-left" style="color:var(--primary);margin-right:6px"></i>最近の記録</div>
        <div id="recent-list">読み込み中...</div>
      </div>

      <div class="card" style="margin-top:4px">
        <div style="font-weight:700;font-size:15px;margin-bottom:12px"><i class="fas fa-cloud" style="color:var(--muted);margin-right:6px"></i>データ管理</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px">${user ? `<i class="fas fa-user-check" style="color:var(--success)"></i> ${esc(user.email)} でログイン中` : 'クラウドに保存'}</div>
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
    const d = ((a.distance_m || 0) / 1000).toFixed(2);
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
  const a = document.createElement('a'); a.href = url;
  a.download = `journey-tracker-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}
async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('現在のデータを上書きしてインポートしますか？')) { e.target.value = ''; return; }
  try {
    const json = JSON.parse(await file.text());
    if (!json.activities) throw new Error('invalid format');
    await DB.importData(json);
    S.profile = await DB.getProfile();
    if (S.profile && S.profile.mbti) {
      S.personalization = Personality.getPersonalization({ ...S.profile, totalActivities: (await DB.getStats()).total_activities });
      Personality.applyTheme(S.personalization);
    }
    showToast(`${json.activities.length}件の記録をインポートしました ✓`);
    renderRecordPage();
  } catch (err) { showToast('インポート失敗: ' + err.message); }
  e.target.value = '';
}
async function handleClear() {
  showConfirmModal({
    title: '全データを削除',
    message: '記録・統計・マイルストーンなど、すべてのデータが完全に削除されます。この操作は取り消せません。',
    warning: '先にエクスポートすることをお勧めします。',
    confirmLabel: '削除する',
    cancelLabel: 'キャンセル',
    onConfirm: async () => {
      await DB.clearAllData();
      showToast('全データを削除しました');
      renderRecordPage();
    }
  });
}

// ─── Confirm modal ───
function showConfirmModal({ title, message, warning, confirmLabel, cancelLabel, onConfirm }) {
  const existing = document.getElementById('confirm-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'confirm-modal';
  modal.className = 'confirm-modal show';
  modal.innerHTML = `
    <div class="confirm-sheet">
      <div style="text-align:center;margin-bottom:20px">
        <div class="confirm-icon-ring"><i class="fas fa-triangle-exclamation"></i></div>
        <div style="font-size:18px;font-weight:800;margin-bottom:8px">${title}</div>
        <div style="font-size:14px;color:var(--muted);line-height:1.6">${message}</div>
        ${warning ? `<div style="margin-top:10px;padding:10px 14px;background:#fef2f2;border-radius:10px;font-size:13px;color:var(--danger);font-weight:600"><i class="fas fa-circle-info" style="margin-right:4px"></i>${warning}</div>` : ''}
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-ghost" style="flex:1;color:var(--text);border:1.5px solid #e2e8f0;background:#fff" id="confirm-cancel">${cancelLabel}</button>
        <button class="btn-primary btn-danger" style="flex:1" id="confirm-ok">${confirmLabel}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('confirm-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.getElementById('confirm-ok').addEventListener('click', async () => {
    const btn = document.getElementById('confirm-ok');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';
    await onConfirm();
    modal.remove();
  });
}

// ═══════════════════════════════════════════════════════════════
// 2. Tracking
// ═══════════════════════════════════════════════════════════════
function startTracking() {
  if (!navigator.geolocation) { alert('位置情報が利用できません'); return; }
  S.tracking = true; S.paused = false; S.points = []; S.distance = 0;
  S.startTime = Date.now(); S.pausedTime = 0; S.lastPos = null;
  S.watchId = navigator.geolocation.watchPosition(onPos, onPosErr, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
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
  hideTrackingPanel(); showSaveModal();
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
  const d = document.getElementById('tp-dist'), t = document.getElementById('tp-time'), pts = document.getElementById('tp-pts');
  const pauseBtn = document.getElementById('btn-pause');
  if (!d) return;
  d.textContent = (S.distance / 1000).toFixed(2);
  t.textContent = fmtDurationShort(getElapsed());
  pts.textContent = S.points.length;
  if (pauseBtn) pauseBtn.innerHTML = S.paused ? '<i class="fas fa-play"></i> 再開' : '<i class="fas fa-pause"></i> 一時停止';
}
function hideTrackingPanel() { document.getElementById('tracking-panel').classList.remove('open'); }

// ─── Save modal ───
function showSaveModal() {
  const modal = document.getElementById('save-modal');
  const distKm = (S.distance / 1000).toFixed(2);
  const elapsed = getElapsed();
  const p = S.personalization || Personality.getPersonalization(null);
  const completionMsg = pick(p.completionMessages);

  modal.innerHTML = `
    <div class="save-sheet">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:14px;color:var(--muted);font-weight:600">記録完了</div>
        <div style="font-size:42px;font-weight:900" class="text-gradient">${distKm} km</div>
        <div style="font-size:14px;color:var(--muted)">${fmtDuration(elapsed)}</div>
        <div style="font-size:14px;font-weight:600;color:var(--primary);margin-top:8px">${completionMsg}</div>
      </div>
      <div id="save-map" class="map-container" style="height:200px;margin-bottom:16px;border-radius:12px"></div>
      <input type="text" id="save-route-name" placeholder="ルート名（任意）" style="margin-bottom:8px" />
      <textarea id="save-memo" placeholder="ひとことメモ（任意）" rows="2" style="margin-bottom:16px;resize:none"></textarea>
      <div style="display:flex;gap:10px">
        <button class="btn-ghost" style="flex:1;color:var(--text);border-color:#e2e8f0" id="btn-discard">破棄</button>
        <button class="btn-primary" style="flex:1" id="btn-save"><i class="fas fa-cloud-arrow-up"></i> 保存</button>
      </div>
    </div>
  `;
  modal.classList.add('show');
  setTimeout(() => {
    if (S.points.length > 1) {
      const map = L.map('save-map', { zoomControl: false, attributionControl: false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      const latlngs = S.points.map(pt => [pt[0], pt[1]]);
      const line = L.polyline(latlngs, { color: S.personalization ? S.personalization.theme.primary : '#4f46e5', weight: 4 }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [30, 30] });
    }
  }, 100);
  document.getElementById('btn-discard').addEventListener('click', () => modal.classList.remove('show'));
  document.getElementById('btn-save').addEventListener('click', saveActivity);
}

async function saveActivity() {
  const btn = document.getElementById('btn-save');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...'; }
  
  const elapsed = getElapsed();
  const payload = {
    started_at: new Date(S.startTime).toISOString(),
    ended_at: new Date().toISOString(),
    distance_m: S.distance, duration_sec: elapsed,
    polyline: S.points,
    memo: document.getElementById('save-memo')?.value || '',
    route_name: document.getElementById('save-route-name')?.value || '',
  };
  const result = await DB.saveActivity(payload);
  document.getElementById('save-modal').classList.remove('show');

  const stats = await DB.getStats();
  S.profile = await DB.getProfile();
  if (S.profile) {
    S.personalization = Personality.getPersonalization({ ...S.profile, totalActivities: stats.total_activities });
  }

  if (result.new_milestones && result.new_milestones.length > 0) {
    await showMilestoneOverlay(result.new_milestones[0]);
  }
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
        <div><span class="legend-line" style="opacity:.3"></span>1回</div>
        <div><span class="legend-line" style="opacity:.6"></span>2-3回</div>
        <div><span class="legend-line" style="opacity:1"></span>4回+</div>
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
  const mapColor = S.personalization ? S.personalization.theme.primary : '#4f46e5';
  const map = L.map(container, { zoomControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
  S.maps.mymap = map;

  const allRoutes = await DB.getHeatmapRoutes(S.mapFilter);
  if (allRoutes.length === 0) { map.setView([35.68, 139.76], 12); return; }

  const segCount = {}, allPts = [];
  allRoutes.forEach(route => {
    if (!Array.isArray(route) || route.length < 2) return;
    for (let i = 0; i < route.length - 1; i++) {
      const key = gridKey(route[i][0], route[i][1]) + '-' + gridKey(route[i + 1][0], route[i + 1][1]);
      segCount[key] = (segCount[key] || 0) + 1;
    }
    route.forEach(pt => allPts.push([pt[0], pt[1]]));
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
    L.polyline(route.map(pt => [pt[0], pt[1]]), { color: mapColor, weight, opacity, lineJoin: 'round', lineCap: 'round' }).addTo(map);
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
  const p = S.personalization || Personality.getPersonalization(null);
  const distKm = ((summary.total_distance_m || 0) / 1000).toFixed(1);
  const durH = Math.floor((summary.total_duration_sec || 0) / 3600);
  const durM = Math.floor(((summary.total_duration_sec || 0) % 3600) / 60);
  const count = summary.count || 0;
  const periodLabel = S.reviewPeriod === 'week' ? '今週' : '今月';
  const hours = hour_distribution || [];
  const bestHour = hours.length > 0 ? hours.reduce((a, b) => b.cnt > a.cnt ? b : a, hours[0]) : null;
  const dailyData = daily || [];
  const maxDist = Math.max(...dailyData.map(d => d.dist || 0), 1);

  const insightHTML = p.reviewInsights.length > 0 ? `
    <div class="card fade-in" style="border-left:3px solid var(--primary)">
      <div style="font-weight:700;font-size:14px;margin-bottom:8px">あなたへのインサイト</div>
      ${p.reviewInsights.slice(0, 2).map(ins => `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:18px">${ins.icon}</span>
          <span style="font-size:13px;color:var(--muted);line-height:1.5">${ins.text}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  el.innerHTML = `
    <div class="card fade-in" style="text-align:center">
      <div style="font-size:13px;color:var(--muted);font-weight:600">${periodLabel}のまとめ</div>
      <div style="font-size:44px;font-weight:900;margin:8px 0" class="text-gradient">${distKm} km</div>
      <div style="display:flex;justify-content:center;gap:24px;font-size:13px;color:var(--muted)">
        <div><i class="fas fa-clock" style="margin-right:4px"></i>${durH}時間${durM}分</div>
        <div><i class="fas fa-shoe-prints" style="margin-right:4px"></i>${count}回</div>
      </div>
    </div>
    ${insightHTML}
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
  const p = S.personalization || Personality.getPersonalization(null);
  const totalKm = ((st.total_distance_m || 0) / 1000).toFixed(1);
  const thresholds = [10, 50, 100, 300, 1000];
  const nextKm = thresholds.find(t => (st.total_distance_m || 0) < t * 1000) || null;
  const motiveMsg = pick(p.milestoneMessages);

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
        <div style="margin-top:16px;font-size:14px;font-weight:700;color:var(--primary)">${motiveMsg}</div>
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
// 6. Profile (自分タブ) + ログアウト
// ═══════════════════════════════════════════════════════════════
async function renderProfilePage() {
  const page = document.getElementById('page-profile');
  const profile = S.profile;
  const stats = await DB.getStats();
  const p = S.personalization || Personality.getPersonalization(null);
  const log = await DB.getEvolutionLog();
  const user = DB.getUser();

  if (!profile || !profile.mbti) {
    page.innerHTML = `
      <div style="padding:16px;text-align:center;padding-top:60px">
        <div style="font-size:48px;margin-bottom:16px">🧭</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:8px">性格診断がまだです</div>
        <div style="font-size:14px;color:var(--muted);margin-bottom:24px">10の質問に答えて、あなた専用のアプリに</div>
        <button class="btn-primary" style="padding:14px 32px;border-radius:16px" id="btn-start-diag">診断する</button>
      </div>
    `;
    document.getElementById('btn-start-diag').addEventListener('click', renderOnboarding);
    return;
  }

  const mbti = Personality.MBTI_PROFILES[profile.mbti];
  const b5 = profile.bigFive;
  const b5Labels = { E: '外向性', A: '協調性', C: '計画性', N: '感受性', O: '開放性' };
  const lvl = p.levelInfo;

  page.innerHTML = `
    <div style="padding:16px">
      <div style="font-weight:800;font-size:18px;margin-bottom:16px"><i class="fas fa-user-gear" style="color:var(--primary);margin-right:6px"></i>自分</div>

      <!-- アカウント情報 -->
      <div class="card fade-in" style="display:flex;align-items:center;gap:12px">
        <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,${mbti.gradientFrom},${mbti.gradientTo});display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;flex-shrink:0">
          ${user && user.display_name ? esc(user.display_name.slice(0, 1)) : '<i class="fas fa-user"></i>'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:15px">${user ? esc(user.display_name || user.email) : ''}</div>
          <div style="font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis">${user ? esc(user.email) : ''}</div>
        </div>
        <span style="font-size:11px;color:var(--success);background:#f0fdf4;padding:3px 10px;border-radius:20px;font-weight:600;white-space:nowrap"><i class="fas fa-cloud-arrow-up" style="font-size:9px;margin-right:3px"></i>同期済み</span>
      </div>

      <!-- 性格カード -->
      <div class="card fade-in" style="text-align:center;padding:24px;background:linear-gradient(135deg,${mbti.gradientFrom}08,${mbti.gradientTo}12)">
        <div style="font-size:48px;margin-bottom:4px">${mbti.emoji}</div>
        <div style="font-size:24px;font-weight:900">${mbti.label}</div>
        <div style="font-size:16px;font-weight:700;color:${mbti.color};margin-bottom:8px">${profile.mbti}</div>
        <div style="font-size:13px;color:var(--muted);line-height:1.5">${mbti.desc}</div>
      </div>

      <!-- レベル -->
      <div class="card fade-in">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div style="font-weight:700;font-size:15px"><i class="fas fa-star" style="color:var(--accent);margin-right:6px"></i>レベル</div>
          <div style="font-size:13px;color:var(--muted)">${stats.total_activities}回の記録</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div style="font-size:32px;font-weight:900;color:var(--primary)">Lv.${lvl.level}</div>
          <div>
            <div style="font-size:15px;font-weight:700">${lvl.title}</div>
            <div style="font-size:12px;color:var(--muted)">${lvl.unlocks}</div>
          </div>
        </div>
        ${lvl.nextLevel ? `
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:4px">
            <span>Lv.${lvl.level}</span><span>Lv.${lvl.nextLevel} (${lvl.nextMin}回)</span>
          </div>
          <div style="background:#f1f5f9;border-radius:6px;height:8px;overflow:hidden">
            <div style="background:linear-gradient(90deg,${mbti.gradientFrom},${mbti.gradientTo});height:100%;width:${lvl.progress}%;border-radius:6px;transition:width .6s"></div>
          </div>
        ` : '<div style="font-size:13px;color:var(--accent);font-weight:600">最高レベル到達！</div>'}
      </div>

      <!-- Big Five -->
      <div class="card fade-in">
        <div style="font-weight:700;font-size:15px;margin-bottom:12px">Big Five プロフィール</div>
        ${Object.entries(b5).map(([dim, val]) => `
          <div style="margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
              <span style="font-weight:600">${b5Labels[dim]}</span>
              <span style="color:var(--muted)">${val.toFixed(1)}</span>
            </div>
            <div style="background:#f1f5f9;border-radius:6px;height:8px;overflow:hidden">
              <div style="background:${mbti.color};height:100%;width:${(val / 7) * 100}%;border-radius:6px"></div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- 強みとリスク -->
      <div class="card fade-in">
        <div style="font-weight:700;font-size:14px;margin-bottom:8px">あなたの強み</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          ${mbti.strengths.map(s => `<span style="background:${mbti.color}15;color:${mbti.color};padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600">${s}</span>`).join('')}
        </div>
        <div style="font-weight:700;font-size:14px;margin-bottom:8px">注意したいこと</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${mbti.riskFactors.map(r => `<span style="background:#fef2f2;color:var(--danger);padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600">${r}</span>`).join('')}
        </div>
      </div>

      <!-- 進化ログ -->
      ${log.length > 0 ? `
        <div class="card fade-in">
          <div style="font-weight:700;font-size:15px;margin-bottom:12px"><i class="fas fa-timeline" style="color:var(--primary);margin-right:6px"></i>カスタマイズ進化ログ</div>
          ${log.slice(-10).reverse().map(entry => {
            const date = fmtDate(entry.timestamp);
            if (entry.type === 'diagnosis') return `<div class="activity-row"><div class="activity-dot" style="background:var(--accent)"></div><div style="flex:1"><div style="font-size:13px;font-weight:600">性格診断実施</div><div style="font-size:12px;color:var(--muted)">${date} · ${entry.mbti}</div></div></div>`;
            if (entry.type === 'level_up') return `<div class="activity-row"><div class="activity-dot" style="background:var(--success)"></div><div style="flex:1"><div style="font-size:13px;font-weight:600">Lv.${entry.level} ${entry.title} に到達</div><div style="font-size:12px;color:var(--muted)">${date} · ${entry.unlocks}解放</div></div></div>`;
            return '';
          }).join('')}
        </div>
      ` : ''}

      <!-- アクション -->
      <div class="card fade-in">
        <div style="font-weight:700;font-size:15px;margin-bottom:12px">設定</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="data-mgmt-btn" style="width:100%;justify-content:center" id="btn-rediag">
            <i class="fas fa-rotate"></i> 性格診断をやり直す
          </button>
          <button class="data-mgmt-btn danger" style="width:100%;justify-content:center" id="btn-reset-all">
            <i class="fas fa-triangle-exclamation"></i> 全データ+プロフィールを完全削除
          </button>
          <button class="data-mgmt-btn" style="width:100%;justify-content:center;color:var(--muted);border-color:#e2e8f0" id="btn-logout">
            <i class="fas fa-arrow-right-from-bracket"></i> ログアウト
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-rediag').addEventListener('click', async () => {
    if (!confirm('性格診断をやり直しますか？\n（記録データは保持されます）')) return;
    await DB.clearProfile();
    S.profile = null;
    S.personalization = null;
    document.documentElement.style.setProperty('--primary', '#4f46e5');
    document.documentElement.style.setProperty('--primary-light', '#818cf8');
    document.documentElement.style.setProperty('--gradient-from', '#4338ca');
    document.documentElement.style.setProperty('--gradient-to', '#6366f1');
    renderOnboarding();
  });

  document.getElementById('btn-reset-all').addEventListener('click', () => {
    showConfirmModal({
      title: '全データ+プロフィールを完全削除',
      message: '記録データ・性格診断・プロフィールなど、すべてが完全に削除されます。アプリは初期状態に戻ります。',
      warning: 'この操作は取り消せません。事前にデータをエクスポートしてください。',
      confirmLabel: '完全に削除する',
      cancelLabel: 'キャンセル',
      onConfirm: async () => {
        await DB.clearEverything();
        S.profile = null; S.personalization = null;
        await bootApp();
      }
    });
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    if (!confirm('ログアウトしますか？')) return;
    await DB.logout();
    S.profile = null;
    S.personalization = null;
    // テーマをリセット
    document.documentElement.style.setProperty('--primary', '#4f46e5');
    document.documentElement.style.setProperty('--primary-light', '#818cf8');
    document.documentElement.style.setProperty('--gradient-from', '#4338ca');
    document.documentElement.style.setProperty('--gradient-to', '#6366f1');
    renderAuthScreen();
  });
}

// ═══════════════════════════════════════════════════════════════
// Milestone Overlay
// ═══════════════════════════════════════════════════════════════
async function showMilestoneOverlay(msType) {
  if (S.seenMilestones.includes(msType)) return;
  const milestones = await DB.getMilestones();
  const ms = milestones.find(m => m.type === msType);
  if (!ms) return;

  const p = S.personalization || Personality.getPersonalization(null);
  const km = (ms.threshold_m / 1000).toFixed(0);
  const totalKm = (ms.total_distance_m / 1000).toFixed(1);
  const durH = Math.floor(ms.total_duration_sec / 3600);
  const msg = pick(p.milestoneMessages);

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
  const dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function fmtDuration(sec) { const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); return h > 0 ? `${h}時間${m}分` : `${m}分`; }
function fmtDurationShort(sec) { const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60; return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ─── Toast notification ───
function showToast(msg, duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ─── SW ───
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/static/sw.js').catch(() => {});
