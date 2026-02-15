import { Hono } from 'hono'
import type { AppType } from './index'

export const apiRoutes = new Hono<AppType>()

// ============================================================
// パスワードハッシュ (Web Crypto API – Cloudflare Workers互換)
// ============================================================
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateToken(): string {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ============================================================
// 認証ミドルウェア: トークンからユーザーを取得
// ============================================================
async function getUser(c: any): Promise<{ id: number; email: string; display_name: string } | null> {
  const auth = c.req.header('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  const token = auth.slice(7)
  const DB = c.env.DB
  const session = await DB.prepare(
    "SELECT user_id FROM sessions WHERE token=? AND expires_at > datetime('now')"
  ).bind(token).first<{ user_id: number }>()
  if (!session) return null
  const user = await DB.prepare(
    'SELECT id, email, display_name FROM users WHERE id=?'
  ).bind(session.user_id).first<{ id: number; email: string; display_name: string }>()
  return user || null
}

function requireAuth(c: any, user: any) {
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401)
  return null
}

// ============================================================
// マイルストーン定義（メートル単位）
// ============================================================
const MILESTONES = [
  { type: 'distance_10km', threshold: 10000, label: '10 km' },
  { type: 'distance_50km', threshold: 50000, label: '50 km' },
  { type: 'distance_100km', threshold: 100000, label: '100 km' },
  { type: 'distance_300km', threshold: 300000, label: '300 km' },
  { type: 'distance_1000km', threshold: 1000000, label: '1,000 km' },
]

// ============================================================
// POST /api/auth/signup - 新規登録
// ============================================================
apiRoutes.post('/auth/signup', async (c) => {
  const DB = c.env.DB
  try {
    const { email, password, display_name } = await c.req.json<{
      email: string; password: string; display_name?: string
    }>()

    if (!email || !password) return c.json({ ok: false, error: 'メールアドレスとパスワードは必須です' }, 400)
    if (password.length < 6) return c.json({ ok: false, error: 'パスワードは6文字以上にしてください' }, 400)

    // メール重複チェック
    const exists = await DB.prepare('SELECT id FROM users WHERE email=?').bind(email.toLowerCase().trim()).first()
    if (exists) return c.json({ ok: false, error: 'このメールアドレスは既に登録されています' }, 409)

    const passwordHash = await hashPassword(password)
    const result = await DB.prepare(
      'INSERT INTO users (email, display_name, password_hash) VALUES (?, ?, ?)'
    ).bind(email.toLowerCase().trim(), display_name || '', passwordHash).run()

    const userId = result.meta.last_row_id as number

    // user_stats 初期行を作成
    await DB.prepare('INSERT INTO user_stats (user_id) VALUES (?)').bind(userId).run()

    // セッション発行
    const token = generateToken()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30日
    await DB.prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(userId, token, expiresAt).run()

    return c.json({
      ok: true,
      data: {
        token,
        user: { id: userId, email: email.toLowerCase().trim(), display_name: display_name || '' }
      }
    })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// POST /api/auth/login - ログイン
// ============================================================
apiRoutes.post('/auth/login', async (c) => {
  const DB = c.env.DB
  try {
    const { email, password } = await c.req.json<{ email: string; password: string }>()
    if (!email || !password) return c.json({ ok: false, error: 'メールアドレスとパスワードは必須です' }, 400)

    const user = await DB.prepare(
      'SELECT id, email, display_name, password_hash FROM users WHERE email=?'
    ).bind(email.toLowerCase().trim()).first<{ id: number; email: string; display_name: string; password_hash: string }>()

    if (!user) return c.json({ ok: false, error: 'メールアドレスまたはパスワードが正しくありません' }, 401)

    const passwordHash = await hashPassword(password)
    if (passwordHash !== user.password_hash) return c.json({ ok: false, error: 'メールアドレスまたはパスワードが正しくありません' }, 401)

    // 古いセッションクリーン（最大5つまで保持）
    const sessions = await DB.prepare(
      'SELECT id FROM sessions WHERE user_id=? ORDER BY created_at DESC'
    ).bind(user.id).all()
    if (sessions.results.length >= 5) {
      const oldIds = sessions.results.slice(4).map((s: any) => s.id)
      for (const sid of oldIds) {
        await DB.prepare('DELETE FROM sessions WHERE id=?').bind(sid).run()
      }
    }

    const token = generateToken()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await DB.prepare(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, token, expiresAt).run()

    return c.json({
      ok: true,
      data: {
        token,
        user: { id: user.id, email: user.email, display_name: user.display_name }
      }
    })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// POST /api/auth/logout - ログアウト
// ============================================================
apiRoutes.post('/auth/logout', async (c) => {
  const DB = c.env.DB
  try {
    const auth = c.req.header('Authorization')
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.slice(7)
      await DB.prepare('DELETE FROM sessions WHERE token=?').bind(token).run()
    }
    return c.json({ ok: true })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/auth/me - 現在のユーザー情報
// ============================================================
apiRoutes.get('/auth/me', async (c) => {
  const user = await getUser(c)
  if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401)
  return c.json({ ok: true, data: user })
})

// ============================================================
// GET /api/stats - ダッシュボード用統計
// ============================================================
apiRoutes.get('/stats', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    const stats = await DB.prepare('SELECT * FROM user_stats WHERE user_id=?').bind(user!.id).first()
    return c.json({ ok: true, data: stats })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/activities - 一覧（フィルタ対応）
// ============================================================
apiRoutes.get('/activities', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  const period = c.req.query('period') || 'all'
  const limit = parseInt(c.req.query('limit') || '200')

  let where = 'WHERE user_id=?'
  if (period === 'week') where += " AND started_at >= datetime('now','-7 days')"
  else if (period === 'month') where += " AND started_at >= datetime('now','-1 month')"
  else if (period === 'year') where += " AND started_at >= datetime('now','-1 year')"

  try {
    const rows = await DB.prepare(`
      SELECT id, started_at, ended_at, distance_m, duration_sec,
             polyline, memo, route_name, avg_speed
      FROM activities ${where}
      ORDER BY started_at DESC LIMIT ?
    `).bind(user!.id, limit).all()
    return c.json({ ok: true, data: rows.results })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/activities/:id - 単体詳細
// ============================================================
apiRoutes.get('/activities/:id', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  const id = c.req.param('id')
  try {
    const row = await DB.prepare('SELECT * FROM activities WHERE id=? AND user_id=?').bind(id, user!.id).first()
    if (!row) return c.json({ ok: false, error: 'not found' }, 404)
    return c.json({ ok: true, data: row })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// POST /api/activities - 記録保存（+ マイルストーン判定）
// ============================================================
apiRoutes.post('/activities', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    const body = await c.req.json<{
      started_at: string; ended_at: string
      distance_m: number; duration_sec: number
      polyline: number[][]; memo?: string; route_name?: string
    }>()

    const avgSpeed = body.duration_sec > 0 ? body.distance_m / body.duration_sec : 0
    let maxSpeed = 0
    const pts = body.polyline || []
    for (let i = 1; i < pts.length; i++) {
      const dt = (pts[i][2] || 0) - (pts[i - 1][2] || 0)
      if (dt > 0) {
        const d = haversine(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1])
        maxSpeed = Math.max(maxSpeed, d / dt)
      }
    }

    const res = await DB.prepare(`
      INSERT INTO activities (user_id, started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed, max_speed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      user!.id,
      body.started_at, body.ended_at,
      body.distance_m, body.duration_sec,
      JSON.stringify(pts),
      body.memo || '', body.route_name || '',
      avgSpeed, maxSpeed
    ).run()

    const actId = res.meta.last_row_id

    // --- user_stats 更新 ---
    await DB.prepare(`
      UPDATE user_stats SET
        total_distance_m  = total_distance_m + ?,
        total_duration_sec = total_duration_sec + ?,
        total_activities  = total_activities + 1,
        activity_days     = (SELECT COUNT(DISTINCT DATE(started_at)) FROM activities WHERE user_id=?),
        first_activity_at = COALESCE(first_activity_at, ?),
        last_activity_at  = ?,
        updated_at        = datetime('now')
      WHERE user_id=?
    `).bind(body.distance_m, body.duration_sec, user!.id, body.started_at, body.started_at, user!.id).run()

    // --- マイルストーン判定 ---
    const stats = await DB.prepare('SELECT * FROM user_stats WHERE user_id=?').bind(user!.id).first<any>()
    const newMilestones: string[] = []

    for (const ms of MILESTONES) {
      if (stats.total_distance_m >= ms.threshold) {
        const exists = await DB.prepare('SELECT id FROM milestones WHERE user_id=? AND type=?').bind(user!.id, ms.type).first()
        if (!exists) {
          await DB.prepare(`
            INSERT INTO milestones (user_id, type, threshold_m, reached_at, total_distance_m, total_duration_sec, total_activities, activity_id)
            VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?)
          `).bind(user!.id, ms.type, ms.threshold, stats.total_distance_m, stats.total_duration_sec, stats.total_activities, actId).run()
          newMilestones.push(ms.type)
        }
      }
    }

    return c.json({ ok: true, data: { activity_id: actId, new_milestones: newMilestones } })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// PATCH /api/activities/:id - メモ / ルート名更新
// ============================================================
apiRoutes.patch('/activities/:id', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  const id = c.req.param('id')
  try {
    const { memo, route_name } = await c.req.json<{ memo?: string; route_name?: string }>()
    await DB.prepare('UPDATE activities SET memo=COALESCE(?,memo), route_name=COALESCE(?,route_name) WHERE id=? AND user_id=?')
      .bind(memo ?? null, route_name ?? null, id, user!.id).run()
    return c.json({ ok: true })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// DELETE /api/activities/:id - アクティビティ削除
// ============================================================
apiRoutes.delete('/activities/:id', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  const id = c.req.param('id')
  try {
    await DB.prepare('DELETE FROM activities WHERE id=? AND user_id=?').bind(id, user!.id).run()
    // user_stats 再計算
    await recalcUserStats(DB, user!.id)
    return c.json({ ok: true })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/milestones - マイルストーン一覧
// ============================================================
apiRoutes.get('/milestones', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    const rows = await DB.prepare('SELECT * FROM milestones WHERE user_id=? ORDER BY threshold_m ASC').bind(user!.id).all()
    return c.json({ ok: true, data: rows.results })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/milestones/latest-unchecked - 未表示マイルストーン
// ============================================================
apiRoutes.get('/milestones/latest-unchecked', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    const rows = await DB.prepare('SELECT * FROM milestones WHERE user_id=? ORDER BY threshold_m DESC').bind(user!.id).all()
    return c.json({ ok: true, data: rows.results })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/review - ふりかえり
// ============================================================
apiRoutes.get('/review', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  const period = c.req.query('period') || 'week'
  const since = period === 'week' ? '-7 days' : '-1 month'

  try {
    const summary = await DB.prepare(`
      SELECT COUNT(*) as count, 
             COALESCE(SUM(distance_m),0) as total_distance_m,
             COALESCE(SUM(duration_sec),0) as total_duration_sec,
             COALESCE(AVG(distance_m),0) as avg_distance_m
      FROM activities WHERE user_id=? AND started_at >= datetime('now', ?)
    `).bind(user!.id, since).first()

    const hourDist = await DB.prepare(`
      SELECT CAST(strftime('%H', started_at) AS INTEGER) as hour, COUNT(*) as cnt
      FROM activities WHERE user_id=? AND started_at >= datetime('now', ?)
      GROUP BY hour ORDER BY hour
    `).bind(user!.id, since).all()

    const daily = await DB.prepare(`
      SELECT DATE(started_at) as day, SUM(distance_m) as dist
      FROM activities WHERE user_id=? AND started_at >= datetime('now', ?)
      GROUP BY day ORDER BY day
    `).bind(user!.id, since).all()

    return c.json({
      ok: true,
      data: { period, summary, hour_distribution: hourDist.results, daily: daily.results }
    })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/heatmap - マイマップ用：ルート通過回数
// ============================================================
apiRoutes.get('/heatmap', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  const period = c.req.query('period') || 'all'
  let where = 'WHERE user_id=?'
  if (period === 'week') where += " AND started_at >= datetime('now','-7 days')"
  else if (period === 'month') where += " AND started_at >= datetime('now','-1 month')"
  else if (period === 'year') where += " AND started_at >= datetime('now','-1 year')"

  try {
    const rows = await DB.prepare(`
      SELECT polyline FROM activities ${where} ORDER BY started_at ASC LIMIT 500
    `).bind(user!.id).all()
    return c.json({ ok: true, data: rows.results.map((r: any) => JSON.parse(r.polyline)) })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// POST /api/sync - デバイスからのバックグラウンド同期
// ============================================================
apiRoutes.post('/sync', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    const body = await c.req.json<{ activities: any[] }>()
    const activities = body.activities || []
    let synced = 0

    for (const a of activities) {
      const avgSpeed = a.duration_sec > 0 ? a.distance_m / a.duration_sec : 0
      const existing = await DB.prepare('SELECT id FROM activities WHERE user_id=? AND started_at=? AND distance_m=?')
        .bind(user!.id, a.started_at, a.distance_m).first()
      if (existing) { synced++; continue }

      await DB.prepare(`
        INSERT INTO activities (user_id, started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed, max_speed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        user!.id,
        a.started_at, a.ended_at,
        a.distance_m || 0, a.duration_sec || 0,
        typeof a.polyline === 'string' ? a.polyline : JSON.stringify(a.polyline || []),
        a.memo || '', a.route_name || '',
        avgSpeed, a.max_speed || 0
      ).run()
      synced++
    }

    if (synced > 0) {
      await recalcUserStats(DB, user!.id)
      await recheckMilestones(DB, user!.id)
    }

    return c.json({ ok: true, synced })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// Profile API (性格診断)
// ============================================================

// GET /api/profile
apiRoutes.get('/profile', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    const row = await DB.prepare('SELECT * FROM profiles WHERE user_id=?').bind(user!.id).first()
    if (!row) return c.json({ ok: true, data: null })
    return c.json({
      ok: true,
      data: {
        mbti: row.mbti,
        bigFive: row.big_five ? JSON.parse(row.big_five as string) : null,
        answers: row.answers ? JSON.parse(row.answers as string) : null,
        level: row.level,
        totalActivities: row.total_activities,
        evolution_log: row.evolution_log ? JSON.parse(row.evolution_log as string) : [],
        created_at: row.created_at,
        updated_at: row.updated_at,
      }
    })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// POST /api/profile - 保存 / 更新
apiRoutes.post('/profile', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    const body = await c.req.json<{
      mbti?: string; bigFive?: any; answers?: any
      level?: number; totalActivities?: number; evolution_log?: any[]
    }>()

    const existing = await DB.prepare('SELECT id FROM profiles WHERE user_id=?').bind(user!.id).first()
    if (existing) {
      await DB.prepare(`
        UPDATE profiles SET
          mbti = COALESCE(?, mbti),
          big_five = COALESCE(?, big_five),
          answers = COALESCE(?, answers),
          level = COALESCE(?, level),
          total_activities = COALESCE(?, total_activities),
          evolution_log = COALESCE(?, evolution_log),
          updated_at = datetime('now')
        WHERE user_id=?
      `).bind(
        body.mbti ?? null,
        body.bigFive ? JSON.stringify(body.bigFive) : null,
        body.answers ? JSON.stringify(body.answers) : null,
        body.level ?? null,
        body.totalActivities ?? null,
        body.evolution_log ? JSON.stringify(body.evolution_log) : null,
        user!.id
      ).run()
    } else {
      await DB.prepare(`
        INSERT INTO profiles (user_id, mbti, big_five, answers, level, total_activities, evolution_log)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        user!.id,
        body.mbti || null,
        body.bigFive ? JSON.stringify(body.bigFive) : null,
        body.answers ? JSON.stringify(body.answers) : null,
        body.level || 1,
        body.totalActivities || 0,
        body.evolution_log ? JSON.stringify(body.evolution_log) : '[]'
      ).run()
    }
    return c.json({ ok: true })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// DELETE /api/profile - 削除
apiRoutes.delete('/profile', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    await DB.prepare('DELETE FROM profiles WHERE user_id=?').bind(user!.id).run()
    return c.json({ ok: true })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// DELETE /api/data/all - 全データ削除（アクティビティ・マイルストーン・統計）
apiRoutes.delete('/data/all', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    await DB.prepare('DELETE FROM activities WHERE user_id=?').bind(user!.id).run()
    await DB.prepare('DELETE FROM milestones WHERE user_id=?').bind(user!.id).run()
    await DB.prepare('UPDATE user_stats SET total_distance_m=0, total_duration_sec=0, total_activities=0, activity_days=0, first_activity_at=NULL, last_activity_at=NULL, updated_at=datetime(\'now\') WHERE user_id=?').bind(user!.id).run()
    return c.json({ ok: true })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// DELETE /api/data/everything - 全削除（プロフィール含む）
apiRoutes.delete('/data/everything', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    await DB.prepare('DELETE FROM activities WHERE user_id=?').bind(user!.id).run()
    await DB.prepare('DELETE FROM milestones WHERE user_id=?').bind(user!.id).run()
    await DB.prepare('DELETE FROM profiles WHERE user_id=?').bind(user!.id).run()
    await DB.prepare('UPDATE user_stats SET total_distance_m=0, total_duration_sec=0, total_activities=0, activity_days=0, first_activity_at=NULL, last_activity_at=NULL, updated_at=datetime(\'now\') WHERE user_id=?').bind(user!.id).run()
    return c.json({ ok: true })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// GET /api/data/export - データエクスポート
apiRoutes.get('/data/export', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    const activities = await DB.prepare('SELECT * FROM activities WHERE user_id=? ORDER BY started_at ASC').bind(user!.id).all()
    const milestones = await DB.prepare('SELECT * FROM milestones WHERE user_id=? ORDER BY threshold_m ASC').bind(user!.id).all()
    const stats = await DB.prepare('SELECT * FROM user_stats WHERE user_id=?').bind(user!.id).first()
    const profile = await DB.prepare('SELECT * FROM profiles WHERE user_id=?').bind(user!.id).first()

    return c.json({
      ok: true,
      data: {
        version: 3,
        exported_at: new Date().toISOString(),
        stats,
        milestones: milestones.results,
        activities: activities.results,
        profile: profile ? {
          mbti: profile.mbti,
          bigFive: profile.big_five ? JSON.parse(profile.big_five as string) : null,
          answers: profile.answers ? JSON.parse(profile.answers as string) : null,
          level: profile.level,
          totalActivities: profile.total_activities,
          evolution_log: profile.evolution_log ? JSON.parse(profile.evolution_log as string) : [],
        } : null,
      }
    })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// POST /api/data/import - データインポート
apiRoutes.post('/data/import', async (c) => {
  const user = await getUser(c)
  const err = requireAuth(c, user); if (err) return err
  const DB = c.env.DB
  try {
    const body = await c.req.json<any>()
    const activities = body.activities || []

    // 既存データクリア
    await DB.prepare('DELETE FROM activities WHERE user_id=?').bind(user!.id).run()
    await DB.prepare('DELETE FROM milestones WHERE user_id=?').bind(user!.id).run()

    for (const a of activities) {
      const avgSpeed = a.duration_sec > 0 ? a.distance_m / a.duration_sec : 0
      await DB.prepare(`
        INSERT INTO activities (user_id, started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed, max_speed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        user!.id,
        a.started_at, a.ended_at,
        a.distance_m || 0, a.duration_sec || 0,
        typeof a.polyline === 'string' ? a.polyline : JSON.stringify(a.polyline || []),
        a.memo || '', a.route_name || '',
        avgSpeed, a.max_speed || 0
      ).run()
    }

    await recalcUserStats(DB, user!.id)
    await recheckMilestones(DB, user!.id)

    // プロフィール復元
    if (body.profile) {
      await DB.prepare('DELETE FROM profiles WHERE user_id=?').bind(user!.id).run()
      await DB.prepare(`
        INSERT INTO profiles (user_id, mbti, big_five, answers, level, total_activities, evolution_log)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        user!.id,
        body.profile.mbti || null,
        body.profile.bigFive ? JSON.stringify(body.profile.bigFive) : null,
        body.profile.answers ? JSON.stringify(body.profile.answers) : null,
        body.profile.level || 1,
        body.profile.totalActivities || 0,
        body.profile.evolution_log ? JSON.stringify(body.profile.evolution_log) : '[]'
      ).run()
    }

    return c.json({ ok: true, imported: activities.length })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// Helper: user_stats 再計算
// ============================================================
async function recalcUserStats(DB: D1Database, userId: number) {
  const totals = await DB.prepare(`
    SELECT COUNT(*) as cnt, COALESCE(SUM(distance_m),0) as dist, COALESCE(SUM(duration_sec),0) as dur,
           COUNT(DISTINCT DATE(started_at)) as days, MIN(started_at) as first_at, MAX(started_at) as last_at
    FROM activities WHERE user_id=?
  `).bind(userId).first<any>()
  await DB.prepare(`
    UPDATE user_stats SET total_distance_m=?, total_duration_sec=?, total_activities=?,
           activity_days=?, first_activity_at=?, last_activity_at=?, updated_at=datetime('now') WHERE user_id=?
  `).bind(totals.dist, totals.dur, totals.cnt, totals.days, totals.first_at, totals.last_at, userId).run()
}

// ============================================================
// Helper: マイルストーン再判定
// ============================================================
async function recheckMilestones(DB: D1Database, userId: number) {
  const stats = await DB.prepare('SELECT * FROM user_stats WHERE user_id=?').bind(userId).first<any>()
  if (!stats) return
  for (const ms of MILESTONES) {
    if (stats.total_distance_m >= ms.threshold) {
      const exists = await DB.prepare('SELECT id FROM milestones WHERE user_id=? AND type=?').bind(userId, ms.type).first()
      if (!exists) {
        await DB.prepare(`
          INSERT INTO milestones (user_id, type, threshold_m, reached_at, total_distance_m, total_duration_sec, total_activities)
          VALUES (?, ?, ?, datetime('now'), ?, ?, ?)
        `).bind(userId, ms.type, ms.threshold, stats.total_distance_m, stats.total_duration_sec, stats.total_activities).run()
      }
    } else {
      await DB.prepare('DELETE FROM milestones WHERE user_id=? AND type=?').bind(userId, ms.type).run()
    }
  }
}

// ============================================================
// Haversine (meters)
// ============================================================
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
