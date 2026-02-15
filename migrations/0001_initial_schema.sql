-- Journey Tracker DB Schema v3 – Multi-user support
-- ==============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Sessions table (token-based auth)
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- User stats (per-user)
CREATE TABLE IF NOT EXISTS user_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  total_distance_m REAL DEFAULT 0,
  total_duration_sec INTEGER DEFAULT 0,
  total_activities INTEGER DEFAULT 0,
  activity_days INTEGER DEFAULT 0,
  first_activity_at TEXT,
  last_activity_at TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_stats_user ON user_stats(user_id);

-- Activities (per-user)
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  distance_m REAL DEFAULT 0,
  duration_sec INTEGER DEFAULT 0,
  polyline TEXT DEFAULT '[]',
  memo TEXT DEFAULT '',
  route_name TEXT DEFAULT '',
  avg_speed REAL DEFAULT 0,
  max_speed REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_started ON activities(user_id, started_at);

-- Milestones (per-user)
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  threshold_m REAL NOT NULL,
  reached_at TEXT DEFAULT (datetime('now')),
  total_distance_m REAL DEFAULT 0,
  total_duration_sec INTEGER DEFAULT 0,
  total_activities INTEGER DEFAULT 0,
  activity_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_milestones_user ON milestones(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_milestones_user_type ON milestones(user_id, type);

-- Profiles (per-user personality data)
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  mbti TEXT,
  big_five TEXT,
  answers TEXT,
  level INTEGER DEFAULT 1,
  total_activities INTEGER DEFAULT 0,
  evolution_log TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
