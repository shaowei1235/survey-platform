# バックエンド構成

<span class="status-chip">Implementation / Backend</span>

## レイヤ構成

FastAPI アプリケーションは、HTTP 契約、業務サービス、データアクセス、外部 AI 接続を分離しています。権限や匿名化のような横断ルールを各画面の実装へ散らさず、API 内で一貫して適用します。

```text
api/app/
├─ routers/       HTTP 入出力とステータスコード
├─ services/      認可、集計、匿名化、LLM、状態遷移
├─ schemas.py     Pydantic の request / response 契約
├─ models.py      SQLAlchemy モデル
├─ security.py    パスワードとトークン
├─ deps.py        認証主体と DB セッション
├─ errors.py      共通業務エラー
├─ db.py          Engine / Session 設定
├─ main.py        FastAPI アプリ構成
└─ handler.py     AWS Lambda 用 Mangum 入口
```

## リクエストの処理順序

<ol class="journey">
  <li>入力スキーマ検証</li>
  <li>JWT から主体を特定</li>
  <li>ロールと範囲を検証</li>
  <li>業務ルールを実行</li>
  <li>DB を更新・集計</li>
  <li>構造化応答を返す</li>
</ol>

## アンケートと回答

`services/components.py` は設問レジストリと回答値を検証します。公開条件、公開後の編集禁止、終了後の回答禁止、下書きだけの削除は `services/surveys.py` に集約しています。

回答送信では、クライアントの payload に属性が含まれていても利用しません。認証済み利用者を DB から読み、送信時点の部門・職級・年代を `responses` へ保存します。`survey_id + user_id` の一意制約により、並行リクエストでも重複回答を防止します。

## 集計サービス

`services/analytics.py` は次の処理を共通化しています。

- 利用者の許可部門 ID を展開する。
- リッカート設問の option score を定義から取得する。
- 部門と配下組織の回答をロールアップする。
- `n=0`、`0<n<5`、`n≥5` を分ける。
- 年代・職級フィルタを回答スナップショットへ適用する。
- 画面 JSON と Excel の元になる同じクロス集計を返す。

平均値を算出してからフロントで隠すのではなく、API 応答を作る時点で非開示値を `null` にします。

## Excel 出力

openpyxl でクロス集計を `.xlsx` に変換します。別の集計ロジックを作らず、画面 API と同じ `cross_tab` の結果を利用するため、フィルタと n&lt;5 ルールが一致します。シート末尾には匿名化ルールの注記を付けます。

## AI パイプライン

```text
固定意図
  → authz でスコープ確認
  → analytics で集計
  → deidentify で記述を匿名化
  → evidence を構築
  → llm へ定性結論を依頼
  → 数値と schema を再検証
  → ai_runs へ監査記録
```

`services/deidentify.py` はメール、電話、社員番号を除去し、抜粋の長さと件数を制限します。`services/llm.py` は OpenAI 互換の HTTP API を呼び、JSON Schema を優先して応答形式を制約します。固定分析を無効化しても、作成・回答・集計・Excel という主経路は動作します。

## 通常応答と SSE

分析 API は同期版と SSE 版を持ちます。SSE では evidence 完成後に文章をチャンク送信し、最後に完全な構造化結果を返します。途中の断片は監査テーブルへ保存せず、完了した結果だけを成功として記録します。

## 実行環境への適応

ローカル / VPS では通常の SQLAlchemy pool を使用します。Lambda 実行時は `APP_RUNTIME=lambda` を検出し、`NullPool` を利用して関数インスタンス数に比例した過剰な DB 接続保持を避けます。本番 runtime は Neon の pooled endpoint、Alembic migration は direct endpoint を使います。`handler.py` の Mangum アダプターにより、同じ FastAPI アプリを API Gateway + Lambda でも実行できます。

公開環境の Lambda は Python 3.13 / x86_64、512 MB、30 秒で動作します。Linux 向け package で Psycopg、Argon2 を含む native dependency と `app.handler.handler` の import を確認し、VPC や NAT Gateway を必要としない構成にしています。

[認証・認可へ進む →](/implementation/auth)
