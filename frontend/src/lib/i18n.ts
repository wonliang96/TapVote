import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export const supportedLanguages = {
  en: 'English',
  zh: '中文',
  ms: 'Bahasa Melayu'
} as const

export type SupportedLanguage = keyof typeof supportedLanguages

const resources = {
  en: {
    translation: {
      // App Names
      appName: 'TapVote',
      
      // Navigation
      home: 'Home',
      trending: 'Trending',
      categories: 'Categories',
      profile: 'Profile',
      
      // Authentication
      signIn: 'Sign In',
      signUp: 'Sign Up',
      signOut: 'Sign Out',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      forgotPassword: 'Forgot Password?',
      
      // Polls
      createPoll: 'Create Poll',
      pollQuestion: 'Poll Question',
      addOption: 'Add Option',
      vote: 'Vote',
      voted: 'Voted',
      results: 'Results',
      votes: 'votes',
      noPolls: 'No polls found',
      
      // Categories
      politics: 'Politics',
      technology: 'Technology',
      entertainment: 'Entertainment',
      sports: 'Sports',
      lifestyle: 'Lifestyle',
      worldNews: 'World News',
      
      // Comments
      comments: 'Comments',
      addComment: 'Add Comment',
      reply: 'Reply',
      anonymous: 'Anonymous',
      
      // Time
      justNow: 'Just now',
      minutesAgo: '{{count}} minutes ago',
      hoursAgo: '{{count}} hours ago',
      daysAgo: '{{count}} days ago',
      
      // Common
      loading: 'Loading...',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      share: 'Share',
      search: 'Search',
      filter: 'Filter',
      
      // Translation
      translated: 'Translated',
      showOriginal: 'Show Original',
      machineTranslated: 'Machine Translated',
      
      // Trending News
      trendingNewsPolls: 'Trending News Polls',
      basedOnNews: 'Based on trending news'
    }
  },
  zh: {
    translation: {
      // App Names
      appName: '点投',
      
      // Navigation
      home: '首页',
      trending: '热门',
      categories: '分类',
      profile: '个人资料',
      
      // Authentication
      signIn: '登录',
      signUp: '注册',
      signOut: '退出',
      email: '邮箱',
      password: '密码',
      confirmPassword: '确认密码',
      forgotPassword: '忘记密码？',
      
      // Polls
      createPoll: '创建投票',
      pollQuestion: '投票问题',
      addOption: '添加选项',
      vote: '投票',
      voted: '已投票',
      results: '结果',
      votes: '票',
      noPolls: '未找到投票',
      
      // Categories
      politics: '政治',
      technology: '科技',
      entertainment: '娱乐',
      sports: '体育',
      lifestyle: '生活',
      worldNews: '国际新闻',
      
      // Comments
      comments: '评论',
      addComment: '添加评论',
      reply: '回复',
      anonymous: '匿名',
      
      // Time
      justNow: '刚刚',
      minutesAgo: '{{count}}分钟前',
      hoursAgo: '{{count}}小时前',
      daysAgo: '{{count}}天前',
      
      // Common
      loading: '加载中...',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      edit: '编辑',
      share: '分享',
      search: '搜索',
      filter: '筛选',
      
      // Translation
      translated: '已翻译',
      showOriginal: '显示原文',
      machineTranslated: '机器翻译',
      
      // Trending News
      trendingNewsPolls: '热门新闻投票',
      basedOnNews: '基于热门新闻'
    }
  },
  ms: {
    translation: {
      // App Names
      appName: 'KlikUndi',
      
      // Navigation
      home: 'Utama',
      trending: 'Trending',
      categories: 'Kategori',
      profile: 'Profil',
      
      // Authentication
      signIn: 'Log Masuk',
      signUp: 'Daftar',
      signOut: 'Log Keluar',
      email: 'E-mel',
      password: 'Kata Laluan',
      confirmPassword: 'Sahkan Kata Laluan',
      forgotPassword: 'Lupa Kata Laluan?',
      
      // Polls
      createPoll: 'Cipta Undian',
      pollQuestion: 'Soalan Undian',
      addOption: 'Tambah Pilihan',
      vote: 'Undi',
      voted: 'Telah Mengundi',
      results: 'Keputusan',
      votes: 'undi',
      noPolls: 'Tiada undian dijumpai',
      
      // Categories
      politics: 'Politik',
      technology: 'Teknologi',
      entertainment: 'Hiburan',
      sports: 'Sukan',
      lifestyle: 'Gaya Hidup',
      worldNews: 'Berita Dunia',
      
      // Comments
      comments: 'Komen',
      addComment: 'Tambah Komen',
      reply: 'Balas',
      anonymous: 'Tanpa Nama',
      
      // Time
      justNow: 'Baru sahaja',
      minutesAgo: '{{count}} minit yang lalu',
      hoursAgo: '{{count}} jam yang lalu',
      daysAgo: '{{count}} hari yang lalu',
      
      // Common
      loading: 'Memuatkan...',
      save: 'Simpan',
      cancel: 'Batal',
      delete: 'Padam',
      edit: 'Edit',
      share: 'Kongsi',
      search: 'Cari',
      filter: 'Tapis',
      
      // Translation
      translated: 'Diterjemah',
      showOriginal: 'Tunjuk Asal',
      machineTranslated: 'Terjemahan Mesin',
      
      // Trending News
      trendingNewsPolls: 'Undian Berita Trending',
      basedOnNews: 'Berdasarkan berita trending'
    }
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: typeof window !== 'undefined' ? ['localStorage'] : []
    }
  })

export default i18n