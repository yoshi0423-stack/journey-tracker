# Journey Tracker

**「性格 x 情緒 x 時間」で不可逆に育つ個人資産 — 歩みの記録アプリ**

Big Five + MBTI の性格診断を組み込み、行動の積み上げを"自信"として可視化。  
使うほどカスタマイズが進化し、あなた専用の習慣化アプリになる PWA。

---

## URLs

- **開発環境**: https://3000-iy3udtaqtne7teh8jv7a3-de59bda9.sandbox.novita.ai

---

## アーキテクチャ

```
┌──────────────────────────────────────────────────────────┐
│  Browser (PWA)                                           │
│                                                          │
│  ┌─ IndexedDB ─────────────────────────────────────┐     │
│  │  activities (記録)                               │     │
│  │  milestones (節目)                               │     │
│  │  meta       (統計)                               │     │
│  │  profile    (性格診断・レベル・進化ログ) ← NEW   │     │
│  └────────────┬────────────────────────────────────┘     │
│               │ window.DB (db.js v2)                     │
│               │ window.Personality (personality.js)      │
│  ┌────────────┼────────────────────────────────────┐     │
│  │ 記録 │ 地図 │ 振返り │ 比較 │ 自分(プロフィール)│     │
│  └──────┴──────┴────────┴──────┴──────────────────┘     │
│               │ バックグラウンド同期（オプショナル）      │
├───────────────┼──────────────────────────────────────────┤
│  Cloudflare Workers (Hono)  │  Cloudflare D1 (backup)   │
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
| E (外向性) ≥ 4 → E | I/E | 外向 vs 内向 |
| O (開放性) ≥ 4 → N | S/N | 直感 vs 感覚 |
| A (協調性) ≥ 4 → F | T/F | 感情 vs 思考 |
| C (計画性) ≥ 4 → J | J/P | 判断 vs 知覚 |

### 16タイプ別カスタマイズ例

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
| 記録 | fa-circle-dot | ダッシュボード + GPS記録 + データ管理 |
| 地図 | fa-map | マイマップ（累積ルート表示） |
| 振返り | fa-calendar-days | 週次/月次サマリー + 性格インサイト |
| 比較 | fa-code-compare | パラレル比較 + マイルストーン |
| 自分 | fa-user-gear | 性格結果 + レベル + 進化ログ + 再診断 |

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| ランタイム | Cloudflare Workers (Edge) |
| フレームワーク | Hono v4 |
| ローカルDB | IndexedDB v2 (profile store追加) |
| 性格エンジン | personality.js (Big Five + MBTI) |
| サーバーDB | Cloudflare D1 (バックアップ) |
| 地図 | Leaflet 1.9 + OpenStreetMap |
| CSS | Tailwind CSS (CDN) |
| アイコン | Font Awesome 6 |
| PWA | Service Worker v3 |
| ビルド | Vite |

## ディレクトリ構成

```
webapp/
├── src/
│   ├── index.tsx          # Hono app エントリ
│   ├── api.ts             # 全APIルート (/api/sync含む)
│   └── renderer.tsx       # HTML shell (db→personality→app)
├── public/static/
│   ├── db.js              # IndexedDB v2 (profile対応)
│   ├── personality.js     # 性格エンジン (Big5+MBTI+パーソナライズ)
│   ├── app.js             # SPA controller v3 (47KB)
│   ├── style.css          # PWA-first CSS + onboarding
│   ├── sw.js              # Service Worker v3
│   ├── manifest.json      # PWA manifest
│   └── icon-{svg,192,512} # アイコン
├── migrations/
│   └── 0001_initial_schema.sql
├── seed.sql
├── ecosystem.config.cjs
├── wrangler.jsonc
└── package.json
```

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

## デプロイ状況

- **プラットフォーム**: Cloudflare Pages
- **ステータス**: 開発環境で動作中
- **データ保存**: デバイスローカル (IndexedDB) がプライマリ
- **最終更新**: 2026-02-15
