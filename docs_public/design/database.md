# DB 設計

<span class="status-chip">Design / Data model</span>

## モデルの中心

データモデルは「組織」「アンケート定義」「回答」「分析監査」の四つに分けています。単一企業での利用を前提にしつつ、主要テーブルへ `company_id` を持たせ、企業境界を設計上明示しました。

## 論理関係

```text
Company
├─ Department ─┬─ Department（部 → 課）
│              └─ User ── UserRole
├─ JobGrade ──────┘
└─ Survey ── Response ── AnswerItem
            └─ AiRun（実行者・条件・根拠・結論）
```

## 主要テーブル

| テーブル | 役割 | 重要な制約 |
| --- | --- | --- |
| `companies` | 企業境界 | 第一期は 1 社 |
| `departments` | 部門ツリー | `parent_id`、無効化は論理削除 |
| `users` | 従業員と所属属性 | 企業内で社員番号が一意 |
| `user_roles` | ロールと任意の部門スコープ | 同一ユーザーは複数ロール可 |
| `refresh_tokens` | 更新トークンのハッシュ | 原文を保存せず、失効日時を管理 |
| `surveys` | タイトル、状態、設問定義 | `component_list` を JSONB で保持 |
| `responses` | 一回の回答と属性スナップショット | `survey_id + user_id` が一意 |
| `answer_items` | 設問ごとの回答値 | `response_id + fe_id` が一意 |
| `ai_runs` | AI 実行の監査記録 | 条件・evidence・結論・状態を保存 |

## 設問定義の保存形式

```json
[
  {
    "fe_id": "c_x8J2k",
    "type": "radio",
    "props": {
      "title": "上司は相談に乗ってくれる",
      "required": true,
      "scoreEnabled": true,
      "options": [
        { "value": "1", "label": "全くそう思わない", "score": 1 },
        { "value": "5", "label": "非常にそう思う", "score": 5 }
      ]
    }
  }
]
```

### JSONB を選んだ理由

- 設問タイプごとに異なる `props` を一つの契約で保存できる。
- フロントのレジストリと API バリデーションが同じ形を参照できる。
- 新しい設問タイプを追加するたびに列を増やさずに済む。
- 公開後に定義をロックすることで、柔軟性と整合性を両立できる。

一方、集計対象の回答値は `answer_items` として分離し、アンケート単位・部門単位で検索できるようインデックスを持たせています。

## 回答属性のスナップショット

回答には送信時点の `department_id`、`job_grade_id`、`generation` を保存します。利用者が後に異動しても、過去の ES 調査を当時の組織状態で再集計できるためです。

```text
送信時
User の現在属性 ──copy──> Response の属性

異動後
User の所属は更新 / 過去 Response は不変
```

## 集計データの扱い

第一期は集計専用テーブルを持たず、`responses` と `answer_items` から都度計算します。AI 実行時だけ、当時のクエリ条件と集計結果を `ai_runs` に監査用スナップショットとして残します。

| データ | 正本 | 理由 |
| --- | --- | --- |
| 現在のダッシュボード | 回答から再計算 | フィルタ条件と最新回答を反映するため |
| 過去の AI 結論 | `ai_runs` | 生成時の根拠を後から検証するため |

## 削除方針

- 組織・ユーザーは `is_active=false` の論理削除。
- 下書きアンケートは物理削除可能。
- 公開中・終了済みアンケートは削除不可。
- 回答を個別に消す管理 UI は第一期では提供しない。

[権限・セキュリティ設計へ進む →](/design/security)
