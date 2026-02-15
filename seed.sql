-- ===================================================
-- サンプルデータ（東京都内のリアルなルート）
-- ===================================================

-- Activity 1: 代々木公園周辺ウォーク（30日前）
INSERT INTO activities (started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed) VALUES
(datetime('now', '-30 days', '+9 hours'), datetime('now', '-30 days', '+9 hours', '+32 minutes'), 2540, 1920,
'[[35.6715,139.6961,0],[35.6720,139.6970,60],[35.6728,139.6980,120],[35.6735,139.6988,180],[35.6740,139.6975,240],[35.6732,139.6965,300],[35.6725,139.6958,360],[35.6718,139.6952,420],[35.6712,139.6960,480],[35.6715,139.6961,540]]',
'朝の空気が気持ちいい', '代々木公園一周', 1.32);

-- Activity 2: 皇居ラン（25日前）
INSERT INTO activities (started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed) VALUES
(datetime('now', '-25 days', '+7 hours'), datetime('now', '-25 days', '+7 hours', '+28 minutes'), 5100, 1680,
'[[35.6852,139.7528,0],[35.6870,139.7510,60],[35.6890,139.7495,120],[35.6905,139.7480,180],[35.6915,139.7460,240],[35.6910,139.7440,300],[35.6895,139.7425,360],[35.6875,139.7435,420],[35.6860,139.7450,480],[35.6845,139.7470,540],[35.6835,139.7490,600],[35.6840,139.7510,660],[35.6852,139.7528,720]]',
'皇居ランナー多かった', '皇居一周', 3.04);

-- Activity 3: 渋谷〜表参道散歩（20日前）
INSERT INTO activities (started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed) VALUES
(datetime('now', '-20 days', '+18 hours'), datetime('now', '-20 days', '+18 hours', '+40 minutes'), 3200, 2400,
'[[35.6580,139.7016,0],[35.6595,139.7010,90],[35.6610,139.7005,180],[35.6625,139.7000,270],[35.6640,139.6995,360],[35.6655,139.6990,450],[35.6670,139.6985,540],[35.6685,139.6975,630],[35.6695,139.6970,720]]',
'夜の表参道イルミネーション', '渋谷→表参道', 1.33);

-- Activity 4: 代々木公園朝ラン（15日前）
INSERT INTO activities (started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed) VALUES
(datetime('now', '-15 days', '+6 hours', '+30 minutes'), datetime('now', '-15 days', '+7 hours', '+15 minutes'), 7800, 2700,
'[[35.6715,139.6961,0],[35.6725,139.6975,60],[35.6738,139.6990,120],[35.6750,139.7005,180],[35.6742,139.7020,240],[35.6730,139.7010,300],[35.6720,139.6995,360],[35.6710,139.6980,420],[35.6700,139.6965,480],[35.6710,139.6950,540],[35.6720,139.6940,600],[35.6735,139.6950,660],[35.6715,139.6961,720]]',
'自己ベスト更新！', '代々木公園ロング', 2.89);

-- Activity 5: 新宿御苑散歩（10日前）
INSERT INTO activities (started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed) VALUES
(datetime('now', '-10 days', '+12 hours'), datetime('now', '-10 days', '+12 hours', '+22 minutes'), 1850, 1320,
'[[35.6852,139.7100,0],[35.6858,139.7110,90],[35.6865,139.7120,180],[35.6870,139.7130,270],[35.6862,139.7140,360],[35.6855,139.7135,450],[35.6848,139.7125,540],[35.6852,139.7115,630],[35.6852,139.7100,720]]',
'紅葉がきれい', '新宿御苑', 1.40);

-- Activity 6: 皇居ラン2回目（5日前）
INSERT INTO activities (started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed) VALUES
(datetime('now', '-5 days', '+7 hours'), datetime('now', '-5 days', '+7 hours', '+25 minutes'), 5200, 1500,
'[[35.6852,139.7528,0],[35.6868,139.7512,55],[35.6888,139.7498,110],[35.6903,139.7482,165],[35.6913,139.7462,220],[35.6908,139.7442,275],[35.6893,139.7428,330],[35.6873,139.7438,385],[35.6858,139.7452,440],[35.6843,139.7472,495],[35.6833,139.7492,550],[35.6838,139.7512,605],[35.6852,139.7528,660]]',
'タイム縮まった！', '皇居一周', 3.47);

-- Activity 7: 代々木公園→渋谷散歩（2日前）
INSERT INTO activities (started_at, ended_at, distance_m, duration_sec, polyline, memo, route_name, avg_speed) VALUES
(datetime('now', '-2 days', '+16 hours'), datetime('now', '-2 days', '+16 hours', '+48 minutes'), 4200, 2880,
'[[35.6715,139.6961,0],[35.6708,139.6955,90],[35.6698,139.6948,180],[35.6688,139.6942,270],[35.6678,139.6935,360],[35.6665,139.6940,450],[35.6652,139.6950,540],[35.6640,139.6960,630],[35.6628,139.6970,720],[35.6615,139.6985,810],[35.6600,139.6998,900],[35.6588,139.7010,990],[35.6580,139.7016,1080]]',
'夕焼けがきれいだった', '代々木公園→渋谷', 1.46);

-- ユーザー統計更新
UPDATE user_stats SET
  total_distance_m = (SELECT SUM(distance_m) FROM activities),
  total_duration_sec = (SELECT SUM(duration_sec) FROM activities),
  total_activities = (SELECT COUNT(*) FROM activities),
  activity_days = (SELECT COUNT(DISTINCT DATE(started_at)) FROM activities),
  first_activity_at = (SELECT MIN(started_at) FROM activities),
  last_activity_at = (SELECT MAX(started_at) FROM activities),
  updated_at = datetime('now')
WHERE id = 1;

-- マイルストーン（累計距離に基づいて自動挿入）
INSERT INTO milestones (type, threshold_m, reached_at, total_distance_m, total_duration_sec, total_activities, activity_id) VALUES
('distance_10km', 10000, datetime('now', '-15 days', '+7 hours'), 18640, 8520, 4, 4);

-- Note: distance_20km is not in MILESTONE_DEFS (next is 50km)
-- Removed invalid milestone entry
