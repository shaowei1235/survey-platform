# 基本設計

<span class="status-chip">Design / Architecture</span>

## 設計方針

管理業務と回答体験を分離し、認証・認可・永続化・集計を API に集約しました。画面の都合ではなく、業務上の責務とセキュリティ境界をもとに構成を決めています。

以下はアプリケーションの論理構成です。LLM は任意機能として実装・テストしていますが、AWS 公開環境では `LLM_ENABLED=false` とし、通常業務の実行経路には含めていません。物理構成は [AWS 構成](/infrastructure/aws) に記載しています。

<div class="arch-diagram" role="img" aria-label="ブラウザの管理画面と回答画面が FastAPI を通して PostgreSQL と LLM API に接続する論理構成">
  <div class="arch-group">
    <div class="arch-node"><strong>admin</strong><span>人事・経営層・部門長</span></div>
    <div class="arch-node"><strong>client</strong><span>一般従業員</span></div>
  </div>
  <div class="arch-arrow">JSON / JWT →</div>
  <div class="arch-node"><strong>FastAPI</strong><span>認証・RBAC・集計・AI</span></div>
  <div class="arch-arrow">→</div>
  <div class="arch-group">
    <div class="arch-node"><strong>PostgreSQL</strong><span>正規データ</span></div>
    <div class="arch-node"><strong>LLM API</strong><span>文章生成に限定</span></div>
  </div>
</div>

## コンポーネントの責務

| コンポーネント | 技術 | 責務 |
| --- | --- | --- |
| `admin/` | Vite / React / Ant Design | 組織マスタ、アンケートエディタ、公開・終了、ダッシュボード、固定分析 |
| `client/` | Next.js App Router / React / Ant Design | ログイン、回答可能一覧、回答、完了 |
| `api/` | FastAPI / SQLAlchemy | 認証、RBAC、データ検証、永続化、匿名集計、AI evidence 構築 |
| PostgreSQL | PostgreSQL 16 / JSONB | マスタ、アンケート定義、回答、属性スナップショット、AI 監査記録 |
| LLM（任意） | OpenAI 互換 HTTP API | evidence に基づく定性結論と構造化要約。本番では無効 |

## 機能の流れ

<ol class="journey">
  <li>組織と権限を登録</li>
  <li>アンケートを設計</li>
  <li>公開して回答</li>
  <li>匿名集計</li>
  <li>根拠を構築</li>
  <li>分析結果を表示</li>
</ol>

### アンケート定義を一つの契約にする

管理画面と回答画面は UI 実装を共有しません。一方で、設問を表す `fe_id`・`type`・`props` の契約は共有します。これにより、複雑な編集操作は管理画面に閉じつつ、回答画面は同じ定義を安定して描画できます。

### 集計を API に集約する

画面表示、Excel 出力、AI evidence は、同じ集計ルールを利用します。特にセルマスクを画面側だけで行うと、API 応答や出力ファイルから値が漏れるため、匿名化判定はバックエンドで完了させます。

### AI を最後の文章化レイヤーに置く

AI は最初に質問を解釈して自由に DB を検索するのではなく、許可された固定意図を受け取ります。権限確認、SQL 集計、匿名化、evidence 作成が終わった後にだけ、定性結論の生成を依頼します。

## 主要な設計判断

<div class="decision-grid">
  <article class="decision-card">
    <span class="eyebrow">Boundary</span>
    <h3>管理と回答を別アプリにする</h3>
    <p>操作密度と利用者が大きく異なるため、管理画面は Vite SPA、回答画面は配信・回答に集中した Next.js アプリとしました。</p>
  </article>
  <article class="decision-card">
    <span class="eyebrow">Data</span>
    <h3>回答時点の属性を保存する</h3>
    <p>異動後も過去集計を再現できるよう、回答時点の部門・職級・年代をレスポンスへスナップショットします。</p>
  </article>
  <article class="decision-card">
    <span class="eyebrow">Privacy</span>
    <h3>匿名化を API 契約にする</h3>
    <p>n&lt;5 の場合は値を `null` として返し、単なる表示上の伏字にしません。Excel も同じ集計関数を再利用します。</p>
  </article>
  <article class="decision-card">
    <span class="eyebrow">AI safety</span>
    <h3>数値をモデルに作らせない</h3>
    <p>統計値はアプリケーションが生成し、モデル出力に数値が含まれる場合は evidence と照合します。</p>
  </article>
</div>

## アンケート状態

| 状態 | 定義編集 | 回答 | 削除 |
| --- | --- | --- | --- |
| 下書き `draft` | 可 | 不可 | 可 |
| 公開中 `published` | 不可 | 可 | 不可 |
| 終了 `closed` | 不可 | 不可 | 不可 |

公開済みの定義をロックすることで、回答時に参照した設問と、後から表示・集計する設問の対応を保ちます。

[画面構成へ進む →](/design/screens)
