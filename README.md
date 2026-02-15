# Journey Tracker

**「情緒 x 時間」で不可逆に育つ個人資産 — 歩みの記録アプリ**

行動の積み上げを"自信"として可視化し、他人比較をせず  
「やった自分 vs やらなかった自分」の世界線比較で自己効力感を高めるPWA。

---

## URLs

- **開発環境**: https://3000-iy3udtaqtne7teh8jv7a3-de59bda9.sandbox.novita.ai

---

## アーキテクチャ

```
┌──────────────────────────────────────────────────────┐
│  Browser (PWA)                                       │
│  ┌───────────────────────────────────────────────┐   │
│  │  IndexedDB (デバイスローカル = プライマリDB)    │   │
│  │  ├ activities   (記録データ)                   │   │
│  │  ├ milestones   (マイルストーン)               │   │
│  │  └ meta         (統計情報)                     │   │
│  └─────────┬─────────────────────────────────────┘   │
│            │ window.DB (db.js)                        │
│  ┌─────────┼─────────────────────────────────────┐   │
│  │  記録   │ マイマップ│ ふりかえり│ パラレル比較  │   │
│  │  (Home) │  (Map)   │ (Review) │  (Compare)   │   │
│  └────┬────┴────┬─────┴────┬─────┴────┬──────────┘   │
│       │Geolocation API     │ Leaflet + OSM           │
│       └─────────┬──────────┘                         │
│                 │ バックグラウンド同期（オプショナル） │
├─────────────────┼────────────────────────────────────┤
│  Cloudflare Workers (Hono)                           │
│  ┌──────────────┼──────────────────────────────┐     │
│  │  /api/sync   │  /api/stats                 │     │
│  │  /api/activities  │  /api/milestones        │     │
│  │  /api/review │  /api/heatmap               │     │
│  └──────────────┼──────────────────────────────┘     │
│                 │                                    │
│  Cloudflare D1 (SQLite) - バックアップ用             │
│  ┌──────────────┼──────────────────────────────┐     │
│  │  user_stats  │ activities │ milestones      │     │
│  └──────────────┴────────────┴────────────────┘      │
└──────────────────────────────────────────────────────┘
```

## データ保存方針

### Local-First (デバイスファースト)

| 項目 | 説明 |
|------|------|
| **プライマリDB** | IndexedDB (ブラウザ内蔵) |
| **読み書き** | 全て IndexedDB 経由 (`window.DB`) |
| **ネットワーク依存** | なし。完全オフライン動作 |
| **サーバー同期** | オプショナル。バックグラウンドで `/api/sync` |
| **データ管理** | エクスポート (JSON) / インポート / 全削除 |
| **永続性** | ブラウザストレージに保存。エクスポートで別デバイスへ移行可 |

### データの流れ

```
記録完了 → IndexedDB に直接保存 → 統計/マイルストーン再計算
                                  → バックグラウンドでサーバー同期（失敗OK）
```

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| ランタイム | Cloudflare Workers (Edge) |
| フレームワーク | Hono v4 |
| ローカルDB | IndexedDB (`db.js` ラッパー) |
| サーバーDB | Cloudflare D1 (SQLite) - バックアップ |
| 地図 | Leaflet 1.9 + OpenStreetMap |
| CSS | Tailwind CSS (CDN) |
| アイコン | Font Awesome 6 |
| PWA | Service Worker + Web App Manifest |
| ビルド | Vite + @hono/vite-build |

## 機能一覧

### 1. 記録機能 (Home Tab)
- Geolocation `watchPosition` によるリアルタイムGPS記録
- **5秒間隔 / 10m移動** のインテリジェントフィルタ
- 一時停止 / 再開 / 終了の完全コントロール
- 精度50m以上のノイズ自動フィルタ
- 距離はHaversine公式でリアルタイム計算
- **「デバイスに保存」** — ネットワーク不要で保存

### 2. 記録結果 (Save Modal)
- ルートをLeaflet地図上にプレビュー表示
- ルート名 + 一言メモの保存
- 保存時に自動でマイルストーン判定
- 到達時はパラレル比較のオーバーレイ演出

### 3. マイマップ (Map Tab)
- 全ルートを累積表示する「育つ地図」
- **通過頻度で線の太さ・濃さが変化**（点→線→面）
- フィルタ: 今週 / 今月 / 今年 / 全期間
- ~100mグリッドでのセグメント頻度集計

### 4. パラレル比較 (Compare Tab)
- **やった自分 vs やらなかった自分** の対比表示
- 累計距離 10km / 50km / 100km / 300km / 1000km の自動マイルストーン
- 到達時にフルスクリーンオーバーレイ演出
  - 「この差は、もう埋まらない。」
  - 「あなたは"前に進んだ"。」
- 次のマイルストーンまでのプログレスバー
- 到達履歴の一覧表示

### 5. ふりかえり (Review Tab)
- 週次 / 月次サマリー（距離・時間・回数）
- 日別距離のバーチャート
- 時間帯分布（24時間ヒストグラム）
- よく歩く時間帯のハイライト

### 6. データ管理 (Home Tab 内)
- **エクスポート**: 全データをJSON形式でダウンロード
- **インポート**: JSONファイルから復元（上書き）
- **全削除**: データ完全クリア（2段階確認）

### 7. PWA対応
- `manifest.json` でホーム画面追加対応
- Service Worker でオフラインキャッシュ（db.js含む）
- `apple-mobile-web-app-capable` メタタグ

## データモデル

### IndexedDB (プライマリ)

**activities** ストア:
```
id           (autoIncrement)
started_at   TEXT     -- 開始日時 ISO8601
ended_at     TEXT     -- 終了日時
distance_m   REAL     -- 距離 (m)
duration_sec INTEGER  -- 時間 (秒)
polyline     ARRAY    -- [[lat,lng,elapsedSec],...]
memo         TEXT     -- 一言メモ
route_name   TEXT     -- ルート名
avg_speed    REAL     -- 平均速度 m/s
max_speed    REAL     -- 最高速度 m/s
synced       INTEGER  -- 0=未同期, 1=同期済
```

**milestones** ストア (keyPath: type):
```
type              TEXT     -- 'distance_10km' 等
threshold_m       REAL     -- 基準値 (m)
reached_at        TEXT     -- 到達日時
total_distance_m  REAL     -- 到達時の累計距離
total_duration_sec INTEGER -- 到達時の累計時間
total_activities  INTEGER  -- 到達時の累計回数
```

**meta** ストア (keyPath: key):
```
key = 'user_stats'
total_distance_m, total_duration_sec, total_activities,
activity_days, first_activity_at, last_activity_at
```

## API仕様

| Method | Path | 説明 | 用途 |
|--------|------|------|------|
| GET | `/api/stats` | ユーザー統計 | サーバーDB参照（オプション） |
| GET | `/api/activities?period=&limit=` | 一覧 | サーバーDB参照 |
| POST | `/api/activities` | 記録保存 + マイルストーン判定 | サーバーDB直接保存 |
| PATCH | `/api/activities/:id` | メモ/ルート名更新 | - |
| GET | `/api/milestones` | マイルストーン一覧 | サーバーDB参照 |
| GET | `/api/review?period=` | ふりかえり集計 | サーバーDB参照 |
| GET | `/api/heatmap?period=` | マイマップ用ルートデータ | サーバーDB参照 |
| **POST** | **`/api/sync`** | **デバイスからバックグラウンド同期** | **IndexedDB→D1** |

## 画面構成 (IA)

```
┌─────────────────────────────┐
│                             │
│      Page Content           │
│  (IndexedDB から直接読み出し) │
│                             │
├─────────────────────────────┤
│  記録  │ 地図 │ 振返│ 比較  │  ← 下部タブバー
└─────────────────────────────┘
```

## ローカル開発

```bash
npm install
npm run db:migrate:local   # D1マイグレーション（サーバー側）
npm run db:seed            # D1サンプルデータ
npm run build              # Viteビルド
pm2 start ecosystem.config.cjs  # 開発サーバー
# → http://localhost:3000
```

## ディレクトリ構成

```
webapp/
├── src/
│   ├── index.tsx          # Hono app エントリ + SPA shell
│   ├── api.ts             # 全APIルート（同期含む）
│   └── renderer.tsx       # HTML shell (db.js → app.js 読込順)
├── public/static/
│   ├── db.js              # IndexedDB ラッパー (window.DB)
│   ├── app.js             # SPA controller (32KB)
│   ├── style.css          # PWA-first CSS
│   ├── sw.js              # Service Worker (v2, db.js キャッシュ対応)
│   ├── manifest.json      # PWA manifest
│   ├── icon.svg           # App icon
│   └── icon-{192,512}.png # PWA icons
├── migrations/
│   └── 0001_initial_schema.sql
├── seed.sql               # サンプルデータ（サーバーDB用）
├── ecosystem.config.cjs   # PM2設定
├── wrangler.jsonc         # Cloudflare設定
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 設計思想

### 自己効力感設計の3原則

1. **不可逆性**: 一度記録したデータは消えない。地図は育つ一方。時間が価値を生む。
2. **自己比較のみ**: 他人ランキングなし。「やった自分 vs やらなかった自分」だけ。
3. **情緒的演出**: マイルストーン到達時の対比表示で「止まらなかった事実」を祝う。

### Local-First 設計の理由

- **プライバシー**: 位置情報は個人データ。デバイスに閉じる方が安全
- **速度**: ネットワーク往復なしで全操作が瞬時
- **オフライン**: 電波の届かない場所でも記録・閲覧が可能
- **データ主権**: ユーザー自身がエクスポート/インポートでデータを完全管理

### 地図が育つ仕組み

- 1回目: 薄い細い線 → 同じ道を歩くたび **太く・濃く** なる
- セグメント頻度を ~100m グリッドで集計
- 通過1回=opacity 0.45, 2-3回=0.7, 4回+=1.0 & weight増加
- 「点→線→面」の視覚変化で蓄積を体感

## デプロイ状況

- **プラットフォーム**: Cloudflare Pages
- **ステータス**: 開発環境で動作中
- **データ保存**: デバイスローカル (IndexedDB) がプライマリ
- **最終更新**: 2026-02-15
