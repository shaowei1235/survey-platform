# 品質確認

<span class="status-chip">Testing / Evidence</span>

## 確認結果

2026-09-06 時点で、PostgreSQL を使用する API 自動テストを実行し、**61 tests passed** を確認しています。さらに、AWS 公開環境で Admin / Client から API Gateway、Lambda、Neon までの end-to-end acceptance を実施しました。

<div class="metric-grid">
  <article class="metric-card">
    <span class="eyebrow">Automated</span>
    <strong>61 passed</strong>
    <p>実 DB を含む API・サービス・契約テスト。</p>
  </article>
  <article class="metric-card">
    <span class="eyebrow">Acceptance</span>
    <strong>33 views</strong>
    <p>第一期の業務・権限・品質観点。</p>
  </article>
  <article class="metric-card">
    <span class="eyebrow">Privacy edge</span>
    <strong>0 / 3 / 5</strong>
    <p>未回答、非開示、開示境界を固定データで検証。</p>
  </article>
  <article class="metric-card">
    <span class="eyebrow">Apps</span>
    <strong>3 builds</strong>
    <p>管理、回答、公開ドキュメントを独立してビルド。</p>
  </article>
</div>

## 要件から確認結果まで

| 品質課題 | 実装上の対策 | テスト証拠 |
| --- | --- | --- |
| 他部門データの漏えい | クエリ前に部門スコープを検証 | 他部門指定で 403、スコープ省略時も自部門のみ |
| 小規模部署の特定 | n&lt;5 の平均値と部門長向け n を非開示 | n=3 / n=5 の境界テスト |
| 属性の改ざん | 回答時に利用者マスタから属性を保存 | body の `department_id` を無視 |
| 公開後の定義不整合 | 公開後の component list をロック | PATCH で 409 |
| AI の数値誤り | evidence とモデル出力を照合 | 不一致 mock で `AI_NUMBER_MISMATCH` |
| 出力経路の漏れ | JSON と Excel で同じ集計を再利用 | 画面と Excel のマスク一致 |

## 公開環境での受入結果

| 経路 | 確認結果 |
| --- | --- |
| Authentication | login、Access token、Refresh token rotation が成功 |
| Admin | survey list / detail、response status、analytics が成功 |
| Client | 公開 survey の表示、回答、submit、完了画面が成功 |
| Persistence | submit 後の response / answer item を Neon で確認 |
| Masking | 第一営業課 n=5 は開示、第二営業課 n=3 は非開示 |
| Rollup | 営業部は配下を合算して n=8 として集計 |
| Excel | 公開 API から XLSX を download し、ZIP header と open を確認 |
| CORS | 二つの独自ドメインから認証付き request と OPTIONS が成功 |

公開環境は `LLM_ENABLED=false` ですが、通常の analytics と Excel は AI に依存しないため、上記の受入経路はすべて利用できます。

## 画面で確認できる品質

<figure class="screenshot-frame">
  <img src="/images/survey-list.png" alt="下書き、公開中、終了のアンケートが並び、状態に応じた操作だけを表示する一覧画面">
  <figcaption>状態に応じて公開・終了・削除の操作を制御</figcaption>
</figure>

ダッシュボードでは、開示できる平均、n&lt;5 の非開示、回答 0 件を別の状態として表示します。画面で値を隠すだけではなく、API 応答自体が非開示済みであることを自動テストで確認しています。

## 自動化と手動確認の境界

### 自動化していること

- HTTP ステータスと業務エラーコード
- DB の一意制約と状態遷移
- 部門スコープと匿名化の境界
- Excel 内のマスク文字列
- AI evidence と数値の照合
- SSE のイベント順序と最終結果
- locale リソースとデプロイ設定

### 手動で確認すること

- ドラッグ＆ドロップの操作感
- Undo / Redo と未保存確認の理解しやすさ
- 長い設問・狭い画面でのレイアウト
- グラフ、表、空状態の視認性
- 実際の利用者を対象にした操作性とアクセシビリティ評価

## 現在の品質上の境界

API テスト実行時に、テストクライアント依存関係の非推奨警告が 1 件あります。テスト結果には影響しませんが、依存関係更新時に互換性確認が必要です。管理画面の production build には大きな JS chunk の警告があり、route 単位の dynamic import が次の性能改善候補です。また、現在の確認値は低トラフィックのポートフォリオを対象としたものであり、業務 SLA や大規模負荷試験の結果ではありません。

[AWS 構成へ進む →](/infrastructure/aws)
