-- ユーザー情報テーブル（将来的な拡張用）
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  first_activity_date DATE,
  total_distance REAL DEFAULT 0,
  total_duration INTEGER DEFAULT 0,
  activity_days INTEGER DEFAULT 0
);

-- アクティビティ記録テーブル（歩行・走行の記録）
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER DEFAULT 1,
  activity_type TEXT NOT NULL CHECK(activity_type IN ('walk', 'run', 'cycle')),
  distance REAL NOT NULL,
  duration INTEGER NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 位置情報ポイントテーブル（GPS軌跡）
CREATE TABLE IF NOT EXISTS location_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  altitude REAL,
  accuracy REAL,
  timestamp DATETIME NOT NULL,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE
);

-- マイルストーンテーブル（達成記録）
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER DEFAULT 1,
  milestone_type TEXT NOT NULL,
  milestone_value REAL NOT NULL,
  achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  activity_id INTEGER,
  title TEXT,
  description TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (activity_id) REFERENCES activities(id)
);

-- よく訪れる場所テーブル（頻出スポット）
CREATE TABLE IF NOT EXISTS frequent_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER DEFAULT 1,
  place_name TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  visit_count INTEGER DEFAULT 1,
  first_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_visit DATETIME DEFAULT CURRENT_TIMESTAMP,
  radius REAL DEFAULT 100,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- インデックス作成（クエリパフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_start_time ON activities(start_time);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);
CREATE INDEX IF NOT EXISTS idx_location_points_activity_id ON location_points(activity_id);
CREATE INDEX IF NOT EXISTS idx_location_points_timestamp ON location_points(timestamp);
CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_achieved_at ON milestones(achieved_at);
CREATE INDEX IF NOT EXISTS idx_frequent_places_user_id ON frequent_places(user_id);

-- デフォルトユーザーの作成
INSERT OR IGNORE INTO users (id, username, created_at) VALUES (1, 'default_user', CURRENT_TIMESTAMP);
