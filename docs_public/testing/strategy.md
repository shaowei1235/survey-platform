# テスト方針

<span class="status-chip">Testing / Strategy</span>

## 品質を確認する単位

テストは画面の正常操作だけでなく、要件定義で決めた境界が破られないことを中心に設計しました。特に、権限・匿名化・回答の不変性・AI の根拠照合は、実装詳細ではなく受入条件として扱っています。

AI 関連テストは任意機能の品質を確認するものです。AWS 公開環境では AI を無効化し、その状態でも主要業務と analytics が成立することを別途確認しています。

## テスト構成

| レベル | 対象 | 主な目的 |
| --- | --- | --- |
| Unit | 識別子除去、数値照合、設定変換 | 境界条件と純粋ロジックを高速に確認 |
| API integration | 認証、回答、集計、状態遷移 | PostgreSQL を含む業務フローを確認 |
| Contract | JSON、エラーコード、SSE、Excel | フロントと API の契約を確認 |
| UI manual | エディタ、回答、ダッシュボード | 視認性、操作順、状態表示を確認 |
| Build / delivery | admin、client、docs | 配置可能な成果物を生成できることを確認 |

## リスクベースの優先順位

<div class="decision-grid">
  <article class="decision-card">
    <span class="eyebrow">Critical</span>
    <h3>権限境界</h3>
    <p>部門長が他部門を指定した場合に、空結果ではなく 403 で拒否されることを確認します。</p>
  </article>
  <article class="decision-card">
    <span class="eyebrow">Critical</span>
    <h3>匿名化境界</h3>
    <p>n=3、n=5、n=0 を用意し、非開示・開示・未回答が正しく分かれることを確認します。</p>
  </article>
  <article class="decision-card">
    <span class="eyebrow">High</span>
    <h3>データ整合性</h3>
    <p>公開後の定義変更、再回答、クライアントからの属性改ざんを拒否または無視します。</p>
  </article>
  <article class="decision-card">
    <span class="eyebrow">High</span>
    <h3>AI の検証可能性</h3>
    <p>LLM 停止、数値不一致、データ不足でも、根拠のない文章を成功として返さないことを確認します。</p>
  </article>
</div>

## 再現可能なテストデータ

テストとデモで同じ境界を確認できるよう、シードデータに次の分布を持たせました。

| データ | 回答数 | 確認すること |
| --- | ---: | --- |
| 第一営業課 | 5 | 開示境界、自由記述分析 |
| 第二営業課 | 3 | n&lt;5 のセルマスク |
| 営業部 | 8 | 第一・第二営業課のロールアップ |
| 人事部 | 3 | 全社ロールでのマスク |
| 開発部 | 0 | 「まだ回答がありません」の表示 |

固定されたデータ分布により、単に「値が表示された」ではなく、匿名化の境界値まで再現できます。

## 自動テストの配置

```text
api/tests/
├─ test_qa_phase1.py          認証・回答・集計・権限の主要フロー
├─ test_analytics_stream.py   SSE と evidence の順序
├─ test_deidentify.py         識別子除去
├─ test_llm_numbers.py        AI 数値照合
├─ test_survey_delete.py      状態別の削除制約
├─ test_survey_list.py        一覧と分析対象の選択
├─ test_i18n_assets.py        文案・リソース構造
└─ test_deployment_config.py  Lambda / CORS / feature flag
```

## 合格基準

- 自動テストに失敗がない。
- 33 の受入観点を正常系・異常系・境界値で確認できる。
- 画面と Excel で匿名化結果が一致する。
- AI が利用できない場合も、アンケート作成から集計までの主経路が成立する。
- 管理・回答・ドキュメントの各成果物が本番ビルドできる。

[主なテスト観点へ進む →](/testing/viewpoints)
