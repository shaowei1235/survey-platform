# デプロイ方式

<span class="status-chip">Infrastructure / Delivery</span>

## 三つの実行形態

同じ業務コードを、開発、旧デモ、AWS 本番で動かせるようにしています。現在の公開先は AWS です。

| 形態 | フロント | API | DB | 用途 |
| --- | --- | --- | --- | --- |
| Local | Vite :5173 / Next.js :3000 | Uvicorn :8000 | Docker PostgreSQL :5432 | 開発と自動テスト |
| VPS | nginx / Node service | systemd + Uvicorn | PostgreSQL | 手動 rollback / demo |
| AWS | Amplify Hosting | API Gateway + Lambda | Neon PostgreSQL | 現在の公開環境 |

## AWS 本番デプロイ

### Frontend

`admin/` と `client/` は別々の Amplify application として GitHub リポジトリへ接続しています。それぞれが必要なディレクトリだけをビルドし、公開 API URL を build-time environment variable で受け取ります。

```text
GitHub repository
  ├─ admin  → Amplify → survey-admin.liushaowei.dev
  └─ client → Amplify → survey-client.liushaowei.dev
```

Admin は Vite SPA の refresh fallback、Client は Next.js App Router の server / client-side API 呼び出しを実環境で確認しています。

### API

```text
API Gateway Regional REST API
  ↓ Lambda proxy integration
Lambda: app.handler.handler
  ↓ TLS / pooled connection
Neon PostgreSQL
```

Lambda package は Linux x86_64 用に再現可能な手順で作り、native dependency の import smoke test と ZIP サイズ確認を通してから更新します。API Gateway では通常 JSON に加え、Excel の binary / base64 response も検証しています。

### Database

Alembic はアプリ起動時に実行しません。schema change がある release だけ、Neon direct endpoint を注入した独立作業として `alembic upgrade head` を実行します。Lambda runtime には pooled endpoint を設定し、migration と request 処理の接続用途を分離しています。

## AI の本番方針

AI 分析機能は設計・実装・テスト対象としてコードに残していますが、公開環境は `LLM_ENABLED=false` です。アンケート作成、回答、認証、通常集計、匿名化、Excel 出力は AI なしで完結します。

## VPS の位置付け

旧 VPS の workflow は `workflow_dispatch` のみです。`main` push では起動せず、必要な場合に人が明示的に実行する rollback / demo 経路として残しています。

## ロールバック

- Frontend: Amplify の直前の正常 build または Git revision を再デプロイする。
- API: 直前の Lambda artifact へ戻し、CloudWatch で error を確認する。
- Database: 後方互換 migration を基本とし、破壊的変更はデータ退避と別 release に分ける。
- Configuration: コードと分離した environment variable として戻す。
- Acceptance: `/health`、login、survey list、submit、analytics、Excel を再確認する。

[CI/CD へ進む →](/infrastructure/cicd)
