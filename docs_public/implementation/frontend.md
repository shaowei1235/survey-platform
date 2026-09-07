# フロントエンド構成

<span class="status-chip">Implementation / Frontend</span>

## 二つのアプリを分けた理由

管理画面は、一覧・編集・組織管理・分析のような高密度な対話を扱います。回答画面は、従業員が短時間で迷わず回答することが目的です。利用者と操作特性が異なるため、同じ画面へ詰め込まず、API 契約を共有する独立アプリとして実装しました。

## 管理画面 `admin/`

| 技術 | 用途 |
| --- | --- |
| Vite 6 / React 18 / TypeScript | SPA の開発とビルド |
| React Router | ログイン、マスタ、アンケート、分析のルーティング |
| Ant Design 5 | フォーム、テーブル、モーダル、レイアウト |
| Redux Toolkit / redux-undo | エディタ状態と Undo / Redo |
| @dnd-kit | パレットからの追加、キャンバス内の並べ替え |
| Recharts | 部門別平均の可視化 |
| i18next | 日本語文案とロジックの分離 |

### ディレクトリの役割

```text
admin/src/
├─ pages/          画面単位のコンテナ
├─ components/     エディタ、プレビュー、状態表示
├─ locales/        ja / en の翻訳リソース
├─ api.ts          API クライアントとエラー変換
├─ session.ts      トークンと利用者セッション
├─ store.ts        Redux と履歴管理
└─ App.tsx         ルートと認証ガード
```

### エディタの状態管理

```ts
type EditorState = {
  surveyId: string
  title: string
  status: 'draft' | 'published' | 'closed'
  selectedFeId: string | null
  componentList: Component[]
}
```

`title` と `componentList` だけを履歴対象にし、部品の選択移動は Undo スタックへ入れません。履歴は 20 件に制限し、`Meta+Z`、`Meta+Shift+Z`、`Ctrl+Y` をサポートします。公開中・終了済みでは編集アクション自体を無効化し、API 側の状態検証と二重に守ります。

### 設問レジストリ

| type | 管理画面での設定 | 回答値 |
| --- | --- | --- |
| `title` | 見出し文 | なし |
| `paragraph` | 説明文 | なし |
| `radio` | 必須、選択肢、得点化 | 単一の value |
| `checkbox` | 必須、選択肢 | value の配列 |
| `input` | 必須、最大長 | 文字列 |
| `textarea` | 必須、最大長 | 文字列 |

追加・編集・プレビューはこのレジストリを基準にし、未知の type は保存前に拒否します。

## 回答画面 `client/`

| 技術 | 用途 |
| --- | --- |
| Next.js 15 App Router / React 19 | 回答フローとページ構成 |
| Ant Design 5 | 入力部品とフィードバック |
| Context | セッションと回答フローの共有状態 |
| locale JSON | 日本語既定、英語拡張点 |

```text
client/
├─ app/                    App Router のページ
│  ├─ login/              ログイン
│  └─ surveys/            一覧・回答・完了
├─ components/
│  ├─ AnswerField.tsx     type ごとの入力描画
│  ├─ QuestionCard.tsx    設問の共通枠
│  └─ SurveyFillView.tsx  検証・進捗・送信
├─ lib/
│  ├─ api.ts              回答用 API クライアント
│  └─ session.ts          セッション管理
└─ messages/              ja / en
```

回答画面は API から取得した `component_list` を読み、回答可能な type だけを `AnswerField` へ割り当てます。必須・選択肢・最大長を送信前にも確認し、サーバー側と同じ契約違反を早く利用者へ知らせます。

## API 接続の切り替え

ローカル開発では `/api/v1` を各開発サーバーが FastAPI へ転送します。本番ビルドでは `VITE_API_BASE` と `NEXT_PUBLIC_API_BASE` を使い、フロントエンドの配置先と API の配置先を独立して変更できます。

## UI の状態設計

- Loading、Empty、Error を再利用コンポーネントで統一する。
- 0 件、権限エラー、n&lt;5 の非開示を同じ空表示にしない。
- API の `message_key` を locale リソースへ変換する。
- 破壊的操作は確認ダイアログを通し、状態に応じて操作可能性を変える。
- 回答画面は進捗を表示し、送信後の二重操作を防止する。

[バックエンド構成へ進む →](/implementation/backend)
