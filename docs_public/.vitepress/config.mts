import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'ja-JP',
  title: '社内アンケート基盤',
  description: '要件定義から設計・実装・テスト・デプロイまでを一貫して示すプロジェクトドキュメント',
  cleanUrls: true,
  lastUpdated: true,
  outDir: './dist',
  head: [
    ['meta', { name: 'theme-color', content: '#172554' }],
    ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }]
  ],
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'Survey Platform',
    nav: [
      { text: '概要', link: '/' },
      { text: '要件', link: '/requirements/current-state' },
      { text: '設計', link: '/design/basic' },
      { text: '実装', link: '/implementation/frontend' },
      { text: 'テスト', link: '/testing/strategy' },
      { text: 'インフラ', link: '/infrastructure/aws' }
    ],
    sidebar: [
      {
        text: 'Overview',
        items: [{ text: 'プロジェクト概要', link: '/' }]
      },
      {
        text: '1. Requirements',
        items: [
          { text: '現行業務と課題', link: '/requirements/current-state' },
          { text: '要件定義', link: '/requirements/definition' },
          { text: '非機能要件', link: '/requirements/non-functional' }
        ]
      },
      {
        text: '2. Design',
        items: [
          { text: '基本設計', link: '/design/basic' },
          { text: '画面構成', link: '/design/screens' },
          { text: 'API 設計', link: '/design/api' },
          { text: 'DB 設計', link: '/design/database' },
          { text: '権限・セキュリティ', link: '/design/security' }
        ]
      },
      {
        text: '3. Implementation',
        items: [
          { text: 'フロントエンド構成', link: '/implementation/frontend' },
          { text: 'バックエンド構成', link: '/implementation/backend' },
          { text: '認証・認可', link: '/implementation/auth' }
        ]
      },
      {
        text: '4. Testing',
        items: [
          { text: 'テスト方針', link: '/testing/strategy' },
          { text: '主なテスト観点', link: '/testing/viewpoints' },
          { text: '品質確認', link: '/testing/quality' }
        ]
      },
      {
        text: '5. Infrastructure',
        items: [
          { text: 'AWS 構成', link: '/infrastructure/aws' },
          { text: 'デプロイ方式', link: '/infrastructure/deployment' },
          { text: 'CI/CD', link: '/infrastructure/cicd' },
          { text: 'コスト最適化', link: '/infrastructure/cost' }
        ]
      }
    ],
    outline: { level: [2, 3], label: 'このページ' },
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/shaowei1235/survey-platform' }
    ],
    docFooter: { prev: '前へ', next: '次へ' },
    returnToTopLabel: 'ページ上部へ',
    sidebarMenuLabel: 'メニュー',
    darkModeSwitchLabel: '表示テーマ',
    lightModeSwitchTitle: 'ライトモード',
    darkModeSwitchTitle: 'ダークモード',
    lastUpdatedText: '最終更新',
    footer: {
      message: '要件・設計・実装・品質保証を一つの流れとしてまとめたポートフォリオです。',
      copyright: 'Survey Platform'
    }
  }
})
