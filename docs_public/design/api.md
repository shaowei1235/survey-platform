# API 設計

<span class="status-chip">Design / REST API</span>

## API の役割

API は画面のための単純な CRUD 層ではなく、認証・権限・状態遷移・匿名化を強制する業務境界です。ベースパスは `/api/v1`、JSON は `snake_case`、日時は UTC の ISO 8601 としました。

## 共通契約

| 項目 | ルール |
| --- | --- |
| 認証 | ログインと更新以外は Bearer JWT が必須 |
| ID | UUID を文字列として扱う |
| ページング | `page` は 1 始まり、`page_size` は最大 100 |
| エラー | `error_code` と `message_key` の構造化 JSON |
| 競合 | 状態遷移違反、重複回答は 409 |
| 権限 | ロール不足と部門範囲外を 403 で区別 |

```json
{
  "error_code": "FORBIDDEN_SCOPE",
  "message_key": "error.forbidden_scope"
}
```

画面は `message_key` から日本語メッセージを取得します。API の業務分岐と表示文案を分けることで、エラー処理を一貫させています。

## エンドポイント構成

### 認証・利用者

| Method | Path | 用途 |
| --- | --- | --- |
| `POST` | `/auth/login` | Access / Refresh token の発行 |
| `POST` | `/auth/refresh` | Refresh token をローテーション |
| `GET` | `/me` | 現在ユーザー、ロール、展開済み部門スコープ |

### 組織・アンケート

| Method | Path | 用途 |
| --- | --- | --- |
| `GET/POST` | `/departments` | 部門ツリーの取得・作成 |
| `GET/POST/PATCH` | `/users` | 従業員とロールの管理 |
| `GET/POST` | `/surveys` | 一覧・下書き作成 |
| `GET/PATCH` | `/surveys/{id}` | 定義取得・下書き保存 |
| `POST` | `/surveys/{id}/publish` | 公開 |
| `POST` | `/surveys/{id}/close` | 終了 |
| `DELETE` | `/surveys/{id}` | 下書きだけを削除 |

### 回答

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/client/surveys` | 公開中かつ未回答の一覧 |
| `GET` | `/client/surveys/{id}` | 回答用の設問定義 |
| `POST` | `/client/surveys/{id}/responses` | 回答送信と属性スナップショット |

### 集計・分析

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/analytics/cross-tab` | 匿名化済みクロス集計 |
| `GET` | `/analytics/cross-tab.xlsx` | 同じルールの Excel 出力 |
| `GET` | `/analytics/completion` | 部署別の回答状況 |
| `POST` | `/analytics/intent` | 固定意図の分析 |
| `POST` | `/analytics/free-text-summary` | 自由記述の構造化要約 |
| `POST` | `.../stream` | 分析結果を SSE で配信 |

## クロス集計の応答例

```json
{
  "survey_id": "survey_uuid",
  "questions": [
    { "fe_id": "c_1", "title": "上司は相談に乗ってくれる" }
  ],
  "rows": [
    {
      "department_id": "dept_uuid",
      "department_name": "営業部",
      "cells": [
        { "fe_id": "c_1", "n": 12, "avg_score": 3.4, "masked": false }
      ]
    }
  ]
}
```

マスクセルは `avg_score: null` と `masked: true` を返します。部門長に対しては `n` も `null` にし、クライアントへ具体値を送らない設計です。

## 回答送信の検証

1. 対象アンケートが公開中であること。
2. 同じ利用者の回答がまだ存在しないこと。
3. `fe_id` と `type` が公開済み定義と一致すること。
4. 必須項目が揃い、選択値が定義された option に含まれること。
5. 部門・職級・年代はリクエスト値を採用せず、DB の利用者情報から取得すること。

## SSE のイベント契約

```text
data: {"type":"delta","text":"営業部では…"}
data: {"type":"result","result":{...}}
```

集計と evidence の構築を完了してからストリーミングを開始します。途中失敗は `type: error` と業務エラーコードを返し、部分的な文章を成功結果として保存しません。

[DB 設計へ進む →](/design/database)
