# 社内アンケート基盤

社内向けの **従業員満足度（ES）調査** を、作成・公開・回答・集計まで扱う Web アプリケーションです。汎用フォーム SaaS ではなく、日本企業の人事運用（組織階層・少人数部署のプライバシー）に寄せて実装しています。求職用の個人開発ポートフォリオです。

## 公開環境・技術ドキュメント

- [Admin](https://survey-admin.liushaowei.dev)
- [Client](https://survey-client.liushaowei.dev)
- [公開ドキュメントのソース](docs_public/index.md)

公開環境は Amplify Hosting → API Gateway → Lambda → Neon PostgreSQL で稼働しています。技術ドキュメントもアプリケーションと同じリポジトリで管理し、要件、設計、実装、テスト、AWS 運用をコード変更と一緒に追跡します。

- **セルマスク** — 回答数が 5 未満の集計セルは `非開示（n<5）` と出し、個人が特定されないようにします。
- **組織ロールアップ** — 部の平均点・回答状況は、配下の課を含めて集計します。
- **日本語の ES 運用** — 下書き / 公開中 / 終了のライフサイクル、人事が公開して従業員が回答する流れを前提にしています。

## デモで見てほしい点

シード後、管理画面は **人事企画 `E-HR`**、回答画面は **開発一課 `E-DEV-02`** などで確認できます。ダッシュボードと固定分析は、回答数が最も多いアンケートを初期選択します（同数なら終了・公開日時の新しいもの）。デモ調査は `2026年度 従業員満足度調査（デモ）` です。

1. **`n<5` はバグではない** — 第一営業課は回答 5 件で平均点が出ます。第二営業課・人事部は 3 件のため `非開示（n<5）` になります。開発部はデモ回答が 0 件なので、マスクではなく **「まだ回答がありません」** と出ます。
2. **部→課のロールアップ** — 営業部は第一・第二営業課を合算した 8 件として開示されます。

<img src="screenshots/dashboard-mask.png" alt="分析ダッシュボード。人事部は非開示（n&lt;5）、営業部は部へロールアップ。同じ画面からマスク済み Excel を出力できます" width="800" />

3. **マスク済み Excel** — 上のクロス集計を、画面と同じ非開示ルールで `.xlsx` 出力します（表右上の「Excelをダウンロード」）。
4. **未回答数** — 部署別の対象人数・回答済・未回答を出します。氏名は出しません。対象が 5 人未満の行は未回答数も非開示です。

<img src="screenshots/dashboard-completion.png" alt="部署別の回答状況。氏名は出さず、対象が 5 人未満の行は件数を非開示にします" width="800" />

5. **ライフサイクル** — 一覧・編集から公開 / 終了できます。削除は下書きのみです。シードには下書き・公開中・終了が混在します。

<img src="screenshots/survey-list.png" alt="アンケート一覧。下書き・公開中・終了と回答数" width="800" />

<img src="screenshots/survey-create.png" alt="アンケート編集。部品の追加、プレビュー、保存、公開、下書きの削除" width="800" />

回答画面（所属はマスタから紐づき、回答者は部門・職級・年代を入力しません）:

<img src="screenshots/client-fill.png" alt="従業員の回答画面。進捗とリッカート設問" width="800" />

固定分析（`/analytics/intent`）は任意機能です。`LLM_API_KEY` が空でも、ログイン → 公開 / 回答 → ダッシュボードのマスクと Excel までは動きます。AWS Production では `LLM_ENABLED=false` とし、admin の `VITE_LLM_ENABLED` を未設定（または `false`）にして入口を非表示にします。

## 技術スタック

| 層 | 内容 |
| --- | --- |
| 管理画面 | Vite 6 + React 18 + TypeScript + Ant Design 5（ポート 5173） |
| 回答画面 | Next.js 15 + React 19 + TypeScript + Ant Design 5（ポート 3000） |
| API | FastAPI + SQLAlchemy 2 + Alembic + JWT（ポート 8000） |
| DB | Neon PostgreSQL（local は PostgreSQL 16） |
| AWS | Amplify Hosting + API Gateway + Lambda + CloudWatch |

認証は社員番号 + パスワードです。管理画面・回答画面とも `/api` を API へプロキシします。UI の既定言語は日本語です。

## 構成

```mermaid
flowchart LR
  Admin["Admin / Amplify"] --> APIGW["API Gateway"]
  Client["Client / Amplify"] --> APIGW
  APIGW --> Lambda["Lambda / FastAPI"]
  Lambda --> DB["Neon PostgreSQL"]
```

| ディレクトリ | 役割 |
| --- | --- |
| `admin/` | 人事・経営層・部門長向け。一覧・編集・ダッシュボード・固定分析、部門 / 従業員マスタ |
| `client/` | 従業員向け回答。公開中かつ未回答のアンケートのみ表示 |
| `api/` | REST API（`/api/v1`）、集計・マスク・Excel、任意の LLM 分析 |
| `docs_public/` | VitePress による公開技術ドキュメント |
| `docker-compose.yml` | Postgres 16 のみ |

## ローカル起動

前提: Docker、Python 3、Node.js / npm。API は `api/`、画面はそれぞれ `admin/` と `client/` で起動します。

### 1. PostgreSQL

リポジトリルートで:

```bash
docker compose up -d db
```

接続先は `postgresql+psycopg://survey:survey@127.0.0.1:5432/survey` です（Compose のローカル用アカウント）。

### 2. API

```bash
cd api
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/alembic upgrade head
.venv/bin/python scripts/seed.py
.venv/bin/python scripts/seed_demo_responses.py
.venv/bin/uvicorn app.main:app --reload --port 8000
```

`seed.py` のあとに `seed_demo_responses.py` を実行してください。デモ調査とクロス集計用の回答が入ります。ヘルスチェックは `http://127.0.0.1:8000/health` です。

### 3. 管理画面

別ターミナル:

```bash
cd admin
npm install
npm run dev
```

[http://localhost:5173](http://localhost:5173)

### 4. 回答画面

別ターミナル:

```bash
cd client
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)

## 環境変数

`api/.env.example` を `api/.env` にコピーします。アプリは `api/.env` を読みます。

| 変数 | 例 / 既定 | 説明 |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql+psycopg://survey:survey@127.0.0.1:5432/survey` | Postgres |
| `JWT_SECRET` | `change-me-to-at-least-32-characters-long` | JWT 署名。ローカル用プレースホルダです |
| `APP_RUNTIME` | `local` | `lambda` の場合は Lambda 向け DB 接続方式を使用 |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | 許可 origin のカンマ区切り一覧 |
| `LLM_ENABLED` | ローカルでは既定 `true`、Lambda では既定 `false` | 固定分析の backend feature flag |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | 固定分析用。キーが空なら未使用 |
| `LLM_API_KEY` | （空） | 空のままでデモの主経路は動きます |
| `LLM_MODEL` | `gpt-5-nano-2025-08-07` | 固定分析用 |
| `MIN_CELL_N` | `5`（コード既定。`.env.example` には未記載） | セル非開示の下限 |

固定分析を試す場合のみ `LLM_API_KEY`（必要なら `LLM_BASE_URL` / `LLM_MODEL`）を設定してください。

画面側の環境変数は `admin/.env.example` と `client/.env.example` を参照してください。本番 build では admin に `VITE_API_BASE=https://api.example.com/api/v1`、client に `NEXT_PUBLIC_API_BASE=https://api.example.com/api/v1` を設定します。未設定のローカル開発では、従来どおり各 dev server の `/api/v1` proxy / rewrite を使います。

Lambda の handler は `app.handler.handler` です。migration と seed は handler やアプリ起動時には実行されず、デプロイ前の独立した手順として実行します。

## デモアカウント

ログインは **社員番号** です。パスワードはシード共通の `Init#pass1` です。

**デモ専用です。本番では使わないでください。**

| 社員番号 | 氏名 | 所属 | 主な権限 | 向いている画面 |
| --- | --- | --- | --- | --- |
| `E-HR` | 人事企画 | 人事部 | 人事企画 | 管理（作成・公開・終了・削除、分析） |
| `E-SALES-M` | 営業部長 | 営業部 | 部門長（営業部） | 管理（自部門スコープの分析） |
| `E-DEV-M` | 開発部長 | 開発部 | 部門長（開発部） | 管理（自部門スコープ。デモ回答 0 件） |
| `E-SALES-01` | 高橋 | 第一営業課 | 従業員 | 回答（デモ調査は回答済み） |
| `E-DEV-02` | 井上 | 開発一課 | 従業員 | 回答（デモ調査は未回答） |
| `E-DEV-03` | 木村 | 開発一課 | 従業員 | 回答（デモ調査は未回答） |

同じシードに `E-ADMIN`（システム管理者）、`E-EXEC`（経営層）、`E-HR-01`、営業 `E-SALES-01`〜`08`、開発 `E-DEV-01`〜`10` もあります。一般従業員は管理画面に入れず、回答画面を使います。

デモ調査の回答は営業課と人事のみです。開発アカウントで回答すると、空だった開発部の集計が変わります。

### 組織（シード）

```
全社
├── 経営
├── 人事部
├── 営業部
│   ├── 第一営業課
│   └── 第二営業課
└── 開発部
    ├── 開発一課
    └── 開発二課
```

シードのアンケート例: `2026年度 従業員満足度調査（デモ）`（公開中・デモ回答あり）、ほかに下書き・公開中・終了が混在します。

## 主な画面

### 管理（`admin/`）

| パス | 内容 |
| --- | --- |
| `/login` | 社員番号でログイン |
| `/surveys` | 一覧。人事企画は公開・終了、下書き削除 |
| `/surveys/:id/edit` | 編集。公開中・終了後は閲覧中心 |
| `/analytics/dashboard` | 部署×設問の平均、未回答数、マスク済み Excel |
| `/analytics/intent` | 固定分析（LLM。キーが必要） |

部門（`/org/departments`）と従業員（`/org/users`）のマスタもあります。

### 回答（`client/`）

| パス | 内容 |
| --- | --- |
| `/login` | 社員番号でログイン |
| `/surveys` | 公開中かつ未回答の一覧 |
| `/surveys/[id]` | 回答。部門・職級・年代はマスタから紐づき、回答者が入力しません |

## スコープ外

次は実装していません。

- AI によるアンケート自動生成
- NL2SQL / Text-to-SQL、RAG
- SSO、外部 IdP
- 画面上の言語切替
- 汎用フォームビルダーのマーケットプレイス

## ライセンス

リポジトリに LICENSE ファイルはありません。個人開発のポートフォリオ用途です。
