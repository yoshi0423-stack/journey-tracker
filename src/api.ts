import { Hono } from 'hono'
import type { AppType } from './index'

export const apiRoutes = new Hono<AppType>()

// ============================================================
// マイルストーン定義（メートル単位）
// ============================================================
const MILESTONES = [
  { type: 'distance_10km',   threshold: 10000,   label: '10 km' },
  { type: 'distance_50km',   threshold: 50000,   label: '50 km' },
  { type: 'distance_100km',  threshold: 100000,  label: '100 km' },
  { type: 'distance_300km',  threshold: 300000,  label: '300 km' },
  { type: 'distance_1000km', threshold: 1000000, label: '1,000 km' },
]

// ============================================================
// GET /api/stats  - ダッシュボード用統計
// ============================================================
apiRoutes.get('/stats', async (c) => {
  const DB = c.env.DB
  try {
    const stats = await DB.prepare('SELECT * FROM user_stats WHERE id=1').first()
    return c.json({ ok: true, data: stats })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/activities  - 一覧（フィルタ対応）
// ============================================================
apiRoutes.get('/activities', async (c) => {
  const DB = c.env.DB
  const period = c.req.query('period') || 'all' // week | month | year | all
  const limit  = parseInt(c.req.query('limit') || '200')

  let where = ''
  if (period === 'week')  where = "WHERE started_at >= datetime('now','-7 days')"
  else if (period === 'month') where = "WHERE started_at >= datetime('now','-1 month')"
  else if (period === 'year')  where = "WHERE started_at >= datetime('now','-1 year')"

  try {
    const rows = await DB.prepare(`
      SELECT id, started_at, ended_at, distance_m, duration_sec,
             polyline, memo, route_name, avg_speed
      FROM activities ${where}
      ORDER BY started_at DESC LIMIT ?
    `).bind(limit).all()
    return c.json({ ok: true, data: rows.results })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/activities/:id  - 単体詳細
// ============================================================
apiRoutes.get('/activities/:id', async (c) => {
  const DB = c.env.DB
  const id = c.req.param('id')
  try {
    const row = await DB.prepare('SELECT * FROM activities WHERE id=?').bind(id).first()
    if (!row) return c.json({ ok: false, error: 'not found' }, 404)
    return c.json({ ok: true, data: row })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// POST /api/activities  - 記録保存（+ マイルストーン判定）
// ============================================================
apiRoutes.post('/activities', async (c) => {
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
      const dt = (pts[i][2] || 0) - (pts[i-1][2] || 0)
      if (dt > 0) {
        const d = haversine(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1])
        maxSpeed = Math.max(maxSpeed, d / dt)
      }
    }

    const res = await DB.prepare(`
      INSERT INTO activities (started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed, max_speed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      body.started_at, body.ended_at,
      body.distance_m, body.duration_sec,
      JSON.stringify(pts),
      body.memo || null, body.route_name || null,
      avgSpeed, maxSpeed
    ).run()

    const actId = res.meta.last_row_id

    // --- user_stats 更新 ---
    await DB.prepare(`
      UPDATE user_stats SET
        total_distance_m  = total_distance_m + ?,
        total_duration_sec = total_duration_sec + ?,
        total_activities  = total_activities + 1,
        activity_days     = (SELECT COUNT(DISTINCT DATE(started_at)) FROM activities),
        first_activity_at = COALESCE(first_activity_at, ?),
        last_activity_at  = ?,
        updated_at        = datetime('now')
      WHERE id=1
    `).bind(body.distance_m, body.duration_sec, body.started_at, body.started_at).run()

    // --- マイルストーン判定 ---
    const stats = await DB.prepare('SELECT * FROM user_stats WHERE id=1').first<any>()
    const newMilestones: string[] = []

    for (const ms of MILESTONES) {
      if (stats.total_distance_m >= ms.threshold) {
        const exists = await DB.prepare('SELECT id FROM milestones WHERE type=?').bind(ms.type).first()
        if (!exists) {
          await DB.prepare(`
            INSERT INTO milestones (type, threshold_m, reached_at, total_distance_m, total_duration_sec, total_activities, activity_id)
            VALUES (?, ?, datetime('now'), ?, ?, ?, ?)
          `).bind(ms.type, ms.threshold, stats.total_distance_m, stats.total_duration_sec, stats.total_activities, actId).run()
          newMilestones.push(ms.type)
        }
      }
    }

    return c.json({ ok: true, data: { activity_id: actId, new_milestones: newMilestones } })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// PATCH /api/activities/:id  - メモ / ルート名更新
// ============================================================
apiRoutes.patch('/activities/:id', async (c) => {
  const DB = c.env.DB
  const id = c.req.param('id')
  try {
    const { memo, route_name } = await c.req.json<{ memo?: string; route_name?: string }>()
    await DB.prepare('UPDATE activities SET memo=COALESCE(?,memo), route_name=COALESCE(?,route_name) WHERE id=?')
      .bind(memo ?? null, route_name ?? null, id).run()
    return c.json({ ok: true })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/milestones  - マイルストーン一覧
// ============================================================
apiRoutes.get('/milestones', async (c) => {
  const DB = c.env.DB
  try {
    const rows = await DB.prepare('SELECT * FROM milestones ORDER BY threshold_m ASC').all()
    return c.json({ ok: true, data: rows.results })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/milestones/latest-unchecked  - 未表示マイルストーン
// ============================================================
apiRoutes.get('/milestones/latest-unchecked', async (c) => {
  const DB = c.env.DB
  try {
    const rows = await DB.prepare('SELECT * FROM milestones ORDER BY threshold_m DESC').all()
    return c.json({ ok: true, data: rows.results })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/review  - ふりかえり
// ============================================================
apiRoutes.get('/review', async (c) => {
  const DB = c.env.DB
  const period = c.req.query('period') || 'week' // week | month
  const since = period === 'week' ? '-7 days' : '-1 month'

  try {
    // 集計
    const summary = await DB.prepare(`
      SELECT COUNT(*) as count, 
             COALESCE(SUM(distance_m),0) as total_distance_m,
             COALESCE(SUM(duration_sec),0) as total_duration_sec,
             COALESCE(AVG(distance_m),0) as avg_distance_m
      FROM activities WHERE started_at >= datetime('now', ?)
    `).bind(since).first()

    // 時間帯分布
    const hourDist = await DB.prepare(`
      SELECT CAST(strftime('%H', started_at) AS INTEGER) as hour, COUNT(*) as cnt
      FROM activities WHERE started_at >= datetime('now', ?)
      GROUP BY hour ORDER BY hour
    `).bind(since).all()

    // 日別距離
    const daily = await DB.prepare(`
      SELECT DATE(started_at) as day, SUM(distance_m) as dist
      FROM activities WHERE started_at >= datetime('now', ?)
      GROUP BY day ORDER BY day
    `).bind(since).all()

    return c.json({
      ok: true,
      data: {
        period,
        summary,
        hour_distribution: hourDist.results,
        daily: daily.results,
      }
    })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// GET /api/heatmap  - マイマップ用：ルート通過回数
// ============================================================
apiRoutes.get('/heatmap', async (c) => {
  const DB = c.env.DB
  const period = c.req.query('period') || 'all'
  let where = ''
  if (period === 'week')  where = "WHERE started_at >= datetime('now','-7 days')"
  else if (period === 'month') where = "WHERE started_at >= datetime('now','-1 month')"
  else if (period === 'year')  where = "WHERE started_at >= datetime('now','-1 year')"

  try {
    const rows = await DB.prepare(`
      SELECT polyline FROM activities ${where} ORDER BY started_at ASC LIMIT 500
    `).all()
    return c.json({ ok: true, data: rows.results.map((r: any) => JSON.parse(r.polyline)) })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// POST /api/sync  - デバイスからのバックグラウンド同期
// ============================================================
apiRoutes.post('/sync', async (c) => {
  const DB = c.env.DB
  try {
    const body = await c.req.json<{ activities: any[] }>()
    const activities = body.activities || []
    let synced = 0

    for (const a of activities) {
      const avgSpeed = a.duration_sec > 0 ? a.distance_m / a.duration_sec : 0
      // started_at で重複チェック
      const existing = await DB.prepare('SELECT id FROM activities WHERE started_at=? AND distance_m=?')
        .bind(a.started_at, a.distance_m).first()
      if (existing) { synced++; continue }

      await DB.prepare(`
        INSERT INTO activities (started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed, max_speed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        a.started_at, a.ended_at,
        a.distance_m || 0, a.duration_sec || 0,
        typeof a.polyline === 'string' ? a.polyline : JSON.stringify(a.polyline || []),
        a.memo || null, a.route_name || null,
        avgSpeed, a.max_speed || 0
      ).run()
      synced++
    }

    // user_stats 再計算
    if (synced > 0) {
      const totals = await DB.prepare(`
        SELECT COUNT(*) as cnt, COALESCE(SUM(distance_m),0) as dist, COALESCE(SUM(duration_sec),0) as dur,
               COUNT(DISTINCT DATE(started_at)) as days, MIN(started_at) as first_at, MAX(started_at) as last_at
        FROM activities
      `).first<any>()
      await DB.prepare(`
        UPDATE user_stats SET total_distance_m=?, total_duration_sec=?, total_activities=?,
               activity_days=?, first_activity_at=?, last_activity_at=?, updated_at=datetime('now') WHERE id=1
      `).bind(totals.dist, totals.dur, totals.cnt, totals.days, totals.first_at, totals.last_at).run()

      // マイルストーン再判定
      for (const ms of MILESTONES) {
        if (totals.dist >= ms.threshold) {
          const exists = await DB.prepare('SELECT id FROM milestones WHERE type=?').bind(ms.type).first()
          if (!exists) {
            await DB.prepare(`
              INSERT INTO milestones (type, threshold_m, reached_at, total_distance_m, total_duration_sec, total_activities)
              VALUES (?, ?, datetime('now'), ?, ?, ?)
            `).bind(ms.type, ms.threshold, totals.dist, totals.dur, totals.cnt).run()
          }
        }
      }
    }

    return c.json({ ok: true, synced })
  } catch (e) { return c.json({ ok: false, error: String(e) }, 500) }
})

// ============================================================
// Haversine (meters)
// ============================================================
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
