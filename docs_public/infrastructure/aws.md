# AWS 構成

<span class="status-chip">Infrastructure / Live on AWS</span>

## 稼働中の構成

公開環境は、フロントエンドを AWS Amplify Hosting、API を Amazon API Gateway と AWS Lambda、データベースを Neon PostgreSQL に分離しています。低トラフィックのポートフォリオで常時起動リソースを持たず、各層を独立して更新できる構成です。

<div class="arch-diagram" role="img" aria-label="Amplify Hosting の管理画面と回答画面が API Gateway と Lambda を経由して Neon PostgreSQL に接続する AWS 本番構成">
  <div class="arch-group">
    <div class="arch-node"><strong>Amplify Hosting</strong><span>admin / Vite</span></div>
    <div class="arch-node"><strong>Amplify Hosting</strong><span>client / Next.js</span></div>
  </div>
  <div class="arch-arrow">HTTPS →</div>
  <div class="arch-group">
    <div class="arch-node"><strong>API Gateway</strong><span>Regional REST API / CORS</span></div>
    <div class="arch-node"><strong>AWS Lambda</strong><span>FastAPI + Mangum</span></div>
  </div>
  <div class="arch-arrow">TLS →</div>
  <div class="arch-group">
    <div class="arch-node"><strong>Neon PostgreSQL</strong><span>pooled endpoint</span></div>
    <div class="arch-node"><strong>CloudWatch</strong><span>logs / metrics / alarms</span></div>
  </div>
</div>

## サービスごとの責務

| サービス | 本番での役割 | 主な設定 |
| --- | --- | --- |
| Amplify Hosting | Admin と Client のビルド・配信 | GitHub 連携、独自ドメイン、公開 API URL |
| API Gateway | HTTPS の公開入口 | Regional REST API、Lambda proxy、CORS、binary response |
| Lambda | FastAPI の実行 | Python 3.13、x86_64、512 MB、30 秒 |
| Neon PostgreSQL | 業務データの永続化 | TLS、runtime は pooled endpoint |
| CloudWatch | 実行ログと基本メトリクス | error、invocation、duration、14 日保持 |
| Route 53 | 公開ドメインの DNS | Admin / Client のサブドメイン |

公開 URL は次の二つです。

- [Admin: survey-admin.liushaowei.dev](https://survey-admin.liushaowei.dev)
- [Client: survey-client.liushaowei.dev](https://survey-client.liushaowei.dev)

## Lambda 実行方式

Lambda package は macOS の仮想環境を流用せず、Linux x86_64 向けに依存関係を組み立てています。`psycopg` と `argon2` を含む native dependency を Linux 環境で import 検証し、`app.handler.handler` を entry point として使用します。

```py
from mangum import Mangum
from app.main import app

handler = Mangum(app, lifespan="off")
```

API Gateway の proxy event は Mangum が ASGI request へ変換するため、ローカルと Lambda で同じ router、service、schema を再利用できます。

## Neon との接続

Lambda は VPC に入れず、インターネット経由で Neon へ TLS 接続します。NAT Gateway と RDS の常時コストを持たずに済み、ポートフォリオ規模に適しています。

| 用途 | endpoint | 理由 |
| --- | --- | --- |
| Alembic migration | direct | セッションを保つ DDL と migration を安定して実行するため |
| Lambda runtime | pooled | Serverless の同時起動による接続バーストを吸収するため |

アプリケーションは Lambda 実行時に SQLAlchemy `NullPool` を使います。関数コンテナ内へ接続を長時間保持せず、Neon 側の pooler で物理接続を集約する役割分担です。

## 本番環境の設定方針

| 設定 | 方針 |
| --- | --- |
| `APP_RUNTIME` | `lambda` |
| `DATABASE_URL` | Neon pooled URL。コードやログへ出力しない |
| `JWT_SECRET` | Lambda の暗号化された環境変数として管理 |
| `CORS_ORIGINS` | Admin / Client の二つの Origin のみ許可 |
| `LLM_ENABLED` | `false` |

秘密情報は Git、README、サンプル設定へ保存しません。ポートフォリオ規模では、Lambda の暗号化された環境変数を採用し、必要性のない Secrets Manager を追加しない判断をしています。

## 運用上の境界

- AI / SSE は本番経路から外し、認証、回答、集計、Excel を優先する。
- DB migration は Lambda 起動時や通常デプロイで自動実行しない。
- CloudWatch Logs は 14 日で削除し、回答本文や token を記録しない。
- AWS Budget で月額上限を監視し、低トラフィック前提を継続的に確認する。
- VPS は自動デプロイせず、必要時だけ使う rollback / demo 経路として残す。

[デプロイ方式へ進む →](/infrastructure/deployment)
