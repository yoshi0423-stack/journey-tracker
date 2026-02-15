-- ===================================================
-- Journey Tracker - DB Schema v2
-- 「情緒 × 時間」で不可逆に育つ個人資産
-- ===================================================

-- ユーザー統計テーブル（累積値を持つ）
CREATE TABLE IF NOT EXISTS user_stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  total_distance_m REAL DEFAULT 0,        -- 累計距離 (メートル)
  total_duration_sec INTEGER DEFAULT 0,    -- 累計時間 (秒)
  total_activities INTEGER DEFAULT 0,      -- 累計アクティビティ数
  activity_days INTEGER DEFAULT 0,         -- 活動した日の数
  first_activity_at TEXT,                  -- 初回アクティビティ日時
  last_activity_at TEXT,                   -- 最終アクティビティ日時
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- アクティビティテーブル（1回の記録 = 1行）
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,                -- 開始日時 ISO8601
  ended_at TEXT NOT NULL,                  -- 終了日時 ISO8601
  distance_m REAL NOT NULL DEFAULT 0,      -- 距離 (メートル)
  duration_sec INTEGER NOT NULL DEFAULT 0, -- 時間 (秒)
  polyline TEXT NOT NULL DEFAULT '[]',     -- 座標配列 JSON [[lat,lng,ts],...]
  memo TEXT,                               -- 一言メモ
  route_name TEXT,                         -- ルート名
  avg_speed REAL DEFAULT 0,               -- 平均速度 m/s
  max_speed REAL DEFAULT 0,               -- 最高速度 m/s
  created_at TEXT DEFAULT (datetime('now'))
);

-- マイルストーンテーブル（節目到達記録）
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,                      -- 'distance_10km','distance_50km' 等
  threshold_m REAL NOT NULL,               -- 到達基準値 (メートル)
  reached_at TEXT NOT NULL,                -- 到達日時
  total_distance_m REAL NOT NULL,          -- 到達時の累計距離
  total_duration_sec INTEGER NOT NULL,     -- 到達時の累計時間
  total_activities INTEGER NOT NULL,       -- 到達時の累計回数
  activity_id INTEGER,                     -- 到達時のアクティビティID
  FOREIGN KEY (activity_id) REFERENCES activities(id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_activities_started_at ON activities(started_at);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_milestones_type ON milestones(type);
CREATE INDEX IF NOT EXISTS idx_milestones_reached_at ON milestones(reached_at);

-- デフォルトユーザー統計レコード作成
INSERT OR IGNORE INTO user_stats (id) VALUES (1);
