# Journey Tracker

**「性格 x 情緒 x 時間」で不可逆に育つ個人資産 — 歩みの記録アプリ**

Big Five + MBTI の性格診断を組み込み、行動の積み上げを"自信"として可視化。  
使うほどカスタマイズが進化し、あなた専用の習慣化アプリになる PWA。

---

## URLs

- **開発環境**: https://3000-iy3udtaqtne7teh8jv7a3-de59bda9.sandbox.novita.ai

---

## 完了済み機能

- [x] 10問の Big Five 性格診断（TIPI-J）
- [x] MBTI 16タイプ自動判定 + テーマカラー・メッセージ全切替
- [x] GPS リアルタイム記録（5秒間隔、10m移動フィルタ、精度50m以下のみ）
- [x] IndexedDB v2 によるローカルファーストデータ管理
- [x] D1 (SQLite) サーバーサイドバックアップ同期 (`/api/sync`)
- [x] マイマップ（累積ルートヒートマップ + 期間フィルタ）
- [x] ふりかえり（週次/月次集計 + 時間帯分布 + 日別距離）
- [x] パラレル比較（"やった自分 vs やらなかった自分"）
- [x] マイルストーン (10km/50km/100km/300km/1000km) 自動判定 + オーバーレイ演出
- [x] レベルシステム（Lv.1〜8、記録回数ベース、進化ログ記録）
- [x] データ管理 — エクスポート(JSON)、インポート、2段階確認付き全削除
- [x] PWA (Service Worker v3、マニフェスト、オフラインキャッシュ)
- [x] 性格プロフィール画面（Big Five バーグラフ、レベル、強み/注意点、進化ログ、再診断）
- [x] トースト通知（データ操作時の非侵襲フィードバック）

## 未実装機能

- [ ] Cloudflare Pages へのプロダクションデプロイ
- [ ] カスタムドメイン設定
- [ ] プッシュ通知（習慣化リマインダー）
- [ ] 画像添付（記録時のスナップショット）
- [ ] 複数デバイス間の完全双方向同期

## API エンドポイント

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/stats` | 累計統計 |
| GET | `/api/activities?period=all&limit=200` | アクティビティ一覧 (period: week/month/year/all) |
| GET | `/api/activities/:id` | アクティビティ詳細 |
| POST | `/api/activities` | 新規記録保存 + マイルストーン判定 |
| PATCH | `/api/activities/:id` | メモ/ルート名更新 |
| GET | `/api/milestones` | マイルストーン一覧 |
| GET | `/api/milestones/latest-unchecked` | 未チェックマイルストーン |
| GET | `/api/review?period=week` | ふりかえりデータ (period: week/month) |
| GET | `/api/heatmap?period=all` | ヒートマップ用ポリライン |
| POST | `/api/sync` | デバイスからのバックグラウンド同期 |

## アーキテクチャ

```
┌──────────────────────────────────────────────────────────┐
│  Browser (PWA)                                           │
│                                                          │
│  ┌─ IndexedDB v2 ────────────────────────────────────┐   │
│  │  activities  (記録)                                │   │
│  │  milestones  (節目)                                │   │
│  │  meta        (統計)                                │   │
│  │  profile     (性格診断・レベル・進化ログ)          │   │
│  └────────────┬─────────────────────────────────────┘   │
│               │ window.DB (db.js v2)                     │
│               │ window.Personality (personality.js)       │
│  ┌────────────┼──────────────────────────────────────┐   │
│  │ 記録 │ 地図 │ 振返り │ 比較 │ 自分(プロフィール) │   │
│  └──────┴──────┴────────┴──────┴────────────────────┘   │
│               │ バックグラウンド同期（オプショナル）       │
├───────────────┼──────────────────────────────────────────┤
│  Cloudflare Workers (Hono)  │  Cloudflare D1 (backup)    │
└───────────────┴──────────────────────────────────────────┘
```

## 性格パーソナライズ機能

### フロー

```
初回起動 → 10問の性格診断 (Big Five TIPI-J)
        → Big Five 5次元スコア算出 (E, A, C, N, O: 各1-7)
        → MBTI 4文字コード自動判定 (16タイプ)
        → UIテーマカラー / メッセージ / 演出が全て変化
        → 使うほどレベルアップ → カスタマイズが進化
```

### Big Five → MBTI マッピング

| Big Five次元 | MBTI軸 | 閾値 |
|-------------|--------|------|
| E (外向性) >= 4 → E | I/E | 外向 vs 内向 |
| O (開放性) >= 4 → N | S/N | 直感 vs 感覚 |
| A (協調性) >= 4 → F | T/F | 感情 vs 思考 |
| C (計画性) >= 4 → J | J/P | 判断 vs 知覚 |

### 16タイプ別カスタマイズ

| MBTI | ラベル | 習慣スタイル | テーマカラー |
|------|--------|-------------|-------------|
| INTJ | 戦略家 | 長期目標→逆算 | #6366f1 |
| INFP | 仲介者 | 感情に寄り添う | #ec4899 |
| ENTJ | 指揮官 | 征服型 | #dc2626 |
| ESFP | エンターテイナー | 楽しさ重視 | #e879f9 |
| ISTJ | 管理者 | システマチック | #475569 |
| ... | (全16タイプ対応) | ... | ... |

### パーソナライズされる要素

- **テーマカラー**: 性格タイプ別のグラデーション
- **ホーム画面メッセージ**: 性格に応じた挨拶・励まし
- **記録完了メッセージ**: 16種類のスタイル別コメント
- **マイルストーン演出**: 性格に響く祝福メッセージ
- **記録開始テキスト**: モチベーションスタイル別
- **ふりかえりインサイト**: Big Five スコアに基づく個別アドバイス
- **リスクアラート**: 性格の弱点に基づく習慣化ヒント
- **地図のルート色**: テーマカラー連動

### レベルシステム（使うほど進化）

| Lv | 記録回数 | 称号 | 解放される機能 |
|----|---------|------|--------------|
| 1 | 0回 | はじめの一歩 | 基本テーマカラー |
| 2 | 3回 | 歩き始めた人 | 性格メッセージ |
| 3 | 7回 | 習慣の芽 | ふりかえりインサイト |
| 4 | 14回 | 継続する人 | リスクアラート |
| 5 | 25回 | 習慣の木 | 高度なパーソナライズ |
| 6 | 40回 | 歩みの達人 | 全機能解放 |
| 7 | 60回 | 道の開拓者 | レジェンドバッジ |
| 8 | 100回 | 伝説の旅人 | 究極カスタマイズ |

## 画面構成 (5タブ)

| タブ | アイコン | 内容 |
|------|---------|------|
| 記録 | fa-circle-dot | ダッシュボード + GPS記録 + データ管理(エクスポート/インポート/全削除) |
| 地図 | fa-map | マイマップ（累積ルートヒートマップ + 期間フィルタ） |
| 振返り | fa-calendar-days | 週次/月次サマリー + 性格インサイト + 日別距離チャート + 時間帯分布 |
| 比較 | fa-code-compare | パラレル比較 + マイルストーン一覧 + 次のマイルストーン進捗 |
| 自分 | fa-user-gear | 性格結果(Big Five + MBTI) + レベル + 進化ログ + 再診断 + 全削除 |

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| ランタイム | Cloudflare Workers (Edge) |
| フレームワーク | Hono v4 |
| ローカルDB | IndexedDB v2 (profile store 追加) |
| 性格エンジン | personality.js (Big Five + MBTI + パーソナライズ) |
| サーバーDB | Cloudflare D1 (バックアップ用) |
| 地図 | Leaflet 1.9 + OpenStreetMap |
| CSS | Tailwind CSS (CDN) + カスタム style.css |
| アイコン | Font Awesome 6 |
| PWA | Service Worker v3 + Web App Manifest |
| ビルド | Vite + @hono/vite-build |

## データモデル

### IndexedDB (ローカル - プライマリ)

| ストア | キー | 内容 |
|--------|------|------|
| activities | id (auto) | 記録データ (距離, 時間, ポリライン, メモ, synced フラグ) |
| milestones | type | 到達マイルストーン (閾値, 到達時の累計値) |
| meta | key | 統計値 (user_stats) |
| profile | key | 性格プロフィール (personality) + 進化ログ (evolution_log) |

### Cloudflare D1 (サーバー - バックアップ)

| テーブル | 内容 |
|----------|------|
| user_stats | 累計統計 (距離, 時間, 回数, 日数) |
| activities | 全記録 (started_at, distance_m, duration_sec, polyline, memo, route_name) |
| milestones | マイルストーン到達記録 |

## ディレクトリ構成

```
webapp/
├── src/
│   ├── index.tsx          # Hono app エントリ
│   ├── api.ts             # 全APIルート (/api/sync 含む)
│   └── renderer.tsx       # HTML shell (db → personality → app)
├── public/static/
│   ├── db.js              # IndexedDB v2 (profile 対応)
│   ├── personality.js     # 性格エンジン (Big5 + MBTI + パーソナライズ)
│   ├── app.js             # SPA controller v3 (5タブ + オンボーディング + トースト)
│   ├── style.css          # PWA-first CSS + onboarding + toast
│   ├── sw.js              # Service Worker v3
│   ├── manifest.json      # PWA manifest
│   └── icon-{svg,192,512} # アイコン
├── migrations/
│   └── 0001_initial_schema.sql
├── seed.sql
├── ecosystem.config.cjs
├── wrangler.jsonc
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## ユーザーガイド

1. **初回起動**: 10問の性格診断に回答（各問1-7段階のリッカート尺度）
2. **診断結果表示**: Big Five プロフィール + MBTI タイプが判定される
3. **記録タブ**: 「記録をはじめる」ボタンでGPS追跡開始 → 一時停止/終了 → ルート名・メモ付きで保存
4. **地図タブ**: 全ルートをヒートマップ表示（期間フィルタ可能）
5. **振返りタブ**: 今週/今月の集計データ・チャートを確認
6. **比較タブ**: 累計距離と次のマイルストーンへの進捗を確認
7. **自分タブ**: 性格結果・レベル・進化ログ確認、再診断・全データ削除
8. **データ管理**: 記録タブ下部でJSON エクスポート/インポート/全削除が可能

## ローカル開発

```bash
npm install
npm run db:migrate:local
npm run db:seed
npm run build
pm2 start ecosystem.config.cjs
# → http://localhost:3000
# → 初回は10問の性格診断画面が表示される
```

## 推奨する次のステップ

1. `setup_cloudflare_api_key` + `wrangler pages deploy` でプロダクションデプロイ
2. Tailwind CSS を PostCSS ビルドに移行（CDN警告解消）
3. プッシュ通知で習慣化リマインダー機能追加
4. 記録時の写真添付機能
5. レベル解放時のアニメーション強化

## デプロイ状況

- **プラットフォーム**: Cloudflare Pages
- **ステータス**: 開発環境で動作中 (ローカルD1)
- **データ保存**: デバイスローカル (IndexedDB) がプライマリ、D1はバックアップ
- **最終更新**: 2026-02-15
