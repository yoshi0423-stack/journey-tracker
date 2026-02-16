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
  // Background tracking state
  wakeLock: null,
  lastPosTime: null,
  lastAccuracy: null,
  bgNotified: false,
};

// ─── Big Five レーダーチャート SVG生成 ───
function generateRadarChart(bigFive, color, size = 200) {
  const labels = [
    { key: 'O', label: '開放性',       short: '開放性' },
    { key: 'C', label: '誠実性',       short: '誠実性' },
    { key: 'E', label: '外向性',       short: '外向性' },
    { key: 'A', label: '協調性',       short: '協調性' },
    { key: 'N', label: '神経症的傾向', short: '神経症的' }
  ];

  // viewBox を大きめに取ってラベル余白を確保
  const pad = size * 0.28;           // ラベル用パディング
  const vw = size + pad * 2;         // viewBox 幅
  const vh = size + pad * 2;         // viewBox 高さ
  const cx = vw / 2, cy = vh / 2;   // 中心
  const maxR = size * 0.34;          // チャート半径
  const levels = 4;
  const angleOff = -Math.PI / 2;
  const fs = Math.round(size * 0.052); // フォントサイズ

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw.toFixed(0)} ${vh.toFixed(0)}" width="100%" style="display:block;margin:0 auto">`;
  svg += `<defs><filter id="rc-glow"><feGaussianBlur stdDeviation="2" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;

  // 背景グリッド
  for (let lv = levels; lv >= 1; lv--) {
    const r = maxR * (lv / levels);
    let pts = [];
    for (let i = 0; i < 5; i++) {
      const ang = angleOff + (i * 2 * Math.PI / 5);
      pts.push(`${(cx + Math.cos(ang) * r).toFixed(1)},${(cy + Math.sin(ang) * r).toFixed(1)}`);
    }
    svg += `<polygon points="${pts.join(' ')}" fill="${lv === levels ? '#f8fafc' : 'none'}" stroke="${lv === levels ? '#e2e8f0' : '#f1f5f9'}" stroke-width="${lv === levels ? 1.2 : 0.7}"/>`;
  }

  // 軸線
  for (let i = 0; i < 5; i++) {
    const ang = angleOff + (i * 2 * Math.PI / 5);
    const ex = cx + Math.cos(ang) * maxR;
    const ey = cy + Math.sin(ang) * maxR;
    svg += `<line x1="${cx}" y1="${cy}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="#e2e8f0" stroke-width="0.6"/>`;
  }

  // データ多角形
  let dataPts = [];
  for (let i = 0; i < 5; i++) {
    const ang = angleOff + (i * 2 * Math.PI / 5);
    const val = (bigFive[labels[i].key] || 3) / 5;
    const r = maxR * val;
    dataPts.push(`${(cx + Math.cos(ang) * r).toFixed(1)},${(cy + Math.sin(ang) * r).toFixed(1)}`);
  }
  svg += `<polygon points="${dataPts.join(' ')}" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2" stroke-linejoin="round" filter="url(#rc-glow)"/>`;

  // データ点
  for (let i = 0; i < 5; i++) {
    const ang = angleOff + (i * 2 * Math.PI / 5);
    const val = (bigFive[labels[i].key] || 3) / 5;
    const r = maxR * val;
    const px = cx + Math.cos(ang) * r;
    const py = cy + Math.sin(ang) * r;
    svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
  }

  // ラベル（余白内に収まるよう配置）
  const labelR = maxR + size * 0.08;
  for (let i = 0; i < 5; i++) {
    const ang = angleOff + (i * 2 * Math.PI / 5);
    const val = (bigFive[labels[i].key] || 3).toFixed(1);
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);

    // ラベル位置（軸の延長上）
    let lx = cx + cosA * labelR;
    let ly = cy + sinA * labelR;

    // text-anchor: 左右は start/end, 上下は middle
    let anchor = 'middle';
    if (cosA > 0.3) anchor = 'start';
    else if (cosA < -0.3) anchor = 'end';

    // 上の頂点は上に、下の頂点は下にずらす
    let labelDy = 0;
    if (sinA < -0.3) labelDy = -8;   // 上方向
    else if (sinA > 0.3) labelDy = 12; // 下方向

    svg += `<text x="${lx.toFixed(1)}" y="${(ly + labelDy).toFixed(1)}" text-anchor="${anchor}" font-size="${fs}" font-weight="700" fill="#475569" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${labels[i].label}</text>`;
    svg += `<text x="${lx.toFixed(1)}" y="${(ly + labelDy + fs + 3).toFixed(1)}" text-anchor="${anchor}" font-size="${fs}" font-weight="700" fill="${color}" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${val}</text>`;
  }

  svg += `</svg>`;
  return svg;
}

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
            ${[1,2,3,4,5].map(v => `<button type="button" class="likert-btn" data-v="${v}">${v}</button>`).join('')}
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
  const animalInfo = Personality.MBTI_ANIMALS ? Personality.MBTI_ANIMALS[mbti] : null;
  const app = document.getElementById('app');
  const b5Labels = { E: '外向性', A: '協調性', C: '誠実性', N: '神経症的傾向', O: '開放性' };
  const b5Descs = {
    O: '新しい体験への好奇心',
    C: '計画を実行する力',
    E: '人との交流エネルギー',
    A: '他者への思いやり',
    N: '感情の敏感さ'
  };
  const animalName = animalInfo ? animalInfo.name : '';
  const typeName = info.label;

  app.innerHTML = `
    <div class="onboarding" style="padding:0;overflow-y:auto;height:100vh">
      <!-- ヒーローセクション: グラデーション背景 + アバター -->
      <div style="background:linear-gradient(135deg,${info.gradientFrom},${info.gradientTo});padding:48px 20px 36px;text-align:center;position:relative;overflow:hidden">
        <!-- 装飾パーティクル -->
        <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">
          <div style="position:absolute;top:15%;left:12%;width:6px;height:6px;background:rgba(255,255,255,.3);border-radius:50%;animation:avatarFloat 3s ease-in-out infinite"></div>
          <div style="position:absolute;top:25%;right:18%;width:8px;height:8px;background:rgba(255,255,255,.2);border-radius:50%;animation:avatarFloat 4s ease-in-out infinite .5s"></div>
          <div style="position:absolute;bottom:20%;left:20%;width:5px;height:5px;background:rgba(255,255,255,.25);border-radius:50%;animation:avatarFloat 3.5s ease-in-out infinite 1s"></div>
          <div style="position:absolute;top:35%;right:8%;width:4px;height:4px;background:rgba(255,255,255,.35);border-radius:50%;animation:avatarFloat 2.8s ease-in-out infinite .3s"></div>
        </div>

        <div style="font-size:13px;color:rgba(255,255,255,.8);font-weight:600;margin-bottom:12px;letter-spacing:1px">あなたの診断結果</div>

        <div style="width:180px;height:180px;margin:0 auto 16px;filter:drop-shadow(0 8px 24px rgba(0,0,0,.25));animation:avatarFloat 3s ease-in-out infinite">
          ${Personality.generateAvatar(mbti, bigFive, 180)}
        </div>

        ${animalInfo ? `<div style="font-size:32px;font-weight:900;color:#fff;margin-bottom:4px;text-shadow:0 2px 8px rgba(0,0,0,.2)">${animalName}</div>` : ''}
        <div style="font-size:18px;font-weight:700;color:rgba(255,255,255,.9);margin-bottom:8px">${typeName}（${mbti}）</div>
        <div style="display:inline-block;background:rgba(255,255,255,.2);backdrop-filter:blur(8px);border-radius:20px;padding:6px 16px;font-size:12px;color:#fff;font-weight:600">
          ${info.emoji} ${info.habitStyle === 'strategic' ? '戦略型' : info.habitStyle === 'experimental' ? '実験型' : info.habitStyle === 'conquest' ? '征服型' : info.habitStyle === 'gamified' ? 'ゲーム型' : info.habitStyle === 'meaningful' ? '意味探求型' : info.habitStyle === 'emotional' ? '感情型' : info.habitStyle === 'narrative' ? '物語型' : info.habitStyle === 'exploratory' ? '探索型' : info.habitStyle === 'systematic' ? '体系型' : info.habitStyle === 'nurturing' ? '育成型' : info.habitStyle === 'disciplined' ? '規律型' : info.habitStyle === 'social' ? '社交型' : info.habitStyle === 'independent' ? '独立型' : info.habitStyle === 'creative' ? '創造型' : info.habitStyle === 'challenge' ? '挑戦型' : info.habitStyle === 'playful' ? '遊戯型' : '個性型'}の習慣スタイル
        </div>
      </div>

      <div style="padding:0 16px 120px;margin-top:-16px">
        <!-- 性格説明カード -->
        <div class="card fade-in" style="border-radius:20px;padding:24px;position:relative;z-index:1;box-shadow:0 4px 20px rgba(0,0,0,.08)">
          <div style="font-size:14px;color:var(--muted);line-height:1.7">${info.desc}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
            ${info.strengths.map(s => `<span style="background:${info.color}12;color:${info.color};padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;border:1px solid ${info.color}20">${s}</span>`).join('')}
          </div>
        </div>

        <!-- Big Five レーダーチャート -->
        <div class="card fade-in" style="border-radius:20px;padding:24px;box-shadow:0 4px 20px rgba(0,0,0,.08)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <div style="width:4px;height:20px;border-radius:2px;background:${info.color}"></div>
            <div style="font-weight:800;font-size:16px">ビッグファイブ プロフィール</div>
          </div>
          <div style="width:100%;margin:0 auto 16px">
            ${generateRadarChart(bigFive, info.color, 360)}
          </div>
          <!-- スキルバー風表示 -->
          ${Object.entries(bigFive).map(([dim, val]) => {
            const pct = (val / 5 * 100).toFixed(0);
            const lv = val >= 4.3 ? 'S' : val >= 3.6 ? 'A' : val >= 2.8 ? 'B' : val >= 2 ? 'C' : 'D';
            return `
            <div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:${info.color}15;color:${info.color};font-size:11px;font-weight:800">${lv}</span>
                  <span style="font-weight:700;font-size:13px">${b5Labels[dim]}</span>
                </div>
                <span style="font-size:12px;font-weight:600;color:${info.color}">${val.toFixed(1)}</span>
              </div>
              <div style="background:#f1f5f9;border-radius:8px;height:10px;overflow:hidden;position:relative">
                <div style="background:linear-gradient(90deg,${info.gradientFrom},${info.gradientTo});height:100%;width:${pct}%;border-radius:8px;transition:width .8s cubic-bezier(.4,0,.2,1);position:relative">
                  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.3),transparent);border-radius:8px"></div>
                </div>
              </div>
              <div style="font-size:11px;color:var(--muted);margin-top:3px">${b5Descs[dim]}</div>
            </div>`;
          }).join('')}
        </div>

        <!-- 注意点カード -->
        <div class="card fade-in" style="border-radius:20px;padding:20px;box-shadow:0 4px 20px rgba(0,0,0,.08);border-left:4px solid var(--danger)">
          <div style="font-weight:800;font-size:14px;margin-bottom:10px;color:var(--danger)"><i class="fas fa-triangle-exclamation" style="margin-right:6px"></i>習慣化の注意点</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${info.riskFactors.map(r => `<span style="background:#fef2f2;color:var(--danger);padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700">${r}</span>`).join('')}
          </div>
        </div>

        <!-- CTAボタン -->
        <div style="text-align:center;margin-top:28px">
          <button class="btn-primary" style="width:100%;max-width:340px;padding:18px;font-size:17px;border-radius:20px;background:linear-gradient(135deg,${info.gradientFrom},${info.gradientTo});box-shadow:0 6px 24px ${info.color}40;font-weight:800" id="ob-start">
            ${isFirstTime ? '✨ この設定で始める' : '閉じる'}
          </button>
        </div>
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
    <button class="tab-btn" data-tab="profile"><span class="tab-avatar" id="tab-avatar-slot"></span><i class="fas fa-user-gear tab-profile-icon"></i><span>自分</span></button>
  `;
  document.body.appendChild(bar);
  bar.querySelectorAll('.tab-btn').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

  // タブバーにミニアバターを表示
  updateTabAvatar();
}

function updateTabAvatar() {
  const slot = document.getElementById('tab-avatar-slot');
  if (!slot) return;
  if (S.profile && S.profile.mbti) {
    slot.innerHTML = Personality.generateAvatar(S.profile.mbti, S.profile.bigFive, 26);
    slot.style.display = 'block';
    // font-awesomeアイコンを隠す
    const icon = slot.parentElement.querySelector('.tab-profile-icon');
    if (icon) icon.style.display = 'none';
  } else {
    slot.style.display = 'none';
    const icon = slot.parentElement.querySelector('.tab-profile-icon');
    if (icon) icon.style.display = '';
  }
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
  const profile = S.profile;
  const b5 = profile ? profile.bigFive : null;

  page.innerHTML = `
    <div style="padding:16px 16px 0">
      ${mbti ? `<div class="card" style="text-align:center;padding:0;overflow:hidden;border-radius:20px;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <div style="background:linear-gradient(135deg,${p.theme.gradientFrom},${p.theme.gradientTo});padding:24px 20px 20px;position:relative;overflow:hidden">
          <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">
            <div style="position:absolute;top:10%;right:10%;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.06)"></div>
            <div style="position:absolute;bottom:10%;left:8%;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.04)"></div>
          </div>
          <div class="home-avatar-wrapper" style="margin:0 auto 8px;width:80px;height:80px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.25))">
            ${Personality.generateAvatar(profile.mbti, b5 || {E:3,A:3,C:3,N:3,O:3}, 80)}
          </div>
          <div style="font-size:13px;color:rgba(255,255,255,.8);font-weight:600;margin-bottom:2px">${(Personality.MBTI_ANIMALS && Personality.MBTI_ANIMALS[profile.mbti]) ? Personality.MBTI_ANIMALS[profile.mbti].name + ' · ' : ''}${mbti.emoji} ${mbti.label}</div>
        </div>
        <div style="padding:16px 20px 20px">
          <div style="font-size:16px;font-weight:700;margin-bottom:8px;color:var(--text)">${homeMsg.greeting}</div>
          <div style="font-size:48px;font-weight:900" class="text-gradient">${distKm}<span style="font-size:18px;opacity:.6"> km</span></div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">${acts}回の記録 · ${days}日間の積み重ね</div>
          ${homeMsg.sub ? `<div style="margin-top:6px;font-size:11px;color:var(--muted)">${homeMsg.sub}</div>` : ''}
          <div style="margin-top:10px;display:flex;justify-content:center;gap:8px">
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--success);background:#f0fdf4;padding:4px 12px;border-radius:20px;font-weight:600"><i class="fas fa-cloud-arrow-up" style="font-size:9px"></i>クラウド保存</span>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:${p.theme.primary};background:${p.theme.primary}10;padding:4px 12px;border-radius:20px;font-weight:600"><i class="fas fa-star" style="font-size:9px"></i>Lv.${lvl.level} ${lvl.title}</span>
          </div>
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
// 2. Tracking (Background-aware)
// ═══════════════════════════════════════════════════════════════

// ─── Wake Lock: 画面スリープ防止 ───
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      S.wakeLock = await navigator.wakeLock.request('screen');
      S.wakeLock.addEventListener('release', () => { S.wakeLock = null; });
      console.log('[Tracking] Wake Lock acquired');
    }
  } catch (e) { console.warn('[Tracking] Wake Lock failed:', e.message); }
}
function releaseWakeLock() {
  if (S.wakeLock) { S.wakeLock.release(); S.wakeLock = null; }
}

// ─── バックグラウンド復帰時に Wake Lock 再取得 & watchPosition 再登録 ───
document.addEventListener('visibilitychange', () => {
  if (!S.tracking) return;
  if (document.visibilityState === 'visible') {
    // フォアグラウンド復帰
    requestWakeLock();
    // watchPosition を再登録して正確な位置を即座に取得
    restartWatch();
    console.log('[Tracking] Returned to foreground, watch restarted');
  }
});

function restartWatch() {
  if (S.watchId !== null) navigator.geolocation.clearWatch(S.watchId);
  S.watchId = navigator.geolocation.watchPosition(onPos, onPosErr, {
    enableHighAccuracy: true,
    maximumAge: 3000,   // バックグラウンドではキャッシュ許容
    timeout: 30000      // タイムアウト延長
  });
}

// ─── バックグラウンド通知 ───
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
function showBgNotification() {
  if (S.bgNotified) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Journey Tracker', {
      body: '📍 記録中です。アプリに戻ると正確な位置が取得されます。',
      icon: '/static/icon-192.png',
      tag: 'tracking-active',
      silent: true
    });
    S.bgNotified = true;
  }
}

// ─── メインのトラッキング関数 ───
async function startTracking() {
  if (!navigator.geolocation) { alert('位置情報が利用できません'); return; }
  S.tracking = true; S.paused = false; S.points = []; S.distance = 0;
  S.startTime = Date.now(); S.pausedTime = 0; S.lastPos = null;
  S.lastPosTime = null; S.lastAccuracy = null; S.bgNotified = false;

  // Wake Lock 取得
  await requestWakeLock();
  // 通知許可
  await requestNotificationPermission();

  // 高精度 watchPosition
  S.watchId = navigator.geolocation.watchPosition(onPos, onPosErr, {
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 30000
  });
  S.timerInterval = setInterval(updateTrackingUI, 1000);
  showTrackingPanel();
}

// ─── 位置情報コールバック（精度フィルタ強化版）───
function onPos(pos) {
  if (S.paused || !S.tracking) return;
  const { latitude: lat, longitude: lng, accuracy, speed } = pos.coords;
  const now = Date.now();

  // 1) 精度フィルタ: 精度が悪すぎる点を除外（動的閾値）
  const accThreshold = document.visibilityState === 'visible' ? 30 : 80;
  if (accuracy > accThreshold) {
    console.log(`[Tracking] Skipped: accuracy ${accuracy.toFixed(0)}m > ${accThreshold}m`);
    return;
  }

  const elapsed = getElapsed();

  if (S.lastPos) {
    const d = haversine(S.lastPos[0], S.lastPos[1], lat, lng);
    const dt = (now - S.lastPosTime) / 1000; // 実経過秒

    // 2) 速度フィルタ: 人間の最大移動速度チェック
    //    歩行: ~6km/h, ランニング: ~15km/h, 自転車: ~40km/h
    //    50km/h (≈13.9m/s) を超える移動は GPS ジャンプとみなす
    if (dt > 0) {
      const speedCalc = d / dt; // m/s
      const maxSpeed = 13.9; // 50 km/h in m/s
      if (speedCalc > maxSpeed) {
        console.log(`[Tracking] GPS jump filtered: ${(speedCalc * 3.6).toFixed(1)}km/h, ${d.toFixed(0)}m in ${dt.toFixed(0)}s`);
        return;
      }
    }

    // 3) 最小距離・時間フィルタ（ノイズ除去）
    const elapsedSinceLast = elapsed - (S.points.length > 0 ? S.points[S.points.length - 1][2] : 0);
    if (d < 5 && elapsedSinceLast < 3) return; // 5m以内かつ3秒以内は無視

    // 4) 精度加重: 精度が良いほど信頼する
    //    accuracy < 10m ならそのまま、10-30m なら少し補正
    let adjustedD = d;
    if (accuracy > 15 && d < accuracy * 0.5) {
      // 移動距離が精度の半分未満 → ノイズの可能性
      adjustedD = d * 0.7;
    }

    S.distance += adjustedD;
  }

  S.points.push([lat, lng, elapsed]);
  S.lastPos = [lat, lng];
  S.lastPosTime = now;
  S.lastAccuracy = accuracy;
  updateTrackingUI();
}

function onPosErr(err) {
  console.warn('[Tracking] Geo error:', err.code, err.message);
  // タイムアウトの場合は watchPosition を再起動
  if (err.code === 3 && S.tracking && !S.paused) {
    console.log('[Tracking] Timeout, restarting watch...');
    restartWatch();
  }
}

function getElapsed() {
  if (!S.startTime) return 0;
  const pausing = S.paused ? (Date.now() - S.pauseStart) : 0;
  return Math.floor((Date.now() - S.startTime - S.pausedTime - pausing) / 1000);
}
function pauseTracking() {
  S.paused = true; S.pauseStart = Date.now();
  releaseWakeLock();
  updateTrackingUI();
}
function resumeTracking() {
  if (S.pauseStart) S.pausedTime += Date.now() - S.pauseStart;
  S.paused = false; S.pauseStart = null;
  requestWakeLock();
  restartWatch(); // 再開時に watchPosition を再登録
  updateTrackingUI();
}
function stopTracking() {
  S.tracking = false;
  if (S.watchId !== null) navigator.geolocation.clearWatch(S.watchId);
  if (S.timerInterval) clearInterval(S.timerInterval);
  S.watchId = null; S.timerInterval = null;
  releaseWakeLock();
  S.bgNotified = false;
  hideTrackingPanel(); showSaveModal();
}
function showTrackingPanel() {
  const panel = document.getElementById('tracking-panel');
  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:10px">
      <div class="tracking-stat"><div class="val" id="tp-dist">0.00</div><div class="lbl">km</div></div>
      <div class="tracking-stat"><div class="val" id="tp-time">00:00</div><div class="lbl">時間</div></div>
      <div class="tracking-stat"><div class="val" id="tp-pts">0</div><div class="lbl">ポイント</div></div>
    </div>
    <div id="tp-gps-bar" style="display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,.08);margin-bottom:12px;font-size:12px">
      <span id="tp-gps-dot" style="width:8px;height:8px;border-radius:50%;background:#10b981;flex-shrink:0"></span>
      <span id="tp-gps-label" style="color:rgba(255,255,255,.8)">GPS取得中...</span>
      <span style="margin-left:auto;color:rgba(255,255,255,.5)" id="tp-gps-acc">--m</span>
      <span id="tp-wakelock" style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,.2);color:#10b981;display:none">🔒 画面維持</span>
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

  // GPS精度インジケーター更新
  const dot = document.getElementById('tp-gps-dot');
  const label = document.getElementById('tp-gps-label');
  const acc = document.getElementById('tp-gps-acc');
  const wl = document.getElementById('tp-wakelock');
  if (dot && S.lastAccuracy !== null) {
    const a = S.lastAccuracy;
    if (a <= 10) { dot.style.background = '#10b981'; label.textContent = 'GPS: 高精度'; }
    else if (a <= 30) { dot.style.background = '#f59e0b'; label.textContent = 'GPS: 中精度'; }
    else { dot.style.background = '#ef4444'; label.textContent = 'GPS: 低精度'; }
    acc.textContent = `±${Math.round(a)}m`;
  }
  if (wl) wl.style.display = S.wakeLock ? 'inline' : 'none';
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
        ${S.profile && S.profile.mbti ? `<div class="save-avatar" style="margin:0 auto 12px;width:64px;height:64px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.15))">${Personality.generateAvatarSmall(S.profile.mbti, S.profile.bigFive)}</div>` : ''}
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
  const b5Labels = { E: '外向性', A: '協調性', C: '誠実性', N: '神経症的傾向', O: '開放性' };
  const animalInfo = Personality.MBTI_ANIMALS ? Personality.MBTI_ANIMALS[profile.mbti] : null;
  const lvl = p.levelInfo;
  const userName = user ? esc(user.display_name || user.email.split('@')[0]) : 'あなた';
  const animalName = animalInfo ? animalInfo.name : '';
  const manual = Personality.MBTI_MANUALS ? Personality.MBTI_MANUALS[profile.mbti] : null;

  page.innerHTML = `
    <div style="padding:0 0 16px">
      <!-- 取扱説明書風ヒーロー -->
      <div style="background:linear-gradient(135deg,${mbti.gradientFrom},${mbti.gradientTo});padding:32px 20px 40px;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">
          <div style="position:absolute;top:10%;left:8%;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,.06)"></div>
          <div style="position:absolute;bottom:15%;right:10%;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.04)"></div>
          <div style="position:absolute;top:40%;right:5%;width:4px;height:4px;background:rgba(255,255,255,.3);border-radius:50%;animation:avatarFloat 3s ease-in-out infinite"></div>
          <div style="position:absolute;top:20%;left:15%;width:5px;height:5px;background:rgba(255,255,255,.25);border-radius:50%;animation:avatarFloat 4s ease-in-out infinite .5s"></div>
        </div>
        <div style="text-align:center;position:relative;z-index:1">
          <div style="font-size:12px;color:rgba(255,255,255,.7);font-weight:600;margin-bottom:4px;letter-spacing:2px">PERSONAL MANUAL</div>
          <div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:16px">${userName}の取扱説明書</div>
          <div style="width:140px;height:140px;margin:0 auto 12px;filter:drop-shadow(0 8px 24px rgba(0,0,0,.3));animation:avatarFloat 3s ease-in-out infinite">
            ${Personality.generateAvatar(profile.mbti, b5, 140)}
          </div>
          ${animalInfo ? `<div style="font-size:24px;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.2)">${animalName}</div>` : ''}
          <div style="font-size:14px;font-weight:700;color:rgba(255,255,255,.85)">${mbti.label}（${profile.mbti}）</div>
          <div style="display:flex;justify-content:center;gap:8px;margin-top:12px">
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#fff;background:rgba(255,255,255,.2);backdrop-filter:blur(8px);padding:4px 12px;border-radius:20px;font-weight:600"><i class="fas fa-star" style="font-size:9px"></i>Lv.${lvl.level} ${lvl.title}</span>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#fff;background:rgba(255,255,255,.2);backdrop-filter:blur(8px);padding:4px 12px;border-radius:20px;font-weight:600"><i class="fas fa-cloud-arrow-up" style="font-size:9px"></i>同期済み</span>
          </div>
        </div>
      </div>

      <div style="padding:0 16px;margin-top:-20px;position:relative;z-index:1">
        <!-- 性格タイプカード -->
        <div class="card fade-in" style="border-radius:20px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.08)">
          <div style="font-size:14px;color:var(--muted);line-height:1.7;margin-bottom:16px">${mbti.desc}</div>
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:var(--text)">あなたの強み</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
            ${mbti.strengths.map(s => `<span style="background:${mbti.color}12;color:${mbti.color};padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;border:1px solid ${mbti.color}20">${s}</span>`).join('')}
          </div>
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:var(--danger)">注意したいこと</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${mbti.riskFactors.map(r => `<span style="background:#fef2f2;color:var(--danger);padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700">${r}</span>`).join('')}
          </div>
        </div>

        ${manual && manual.length > 0 ? `
        <!-- 取扱説明書 -->
        <div class="card fade-in" style="border-radius:20px;padding:0;box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden">
          <div style="background:linear-gradient(135deg,${mbti.gradientFrom}15,${mbti.gradientTo}25);padding:20px 24px 12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <div style="width:4px;height:20px;border-radius:2px;background:${mbti.color}"></div>
              <div style="font-weight:800;font-size:16px">${userName}の取扱説明書</div>
            </div>
            <div style="font-size:11px;color:var(--muted);padding-left:12px">${animalName ? animalName + ' · ' : ''}${mbti.label}タイプ</div>
          </div>
          <div style="padding:8px 24px 20px">
            ${manual.map((item, i) => `
              <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;${i < manual.length - 1 ? 'border-bottom:1px solid #f1f5f9' : ''}">
                <span style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;border-radius:50%;background:${mbti.color}12;color:${mbti.color};font-size:11px;font-weight:800;margin-top:1px">${i + 1}</span>
                <span style="font-size:13px;line-height:1.6;color:var(--text)">${item}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ` : ''}

        <!-- Big Five レーダーチャート -->
        <div class="card fade-in" style="border-radius:20px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.08)">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <div style="width:4px;height:20px;border-radius:2px;background:${mbti.color}"></div>
            <div style="font-weight:800;font-size:16px">ビッグファイブ プロフィール</div>
          </div>
          <div style="width:100%;margin:0 auto 20px">
            ${generateRadarChart(b5, mbti.color, 360)}
          </div>
          ${Object.entries(b5).map(([dim, val]) => {
            const pct = (val / 5 * 100).toFixed(0);
            const lv = val >= 4.3 ? 'S' : val >= 3.6 ? 'A' : val >= 2.8 ? 'B' : val >= 2 ? 'C' : 'D';
            return `
            <div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:${mbti.color}15;color:${mbti.color};font-size:10px;font-weight:800">${lv}</span>
                  <span style="font-weight:700;font-size:13px">${b5Labels[dim]}</span>
                </div>
                <span style="font-size:12px;font-weight:600;color:${mbti.color}">${val.toFixed(1)}</span>
              </div>
              <div style="background:#f1f5f9;border-radius:8px;height:8px;overflow:hidden">
                <div style="background:linear-gradient(90deg,${mbti.gradientFrom},${mbti.gradientTo});height:100%;width:${pct}%;border-radius:8px;position:relative">
                  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.3),transparent);border-radius:8px"></div>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>

        <!-- レベル -->
        <div class="card fade-in" style="border-radius:20px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.08)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="font-weight:800;font-size:15px"><i class="fas fa-star" style="color:var(--accent);margin-right:6px"></i>レベル</div>
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
            <div style="background:#f1f5f9;border-radius:8px;height:10px;overflow:hidden">
              <div style="background:linear-gradient(90deg,${mbti.gradientFrom},${mbti.gradientTo});height:100%;width:${lvl.progress}%;border-radius:8px;position:relative">
                <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,.3),transparent);border-radius:8px"></div>
              </div>
            </div>
          ` : '<div style="font-size:13px;color:var(--accent);font-weight:600">🎉 最高レベル到達！</div>'}
        </div>

        <!-- 進化ログ -->
        ${log.length > 0 ? `
          <div class="card fade-in" style="border-radius:20px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.08)">
            <div style="font-weight:800;font-size:15px;margin-bottom:12px"><i class="fas fa-timeline" style="color:var(--primary);margin-right:6px"></i>カスタマイズ進化ログ</div>
            ${log.slice(-10).reverse().map(entry => {
              const date = fmtDate(entry.timestamp);
              if (entry.type === 'diagnosis') return `<div class="activity-row"><div class="activity-dot" style="background:var(--accent)"></div><div style="flex:1"><div style="font-size:13px;font-weight:600">性格診断実施</div><div style="font-size:12px;color:var(--muted)">${date} · ${entry.mbti}</div></div></div>`;
              if (entry.type === 'level_up') return `<div class="activity-row"><div class="activity-dot" style="background:var(--success)"></div><div style="flex:1"><div style="font-size:13px;font-weight:600">Lv.${entry.level} ${entry.title} に到達</div><div style="font-size:12px;color:var(--muted)">${date} · ${entry.unlocks}解放</div></div></div>`;
              return '';
            }).join('')}
          </div>
        ` : ''}

        <!-- アクション -->
        <div class="card fade-in" style="border-radius:20px;padding:24px;box-shadow:0 4px 24px rgba(0,0,0,.08)">
          <div style="font-weight:800;font-size:15px;margin-bottom:12px">設定</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="data-mgmt-btn" style="width:100%;justify-content:center;border-radius:12px;padding:12px" id="btn-rediag">
              <i class="fas fa-rotate"></i> 性格診断をやり直す
            </button>
            <button class="data-mgmt-btn danger" style="width:100%;justify-content:center;border-radius:12px;padding:12px" id="btn-reset-all">
              <i class="fas fa-triangle-exclamation"></i> 全データ+プロフィールを完全削除
            </button>
            <button class="data-mgmt-btn" style="width:100%;justify-content:center;color:var(--muted);border-color:#e2e8f0;border-radius:12px;padding:12px" id="btn-logout">
              <i class="fas fa-arrow-right-from-bracket"></i> ログアウト
            </button>
          </div>
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
        ${S.profile && S.profile.mbti ? `<div style="margin:0 auto 12px;width:80px;height:80px;filter:drop-shadow(0 4px 16px rgba(255,255,255,.3))">${Personality.generateAvatar(S.profile.mbti, S.profile.bigFive, 80)}</div>` : `<div style="font-size:48px;margin-bottom:8px"><i class="fas fa-trophy"></i></div>`}
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

// ─── ページ離脱警告（記録中のみ）───
window.addEventListener('beforeunload', (e) => {
  if (S.tracking) {
    e.preventDefault();
    e.returnValue = '記録中です。ページを離れると記録が失われます。';
    return e.returnValue;
  }
});
