---
layout: home

hero:
  name: Survey Platform
  text: 要件から AWS 運用まで、つながる設計。
  tagline: 日本企業の従業員満足度調査を、作成・回答・匿名集計・Excel 出力まで一つの業務フローにした、公開稼働中の社内アンケート基盤です。
  actions:
    - theme: brand
      text: Admin を開く
      link: https://survey-admin.liushaowei.dev
    - theme: alt
      text: Client を開く
      link: https://survey-client.liushaowei.dev
    - theme: alt
      text: 3分で全体像を読む
      link: /requirements/current-state

features:
  - icon: 🎯
    title: 解いた課題
    details: Excel と共有ファイルに分散していた集計を、権限と匿名化を組み込んだ業務フローへ再設計しました。
  - icon: 🧭
    title: 担当した範囲
    details: 現行業務整理、要件定義、基本・詳細設計、フルスタック実装、テスト、AWS デプロイと運用まで一貫して担当しました。
  - icon: 🛡️
    title: 品質の軸
    details: n<5 のセルマスク、部門スコープ、属性スナップショット、AI 出力の根拠照合をテスト可能な仕様にしました。
---

<div class="home-shell">

<p class="section-kicker">Project overview</p>

## 数分でわかるプロジェクト概要

<p class="lead">汎用フォーム、メール、Excel、人手の要約に分断されていた ES 調査を、役割ごとに安全に利用できる Web アプリケーションへ置き換えました。単なるフォーム作成ではなく、意思決定に使える集計を、プライバシーを守りながら届けることが中心テーマです。</p>

<div class="summary-grid">
  <article class="summary-card primary">
    <span class="eyebrow">Product</span>
    <h3>社内アンケート基盤</h3>
    <p>人事がアンケートを設計・公開し、従業員が回答。人事・経営層・部門長は、それぞれ許可された範囲の集計と分析を参照できます。</p>
  </article>
  <article class="summary-card">
    <span class="eyebrow">Problem</span>
    <h3>集計負荷と情報漏えい</h3>
    <p>手作業のクロス集計、曖昧な共有権限、小規模部署の特定リスク、根拠と結論の分離を解消します。</p>
  </article>
  <article class="summary-card">
    <span class="eyebrow">Approach</span>
    <h3>業務ルールを実装へ落とす</h3>
    <p>組織マスタ、RBAC、クエリスコープ、n&lt;5 マスクを一つの設計に統合し、低トラフィック向けの Serverless 構成で公開しています。</p>
  </article>
</div>

<p class="section-kicker">My contribution</p>

## 担当領域

<ol class="journey">
  <li>現行業務と課題の整理</li>
  <li>業務・機能・非機能要件</li>
  <li>画面・API・DB・権限設計</li>
  <li>フロント / API 実装</li>
  <li>自動・手動テスト設計</li>
  <li>AWS デプロイと運用</li>
</ol>

<div class="metric-grid">
  <article class="metric-card">
    <span class="eyebrow">Privacy</span>
    <strong>n &lt; 5</strong>
    <p>少人数セルの平均値を非開示にし、部門長には件数も返しません。</p>
  </article>
  <article class="metric-card">
    <span class="eyebrow">Scope</span>
    <strong>5 roles</strong>
    <p>人事、経営層、部門長、従業員、システム管理者を権限分離します。</p>
  </article>
  <article class="metric-card">
    <span class="eyebrow">Contract</span>
    <strong>1 schema</strong>
    <p>作成・表示・回答が同じコンポーネント契約を共有します。</p>
  </article>
  <article class="metric-card">
    <span class="eyebrow">Quality</span>
    <strong>61 tests</strong>
    <p>認証、回答、集計、匿名化、Excel、Lambda 設定を自動検証しました。</p>
  </article>
</div>

<p class="section-kicker">Technology</p>

## 技術スタック

| 領域 | 技術 | 主な責務 |
| --- | --- | --- |
| 管理画面 | Vite / React / TypeScript / Ant Design | アンケート編集、組織管理、分析ダッシュボード |
| 回答画面 | Next.js App Router / React / TypeScript | 公開中アンケートの表示・回答 |
| API | FastAPI / Pydantic / SQLAlchemy / Alembic | 認証、認可、永続化、集計、AI パイプライン |
| Data | Neon PostgreSQL / JSONB | 組織、設問定義、回答、属性スナップショット、監査記録 |
| Delivery | Amplify / API Gateway / Lambda | 公開配信、Serverless API、ログとメトリクス |

<p class="section-kicker">Architecture</p>

## システム構成

<div class="arch-diagram" role="img" aria-label="Amplify の管理画面と回答画面が API Gateway と Lambda を経由して Neon PostgreSQL に接続する本番構成">
  <div class="arch-group">
    <div class="arch-node"><strong>Admin / Amplify</strong><span>Vite + React</span></div>
    <div class="arch-node"><strong>Client / Amplify</strong><span>Next.js + React</span></div>
  </div>
  <div class="arch-arrow">HTTPS →</div>
  <div class="arch-group">
    <div class="arch-node"><strong>API Gateway</strong><span>Regional REST API</span></div>
    <div class="arch-node"><strong>Lambda</strong><span>FastAPI + Mangum</span></div>
  </div>
  <div class="arch-arrow">→</div>
  <div class="arch-group">
    <div class="arch-node"><strong>Neon PostgreSQL</strong><span>pooled connection</span></div>
    <div class="arch-node"><strong>CloudWatch</strong><span>logs / metrics</span></div>
  </div>
</div>

本番環境は東京リージョンを中心に構成し、Lambda は VPC に入れず Neon へ TLS 接続します。AI 分析の実装は評価可能な形で残していますが、公開環境では `LLM_ENABLED=false` とし、通常業務を AI に依存させていません。

## デモとソースコード

公開環境は [Admin](https://survey-admin.liushaowei.dev) と [Client](https://survey-client.liushaowei.dev) から確認できます。画面説明は [主要画面と操作フロー](/design/screens)、実行可能なソースコードとローカル起動手順は [GitHub リポジトリ](https://github.com/shaowei1235/survey-platform) にまとめています。

<span class="status-chip">ポートフォリオ公開用ドキュメント</span>

</div>
