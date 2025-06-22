# 🗳️ TapVote - AI-Powered Prediction Market Platform

> **Next-generation polling and prediction markets with AI-generated content**

[![Deploy Backend](https://img.shields.io/badge/Deploy-Railway-blueviolet)](https://railway.app)
[![Deploy Frontend](https://img.shields.io/badge/Deploy-Vercel-black)](https://vercel.com)
[![Live Demo](https://img.shields.io/badge/Demo-Live-green)](#)

**TapVote** is a modern prediction market platform that combines real-time polling, AI-powered content generation, and Polymarket-inspired prediction markets in a mobile-first, multilingual experience.

## 🎯 **Features**

### **Core Platform**
- 🗳️ **Real-time Polling** - Anonymous voting with live results
- 🤖 **AI Poll Generation** - GPT-powered polls from trending topics
- 🎯 **Prediction Markets** - Polymarket-inspired betting on outcomes
- 🌍 **Multilingual** - English, Chinese, Indonesian support
- 📱 **Mobile-First** - Touch-optimized responsive design

### **Advanced Features**
- 📈 **Market Odds** - Dynamic probability calculations
- 🔥 **Trending Topics** - AI-curated from news and social media
- 📊 **Analytics Dashboard** - Real-time voting analytics
- 🏆 **Leaderboards** - User reputation and achievement system
- 💬 **Comments & Discussions** - Community engagement features

### **AI-Powered Content**
- 🤖 **Auto-generation** - Create polls from trending news
- 📰 **News Integration** - Real-time topic analysis
- 🎯 **Smart Categorization** - Automatic content classification
- 📊 **Sentiment Analysis** - Public opinion insights

## 🚀 Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **React i18next** - Internationalization
- **Heroicons** - Beautiful icons
- **Chart.js** - Data visualization

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Prisma ORM** - Database management
- **SQLite** - Development database
- **JWT** - Authentication
- **Socket.io** - Real-time updates
- **bcrypt** - Password hashing

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/tapvote.git
cd tapvote
```

### 2. Install dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Setup the database
```bash
cd backend
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 4. Start development servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:3000
```

## 🎯 Usage

### Demo Account
- **Email:** test@tapvote.com
- **Password:** testpassword123

### Creating Polls
1. Click "Create Poll" or visit `/create`
2. Enter your question and 2-6 options
3. Select a category
4. Set expiration (optional)
5. Publish and share!

### Voting
1. Browse polls on the homepage or by category
2. Click on any option to vote
3. View real-time results with animated progress bars
4. See charts and analytics

## 🛠️ API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login

### Polls
- `GET /api/polls` - List polls with pagination
- `POST /api/polls` - Create new poll
- `POST /api/polls/:id/vote` - Vote on poll

### Categories
- `GET /api/categories` - List all categories

## 🎨 Design System

### Colors
- **Primary:** Blue (#3B82F6) to Purple (#8B5CF6) gradients
- **Secondary:** Orange (#F97316) for trending
- **Success:** Green (#10B981) for positive actions

### Components
- Glass morphism cards with backdrop blur
- Animated progress bars and buttons
- Interactive poll cards
- Responsive navigation

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

---

**Made with ❤️ by the TapVote team**