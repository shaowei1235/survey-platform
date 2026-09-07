# コスト最適化

<span class="status-chip">Infrastructure / Cost control</span>

## 選定の前提

このプロジェクトは低トラフィックのポートフォリオデモです。ピーク性能よりも、アクセスがない時間の固定費を持たないこと、運用対象を増やさないことを優先しました。

| 領域 | 採用 | コストを抑える判断 |
| --- | --- | --- |
| Frontend | Amplify Hosting | Admin / Client を必要なときだけ個別 build |
| API | API Gateway + Lambda | リクエスト時だけ実行し、512 MB / 30 秒から開始 |
| Database | Neon PostgreSQL | VPC、NAT Gateway、RDS の常時構成を持たない |
| AI | Production disabled | 外部 API 利用料と timeout を本番経路から外す |
| Logs | CloudWatch | retention を 14 日に限定する |
| Monitoring | AWS Budget / alarms | 月額の異常と API error を早期に検知する |

## Serverless を採用した理由

定期アンケートは利用時間が偏り、公開ポートフォリオも継続的な高負荷を想定しません。Lambda と API Gateway の request-based model は、このアクセス特性に合います。Lambda を VPC に入れず Neon へ TLS 接続するため、NAT Gateway の固定費も発生しません。

## DB 接続数の制御

Lambda は同時実行数に応じて関数コンテナが増えます。アプリ側では SQLAlchemy `NullPool` を利用し、関数ごとの固定 pool を保持しません。runtime は Neon pooled endpoint を使い、Serverless burst による多数の論理接続を少数の物理接続へ集約します。

Migration は DDL と session の互換性を優先して direct endpoint を使います。接続用途を分けることで、RDS Proxy のような追加コンポーネントを導入せずに現在の規模へ対応しています。

## AI を本番経路から外す

コードには、SQL 集計の evidence に基づく AI 分析機能があります。ただし、公開環境は `LLM_ENABLED=false` です。アンケート作成、回答、集計、匿名化、Excel 出力は LLM なしで動くため、外部 API の利用料と障害を通常業務から切り離せます。

## 監視と上限

- CloudWatch Logs は無期限保存せず、14 日 retention とする。
- Lambda error、duration、invocation と API Gateway 5xx を確認する。
- AWS Budget で段階的な月額通知を設定する。
- Neon、Amplify、Lambda、API Gateway、CloudWatch の利用量を定期的に確認する。

本番規模が増えた場合にだけ、Lambda memory、DB plan、予約済み同時実行数、専用の secrets service を再評価します。ポートフォリオ段階では、利用実績のない高度な構成を先に追加しません。

[プロジェクト概要へ戻る →](/)
