/* ===================================================================
   Journey Tracker – Personality Engine (personality.js)
   
   Big Five (10問簡易版 TIPI-J) → MBTI 4文字コード自動判定
   性格に基づいてUI全体をパーソナライズする。
   使うほどデータが蓄積し、カスタマイズが進化する。
   =================================================================== */

// ═══════════════════════════════════════════════════════════════
// 1. Big Five 診断 (TIPI-J: Ten-Item Personality Inventory 日本語版)
//    各次元 1-7 スケール × 2問 → 平均 → 5次元スコア
// ═══════════════════════════════════════════════════════════════

const BIG5_QUESTIONS = [
  // [次元, 方向(+1=正, -1=逆転), 質問テキスト]
  // E: Extraversion（外向性）
  { dim: 'E', dir: +1, text: '自分は社交的で活発だと思う' },
  { dim: 'E', dir: -1, text: '自分は控えめで物静かだと思う' },
  // A: Agreeableness（協調性）
  { dim: 'A', dir: +1, text: '他人に対して思いやりがある方だ' },
  { dim: 'A', dir: -1, text: '人と衝突しやすい方だ' },
  // C: Conscientiousness（誠実性）
  { dim: 'C', dir: +1, text: '物事をきちんと計画して実行する方だ' },
  { dim: 'C', dir: -1, text: '少しだらしないところがある' },
  // N: Neuroticism（神経症的傾向）
  { dim: 'N', dir: +1, text: '不安を感じやすい方だ' },
  { dim: 'N', dir: -1, text: '感情的に安定している方だ' },
  // O: Openness（開放性）
  { dim: 'O', dir: +1, text: '新しいことに挑戦するのが好きだ' },
  { dim: 'O', dir: -1, text: '慣れたやり方を好む' },
];

/**
 * 回答配列 (10個, 各1-7) → Big Five スコア { E, A, C, N, O } (各1-7)
 */
function calcBigFive(answers) {
  const dims = {};
  BIG5_QUESTIONS.forEach((q, i) => {
    const raw = answers[i] || 4;
    const val = q.dir === 1 ? raw : (8 - raw); // 逆転項目
    if (!dims[q.dim]) dims[q.dim] = [];
    dims[q.dim].push(val);
  });
  const scores = {};
  for (const [dim, vals] of Object.entries(dims)) {
    scores[dim] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }
  return scores; // { E: 1-7, A: 1-7, C: 1-7, N: 1-7, O: 1-7 }
}

// ═══════════════════════════════════════════════════════════════
// 2. Big Five → MBTI マッピング
//    学術的には完全な対応ではないが、実用的な近似として使用
// ═══════════════════════════════════════════════════════════════

function bigFiveToMBTI(b5) {
  const I_E = b5.E >= 4 ? 'E' : 'I';       // 外向 vs 内向
  const S_N = b5.O >= 4 ? 'N' : 'S';        // 直感 vs 感覚 (開放性↑=直感)
  const T_F = b5.A >= 4 ? 'F' : 'T';        // 感情 vs 思考 (協調性↑=感情)
  const J_P = b5.C >= 4 ? 'J' : 'P';        // 判断 vs 知覚 (誠実性↑=判断)
  return I_E + S_N + T_F + J_P;
}

// ═══════════════════════════════════════════════════════════════
// 3. MBTI 16タイプ定義: 習慣化に特化したパーソナライズ
// ═══════════════════════════════════════════════════════════════

const MBTI_PROFILES = {
  // ─── Analyst (NT) ───
  INTJ: {
    label: '戦略家', emoji: '🧠', color: '#6366f1',
    gradientFrom: '#4338ca', gradientTo: '#6366f1',
    habitStyle: 'strategic', // 長期目標 → 逆算
    motivator: 'progress',   // 数値的進捗
    desc: '長期ビジョンから逆算して、計画的に習慣を積み上げる',
    strengths: ['自己管理力', '長期思考', '独立性'],
    riskFactors: ['完璧主義で挫折', '孤独な継続に飽き'],
  },
  INTP: {
    label: '論理学者', emoji: '🔬', color: '#8b5cf6',
    gradientFrom: '#6d28d9', gradientTo: '#8b5cf6',
    habitStyle: 'experimental',
    motivator: 'insight',
    desc: 'データとパターンを分析し、最適な習慣を実験的に見つけ出す',
    strengths: ['分析力', '好奇心', '論理的思考'],
    riskFactors: ['飽きやすい', '完璧を求めすぎ'],
  },
  ENTJ: {
    label: '指揮官', emoji: '⚡', color: '#dc2626',
    gradientFrom: '#b91c1c', gradientTo: '#ef4444',
    habitStyle: 'conquest',
    motivator: 'achievement',
    desc: '目標を征服するように、力強く習慣を制覇していく',
    strengths: ['実行力', '決断力', 'リーダーシップ'],
    riskFactors: ['無理しすぎ', '休息軽視'],
  },
  ENTP: {
    label: '討論者', emoji: '💡', color: '#f59e0b',
    gradientFrom: '#d97706', gradientTo: '#f59e0b',
    habitStyle: 'gamified',
    motivator: 'novelty',
    desc: '飽きない仕組みとゲーム性で、楽しみながら習慣を続ける',
    strengths: ['創造性', '適応力', 'エネルギー'],
    riskFactors: ['新しいことに目移り', '一貫性不足'],
  },
  // ─── Diplomat (NF) ───
  INFJ: {
    label: '提唱者', emoji: '🌊', color: '#0ea5e9',
    gradientFrom: '#0284c7', gradientTo: '#38bdf8',
    habitStyle: 'meaningful',
    motivator: 'purpose',
    desc: '深い意味と使命感を原動力に、静かに確実に習慣を育てる',
    strengths: ['洞察力', '忍耐力', '意味づけ力'],
    riskFactors: ['理想と現実のギャップ', '燃え尽き'],
  },
  INFP: {
    label: '仲介者', emoji: '🌸', color: '#ec4899',
    gradientFrom: '#db2777', gradientTo: '#f472b6',
    habitStyle: 'emotional',
    motivator: 'feeling',
    desc: '感情の波に寄り添いながら、自分だけのペースで歩みを重ねる',
    strengths: ['共感力', '内省力', '創造性'],
    riskFactors: ['気分の波', 'モチベーション依存'],
  },
  ENFJ: {
    label: '主人公', emoji: '🌟', color: '#f97316',
    gradientFrom: '#ea580c', gradientTo: '#fb923c',
    habitStyle: 'narrative',
    motivator: 'story',
    desc: '自分の物語を紡ぐように、ドラマチックに習慣を続ける',
    strengths: ['モチベーション力', '共感力', 'ビジョン'],
    riskFactors: ['他人のために頑張りすぎ', '自分を後回し'],
  },
  ENFP: {
    label: '運動家', emoji: '🎪', color: '#a855f7',
    gradientFrom: '#9333ea', gradientTo: '#c084fc',
    habitStyle: 'exploratory',
    motivator: 'discovery',
    desc: '好奇心に導かれて、冒険するように新しい道を歩いていく',
    strengths: ['熱意', '創造性', '社交性'],
    riskFactors: ['飽きやすい', '計画性不足'],
  },
  // ─── Sentinel (SJ) ───
  ISTJ: {
    label: '管理者', emoji: '📋', color: '#475569',
    gradientFrom: '#334155', gradientTo: '#64748b',
    habitStyle: 'systematic',
    motivator: 'consistency',
    desc: 'ルールと仕組みで確実に積み上げる、最も安定した習慣構築者',
    strengths: ['責任感', '計画性', '粘り強さ'],
    riskFactors: ['柔軟性不足', '楽しさ軽視'],
  },
  ISFJ: {
    label: '擁護者', emoji: '🛡️', color: '#14b8a6',
    gradientFrom: '#0d9488', gradientTo: '#2dd4bf',
    habitStyle: 'nurturing',
    motivator: 'care',
    desc: '自分と大切な人のために、丁寧にケアするように習慣を守る',
    strengths: ['思いやり', '忍耐力', '注意深さ'],
    riskFactors: ['自分を後回し', '変化への抵抗'],
  },
  ESTJ: {
    label: '幹部', emoji: '🏛️', color: '#2563eb',
    gradientFrom: '#1d4ed8', gradientTo: '#3b82f6',
    habitStyle: 'disciplined',
    motivator: 'order',
    desc: '規律とルーティンで、揺るがない習慣の柱を建てる',
    strengths: ['組織力', '実行力', '責任感'],
    riskFactors: ['柔軟性不足', 'ストレス蓄積'],
  },
  ESFJ: {
    label: '領事', emoji: '🤝', color: '#10b981',
    gradientFrom: '#059669', gradientTo: '#34d399',
    habitStyle: 'social',
    motivator: 'connection',
    desc: '人との繋がりを力に変えて、温かく習慣を続ける',
    strengths: ['社交性', '思いやり', '調和'],
    riskFactors: ['他人依存', '自分の基準が曖昧'],
  },
  // ─── Explorer (SP) ───
  ISTP: {
    label: '巨匠', emoji: '🔧', color: '#78716c',
    gradientFrom: '#57534e', gradientTo: '#a8a29e',
    habitStyle: 'pragmatic',
    motivator: 'efficiency',
    desc: '無駄を省いた効率的なやり方で、実用的に習慣を回す',
    strengths: ['実践力', '適応力', '冷静さ'],
    riskFactors: ['飽きやすい', '長期計画が苦手'],
  },
  ISFP: {
    label: '冒険家', emoji: '🎨', color: '#f43f5e',
    gradientFrom: '#e11d48', gradientTo: '#fb7185',
    habitStyle: 'aesthetic',
    motivator: 'beauty',
    desc: '美しさと感性を大切にしながら、自分だけの道を彩る',
    strengths: ['感性', '柔軟性', '行動力'],
    riskFactors: ['構造が苦手', '気分次第'],
  },
  ESTP: {
    label: '起業家', emoji: '🎯', color: '#ea580c',
    gradientFrom: '#c2410c', gradientTo: '#f97316',
    habitStyle: 'challenge',
    motivator: 'thrill',
    desc: 'チャレンジと即時フィードバックで、刺激的に習慣を続ける',
    strengths: ['行動力', '適応力', '実践力'],
    riskFactors: ['飽きやすい', '長期目標が苦手'],
  },
  ESFP: {
    label: 'エンターテイナー', emoji: '🎭', color: '#e879f9',
    gradientFrom: '#d946ef', gradientTo: '#f0abfc',
    habitStyle: 'playful',
    motivator: 'fun',
    desc: '楽しさとワクワクを燃料に、笑顔で習慣を続ける',
    strengths: ['楽観性', '社交性', '柔軟性'],
    riskFactors: ['飽きやすい', '楽しくないとやめる'],
  },
};

// ═══════════════════════════════════════════════════════════════
// 4. パーソナライズエンジン: 性格 → 具体的なカスタマイズ
// ═══════════════════════════════════════════════════════════════

/**
 * プロフィールから現在のパーソナライズ設定を生成
 * @param {object} profile - { bigFive, mbti, level, totalActivities }
 * @returns {object} カスタマイズオブジェクト
 */
function getPersonalization(profile) {
  if (!profile || !profile.mbti) return getDefaultPersonalization();
  
  const mbti = MBTI_PROFILES[profile.mbti] || MBTI_PROFILES['INFP'];
  const b5 = profile.bigFive || { E: 4, A: 4, C: 4, N: 4, O: 4 };
  const level = profile.level || 1;
  const totalActs = profile.totalActivities || 0;

  return {
    // ─── テーマカラー ───
    theme: {
      primary: mbti.color,
      gradientFrom: mbti.gradientFrom,
      gradientTo: mbti.gradientTo,
    },
    // ─── ホーム画面メッセージ ───
    homeMessages: buildHomeMessages(mbti, b5, level, totalActs),
    // ─── 記録完了メッセージ ───
    completionMessages: buildCompletionMessages(mbti, b5),
    // ─── マイルストーン演出 ───
    milestoneMessages: buildMilestoneMessages(mbti, b5),
    // ─── 記録開始の励まし ───
    startMessages: buildStartMessages(mbti, b5),
    // ─── ふりかえりコメント ───
    reviewInsights: buildReviewInsights(mbti, b5),
    // ─── 習慣化リスクアラート ───
    riskAlerts: buildRiskAlerts(mbti, b5, totalActs),
    // ─── レベルシステム ───
    levelInfo: calcLevel(totalActs),
    // ─── MBTI情報 ───
    mbtiInfo: mbti,
  };
}

function getDefaultPersonalization() {
  return {
    theme: { primary: '#4f46e5', gradientFrom: '#4338ca', gradientTo: '#6366f1' },
    homeMessages: { greeting: 'あなたの歩みを記録しよう', sub: '' },
    completionMessages: ['お疲れさまでした！'],
    milestoneMessages: ['この差は、もう埋まらない。'],
    startMessages: ['さあ、出かけよう'],
    reviewInsights: [],
    riskAlerts: [],
    levelInfo: { level: 1, title: 'はじめの一歩', next: 3, progress: 0 },
    mbtiInfo: null,
  };
}

// ─── メッセージビルダー群 ───

function buildHomeMessages(mbti, b5, level, acts) {
  const greetings = {
    strategic:    ['戦略的に積み上げている', '計画通りに進んでいる'],
    experimental: ['面白いパターンが見えてきた', 'データが語り始めている'],
    conquest:     ['着実に制覇している', '次の目標を攻略しよう'],
    gamified:     ['今日はどんな冒険をする？', '新しい発見が待っている'],
    meaningful:   ['一歩一歩に意味がある', '静かに、確かに育っている'],
    emotional:    ['今日の気分で、自分のペースで', 'あなたらしく歩こう'],
    narrative:    ['あなたの物語は続いている', '今日も新しい一章が始まる'],
    exploratory:  ['どこへ行こう？', '未知の道が呼んでいる'],
    systematic:   ['着実に積み上がっている', 'ルーティンが力になっている'],
    nurturing:    ['自分を大切にする時間', '丁寧に、一歩ずつ'],
    disciplined:  ['規律が結果を生んでいる', '今日も確実に'],
    social:       ['歩いた分だけ、つながりが生まれる', '今日も誰かのために'],
    pragmatic:    ['効率よく進んでいる', '無駄のない一歩'],
    aesthetic:    ['今日の景色を楽しもう', '美しい一歩を'],
    challenge:    ['今日の自分に挑戦しよう', '昨日を超えろ'],
    playful:      ['楽しく行こう！', 'ワクワクする一歩を'],
  };
  const msgs = greetings[mbti.habitStyle] || ['歩みを続けよう'];
  const greeting = msgs[Math.floor(Math.random() * msgs.length)];
  
  let sub = '';
  if (acts === 0) sub = `${mbti.emoji} ${mbti.label}タイプのあなたに最適化されました`;
  else if (acts < 5) sub = `${mbti.strengths[0]}を活かして、まず5回の記録を目指そう`;
  else if (acts < 20) sub = '習慣の土台ができてきている';
  else sub = `Lv.${level} — ${mbti.desc.slice(0, 20)}…`;

  return { greeting, sub };
}

function buildCompletionMessages(mbti, b5) {
  const base = {
    strategic:    ['計画通り。次のステップへ。', '積み上げが加速している。', '戦略は正しかった。'],
    experimental: ['新しいデータが増えた。', '興味深いパターンだ。', 'また一つ学びが増えた。'],
    conquest:     ['また一つ制覇した。', '止まらない。', '強い。'],
    gamified:     ['ナイス！経験値ゲット！', '新記録を狙おう！', 'レベルアップに近づいた！'],
    meaningful:   ['また一歩、意味のある時間を過ごした。', '静かな達成感。', '確かな一歩。'],
    emotional:    ['今日の自分を褒めてあげて。', 'よく歩いたね。', '自分のペースで、大丈夫。'],
    narrative:    ['物語に新しいページが加わった。', '今日の一章、完結。', 'ドラマチックな一歩。'],
    exploratory:  ['新しい景色を見つけた！', '冒険は続く。', '次はどこへ行こう？'],
    systematic:   ['ルーティン完了。', '安定して積み上がっている。', '着実。'],
    nurturing:    ['自分を大切にできた。', '丁寧な時間だった。', 'よく頑張ったね。'],
    disciplined:  ['規律を守った。それが全て。', '継続は力。', 'ブレない。'],
    social:       ['歩いた分だけ、世界が広がった。', '今日もつながりを感じた。', 'ありがとう、自分。'],
    pragmatic:    ['効率的だった。', '無駄のない一歩。', '完了。'],
    aesthetic:    ['美しい時間だった。', '景色が心に残った。', '感性が磨かれた。'],
    challenge:    ['チャレンジ完了！', '昨日の自分を超えた。', '限界を押し広げた。'],
    playful:      ['楽しかった！', 'またやろう！', '最高の時間！'],
  };
  return base[mbti.habitStyle] || ['お疲れさまでした！'];
}

function buildMilestoneMessages(mbti, b5) {
  const base = {
    strategic:    ['計算通り。この成果は必然だ。', '長期戦略が実を結んだ。'],
    experimental: ['仮説が証明された。あなたは"できる"。', 'データが示している — 前進した。'],
    conquest:     ['征服した。この領域はあなたのものだ。', '止められない力がある。'],
    gamified:     ['ボーナスステージ突入！', 'レジェンド級の達成だ！'],
    meaningful:   ['この一歩一歩に、深い意味があった。', '静かに、しかし確実に世界を変えた。'],
    emotional:    ['感じてほしい。あなたが歩いた全ての瞬間を。', '泣いても、笑っても、歩き続けた。それが全て。'],
    narrative:    ['これはあなたの物語の転換点だ。', '主人公は、立ち止まらなかった。'],
    exploratory:  ['未知の領域に到達した！', '好奇心が、ここまで連れてきた。'],
    systematic:   ['システムが正しく機能した証拠だ。', '着実な積み上げの結晶。'],
    nurturing:    ['自分を大切にした結果がここにある。', '丁寧に育てたものは、裏切らない。'],
    disciplined:  ['規律は裏切らない。それを証明した。', '揺るがない意志の勝利。'],
    social:       ['あなたの歩みは、誰かの勇気になっている。', '繋がりの中で、ここまで来た。'],
    pragmatic:    ['効率的に、確実に。それがあなたのやり方。', '無駄のない道のりだった。'],
    aesthetic:    ['美しい軌跡を描いた。', 'あなたの歩みは、アートだ。'],
    challenge:    ['挑戦者は、ここまで来た。', '限界は、超えるためにある。'],
    playful:      ['楽しみながら、ここまで来ちゃった！', '遊び心が最強の武器だった。'],
  };
  return base[mbti.habitStyle] || ['この差は、もう埋まらない。'];
}

function buildStartMessages(mbti, b5) {
  const base = {
    strategic:    ['計画に沿って始めよう', '今日の目標を達成しに行こう'],
    experimental: ['今日はどんなデータが取れるかな', '新しい実験を始めよう'],
    conquest:     ['さあ、攻略開始だ', '今日も勝ちに行こう'],
    gamified:     ['アドベンチャー開始！', '経験値を稼ごう！'],
    meaningful:   ['意味のある時間を始めよう', '今日の一歩も、大切な一歩'],
    emotional:    ['自分のペースでいい。歩き出そう', '今の気持ちを連れて行こう'],
    narrative:    ['新しい章が始まる', '今日の物語を紡ごう'],
    exploratory:  ['どこへ行こう？', '未知の道を探検しよう'],
    systematic:   ['ルーティン開始', '今日も確実に'],
    nurturing:    ['自分のための時間を始めよう', '丁寧に歩こう'],
    disciplined:  ['規律を守ろう。今日も', 'やるべきことをやる'],
    social:       ['歩いて、世界と繋がろう', '今日も外に出よう'],
    pragmatic:    ['効率よく行こう', 'スタート'],
    aesthetic:    ['今日の景色を楽しみに', '美しい一歩を'],
    challenge:    ['自分に挑戦だ', '昨日の記録を超えよう'],
    playful:      ['楽しく行こう〜！', 'レッツゴー！'],
  };
  return base[mbti.habitStyle] || ['さあ、出かけよう'];
}

function buildReviewInsights(mbti, b5) {
  // 性格に基づいたふりかえりの視点
  const insights = [];
  if (b5.C >= 5) insights.push({ icon: '📊', text: '計画性の高いあなた。継続率を見てみよう' });
  if (b5.C < 3) insights.push({ icon: '🎲', text: '自由なあなた。歩いた日の気分の良さを思い出して' });
  if (b5.N >= 5) insights.push({ icon: '💆', text: '歩くことはストレス解消にも。心の変化に注目' });
  if (b5.E >= 5) insights.push({ icon: '👥', text: '社交的なあなた。散歩で出会った景色を誰かに話そう' });
  if (b5.E < 3) insights.push({ icon: '🧘', text: '静かな時間を楽しむあなた。ひとり歩きの価値を味わおう' });
  if (b5.O >= 5) insights.push({ icon: '🗺️', text: '新しいルートを試すのも面白いかも' });
  if (b5.A >= 5) insights.push({ icon: '💛', text: '優しいあなた。自分のことも褒めてあげて' });
  return insights;
}

function buildRiskAlerts(mbti, b5, totalActs) {
  const alerts = [];
  // 性格に基づいた離脱リスクアラート
  if (b5.N >= 5 && totalActs > 3) {
    alerts.push({ type: 'gentle', msg: '完璧じゃなくていい。歩いた事実が全て。' });
  }
  if (b5.C < 3 && totalActs > 5) {
    alerts.push({ type: 'structure', msg: '「毎日同じ時間」じゃなくてOK。週3回でも十分。' });
  }
  if (b5.E < 3 && totalActs > 10) {
    alerts.push({ type: 'solo', msg: 'ひとりでここまで来た。それは、すごいこと。' });
  }
  if (b5.O >= 5 && totalActs > 7) {
    alerts.push({ type: 'novelty', msg: '今日は違うルートを歩いてみる？' });
  }
  return alerts;
}

// ═══════════════════════════════════════════════════════════════
// 5. レベルシステム（使うほど進化）
// ═══════════════════════════════════════════════════════════════

const LEVELS = [
  { level: 1,  min: 0,   title: 'はじめの一歩',    unlocks: '基本テーマカラー' },
  { level: 2,  min: 3,   title: '歩き始めた人',    unlocks: '性格メッセージ' },
  { level: 3,  min: 7,   title: '習慣の芽',        unlocks: 'ふりかえりインサイト' },
  { level: 4,  min: 14,  title: '継続する人',      unlocks: 'リスクアラート' },
  { level: 5,  min: 25,  title: '習慣の木',        unlocks: '高度なパーソナライズ' },
  { level: 6,  min: 40,  title: '歩みの達人',      unlocks: '全機能解放' },
  { level: 7,  min: 60,  title: '道の開拓者',      unlocks: 'レジェンドバッジ' },
  { level: 8,  min: 100, title: '伝説の旅人',      unlocks: '究極カスタマイズ' },
];

function calcLevel(totalActivities) {
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalActivities >= LEVELS[i].min) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }
  const progress = next
    ? Math.min(((totalActivities - current.min) / (next.min - current.min)) * 100, 100)
    : 100;
  return {
    level: current.level,
    title: current.title,
    unlocks: current.unlocks,
    nextLevel: next ? next.level : null,
    nextTitle: next ? next.title : null,
    nextMin: next ? next.min : null,
    progress,
    totalActivities,
  };
}

// ═══════════════════════════════════════════════════════════════
// 6. テーマ適用: CSS変数を動的に更新
// ═══════════════════════════════════════════════════════════════

function applyTheme(personalization) {
  if (!personalization || !personalization.theme) return;
  const t = personalization.theme;
  const root = document.documentElement;
  root.style.setProperty('--primary', t.primary);
  root.style.setProperty('--gradient-from', t.gradientFrom);
  root.style.setProperty('--gradient-to', t.gradientTo);
  // テーマカラーの明るい版を自動生成
  root.style.setProperty('--primary-light', t.gradientTo);
  // meta theme-color も更新
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.primary);
}

// ═══════════════════════════════════════════════════════════════
// 7. アバター生成エンジン – MBTI × Big Five → 動物 SVG
//    性格診断ごとに、MBTIタイプに対応した動物アバターを生成
//    Big Five スコアで表情・体型・装飾がユニークに変化
// ═══════════════════════════════════════════════════════════════

/** MBTI → 動物マッピング */
const MBTI_ANIMALS = {
  // ─── Analyst (NT) ───
  INTJ: { animal: 'owl',     name: 'フクロウ' },   // 賢明・戦略的
  INTP: { animal: 'cat',     name: 'ネコ' },       // 好奇心・独立
  ENTJ: { animal: 'lion',    name: 'ライオン' },   // 指揮・威厳
  ENTP: { animal: 'fox',     name: 'キツネ' },     // 機知・遊び心
  // ─── Diplomat (NF) ───
  INFJ: { animal: 'wolf',    name: 'オオカミ' },   // 洞察・孤高
  INFP: { animal: 'deer',    name: 'シカ' },       // 繊細・優美
  ENFJ: { animal: 'dolphin', name: 'イルカ' },     // 社交・導き
  ENFP: { animal: 'butterfly', name: 'チョウ' },   // 自由・好奇心
  // ─── Sentinel (SJ) ───
  ISTJ: { animal: 'bear',    name: 'クマ' },       // 堅実・力強さ
  ISFJ: { animal: 'rabbit',  name: 'ウサギ' },     // 優しさ・守り
  ESTJ: { animal: 'eagle',   name: 'ワシ' },       // 統率・鋭い目
  ESFJ: { animal: 'dog',     name: 'イヌ' },       // 忠実・社交
  // ─── Explorer (SP) ───
  ISTP: { animal: 'hawk',    name: 'タカ' },       // 実践・独立
  ISFP: { animal: 'panda',   name: 'パンダ' },     // 穏やか・感性
  ESTP: { animal: 'tiger',   name: 'トラ' },       // 行動・大胆
  ESFP: { animal: 'otter',   name: 'カワウソ' },   // 遊び心・楽観
};

/**
 * MBTI + Big Five から高品質チビキャラ動物SVGアバターを生成
 * MindAxis風：リッチグラデーション、大きなキラキラ目、ファンタジー要素
 * @param {string} mbti - MBTIコード (例: "INFP")
 * @param {object} bigFive - { E, A, C, N, O } (各1-7)
 * @param {number} size - SVGサイズ (default 200)
 * @returns {string} SVG文字列
 */
function generateAvatar(mbti, bigFive, size = 200) {
  const prof = MBTI_PROFILES[mbti] || MBTI_PROFILES['INFP'];
  const animalInfo = MBTI_ANIMALS[mbti] || MBTI_ANIMALS['INFP'];
  const b5 = bigFive || { E: 4, A: 4, C: 4, N: 4, O: 4 };

  const E = (b5.E - 1) / 6; // 外向性
  const A = (b5.A - 1) / 6; // 協調性
  const C = (b5.C - 1) / 6; // 誠実性
  const N = (b5.N - 1) / 6; // 神経症的傾向
  const O = (b5.O - 1) / 6; // 開放性

  const c1 = prof.gradientFrom;
  const c2 = prof.gradientTo;
  const accent = prof.color;
  const lerp = (a, b, t) => a + (b - a) * t;
  const cx = size / 2;
  const cy = size / 2;
  const u = size / 200;

  // deterministic rng
  let seed = 0;
  for (let i = 0; i < mbti.length; i++) seed = seed * 31 + mbti.charCodeAt(i);
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  // hex helpers
  const hexToRgb = (h) => {
    const r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16);
    return {r,g,b};
  };
  const lerpColor = (h1, h2, t) => {
    const a = hexToRgb(h1), b2 = hexToRgb(h2);
    const r = Math.round(a.r+(b2.r-a.r)*t), g = Math.round(a.g+(b2.g-a.g)*t), bl = Math.round(a.b+(b2.b-a.b)*t);
    return `rgb(${r},${g},${bl})`;
  };
  const lighten = (hex, amt) => {
    const {r,g,b: bl} = hexToRgb(hex);
    return `rgb(${Math.min(255,r+amt)},${Math.min(255,g+amt)},${Math.min(255,bl+amt)})`;
  };
  const darken = (hex, amt) => lighten(hex, -amt);

  const uid = 'a' + mbti + size + Math.random().toString(36).slice(2,6);
  const a = animalInfo.animal;

  // ═══ 動物カラーパレット（タイプ固有の自然色） ═══
  const PALETTES = {
    owl:       { body: '#6c5ce7', bodyL: '#a29bfe', belly: '#ddd6fe', markA: '#4c3ec4', markB: '#c4b5fd', glow: '#8b5cf6' },
    cat:       { body: '#7c3aed', bodyL: '#c4b5fd', belly: '#ede9fe', markA: '#5b21b6', markB: '#ddd6fe', glow: '#a78bfa' },
    lion:      { body: '#dc2626', bodyL: '#fca5a5', belly: '#fee2e2', markA: '#991b1b', markB: '#fecaca', glow: '#f87171' },
    fox:       { body: '#ea580c', bodyL: '#fdba74', belly: '#fff7ed', markA: '#c2410c', markB: '#fed7aa', glow: '#fb923c' },
    wolf:      { body: '#0284c7', bodyL: '#7dd3fc', belly: '#e0f2fe', markA: '#075985', markB: '#bae6fd', glow: '#38bdf8' },
    deer:      { body: '#db2777', bodyL: '#f9a8d4', belly: '#fce7f3', markA: '#9d174d', markB: '#fbcfe8', glow: '#f472b6' },
    dolphin:   { body: '#0891b2', bodyL: '#67e8f9', belly: '#e0f7fa', markA: '#155e75', markB: '#a5f3fc', glow: '#22d3ee' },
    butterfly: { body: '#9333ea', bodyL: '#d8b4fe', belly: '#f5f3ff', markA: '#6b21a8', markB: '#e9d5ff', glow: '#c084fc' },
    bear:      { body: '#4b5563', bodyL: '#9ca3af', belly: '#e5e7eb', markA: '#374151', markB: '#d1d5db', glow: '#6b7280' },
    rabbit:    { body: '#0d9488', bodyL: '#5eead4', belly: '#ccfbf1', markA: '#115e59', markB: '#99f6e4', glow: '#2dd4bf' },
    eagle:     { body: '#1d4ed8', bodyL: '#93c5fd', belly: '#dbeafe', markA: '#1e3a8a', markB: '#bfdbfe', glow: '#60a5fa' },
    dog:       { body: '#059669', bodyL: '#6ee7b7', belly: '#d1fae5', markA: '#065f46', markB: '#a7f3d0', glow: '#34d399' },
    hawk:      { body: '#78716c', bodyL: '#d6d3d1', belly: '#f5f5f4', markA: '#44403c', markB: '#e7e5e4', glow: '#a8a29e' },
    panda:     { body: '#e11d48', bodyL: '#fda4af', belly: '#fff1f2', markA: '#9f1239', markB: '#fecdd3', glow: '#fb7185' },
    tiger:     { body: '#ea580c', bodyL: '#fdba74', belly: '#fff7ed', markA: '#9a3412', markB: '#fed7aa', glow: '#f97316' },
    otter:     { body: '#d946ef', bodyL: '#f0abfc', belly: '#fdf4ff', markA: '#a21caf', markB: '#f5d0fe', glow: '#e879f9' },
  };
  const pal = PALETTES[a] || PALETTES.cat;

  // ═══ SVG開始 + デフィニション ═══
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<defs>`;
  // 背景グラデーション
  svg += `<radialGradient id="${uid}-bg" cx="50%" cy="45%"><stop offset="0%" stop-color="${pal.glow}" stop-opacity="0.25"/><stop offset="60%" stop-color="${pal.glow}" stop-opacity="0.08"/><stop offset="100%" stop-color="${pal.body}" stop-opacity="0.02"/></radialGradient>`;
  // 体メイングラデーション（上から光）
  svg += `<radialGradient id="${uid}-fur" cx="50%" cy="25%" r="70%"><stop offset="0%" stop-color="${pal.bodyL}"/><stop offset="70%" stop-color="${pal.body}"/><stop offset="100%" stop-color="${pal.markA}"/></radialGradient>`;
  // 体ハイライト
  svg += `<radialGradient id="${uid}-hi" cx="40%" cy="20%" r="60%"><stop offset="0%" stop-color="#fff" stop-opacity="0.55"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  // お腹グラデーション
  svg += `<radialGradient id="${uid}-belly" cx="50%" cy="35%"><stop offset="0%" stop-color="${pal.belly}"/><stop offset="100%" stop-color="${pal.bodyL}" stop-opacity="0.5"/></radialGradient>`;
  // 目グラデーション
  svg += `<radialGradient id="${uid}-iris" cx="45%" cy="35%"><stop offset="0%" stop-color="${pal.bodyL}"/><stop offset="50%" stop-color="${pal.body}"/><stop offset="100%" stop-color="${pal.markA}"/></radialGradient>`;
  // グロー
  svg += `<radialGradient id="${uid}-glow" cx="50%" cy="50%"><stop offset="0%" stop-color="${pal.glow}" stop-opacity="0.4"/><stop offset="100%" stop-color="${pal.glow}" stop-opacity="0"/></radialGradient>`;
  // フィルター - ソフトグロー
  svg += `<filter id="${uid}-sf" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur in="SourceGraphic" stdDeviation="${2*u}"/></filter>`;
  svg += `</defs>`;

  // ═══ 背景グロー ═══
  svg += `<circle cx="${cx}" cy="${cy}" r="${size*0.48}" fill="url(#${uid}-bg)"/>`;
  // 外周のソフトグロー
  svg += `<circle cx="${cx}" cy="${cy+2*u}" r="${size*0.38}" fill="url(#${uid}-glow)" filter="url(#${uid}-sf)"/>`;

  // ═══ Big-Five パラメータ ═══
  const bodyScale = lerp(0.85, 1.1, (E + A) / 2);
  const eyeScale = lerp(0.85, 1.2, (E + O) / 2);
  const blushAlpha = lerp(0, 0.6, (N + A) / 2);
  const sparkleCount = Math.floor(lerp(0, 5, O));
  const smileIntensity = lerp(0.2, 1.0, E);
  const cheekPuff = lerp(0, 1, A);

  // 基準サイズ
  const bodyW = 38 * u * bodyScale;
  const bodyH = 35 * u * bodyScale;
  const headR = 32 * u * lerp(0.95, 1.08, (E+O)/2);
  const headY = cy - 10 * u;
  const bodyY = cy + 25 * u;

  // ═══ マジカルパーティクル (O:開放性) ═══
  if (sparkleCount > 0) {
    for (let i = 0; i < sparkleCount + 3; i++) {
      const ang = (i / (sparkleCount + 3)) * Math.PI * 2 + rng() * 1.2;
      const dist = size * lerp(0.32, 0.47, rng());
      const px = cx + Math.cos(ang) * dist;
      const py = cy + Math.sin(ang) * dist;
      const ps = lerp(1.5, 4, rng()) * u;
      const po = lerp(0.15, 0.5, rng());
      const dur = lerp(2, 5, rng());
      // 星型パーティクル
      if (rng() > 0.5) {
        const s = ps * 1.2;
        svg += `<path d="M${px},${py-s} L${px+s*0.3},${py-s*0.3} L${px+s},${py} L${px+s*0.3},${py+s*0.3} L${px},${py+s} L${px-s*0.3},${py+s*0.3} L${px-s},${py} L${px-s*0.3},${py-s*0.3} Z" fill="${pal.glow}" opacity="${po.toFixed(2)}"><animate attributeName="opacity" values="${po.toFixed(2)};${(po*0.2).toFixed(2)};${po.toFixed(2)}" dur="${dur.toFixed(1)}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="rotate" values="0 ${px.toFixed(1)} ${py.toFixed(1)};360 ${px.toFixed(1)} ${py.toFixed(1)}" dur="${(dur*3).toFixed(1)}s" repeatCount="indefinite"/></path>`;
      } else {
        svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${ps.toFixed(1)}" fill="${pal.bodyL}" opacity="${po.toFixed(2)}"><animate attributeName="opacity" values="${po.toFixed(2)};${(po*0.15).toFixed(2)};${po.toFixed(2)}" dur="${dur.toFixed(1)}s" repeatCount="indefinite"/></circle>`;
      }
    }
  }

  // ═══════════════ 動物別描画 ═══════════════

  // --- 尻尾（体の後ろに描画） ---
  if (a === 'cat' || a === 'fox' || a === 'wolf' || a === 'dog' || a === 'tiger' || a === 'otter') {
    const tx = cx + bodyW * 0.75;
    const ty = bodyY + 5 * u;
    const curl = a === 'fox' ? 28 * u : 18 * u;
    svg += `<path d="M${tx},${ty} Q${tx+curl*0.6},${ty-curl*0.9} ${tx+curl},${ty-curl*0.5} Q${tx+curl*1.2},${ty-curl*0.1} ${tx+curl*0.8},${ty}" fill="none" stroke="url(#${uid}-fur)" stroke-width="${7*u}" stroke-linecap="round" opacity="0.8"/>`;
    if (a === 'fox') {
      svg += `<circle cx="${tx+curl}" cy="${ty-curl*0.5}" r="${4*u}" fill="#fff" opacity="0.5"/>`;
    }
  } else if (a === 'rabbit') {
    svg += `<circle cx="${cx+bodyW*0.6}" cy="${bodyY+10*u}" r="${5*u}" fill="#fff" opacity="0.7"/>`;
    svg += `<circle cx="${cx+bodyW*0.6}" cy="${bodyY+10*u}" r="${3*u}" fill="${pal.belly}" opacity="0.5"/>`;
  } else if (a === 'lion') {
    const tx = cx + bodyW * 0.7;
    const ty = bodyY;
    svg += `<path d="M${tx},${ty} Q${tx+20*u},${ty-15*u} ${tx+25*u},${ty-5*u}" fill="none" stroke="url(#${uid}-fur)" stroke-width="${5*u}" stroke-linecap="round" opacity="0.7"/>`;
    svg += `<circle cx="${tx+26*u}" cy="${ty-4*u}" r="${5*u}" fill="${pal.markA}" opacity="0.4"/>`;
  }

  // --- チョウの翼（体の後ろ） ---
  if (a === 'butterfly') {
    const wsx = bodyW * 1.1;
    const wy = bodyY - 10 * u;
    // 上翼
    svg += `<ellipse cx="${cx-wsx-8*u}" cy="${wy-12*u}" rx="${22*u}" ry="${20*u}" fill="${pal.bodyL}" opacity="0.55" transform="rotate(-20,${cx-wsx},${wy})"/>`;
    svg += `<ellipse cx="${cx+wsx+8*u}" cy="${wy-12*u}" rx="${22*u}" ry="${20*u}" fill="${pal.bodyL}" opacity="0.55" transform="rotate(20,${cx+wsx},${wy})"/>`;
    // 下翼
    svg += `<ellipse cx="${cx-wsx-4*u}" cy="${wy+10*u}" rx="${16*u}" ry="${14*u}" fill="${pal.body}" opacity="0.4" transform="rotate(-10,${cx-wsx},${wy})"/>`;
    svg += `<ellipse cx="${cx+wsx+4*u}" cy="${wy+10*u}" rx="${16*u}" ry="${14*u}" fill="${pal.body}" opacity="0.4" transform="rotate(10,${cx+wsx},${wy})"/>`;
    // 翼の模様
    svg += `<circle cx="${cx-wsx-8*u}" cy="${wy-12*u}" r="${8*u}" fill="${pal.glow}" opacity="0.3"/>`;
    svg += `<circle cx="${cx+wsx+8*u}" cy="${wy-12*u}" r="${8*u}" fill="${pal.glow}" opacity="0.3"/>`;
    svg += `<circle cx="${cx-wsx-8*u}" cy="${wy-12*u}" r="${4*u}" fill="#fff" opacity="0.25"/>`;
    svg += `<circle cx="${cx+wsx+8*u}" cy="${wy-12*u}" r="${4*u}" fill="#fff" opacity="0.25"/>`;
  }

  // --- 体（丸い胴体） ---
  svg += `<ellipse cx="${cx}" cy="${bodyY}" rx="${bodyW}" ry="${bodyH}" fill="url(#${uid}-fur)"/>`;
  svg += `<ellipse cx="${cx}" cy="${bodyY}" rx="${bodyW}" ry="${bodyH}" fill="url(#${uid}-hi)"/>`;
  // お腹
  svg += `<ellipse cx="${cx}" cy="${bodyY+4*u}" rx="${bodyW*0.6}" ry="${bodyH*0.65}" fill="url(#${uid}-belly)"/>`;

  // --- イルカのヒレ ---
  if (a === 'dolphin') {
    svg += `<path d="M${cx+bodyW*0.4},${bodyY-bodyH*0.5} Q${cx+bodyW*0.8},${bodyY-bodyH*1.1} ${cx+bodyW*0.9},${bodyY-bodyH*0.3}" fill="url(#${uid}-fur)" opacity="0.7"/>`;
    // 尾ビレ
    svg += `<path d="M${cx+bodyW*0.5},${bodyY+bodyH*0.6} Q${cx+bodyW*1.1},${bodyY+bodyH*0.2} ${cx+bodyW*1.2},${bodyY+bodyH*0.8}" fill="url(#${uid}-fur)" opacity="0.6"/>`;
  }

  // --- 腕/前足 ---
  const armY = bodyY - 2 * u;
  if (a !== 'butterfly' && a !== 'dolphin') {
    // 左腕
    svg += `<ellipse cx="${cx-bodyW*0.7}" cy="${armY+10*u}" rx="${8*u}" ry="${14*u}" fill="url(#${uid}-fur)" transform="rotate(15,${cx-bodyW*0.7},${armY+10*u})"/>`;
    svg += `<ellipse cx="${cx-bodyW*0.7}" cy="${armY+10*u}" rx="${8*u}" ry="${14*u}" fill="url(#${uid}-hi)" transform="rotate(15,${cx-bodyW*0.7},${armY+10*u})"/>`;
    // 右腕
    svg += `<ellipse cx="${cx+bodyW*0.7}" cy="${armY+10*u}" rx="${8*u}" ry="${14*u}" fill="url(#${uid}-fur)" transform="rotate(-15,${cx+bodyW*0.7},${armY+10*u})"/>`;
  }

  // --- 足 ---
  if (a !== 'dolphin' && a !== 'butterfly') {
    const footY = bodyY + bodyH - 4*u;
    const fsp = bodyW * 0.45;
    svg += `<ellipse cx="${cx-fsp}" cy="${footY}" rx="${9*u}" ry="${6*u}" fill="${pal.markA}" opacity="0.45"/>`;
    svg += `<ellipse cx="${cx+fsp}" cy="${footY}" rx="${9*u}" ry="${6*u}" fill="${pal.markA}" opacity="0.45"/>`;
    svg += `<ellipse cx="${cx-fsp}" cy="${footY}" rx="${6*u}" ry="${4*u}" fill="${pal.belly}" opacity="0.35"/>`;
    svg += `<ellipse cx="${cx+fsp}" cy="${footY}" rx="${6*u}" ry="${4*u}" fill="${pal.belly}" opacity="0.35"/>`;
  }

  // ═══ ライオンのたてがみ（頭の後ろ） ═══
  if (a === 'lion') {
    const mr = headR * 1.45;
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const rr = mr + rng() * 10 * u;
      const px = cx + Math.cos(ang) * rr;
      const py = headY + Math.sin(ang) * rr;
      const cr = lerp(8, 14, rng()) * u;
      svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${cr.toFixed(1)}" fill="${lerpColor(pal.markA, pal.body, rng())}" opacity="${lerp(0.35, 0.65, rng()).toFixed(2)}"/>`;
    }
    // 内側のなめらかなたてがみ
    svg += `<circle cx="${cx}" cy="${headY}" r="${headR*1.2}" fill="url(#${uid}-fur)" opacity="0.3"/>`;
  }

  // ═══ 頭（大きい丸） ═══
  svg += `<circle cx="${cx}" cy="${headY}" r="${headR}" fill="url(#${uid}-fur)"/>`;
  svg += `<circle cx="${cx}" cy="${headY}" r="${headR}" fill="url(#${uid}-hi)"/>`;
  // 頬のふっくら
  if (cheekPuff > 0.3) {
    const cp = cheekPuff * 0.12;
    svg += `<ellipse cx="${cx-headR*0.55}" cy="${headY+headR*0.15}" rx="${headR*cp*1.8}" ry="${headR*cp*1.2}" fill="${pal.bodyL}" opacity="0.2"/>`;
    svg += `<ellipse cx="${cx+headR*0.55}" cy="${headY+headR*0.15}" rx="${headR*cp*1.8}" ry="${headR*cp*1.2}" fill="${pal.bodyL}" opacity="0.2"/>`;
  }

  // ═══ 耳（動物種別） ═══
  if (a === 'cat' || a === 'fox') {
    const eh = 24 * u;
    const ew = 16 * u;
    const tilt = a === 'fox' ? 5 : 3;
    [-1,1].forEach(s => {
      const ex = cx + s * headR * 0.6;
      const ey = headY - headR * 0.7;
      svg += `<path d="M${ex-s*ew*0.5},${ey+eh*0.5} L${ex},${ey-eh*0.5} L${ex+s*ew*0.5},${ey+eh*0.5} Z" fill="url(#${uid}-fur)"/>`;
      svg += `<path d="M${ex-s*ew*0.3},${ey+eh*0.35} L${ex},${ey-eh*0.25} L${ex+s*ew*0.3},${ey+eh*0.35} Z" fill="${pal.markB}" opacity="0.5"/>`;
      svg += `<path d="M${ex-s*ew*0.15},${ey+eh*0.2} L${ex},${ey-eh*0.05} L${ex+s*ew*0.15},${ey+eh*0.2} Z" fill="#f9a8d4" opacity="0.35"/>`;
    });
  } else if (a === 'rabbit') {
    const eh = 38 * u;
    [-1,1].forEach(s => {
      const ex = cx + s * headR * 0.3;
      const ey = headY - headR;
      const rot = s * 8;
      svg += `<ellipse cx="${ex}" cy="${ey-eh*0.3}" rx="${8*u}" ry="${eh}" fill="url(#${uid}-fur)" transform="rotate(${rot},${ex},${ey})"/>`;
      svg += `<ellipse cx="${ex}" cy="${ey-eh*0.3}" rx="${8*u}" ry="${eh}" fill="url(#${uid}-hi)" transform="rotate(${rot},${ex},${ey})"/>`;
      svg += `<ellipse cx="${ex}" cy="${ey-eh*0.25}" rx="${4.5*u}" ry="${eh*0.7}" fill="#f9a8d4" opacity="0.4" transform="rotate(${rot},${ex},${ey})"/>`;
    });
  } else if (a === 'bear' || a === 'panda') {
    const er = 12 * u;
    [-1,1].forEach(s => {
      const ex = cx + s * headR * 0.7;
      const ey = headY - headR * 0.65;
      svg += `<circle cx="${ex}" cy="${ey}" r="${er}" fill="url(#${uid}-fur)"/>`;
      if (a === 'panda') {
        svg += `<circle cx="${ex}" cy="${ey}" r="${er*0.7}" fill="${pal.markA}" opacity="0.8"/>`;
      } else {
        svg += `<circle cx="${ex}" cy="${ey}" r="${er*0.6}" fill="${pal.belly}" opacity="0.4"/>`;
      }
    });
  } else if (a === 'owl') {
    const eh = 20 * u;
    [-1,1].forEach(s => {
      const ex = cx + s * headR * 0.55;
      const ey = headY - headR * 0.65;
      svg += `<path d="M${ex-s*8*u},${ey+eh*0.4} L${ex+s*2*u},${ey-eh*0.6} L${ex+s*10*u},${ey+eh*0.3} Z" fill="url(#${uid}-fur)"/>`;
      svg += `<path d="M${ex-s*5*u},${ey+eh*0.3} L${ex+s*2*u},${ey-eh*0.3} L${ex+s*7*u},${ey+eh*0.2} Z" fill="${pal.markB}" opacity="0.4"/>`;
    });
  } else if (a === 'dog') {
    [-1,1].forEach(s => {
      const ex = cx + s * headR * 0.75;
      const ey = headY - headR * 0.1;
      svg += `<ellipse cx="${ex}" cy="${ey}" rx="${10*u}" ry="${20*u}" fill="url(#${uid}-fur)" transform="rotate(${s*25},${ex},${ey})"/>`;
      svg += `<ellipse cx="${ex}" cy="${ey+2*u}" rx="${7*u}" ry="${15*u}" fill="${pal.markA}" opacity="0.2" transform="rotate(${s*25},${ex},${ey})"/>`;
    });
  } else if (a === 'wolf') {
    const eh = 26 * u;
    [-1,1].forEach(s => {
      const ex = cx + s * headR * 0.55;
      const ey = headY - headR * 0.7;
      svg += `<path d="M${ex-s*8*u},${ey+eh*0.4} L${ex},${ey-eh*0.6} L${ex+s*8*u},${ey+eh*0.4} Z" fill="url(#${uid}-fur)"/>`;
      svg += `<path d="M${ex-s*5*u},${ey+eh*0.3} L${ex},${ey-eh*0.3} L${ex+s*5*u},${ey+eh*0.3} Z" fill="${pal.markB}" opacity="0.35"/>`;
    });
  } else if (a === 'tiger') {
    const er = 12 * u;
    [-1,1].forEach(s => {
      const ex = cx + s * headR * 0.68;
      const ey = headY - headR * 0.65;
      svg += `<circle cx="${ex}" cy="${ey}" r="${er}" fill="url(#${uid}-fur)"/>`;
      svg += `<circle cx="${ex}" cy="${ey}" r="${er*0.55}" fill="#fff" opacity="0.25"/>`;
    });
  } else if (a === 'deer') {
    // 枝角
    const ah = 30 * u;
    [-1,1].forEach(s => {
      const ax = cx + s * headR * 0.35;
      const ay = headY - headR * 0.85;
      svg += `<path d="M${ax},${ay} L${ax+s*8*u},${ay-ah*0.6} L${ax+s*15*u},${ay-ah*0.8} M${ax+s*8*u},${ay-ah*0.6} L${ax+s*5*u},${ay-ah}" fill="none" stroke="${pal.markA}" stroke-width="${3*u}" stroke-linecap="round" opacity="0.6"/>`;
      // 角の先端の光
      svg += `<circle cx="${ax+s*15*u}" cy="${ay-ah*0.8}" r="${2.5*u}" fill="${pal.glow}" opacity="0.4"/>`;
      svg += `<circle cx="${ax+s*5*u}" cy="${ay-ah}" r="${2*u}" fill="${pal.glow}" opacity="0.35"/>`;
    });
    // 小さい耳
    [-1,1].forEach(s => {
      svg += `<ellipse cx="${cx+s*headR*0.65}" cy="${headY-headR*0.5}" rx="${6*u}" ry="${10*u}" fill="url(#${uid}-fur)" transform="rotate(${s*-20},${cx+s*headR*0.65},${headY-headR*0.5})"/>`;
      svg += `<ellipse cx="${cx+s*headR*0.65}" cy="${headY-headR*0.48}" rx="${3.5*u}" ry="${7*u}" fill="#f9a8d4" opacity="0.35" transform="rotate(${s*-20},${cx+s*headR*0.65},${headY-headR*0.5})"/>`;
    });
  } else if (a === 'eagle' || a === 'hawk') {
    // 冠羽
    for (let i = 0; i < 3; i++) {
      const fx = cx + (i-1) * 5 * u;
      const fh = (20 - i * 3) * u;
      svg += `<path d="M${fx-3*u},${headY-headR*0.85} L${fx},${headY-headR-fh} L${fx+3*u},${headY-headR*0.85}" fill="${i===1?pal.body:pal.bodyL}" opacity="${i===1?0.7:0.45}"/>`;
    }
  } else if (a === 'butterfly') {
    // 触角
    [-1,1].forEach(s => {
      const bx = cx + s * 5 * u;
      const by = headY - headR * 0.8;
      svg += `<path d="M${bx},${by} Q${bx+s*12*u},${by-22*u} ${bx+s*16*u},${by-18*u}" fill="none" stroke="${pal.body}" stroke-width="${2*u}" stroke-linecap="round" opacity="0.7"/>`;
      svg += `<circle cx="${bx+s*16*u}" cy="${by-18*u}" r="${3.5*u}" fill="${pal.glow}" opacity="0.7"/>`;
      svg += `<circle cx="${bx+s*16*u}" cy="${by-18*u}" r="${2*u}" fill="#fff" opacity="0.4"/>`;
    });
  } else if (a === 'otter') {
    const er = 9 * u;
    [-1,1].forEach(s => {
      const ex = cx + s * headR * 0.65;
      const ey = headY - headR * 0.6;
      svg += `<circle cx="${ex}" cy="${ey}" r="${er}" fill="url(#${uid}-fur)"/>`;
      svg += `<circle cx="${ex}" cy="${ey}" r="${er*0.55}" fill="${pal.belly}" opacity="0.4"/>`;
    });
  }

  // ── トラの縞模様 ──
  if (a === 'tiger') {
    for (let i = 0; i < 3; i++) {
      const sy = headY - headR * 0.2 + i * 7 * u;
      [-1,1].forEach(s => {
        svg += `<path d="M${cx+s*headR*0.1},${sy} Q${cx+s*headR*0.4},${sy-3*u} ${cx+s*headR*0.8},${sy+2*u}" fill="none" stroke="${pal.markA}" stroke-width="${2*u}" opacity="0.25" stroke-linecap="round"/>`;
      });
    }
  }

  // ── パンダの目周り ──
  if (a === 'panda') {
    const eyeY = headY - headR * 0.02;
    const eyeSp = headR * 0.38;
    svg += `<ellipse cx="${cx-eyeSp}" cy="${eyeY}" rx="${13*u}" ry="${12*u}" fill="${pal.markA}" opacity="0.6"/>`;
    svg += `<ellipse cx="${cx+eyeSp}" cy="${eyeY}" rx="${13*u}" ry="${12*u}" fill="${pal.markA}" opacity="0.6"/>`;
  }

  // ── フクロウの顔ディスク ──
  if (a === 'owl') {
    const eyeY = headY - headR * 0.02;
    const eyeSp = headR * 0.38;
    svg += `<circle cx="${cx-eyeSp}" cy="${eyeY}" r="${16*u}" fill="${pal.markB}" opacity="0.25" stroke="${pal.body}" stroke-width="${1*u}" stroke-opacity="0.15"/>`;
    svg += `<circle cx="${cx+eyeSp}" cy="${eyeY}" r="${16*u}" fill="${pal.markB}" opacity="0.25" stroke="${pal.body}" stroke-width="${1*u}" stroke-opacity="0.15"/>`;
  }

  // ═══ 目（大きなアニメ風キラキラ目） ═══
  const eyeY = headY - headR * 0.02;
  const eyeSp = headR * 0.38;
  const eSize = lerp(9, 14, eyeScale) * u;

  [-1, 1].forEach(side => {
    const ex = cx + side * eyeSp;
    const ew = eSize * 1.1;
    const eh = eSize * 1.2;

    // 白目（大きめ）
    svg += `<ellipse cx="${ex}" cy="${eyeY}" rx="${ew}" ry="${eh}" fill="#fff" stroke="${pal.markA}" stroke-width="${0.8*u}" stroke-opacity="0.12"/>`;

    // 虹彩（リッチグラデーション）
    const irisR = eSize * 0.75;
    svg += `<circle cx="${ex}" cy="${eyeY+1*u}" r="${irisR}" fill="url(#${uid}-iris)"/>`;
    // 虹彩の輝きリング
    svg += `<circle cx="${ex}" cy="${eyeY+1*u}" r="${irisR}" fill="none" stroke="${pal.bodyL}" stroke-width="${0.6*u}" opacity="0.3"/>`;

    // 瞳孔（深い色）
    const pupilR = irisR * 0.55;
    svg += `<circle cx="${ex}" cy="${eyeY+1.5*u}" r="${pupilR}" fill="${pal.markA}"/>`;

    // メインハイライト（大きな白い丸）
    svg += `<circle cx="${ex-irisR*0.3}" cy="${eyeY-irisR*0.3}" r="${irisR*0.35}" fill="#fff" opacity="0.95"/>`;
    // サブハイライト
    svg += `<circle cx="${ex+irisR*0.25}" cy="${eyeY-irisR*0.45}" r="${irisR*0.18}" fill="#fff" opacity="0.8"/>`;
    // ボトムリフレクション
    svg += `<ellipse cx="${ex}" cy="${eyeY+irisR*0.5}" rx="${irisR*0.35}" ry="${irisR*0.12}" fill="#fff" opacity="0.25"/>`;

    // キラキラ（N:神経症的傾向 = 感受性 → 目の輝き強化）
    if (N > 0.3) {
      svg += `<circle cx="${ex+irisR*0.15}" cy="${eyeY+irisR*0.25}" r="${irisR*0.08}" fill="#fff" opacity="${lerp(0.3, 0.7, N).toFixed(2)}"/>`;
      svg += `<circle cx="${ex-irisR*0.4}" cy="${eyeY+irisR*0.1}" r="${irisR*0.06}" fill="#fff" opacity="${lerp(0.2, 0.5, N).toFixed(2)}"/>`;
    }
    if (N > 0.6) {
      // 十字キラキラ
      const sx = ex + side * irisR * 0.4;
      const sy = eyeY - irisR * 0.55;
      const ss = irisR * 0.2;
      svg += `<path d="M${sx},${sy-ss} L${sx},${sy+ss} M${sx-ss},${sy} L${sx+ss},${sy}" stroke="#fff" stroke-width="${0.8*u}" opacity="0.6" stroke-linecap="round"/>`;
    }
  });

  // ── まつ毛（A:協調性が高いと可愛いまつ毛） ──
  if (A > 0.4) {
    [-1,1].forEach(side => {
      const ex = cx + side * eyeSp;
      const lashLen = lerp(3, 7, A) * u;
      for (let i = 0; i < 3; i++) {
        const la = (i - 1) * 0.3 + side * 0.2;
        const lx = ex + Math.cos(-Math.PI/2 + la) * eSize * 1.1;
        const ly = eyeY + Math.sin(-Math.PI/2 + la) * eSize * 1.2;
        const lx2 = lx + Math.cos(-Math.PI/2 + la) * lashLen;
        const ly2 = ly + Math.sin(-Math.PI/2 + la) * lashLen;
        svg += `<line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${lx2.toFixed(1)}" y2="${ly2.toFixed(1)}" stroke="${pal.markA}" stroke-width="${1.2*u}" stroke-linecap="round" opacity="0.35"/>`;
      }
    });
  }

  // ═══ 鼻 ═══
  const noseY = headY + headR * 0.25;
  if (a === 'cat' || a === 'fox' || a === 'tiger' || a === 'wolf' || a === 'dog' || a === 'lion' || a === 'otter') {
    // 可愛い逆三角鼻
    const nw = 6 * u, nh = 5 * u;
    svg += `<path d="M${cx},${noseY-nh*0.3} Q${cx-nw*0.6},${noseY+nh*0.6} ${cx-nw*0.1},${noseY+nh*0.5} Q${cx},${noseY+nh*0.7} ${cx+nw*0.1},${noseY+nh*0.5} Q${cx+nw*0.6},${noseY+nh*0.6} ${cx},${noseY-nh*0.3}" fill="${pal.markA}" opacity="0.6"/>`;
    svg += `<ellipse cx="${cx}" cy="${noseY}" rx="${nw*0.35}" ry="${nh*0.2}" fill="#fff" opacity="0.2"/>`;
    // ヒゲ
    if (a === 'cat' || a === 'fox' || a === 'tiger' || a === 'otter') {
      [-1,1].forEach(s => {
        svg += `<line x1="${cx+s*4*u}" y1="${noseY+3*u}" x2="${cx+s*headR*0.8}" y2="${noseY}" stroke="${pal.markA}" stroke-width="${0.8*u}" opacity="0.18" stroke-linecap="round"/>`;
        svg += `<line x1="${cx+s*4*u}" y1="${noseY+5*u}" x2="${cx+s*headR*0.85}" y2="${noseY+5*u}" stroke="${pal.markA}" stroke-width="${0.8*u}" opacity="0.15" stroke-linecap="round"/>`;
        svg += `<line x1="${cx+s*4*u}" y1="${noseY+7*u}" x2="${cx+s*headR*0.75}" y2="${noseY+10*u}" stroke="${pal.markA}" stroke-width="${0.8*u}" opacity="0.12" stroke-linecap="round"/>`;
      });
    }
  } else if (a === 'bear' || a === 'panda') {
    // マズル + 丸鼻
    svg += `<ellipse cx="${cx}" cy="${noseY+4*u}" rx="${headR*0.3}" ry="${headR*0.2}" fill="${pal.belly}" opacity="0.5"/>`;
    svg += `<ellipse cx="${cx}" cy="${noseY}" rx="${5*u}" ry="${4*u}" fill="${pal.markA}" opacity="0.6"/>`;
    svg += `<ellipse cx="${cx}" cy="${noseY-1*u}" rx="${3*u}" ry="${2*u}" fill="#fff" opacity="0.2"/>`;
  } else if (a === 'rabbit' || a === 'deer') {
    svg += `<ellipse cx="${cx}" cy="${noseY}" rx="${4*u}" ry="${3*u}" fill="#f9a8d4" opacity="0.6"/>`;
    svg += `<ellipse cx="${cx}" cy="${noseY-1*u}" rx="${2.5*u}" ry="${1.5*u}" fill="#fff" opacity="0.25"/>`;
    if (a === 'rabbit') {
      // Y字口
      svg += `<path d="M${cx},${noseY+3*u} L${cx},${noseY+7*u} M${cx},${noseY+7*u} Q${cx-4*u},${noseY+10*u} ${cx-6*u},${noseY+9*u} M${cx},${noseY+7*u} Q${cx+4*u},${noseY+10*u} ${cx+6*u},${noseY+9*u}" fill="none" stroke="${pal.markA}" stroke-width="${1*u}" opacity="0.2" stroke-linecap="round"/>`;
    }
  } else if (a === 'eagle' || a === 'hawk') {
    svg += `<path d="M${cx-5*u},${noseY} Q${cx},${noseY-3*u} ${cx+5*u},${noseY} L${cx},${noseY+8*u} Z" fill="#f59e0b" opacity="0.75"/>`;
    svg += `<path d="M${cx-3*u},${noseY+1*u} Q${cx},${noseY-1*u} ${cx+3*u},${noseY+1*u} L${cx},${noseY+5*u} Z" fill="#fbbf24" opacity="0.35"/>`;
  } else if (a === 'owl') {
    svg += `<path d="M${cx-4*u},${noseY+2*u} L${cx},${noseY+8*u} L${cx+4*u},${noseY+2*u} Z" fill="#f59e0b" opacity="0.7"/>`;
    svg += `<path d="M${cx-2*u},${noseY+3*u} L${cx},${noseY+6*u} L${cx+2*u},${noseY+3*u} Z" fill="#fbbf24" opacity="0.35"/>`;
  } else if (a === 'dolphin') {
    svg += `<ellipse cx="${cx}" cy="${noseY+3*u}" rx="${headR*0.2}" ry="${4*u}" fill="${pal.markB}" opacity="0.3"/>`;
  } else if (a === 'butterfly') {
    svg += `<circle cx="${cx}" cy="${noseY}" r="${2*u}" fill="${pal.markA}" opacity="0.35"/>`;
  }

  // ═══ 頬紅 ═══
  if (blushAlpha > 0.08) {
    [-1,1].forEach(s => {
      const bx = cx + s * headR * 0.52;
      const by = eyeY + headR * 0.3;
      svg += `<ellipse cx="${bx}" cy="${by}" rx="${headR*0.16}" ry="${headR*0.08}" fill="#f472b6" opacity="${blushAlpha.toFixed(2)}"/>`;
      // 頬紅の中のハイライト
      if (blushAlpha > 0.3) {
        svg += `<ellipse cx="${bx-2*u}" cy="${by-1*u}" rx="${headR*0.06}" ry="${headR*0.03}" fill="#fff" opacity="${(blushAlpha*0.3).toFixed(2)}"/>`;
      }
    });
  }

  // ═══ 口（E:外向性で笑顔度合い変化） ═══
  const mouthY = noseY + lerp(8, 10, E) * u;
  if (a !== 'eagle' && a !== 'hawk' && a !== 'owl' && a !== 'rabbit') {
    if (smileIntensity > 0.7) {
      // 大きなニッコリ（ωタイプ）
      const mw = lerp(6, 12, E) * u;
      svg += `<path d="M${cx-mw},${mouthY-1*u} Q${cx-mw*0.5},${mouthY+5*u} ${cx},${mouthY+3*u} Q${cx+mw*0.5},${mouthY+5*u} ${cx+mw},${mouthY-1*u}" fill="none" stroke="${pal.markA}" stroke-width="${1.5*u}" stroke-linecap="round" opacity="0.4"/>`;
    } else if (smileIntensity > 0.4) {
      const mw = lerp(5, 9, E) * u;
      svg += `<path d="M${cx-mw},${mouthY} Q${cx},${mouthY+4*u} ${cx+mw},${mouthY}" fill="none" stroke="${pal.markA}" stroke-width="${1.3*u}" stroke-linecap="round" opacity="0.3"/>`;
    } else {
      const mw = 5 * u;
      svg += `<path d="M${cx-mw},${mouthY} Q${cx},${mouthY+2*u} ${cx+mw},${mouthY}" fill="none" stroke="${pal.markA}" stroke-width="${1*u}" stroke-linecap="round" opacity="0.2"/>`;
    }
  }

  // ═══ 模様マーキング（C:誠実性で整った模様） ═══
  if (C > 0.5 && a !== 'butterfly' && a !== 'dolphin') {
    const markOp = lerp(0.1, 0.25, C);
    // 額のマーク
    svg += `<path d="M${cx},${headY-headR*0.6} L${cx-3*u},${headY-headR*0.45} L${cx},${headY-headR*0.35} L${cx+3*u},${headY-headR*0.45} Z" fill="${pal.glow}" opacity="${markOp.toFixed(2)}"/>`;
  }

  // ═══ 仕上げの輝き ═══
  // 頭頂のハイライト
  svg += `<ellipse cx="${cx-headR*0.15}" cy="${headY-headR*0.7}" rx="${headR*0.25}" ry="${headR*0.08}" fill="#fff" opacity="0.25" transform="rotate(-15,${cx},${headY})"/>`;

  svg += `</svg>`;
  return svg;
}

/**
 * アバター生成（小サイズ用ラッパー）
 */
function generateAvatarSmall(mbti, bigFive) {
  return generateAvatar(mbti, bigFive, 120);
}

// ═══════════════════════════════════════════════════════════════
// 8. Public API (window.Personality)
// ═══════════════════════════════════════════════════════════════

window.Personality = {
  BIG5_QUESTIONS,
  calcBigFive,
  bigFiveToMBTI,
  MBTI_PROFILES,
  getPersonalization,
  applyTheme,
  calcLevel,
  LEVELS,
  MBTI_ANIMALS,
  generateAvatar,
  generateAvatarSmall,
};
