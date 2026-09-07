# CI/CD

<span class="status-chip">Infrastructure / Automation</span>

## 現在のデプロイ経路

フロントエンドは Amplify と GitHub を接続してビルドします。API はまず手動で package、更新、smoke test の手順を確立し、失敗点を理解できる状態にしてから自動化する方針です。

| 対象 | 現在の方式 | 自動化の範囲 |
| --- | --- | --- |
| Admin | GitHub → Amplify | 対象 branch の変更を build / deploy |
| Client | GitHub → Amplify | 対象 branch の変更を build / deploy |
| Lambda | 再現可能な script + AWS CLI | package は自動化、反映と確認は明示実行 |
| Migration | Alembic + Neon direct endpoint | release から独立して明示実行 |
| 旧 VPS | GitHub Actions | `workflow_dispatch` の手動実行のみ |

## VPS workflow の安全対策

以前の VPS workflow は `main` push で本番更新される状態でした。AWS 移行時に自動 trigger を削除し、現在は次の形です。

```yaml
on:
  workflow_dispatch:
```

そのため、通常の push や merge が旧 VPS へ副作用を起こすことはありません。VPS の host、user、SSH key は GitHub Secrets を参照し、workflow やソースへ実値を保存しません。

## 品質ゲート

| Gate | 確認内容 |
| --- | --- |
| Test | API の自動テストが成功する |
| Build | Admin、Client、公開ドキュメントが production build できる |
| Lambda package | Linux 上で FastAPI、Mangum、Psycopg、Argon2、SQLAlchemy、handler を import できる |
| Migration | schema change がある場合だけ Alembic を head まで適用する |
| Smoke | health、login、refresh、survey、analytics、submit、Excel を確認する |
| Security | `.env`、DB URL、JWT secret、ZIP、出力ファイルが Git に含まれない |

## 次の自動化候補

手動デプロイで end-to-end の手順を確認済みなので、次は GitHub Actions で Lambda package を作り、テスト成功後に `aws lambda update-function-code` を実行できます。ただし、DB migration は schema とデータへの影響が大きいため、通常の deploy ごとには自動実行しません。

```text
Pull Request
  → test + frontend build + Lambda package verification

Approved release
  → Lambda code update
  → representative smoke test

Schema change
  → separately approved Alembic migration
```

[コスト最適化へ進む →](/infrastructure/cost)
