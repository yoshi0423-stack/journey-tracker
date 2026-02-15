-- サンプルアクティビティデータ
INSERT INTO activities (user_id, activity_type, distance, duration, start_time, end_time, created_at) VALUES
  (1, 'walk', 2.5, 1800, datetime('now', '-30 days', '+9 hours'), datetime('now', '-30 days', '+9 hours', '+30 minutes'), datetime('now', '-30 days')),
  (1, 'run', 5.2, 1500, datetime('now', '-25 days', '+7 hours'), datetime('now', '-25 days', '+7 hours', '+25 minutes'), datetime('now', '-25 days')),
  (1, 'walk', 3.1, 2100, datetime('now', '-20 days', '+18 hours'), datetime('now', '-20 days', '+18 hours', '+35 minutes'), datetime('now', '-20 days')),
  (1, 'run', 7.8, 2400, datetime('now', '-15 days', '+6 hours'), datetime('now', '-15 days', '+6 hours', '+40 minutes'), datetime('now', '-15 days')),
  (1, 'walk', 1.8, 1200, datetime('now', '-10 days', '+12 hours'), datetime('now', '-10 days', '+12 hours', '+20 minutes'), datetime('now', '-10 days')),
  (1, 'run', 6.5, 2000, datetime('now', '-5 days', '+7 hours'), datetime('now', '-5 days', '+7 hours', '+33 minutes'), datetime('now', '-5 days')),
  (1, 'walk', 4.2, 2700, datetime('now', '-2 days', '+16 hours'), datetime('now', '-2 days', '+16 hours', '+45 minutes'), datetime('now', '-2 days'));

-- サンプル位置情報ポイント（東京周辺の架空のルート）
INSERT INTO location_points (activity_id, latitude, longitude, accuracy, timestamp) VALUES
  -- アクティビティ1の軌跡
  (1, 35.6812, 139.7671, 10, datetime('now', '-30 days', '+9 hours')),
  (1, 35.6815, 139.7680, 12, datetime('now', '-30 days', '+9 hours', '+5 minutes')),
  (1, 35.6820, 139.7690, 15, datetime('now', '-30 days', '+9 hours', '+10 minutes')),
  -- アクティビティ2の軌跡
  (2, 35.6895, 139.6917, 8, datetime('now', '-25 days', '+7 hours')),
  (2, 35.6905, 139.6927, 10, datetime('now', '-25 days', '+7 hours', '+5 minutes')),
  (2, 35.6915, 139.6937, 12, datetime('now', '-25 days', '+7 hours', '+10 minutes'));

-- サンプルマイルストーン
INSERT INTO milestones (user_id, milestone_type, milestone_value, achieved_at, title, description) VALUES
  (1, 'total_distance', 10.0, datetime('now', '-20 days'), '10km達成', '累計距離が10kmに到達しました'),
  (1, 'total_distance', 20.0, datetime('now', '-10 days'), '20km達成', '累計距離が20kmに到達しました'),
  (1, 'activity_count', 5, datetime('now', '-15 days'), '5回目の記録', 'アクティビティを5回記録しました');

-- サンプル頻出スポット
INSERT INTO frequent_places (user_id, place_name, latitude, longitude, visit_count, first_visit, last_visit) VALUES
  (1, '代々木公園', 35.6715, 139.6961, 5, datetime('now', '-30 days'), datetime('now', '-5 days')),
  (1, '皇居周辺', 35.6852, 139.7528, 3, datetime('now', '-25 days'), datetime('now', '-10 days'));

-- ユーザー統計の更新
UPDATE users SET 
  first_activity_date = (SELECT MIN(DATE(start_time)) FROM activities WHERE user_id = 1),
  total_distance = (SELECT COALESCE(SUM(distance), 0) FROM activities WHERE user_id = 1),
  total_duration = (SELECT COALESCE(SUM(duration), 0) FROM activities WHERE user_id = 1),
  activity_days = (SELECT COUNT(DISTINCT DATE(start_time)) FROM activities WHERE user_id = 1)
WHERE id = 1;
