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
  // C: Conscientiousness（誠実性/計画性）
  { dim: 'C', dir: +1, text: '物事をきちんと計画して実行する方だ' },
  { dim: 'C', dir: -1, text: '少しだらしないところがある' },
  // N: Neuroticism（神経症傾向 / 情緒不安定性）
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
// 7. アバター生成エンジン – MBTI × Big Five → SVG
//    性格特性から唯一無二のキャラクターアバターを生成
// ═══════════════════════════════════════════════════════════════

/**
 * MBTI + Big Five からSVGアバターを生成
 * @param {string} mbti - MBTIコード (例: "INFP")
 * @param {object} bigFive - { E, A, C, N, O } (各1-7)
 * @param {number} size - SVGサイズ (default 200)
 * @returns {string} SVG文字列
 */
function generateAvatar(mbti, bigFive, size = 200) {
  const prof = MBTI_PROFILES[mbti] || MBTI_PROFILES['INFP'];
  const b5 = bigFive || { E: 4, A: 4, C: 4, N: 4, O: 4 };
  // 正規化 0-1
  const E = (b5.E - 1) / 6;
  const A = (b5.A - 1) / 6;
  const C = (b5.C - 1) / 6;
  const N = (b5.N - 1) / 6;
  const O = (b5.O - 1) / 6;
  const c1 = prof.gradientFrom;
  const c2 = prof.gradientTo;
  const accent = prof.color;

  // ─── ヘルパー ───
  const lerp = (a, b, t) => a + (b - a) * t;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36; // 顔半径

  // ─── 顔の形状 (E:丸→楕円, C:左右対称度) ───
  const faceRX = r * lerp(0.92, 1.08, E);
  const faceRY = r * lerp(1.06, 0.94, E);

  // ─── 肌色 (MBTIグループで変化) ───
  const skinTones = {
    NT: '#fef3c7', NF: '#fce7f3', SJ: '#e0f2fe', SP: '#fef9c3',
  };
  const group = mbti[1] === 'N' ? (mbti[2] === 'T' ? 'NT' : 'NF') : (mbti[3] === 'J' ? 'SJ' : 'SP');
  const skin = skinTones[group];

  // ─── 髪型 (O:開放性→ワイルド, C:計画性→整頓) ───
  const hairWild = lerp(0, 12, O);
  const hairNeat = lerp(0, 1, C);

  // ─── 目 (E:大きさ, N:輝き, A:柔らかさ) ───
  const eyeScale = lerp(0.8, 1.3, E);
  const eyeSparkle = N > 0.5;
  const eyeSoft = A > 0.5;

  // ─── 口 (E:笑顔幅, A:柔らかさ) ───
  const smileWidth = lerp(6, 16, E);
  const smileDepth = lerp(2, 7, (E + A) / 2);

  // ─── 頬紅 (N:感受性, A:協調性) ───
  const blushOpacity = lerp(0, 0.5, (N + A) / 2);

  // ─── オーラ/装飾 (O:開放性) ───
  const hasAura = O > 0.55;
  const numParticles = Math.floor(lerp(0, 8, O));

  // ─── seed from mbti for deterministic randomness ───
  let seed = 0;
  for (let i = 0; i < mbti.length; i++) seed = seed * 31 + mbti.charCodeAt(i);
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff); };

  // ─── SVG 構築 ───
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  svg += `<defs>`;
  svg += `<radialGradient id="av-bg" cx="50%" cy="40%"><stop offset="0%" stop-color="${c2}" stop-opacity="0.2"/><stop offset="100%" stop-color="${c1}" stop-opacity="0.08"/></radialGradient>`;
  svg += `<radialGradient id="av-skin"><stop offset="0%" stop-color="${skin}"/><stop offset="100%" stop-color="${skin}" stop-opacity="0.95"/></radialGradient>`;
  svg += `<linearGradient id="av-hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>`;
  if (eyeSparkle) {
    svg += `<radialGradient id="av-sparkle"><stop offset="0%" stop-color="#fff" stop-opacity="0.9"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  }
  svg += `</defs>`;

  // 背景円
  svg += `<circle cx="${cx}" cy="${cy}" r="${size * 0.48}" fill="url(#av-bg)"/>`;

  // ─── オーラパーティクル ───
  if (hasAura) {
    for (let i = 0; i < numParticles; i++) {
      const angle = (i / numParticles) * Math.PI * 2 + rng() * 0.5;
      const dist = size * lerp(0.38, 0.46, rng());
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      const ps = lerp(2, 5, rng());
      const po = lerp(0.15, 0.45, rng());
      svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${ps.toFixed(1)}" fill="${accent}" opacity="${po.toFixed(2)}"><animate attributeName="opacity" values="${po.toFixed(2)};${(po*0.3).toFixed(2)};${po.toFixed(2)}" dur="${lerp(2,4,rng()).toFixed(1)}s" repeatCount="indefinite"/></circle>`;
    }
  }

  // ─── 身体（肩） ───
  const shoulderY = cy + r * 1.05;
  const shoulderW = faceRX * 1.4;
  svg += `<ellipse cx="${cx}" cy="${shoulderY + size*0.12}" rx="${shoulderW}" ry="${size*0.15}" fill="${c1}" opacity="0.15"/>`;

  // ─── 髪（後ろ） ───
  const hairTop = cy - faceRY * 1.05;
  const hairSideL = cx - faceRX * 1.15 - hairWild * 0.5;
  const hairSideR = cx + faceRX * 1.15 + hairWild * 0.5;
  svg += `<path d="M${hairSideL},${cy + faceRY * 0.3} Q${hairSideL - hairWild * 0.3},${hairTop - hairWild} ${cx},${hairTop - 8 - hairWild * 0.5} Q${hairSideR + hairWild * 0.3},${hairTop - hairWild} ${hairSideR},${cy + faceRY * 0.3} Z" fill="url(#av-hair)" opacity="0.9"/>`;

  // ─── 顔 ───
  svg += `<ellipse cx="${cx}" cy="${cy}" rx="${faceRX}" ry="${faceRY}" fill="url(#av-skin)" stroke="${c1}" stroke-width="1" stroke-opacity="0.1"/>`;

  // ─── 髪（前髪） ───
  const bangsY = cy - faceRY * 0.55;
  if (hairNeat > 0.5) {
    // 整った前髪
    svg += `<path d="M${cx - faceRX * 0.85},${bangsY + 4} Q${cx},${bangsY - 10 - hairWild * 0.5} ${cx + faceRX * 0.85},${bangsY + 4} L${cx + faceRX * 1.05},${hairTop + 5} Q${cx},${hairTop - 5} ${cx - faceRX * 1.05},${hairTop + 5} Z" fill="url(#av-hair)"/>`;
  } else {
    // ワイルドな前髪
    const spikes = 3 + Math.floor(O * 3);
    let path = `M${cx - faceRX * 0.95},${bangsY + 8}`;
    for (let i = 0; i <= spikes; i++) {
      const t = i / spikes;
      const sx = cx - faceRX * 0.95 + t * faceRX * 1.9;
      const spikeH = hairWild * (0.5 + rng() * 0.8) + 8;
      if (i < spikes) path += ` Q${sx + faceRX * 0.1},${bangsY - spikeH} ${sx + faceRX * 0.2},${bangsY + 3}`;
    }
    path += ` L${cx + faceRX * 1.05},${hairTop + 5} Q${cx},${hairTop - 5 - hairWild} ${cx - faceRX * 1.05},${hairTop + 5} Z`;
    svg += `<path d="${path}" fill="url(#av-hair)"/>`;
  }

  // ─── 眉 (C:角度, E:太さ) ───
  const browY = cy - faceRY * 0.22;
  const browLen = faceRX * 0.3;
  const browLift = lerp(0, -4, C); // 計画性高い→キリッと上がる
  const browThick = lerp(1.5, 2.5, E);
  svg += `<line x1="${cx - faceRX * 0.35}" y1="${browY}" x2="${cx - faceRX * 0.35 + browLen}" y2="${browY + browLift}" stroke="${c1}" stroke-width="${browThick}" stroke-linecap="round" opacity="0.5"/>`;
  svg += `<line x1="${cx + faceRX * 0.35 - browLen}" y1="${browY + browLift}" x2="${cx + faceRX * 0.35}" y2="${browY}" stroke="${c1}" stroke-width="${browThick}" stroke-linecap="round" opacity="0.5"/>`;

  // ─── 目 ───
  const eyeY = cy - faceRY * 0.08;
  const eyeSpacing = faceRX * 0.32;
  const eyeW = 7 * eyeScale;
  const eyeH = 8 * eyeScale;
  const pupilR = 3.5 * eyeScale;

  // 目の白
  [-1, 1].forEach(side => {
    const ex = cx + side * eyeSpacing;
    if (eyeSoft) {
      // 柔らかい丸目
      svg += `<ellipse cx="${ex}" cy="${eyeY}" rx="${eyeW}" ry="${eyeH}" fill="#fff" stroke="${c1}" stroke-width="0.8" stroke-opacity="0.2"/>`;
    } else {
      // シャープな目
      svg += `<ellipse cx="${ex}" cy="${eyeY}" rx="${eyeW * 1.1}" ry="${eyeH * 0.85}" fill="#fff" stroke="${c1}" stroke-width="0.8" stroke-opacity="0.2"/>`;
    }
    // 瞳
    svg += `<circle cx="${ex}" cy="${eyeY + 0.5}" r="${pupilR}" fill="${c1}"/>`;
    svg += `<circle cx="${ex}" cy="${eyeY + 0.5}" r="${pupilR * 0.55}" fill="${accent}" opacity="0.7"/>`;
    // ハイライト
    svg += `<circle cx="${ex - pupilR * 0.35}" cy="${eyeY - pupilR * 0.35}" r="${pupilR * 0.3}" fill="#fff" opacity="0.9"/>`;
    // 追加キラキラ（感受性高い）
    if (eyeSparkle) {
      svg += `<circle cx="${ex + pupilR * 0.3}" cy="${eyeY - pupilR * 0.5}" r="${pupilR * 0.18}" fill="url(#av-sparkle)"/>`;
      svg += `<circle cx="${ex + pupilR * 0.15}" cy="${eyeY + pupilR * 0.4}" r="${pupilR * 0.12}" fill="#fff" opacity="0.6"/>`;
    }
  });

  // ─── 頬紅 ───
  if (blushOpacity > 0.08) {
    svg += `<ellipse cx="${cx - faceRX * 0.42}" cy="${eyeY + faceRY * 0.22}" rx="${faceRX * 0.14}" ry="${faceRY * 0.08}" fill="#f472b6" opacity="${blushOpacity.toFixed(2)}"/>`;
    svg += `<ellipse cx="${cx + faceRX * 0.42}" cy="${eyeY + faceRY * 0.22}" rx="${faceRX * 0.14}" ry="${faceRY * 0.08}" fill="#f472b6" opacity="${blushOpacity.toFixed(2)}"/>`;
  }

  // ─── 鼻 ───
  svg += `<ellipse cx="${cx}" cy="${cy + faceRY * 0.1}" rx="2.5" ry="1.5" fill="${c1}" opacity="0.12"/>`;

  // ─── 口 ───
  const mouthY = cy + faceRY * 0.3;
  if (E > 0.55) {
    // にっこり（開放的）
    svg += `<path d="M${cx - smileWidth},${mouthY} Q${cx},${mouthY + smileDepth * 2} ${cx + smileWidth},${mouthY}" fill="none" stroke="${c1}" stroke-width="2" stroke-linecap="round" opacity="0.55"/>`;
    if (E > 0.7) {
      // 歯見せ笑顔
      svg += `<path d="M${cx - smileWidth * 0.6},${mouthY + 1} Q${cx},${mouthY + smileDepth * 1.5} ${cx + smileWidth * 0.6},${mouthY + 1}" fill="#fff" stroke="none" opacity="0.7"/>`;
    }
  } else if (E > 0.3) {
    // 穏やかな微笑み
    svg += `<path d="M${cx - smileWidth * 0.7},${mouthY} Q${cx},${mouthY + smileDepth * 1.2} ${cx + smileWidth * 0.7},${mouthY}" fill="none" stroke="${c1}" stroke-width="1.8" stroke-linecap="round" opacity="0.45"/>`;
  } else {
    // 控えめ（内向的）
    svg += `<path d="M${cx - smileWidth * 0.5},${mouthY} Q${cx},${mouthY + smileDepth * 0.6} ${cx + smileWidth * 0.5},${mouthY}" fill="none" stroke="${c1}" stroke-width="1.5" stroke-linecap="round" opacity="0.35"/>`;
  }

  // ─── MBTIシンボル装飾 ───
  const symbolY = cy - faceRY - 16;
  const symbols = {
    INTJ: '♟', INTP: '∞', ENTJ: '⚡', ENTP: '💡',
    INFJ: '🌊', INFP: '🌸', ENFJ: '✨', ENFP: '🦋',
    ISTJ: '⬡', ISFJ: '🛡', ESTJ: '⚙', ESFJ: '♥',
    ISTP: '▲', ISFP: '◆', ESTP: '⚡', ESFP: '★',
  };
  const sym = symbols[mbti] || '●';
  svg += `<text x="${cx}" y="${symbolY}" text-anchor="middle" font-size="14" opacity="0.6">${sym}</text>`;

  // ─── アクセサリ（タイプ別） ───
  if (group === 'NT') {
    // メガネ（知性）
    const gY = eyeY;
    const gW = eyeW * 1.5;
    const gH = eyeH * 1.3;
    svg += `<ellipse cx="${cx - eyeSpacing}" cy="${gY}" rx="${gW}" ry="${gH}" fill="none" stroke="${c1}" stroke-width="1.2" opacity="0.3"/>`;
    svg += `<ellipse cx="${cx + eyeSpacing}" cy="${gY}" rx="${gW}" ry="${gH}" fill="none" stroke="${c1}" stroke-width="1.2" opacity="0.3"/>`;
    svg += `<line x1="${cx - eyeSpacing + gW}" y1="${gY}" x2="${cx + eyeSpacing - gW}" y2="${gY}" stroke="${c1}" stroke-width="1" opacity="0.25"/>`;
  } else if (group === 'NF') {
    // 花/光のオーラ
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI * 0.6 + (i / 2) * Math.PI * 0.6;
      const px = cx + Math.cos(angle) * (r + 8);
      const py = cy - 5 + Math.sin(angle) * (r + 8);
      svg += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3" fill="${c2}" opacity="0.35"><animate attributeName="r" values="3;4.5;3" dur="${(2 + i * 0.5).toFixed(1)}s" repeatCount="indefinite"/></circle>`;
    }
  } else if (group === 'SJ') {
    // 襟/ネクタイ（きちんと感）
    svg += `<path d="M${cx - 8},${shoulderY - 2} L${cx},${shoulderY + 12} L${cx + 8},${shoulderY - 2}" fill="${c1}" opacity="0.2"/>`;
    svg += `<path d="M${cx - 3},${shoulderY} L${cx},${shoulderY + 10} L${cx + 3},${shoulderY}" fill="${accent}" opacity="0.25"/>`;
  }
  // SP → アクセサリなし（自由なスタイル）

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
  generateAvatar,
  generateAvatarSmall,
};
