import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { renderer } from './renderer'

type Bindings = {
  DB: D1Database;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定（フロントエンドとの通信用）
app.use('/api/*', cors())

// レンダラー設定
app.use(renderer)

// =====================================
// API Routes
// =====================================

// 統計情報取得API
app.get('/api/stats', async (c) => {
  const { DB } = c.env

  try {
    // ユーザー統計取得
    const userStats = await DB.prepare(`
      SELECT 
        first_activity_date,
        total_distance,
        total_duration,
        activity_days,
        CAST((julianday('now') - julianday(first_activity_date)) AS INTEGER) as days_since_start
      FROM users WHERE id = 1
    `).first()

    // 最近のアクティビティ取得
    const recentActivities = await DB.prepare(`
      SELECT 
        id, activity_type, distance, duration, 
        datetime(start_time, 'localtime') as start_time,
        datetime(end_time, 'localtime') as end_time
      FROM activities 
      WHERE user_id = 1 
      ORDER BY start_time DESC 
      LIMIT 10
    `).all()

    // 週ごとの統計
    const weeklyStats = await DB.prepare(`
      SELECT 
        strftime('%Y-%W', start_time) as week,
        COUNT(*) as activity_count,
        SUM(distance) as total_distance,
        SUM(duration) as total_duration
      FROM activities 
      WHERE user_id = 1 
      GROUP BY week 
      ORDER BY week DESC 
      LIMIT 12
    `).all()

    // マイルストーン取得
    const milestones = await DB.prepare(`
      SELECT 
        milestone_type, milestone_value, title, description,
        datetime(achieved_at, 'localtime') as achieved_at
      FROM milestones 
      WHERE user_id = 1 
      ORDER BY achieved_at DESC 
      LIMIT 5
    `).all()

    return c.json({
      success: true,
      data: {
        user: userStats,
        recent_activities: recentActivities.results,
        weekly_stats: weeklyStats.results,
        milestones: milestones.results
      }
    })
  } catch (error) {
    console.error('Stats API Error:', error)
    return c.json({ success: false, error: String(error) }, 500)
  }
})

// アクティビティ一覧取得API
app.get('/api/activities', async (c) => {
  const { DB } = c.env
  const limit = c.req.query('limit') || '50'
  const offset = c.req.query('offset') || '0'

  try {
    const activities = await DB.prepare(`
      SELECT 
        id, activity_type, distance, duration, 
        datetime(start_time, 'localtime') as start_time,
        datetime(end_time, 'localtime') as end_time,
        datetime(created_at, 'localtime') as created_at
      FROM activities 
      WHERE user_id = 1 
      ORDER BY start_time DESC 
      LIMIT ? OFFSET ?
    `).bind(parseInt(limit), parseInt(offset)).all()

    const total = await DB.prepare(`
      SELECT COUNT(*) as count FROM activities WHERE user_id = 1
    `).first()

    return c.json({
      success: true,
      data: activities.results,
      total: total?.count || 0
    })
  } catch (error) {
    console.error('Activities API Error:', error)
    return c.json({ success: false, error: String(error) }, 500)
  }
})

// アクティビティ詳細取得API（位置情報含む）
app.get('/api/activities/:id', async (c) => {
  const { DB } = c.env
  const activityId = c.req.param('id')

  try {
    const activity = await DB.prepare(`
      SELECT 
        id, activity_type, distance, duration, 
        datetime(start_time, 'localtime') as start_time,
        datetime(end_time, 'localtime') as end_time
      FROM activities 
      WHERE id = ? AND user_id = 1
    `).bind(activityId).first()

    if (!activity) {
      return c.json({ success: false, error: 'Activity not found' }, 404)
    }

    const locations = await DB.prepare(`
      SELECT 
        latitude, longitude, accuracy,
        datetime(timestamp, 'localtime') as timestamp
      FROM location_points 
      WHERE activity_id = ? 
      ORDER BY timestamp ASC
    `).bind(activityId).all()

    return c.json({
      success: true,
      data: {
        activity,
        locations: locations.results
      }
    })
  } catch (error) {
    console.error('Activity Detail API Error:', error)
    return c.json({ success: false, error: String(error) }, 500)
  }
})

// アクティビティ記録API
app.post('/api/activities', async (c) => {
  const { DB } = c.env

  try {
    const body = await c.req.json()
    const { activity_type, distance, duration, start_time, end_time, locations } = body

    // バリデーション
    if (!activity_type || !distance || !duration || !start_time || !end_time) {
      return c.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, 400)
    }

    // アクティビティ挿入
    const activityResult = await DB.prepare(`
      INSERT INTO activities (user_id, activity_type, distance, duration, start_time, end_time)
      VALUES (1, ?, ?, ?, ?, ?)
    `).bind(activity_type, distance, duration, start_time, end_time).run()

    const activityId = activityResult.meta.last_row_id

    // 位置情報ポイント挿入
    if (locations && Array.isArray(locations) && locations.length > 0) {
      for (const loc of locations) {
        await DB.prepare(`
          INSERT INTO location_points (activity_id, latitude, longitude, accuracy, timestamp)
          VALUES (?, ?, ?, ?, ?)
        `).bind(activityId, loc.latitude, loc.longitude, loc.accuracy || 0, loc.timestamp).run()
      }
    }

    // ユーザー統計更新
    await DB.prepare(`
      UPDATE users SET 
        first_activity_date = COALESCE(first_activity_date, DATE(?)),
        total_distance = total_distance + ?,
        total_duration = total_duration + ?,
        activity_days = (SELECT COUNT(DISTINCT DATE(start_time)) FROM activities WHERE user_id = 1)
      WHERE id = 1
    `).bind(start_time, distance, duration).run()

    // マイルストーンチェック
    await checkAndCreateMilestones(DB, activityId)

    return c.json({
      success: true,
      data: {
        activity_id: activityId,
        message: 'Activity recorded successfully'
      }
    })
  } catch (error) {
    console.error('Record Activity API Error:', error)
    return c.json({ success: false, error: String(error) }, 500)
  }
})

// マイルストーン一覧取得API
app.get('/api/milestones', async (c) => {
  const { DB } = c.env

  try {
    const milestones = await DB.prepare(`
      SELECT 
        id, milestone_type, milestone_value, title, description,
        datetime(achieved_at, 'localtime') as achieved_at
      FROM milestones 
      WHERE user_id = 1 
      ORDER BY achieved_at DESC
    `).all()

    return c.json({
      success: true,
      data: milestones.results
    })
  } catch (error) {
    console.error('Milestones API Error:', error)
    return c.json({ success: false, error: String(error) }, 500)
  }
})

// =====================================
// Helper Functions
// =====================================

async function checkAndCreateMilestones(DB: D1Database, activityId: number) {
  // ユーザー統計取得
  const stats = await DB.prepare(`
    SELECT total_distance, activity_days FROM users WHERE id = 1
  `).first()

  if (!stats) return

  const distanceMilestones = [10, 20, 50, 100, 200, 500, 1000]
  const activityMilestones = [1, 5, 10, 20, 50, 100, 200]

  // 距離マイルストーンチェック
  for (const milestone of distanceMilestones) {
    if (stats.total_distance >= milestone) {
      const exists = await DB.prepare(`
        SELECT id FROM milestones 
        WHERE user_id = 1 AND milestone_type = 'total_distance' AND milestone_value = ?
      `).bind(milestone).first()

      if (!exists) {
        await DB.prepare(`
          INSERT INTO milestones (user_id, milestone_type, milestone_value, activity_id, title, description)
          VALUES (1, 'total_distance', ?, ?, ?, ?)
        `).bind(
          milestone,
          activityId,
          `${milestone}km達成！`,
          `累計距離が${milestone}kmに到達しました。素晴らしい記録です！`
        ).run()
      }
    }
  }

  // アクティビティ回数マイルストーンチェック
  for (const milestone of activityMilestones) {
    if (stats.activity_days >= milestone) {
      const exists = await DB.prepare(`
        SELECT id FROM milestones 
        WHERE user_id = 1 AND milestone_type = 'activity_count' AND milestone_value = ?
      `).bind(milestone).first()

      if (!exists) {
        await DB.prepare(`
          INSERT INTO milestones (user_id, milestone_type, milestone_value, activity_id, title, description)
          VALUES (1, 'activity_count', ?, ?, ?, ?)
        `).bind(
          milestone,
          activityId,
          `${milestone}日目の記録`,
          `${milestone}日間アクティビティを記録しました。継続は力なり！`
        ).run()
      }
    }
  }
}

// =====================================
// Frontend Routes
// =====================================

app.get('/', (c) => {
  return c.render(
    <div class="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <header class="mb-12 text-center">
        <div class="inline-flex items-center gap-3 mb-4">
          <i class="fas fa-shoe-prints text-5xl text-indigo-600"></i>
          <h1 class="text-5xl font-bold text-gray-800">Journey Tracker</h1>
        </div>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto">
          あなたの歩みを記録し、時間とともに深まる資産を築こう
        </p>
      </header>

      {/* Stats Overview */}
      <section id="stats-overview" class="mb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div class="flex items-center justify-between mb-2">
            <i class="fas fa-route text-3xl text-blue-500"></i>
            <span class="text-sm text-gray-500">累計距離</span>
          </div>
          <div class="text-3xl font-bold text-gray-800" id="total-distance">-</div>
          <div class="text-sm text-gray-500 mt-1">km</div>
        </div>

        <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
          <div class="flex items-center justify-between mb-2">
            <i class="fas fa-calendar-check text-3xl text-green-500"></i>
            <span class="text-sm text-gray-500">活動日数</span>
          </div>
          <div class="text-3xl font-bold text-gray-800" id="activity-days">-</div>
          <div class="text-sm text-gray-500 mt-1">日間</div>
        </div>

        <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
          <div class="flex items-center justify-between mb-2">
            <i class="fas fa-clock text-3xl text-purple-500"></i>
            <span class="text-sm text-gray-500">累計時間</span>
          </div>
          <div class="text-3xl font-bold text-gray-800" id="total-duration">-</div>
          <div class="text-sm text-gray-500 mt-1">時間</div>
        </div>

        <div class="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
          <div class="flex items-center justify-between mb-2">
            <i class="fas fa-seedling text-3xl text-orange-500"></i>
            <span class="text-sm text-gray-500">継続日数</span>
          </div>
          <div class="text-3xl font-bold text-gray-800" id="days-since-start">-</div>
          <div class="text-sm text-gray-500 mt-1">日目</div>
        </div>
      </section>

      {/* Action Buttons */}
      <section class="mb-12 flex flex-wrap gap-4 justify-center">
        <button 
          id="start-tracking-btn" 
          class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform transition hover:scale-105 flex items-center gap-3">
          <i class="fas fa-play-circle text-2xl"></i>
          <span class="text-lg">トラッキング開始</span>
        </button>
        <button 
          id="stop-tracking-btn" 
          class="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-xl shadow-lg transform transition hover:scale-105 hidden flex items-center gap-3">
          <i class="fas fa-stop-circle text-2xl"></i>
          <span class="text-lg">トラッキング停止</span>
        </button>
      </section>

      {/* Tracking Status */}
      <section id="tracking-status" class="mb-12 hidden">
        <div class="bg-gradient-to-r from-green-400 to-blue-500 text-white rounded-xl shadow-xl p-8">
          <div class="flex items-center gap-4 mb-6">
            <i class="fas fa-location-arrow text-4xl animate-pulse"></i>
            <div>
              <h2 class="text-2xl font-bold">トラッキング中...</h2>
              <p class="text-green-100">位置情報を記録しています</p>
            </div>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div class="bg-white bg-opacity-20 rounded-lg p-4">
              <div class="text-sm text-green-100 mb-1">現在の距離</div>
              <div class="text-2xl font-bold" id="current-distance">0.0</div>
              <div class="text-xs text-green-100">km</div>
            </div>
            <div class="bg-white bg-opacity-20 rounded-lg p-4">
              <div class="text-sm text-green-100 mb-1">経過時間</div>
              <div class="text-2xl font-bold" id="current-duration">00:00</div>
              <div class="text-xs text-green-100">分:秒</div>
            </div>
            <div class="bg-white bg-opacity-20 rounded-lg p-4">
              <div class="text-sm text-green-100 mb-1">記録ポイント</div>
              <div class="text-2xl font-bold" id="point-count">0</div>
              <div class="text-xs text-green-100">地点</div>
            </div>
            <div class="bg-white bg-opacity-20 rounded-lg p-4">
              <div class="text-sm text-green-100 mb-1">精度</div>
              <div class="text-2xl font-bold" id="current-accuracy">-</div>
              <div class="text-xs text-green-100">m</div>
            </div>
          </div>
        </div>
      </section>

      {/* Charts */}
      <section class="mb-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="bg-white rounded-xl shadow-lg p-6">
          <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i class="fas fa-chart-line text-indigo-600"></i>
            週間活動グラフ
          </h3>
          <canvas id="weekly-chart"></canvas>
        </div>

        <div class="bg-white rounded-xl shadow-lg p-6">
          <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i class="fas fa-trophy text-yellow-500"></i>
            最近のマイルストーン
          </h3>
          <div id="milestones-list" class="space-y-3 max-h-64 overflow-y-auto">
            <div class="text-gray-500 text-center py-8">読み込み中...</div>
          </div>
        </div>
      </section>

      {/* Recent Activities */}
      <section class="mb-12">
        <div class="bg-white rounded-xl shadow-lg p-6">
          <h3 class="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <i class="fas fa-history text-green-600"></i>
            最近のアクティビティ
          </h3>
          <div id="recent-activities" class="space-y-3">
            <div class="text-gray-500 text-center py-8">読み込み中...</div>
          </div>
        </div>
      </section>

      {/* Activity Type Selection Modal -->
      <div id="activity-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
          <h3 class="text-2xl font-bold text-gray-800 mb-6 text-center">アクティビティタイプを選択</h3>
          <div class="space-y-4">
            <button class="activity-type-btn w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-between transition" data-type="walk">
              <div class="flex items-center gap-3">
                <i class="fas fa-walking text-2xl"></i>
                <span class="text-lg">ウォーキング</span>
              </div>
              <i class="fas fa-chevron-right"></i>
            </button>
            <button class="activity-type-btn w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-between transition" data-type="run">
              <div class="flex items-center gap-3">
                <i class="fas fa-running text-2xl"></i>
                <span class="text-lg">ランニング</span>
              </div>
              <i class="fas fa-chevron-right"></i>
            </button>
            <button class="activity-type-btn w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-between transition" data-type="cycle">
              <div class="flex items-center gap-3">
                <i class="fas fa-biking text-2xl"></i>
                <span class="text-lg">サイクリング</span>
              </div>
              <i class="fas fa-chevron-right"></i>
            </button>
          </div>
          <button id="close-modal-btn" class="mt-6 w-full bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-3 px-6 rounded-xl transition">
            キャンセル
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer class="text-center text-gray-600 mt-16 py-8 border-t border-gray-200">
        <p class="text-sm">
          <i class="fas fa-heart text-red-500"></i>
          Journey Tracker - 時間とともに深まるあなただけの資産
        </p>
      </footer>
    </div>
  )
})

export default app
