# 🚶‍♂️ Journey Tracker

**時間とともに深まる、あなただけの歩みの資産**

位置情報を使って歩行・走行距離を記録し、使えば使うほど蓄積される情緒的価値を持つパーソナル記録アプリです。

---

## 🌟 プロジェクト概要

- **名称**: Journey Tracker
- **コンセプト**: 時間との結びつき × 不可逆的な蓄積 = 情緒的ベネフィット
- **目的**: 日々の移動を記録し、自分だけの軌跡として資産化する

### 📍 現在の公開URL

- **開発環境**: https://3000-iy3udtaqtne7teh8jv7a3-de59bda9.sandbox.novita.ai
- **APIエンドポイント**: `/api/stats`, `/api/activities`, `/api/milestones`

---

## ✨ 完成済み機能

### ✅ コア機能
- **リアルタイム位置情報トラッキング** - Geolocation APIを使用した高精度GPS記録
- **アクティビティタイプ選択** - ウォーキング、ランニング、サイクリング
- **距離・時間自動計算** - Haversine公式による正確な距離計測
- **データ永続化** - Cloudflare D1データベースへの記録保存

### 📊 可視化機能
- **統計ダッシュボード** - 累計距離、活動日数、累計時間、継続日数
- **週間活動グラフ** - Chart.jsによる視覚的な週次集計
- **アクティビティ履歴** - 過去の記録一覧表示

### 🏆 情緒的ベネフィット要素
- **マイルストーンシステム** - 10km、20km、50km等の達成記録
- **継続日数カウント** - 初回活動からの経過日数表示
- **記念日記録** - アクティビティ回数に応じた祝福メッセージ
- **時間軸との結びつき** - 不可逆的に蓄積される自分だけの履歴

---

## 🗄️ データアーキテクチャ

### データモデル

#### 1. **users** - ユーザー情報
```sql
- id: ユーザーID
- username: ユーザー名
- created_at: 登録日時
- first_activity_date: 初回活動日
- total_distance: 累計距離（km）
- total_duration: 累計時間（秒）
- activity_days: 活動日数
```

#### 2. **activities** - アクティビティ記録
```sql
- id: アクティビティID
- user_id: ユーザーID
- activity_type: タイプ（walk/run/cycle）
- distance: 距離（km）
- duration: 時間（秒）
- start_time: 開始時刻
- end_time: 終了時刻
- created_at: 記録日時
```

#### 3. **location_points** - GPS軌跡
```sql
- id: ポイントID
- activity_id: アクティビティID
- latitude: 緯度
- longitude: 経度
- accuracy: 精度（m）
- timestamp: 記録時刻
```

#### 4. **milestones** - マイルストーン
```sql
- id: マイルストーンID
- user_id: ユーザーID
- milestone_type: タイプ（total_distance/activity_count）
- milestone_value: 達成値
- achieved_at: 達成日時
- title: タイトル
- description: 説明
```

#### 5. **frequent_places** - 頻出スポット（将来拡張用）
```sql
- place_name: 場所名
- latitude/longitude: 座標
- visit_count: 訪問回数
- first_visit/last_visit: 初回/最終訪問日時
```

### ストレージサービス
- **Cloudflare D1**: SQLiteベースの永続データベース
- **ローカル開発**: `.wrangler/state/v3/d1` にローカルSQLite自動生成

---

## 🎯 API仕様

### GET `/api/stats`
統計情報取得（ユーザー統計、最近のアクティビティ、週間統計、マイルストーン）

### GET `/api/activities`
アクティビティ一覧取得（ページネーション対応）

### GET `/api/activities/:id`
アクティビティ詳細取得（GPS軌跡含む）

### POST `/api/activities`
アクティビティ記録保存（位置情報配列、距離、時間等）

### GET `/api/milestones`
マイルストーン一覧取得

---

## 📖 使い方

### 1. トラッキング開始
1. 「トラッキング開始」ボタンをクリック
2. アクティビティタイプを選択（ウォーキング/ランニング/サイクリング）
3. ブラウザの位置情報許可を承認
4. リアルタイムで距離・時間が記録される

### 2. トラッキング停止
1. 「トラッキング停止」ボタンをクリック
2. 自動的にデータベースに保存される
3. マイルストーン達成時は祝福メッセージが表示される

### 3. 履歴確認
- ダッシュボードで累計統計を確認
- 週間グラフで活動パターンを可視化
- 最近のアクティビティ一覧で過去の記録を振り返る
- マイルストーン一覧で達成記録を確認

---

## 🛠️ 技術スタック

### フロントエンド
- **HTML/CSS/JavaScript** - バニラJSによるシンプル実装
- **TailwindCSS** - ユーティリティファーストCSSフレームワーク
- **Chart.js** - データ可視化ライブラリ
- **Axios** - HTTPクライアント
- **Day.js** - 日時処理ライブラリ
- **Font Awesome** - アイコンフォント

### バックエンド
- **Hono** - 軽量Webフレームワーク
- **TypeScript** - 型安全な開発
- **Cloudflare Workers** - エッジランタイム
- **Cloudflare D1** - SQLiteベース分散データベース

### 開発ツール
- **Vite** - ビルドツール
- **Wrangler** - Cloudflare CLI
- **PM2** - プロセスマネージャー（開発環境）

---

## 🚀 デプロイ方法

### ローカル開発
```bash
# 依存関係インストール
npm install

# データベースマイグレーション
npm run db:migrate:local

# サンプルデータ投入
npm run db:seed

# ビルド
npm run build

# PM2で開発サーバー起動
pm2 start ecosystem.config.cjs

# 動作確認
curl http://localhost:3000
```

### Cloudflare Pagesへのデプロイ
```bash
# D1データベース作成（初回のみ）
npx wrangler d1 create webapp-production

# wrangler.jsonc のdatabase_idを更新

# 本番マイグレーション実行
npm run db:migrate:prod

# デプロイ
npm run deploy:prod
```

---

## 📂 プロジェクト構成

```
webapp/
├── src/
│   ├── index.tsx          # メインアプリケーション（API + フロントエンド）
│   └── renderer.tsx       # HTMLレンダラー
├── public/static/
│   ├── app.js             # フロントエンドロジック（位置情報トラッキング）
│   └── style.css          # カスタムCSS
├── migrations/
│   └── 0001_initial_schema.sql  # データベーススキーマ
├── seed.sql               # サンプルデータ
├── ecosystem.config.cjs   # PM2設定
├── wrangler.jsonc         # Cloudflare設定
├── package.json           # 依存関係とスクリプト
└── README.md              # このファイル
```

---

## 🔮 今後の拡張案

### 未実装機能
- 📍 **地図表示**: GPS軌跡のマップ可視化（Leaflet.js / Mapbox）
- 🏃 **リアルタイムペース計算**: 現在のペース表示
- 📈 **詳細統計**: 月次・年次レポート、ヒートマップ
- 🎖️ **バッジシステム**: 特別な条件達成時のバッジ授与
- 📸 **写真記録**: アクティビティに写真を添付
- 🌤️ **天気情報統合**: 記録時の天候データ保存
- 👥 **ソーシャル機能**: 友人との記録共有
- 🔔 **リマインダー**: 定期的な運動促進通知
- 🎵 **音声フィードバック**: トラッキング中の音声ガイド
- 🏆 **チャレンジモード**: 週次・月次チャレンジ設定

### 推奨される次のステップ
1. **地図表示機能の追加** - GPS軌跡の可視化で体験価値向上
2. **エクスポート機能** - GPXファイル出力でデータポータビリティ
3. **PWA化** - オフライン対応とアプリインストール
4. **ダークモード** - UI/UX改善
5. **多言語対応** - 国際化対応

---

## 📊 デプロイ状況

- **プラットフォーム**: Cloudflare Pages
- **ステータス**: ✅ ローカル開発環境で動作中
- **最終更新**: 2026-02-15

---

## 🎉 まとめ

Journey Trackerは、単なる記録アプリではなく、**時間とともに深まる情緒的資産**を構築するアプリケーションです。

- ✅ 使えば使うほど蓄積されるデータ
- ✅ 時間経過とともに深まる文脈
- ✅ 自分だけの履歴という不可逆的な価値
- ✅ マイルストーンによる達成感と継続モチベーション

**あなたの歩みを記録し、時間とともに育てていきましょう！** 🚶‍♂️✨
