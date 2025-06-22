# TapVote Setup Guide

Complete setup instructions for the TapVote multilingual polling platform.

## 🔧 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- News API key (optional, for trending news features)
- Google Translate API key (optional, for enhanced translation)

## 📦 Installation

### 1. Clone and Install Dependencies

```bash
# Install all dependencies
npm run install:all
```

### 2. Database Setup

```bash
# Set up PostgreSQL database
createdb tapvote

# Copy environment file
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/tapvote?schema=public"
JWT_SECRET="your-super-secret-jwt-key-here-min-32-chars"
JWT_EXPIRES_IN="7d"
PORT=5000
NODE_ENV="development"
NEWS_API_KEY="your-news-api-key-from-newsapi.org"
GOOGLE_TRANSLATE_API_KEY="your-google-translate-api-key"
CORS_ORIGIN="http://localhost:3000"
```

### 3. Database Schema & Seed Data

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Seed with initial data
npx tsx prisma/seed.ts
```

### 4. Start Development Servers

```bash
# From root directory - starts both frontend and backend
npm run dev
```

Or run individually:

```bash
# Frontend (port 3000)
cd frontend && npm run dev

# Backend (port 5000) 
cd backend && npm run dev
```

## 🌐 Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Database Studio**: `cd backend && npm run db:studio`

## 🧪 Test Account

A test account is created during seeding:

- **Email**: test@tapvote.com
- **Password**: testpassword123

## 📱 Features to Test

### Core Functionality
1. **Language Switching**: Use the language switcher in the header
2. **Poll Voting**: Vote on existing polls (works with/without login)
3. **Poll Creation**: Create new polls (requires login)
4. **Real-time Updates**: Vote and see results update live
5. **Comments**: Add comments to polls (anonymous or logged in)

### Multilingual Features
1. **Auto Translation**: Content automatically translates when you switch languages
2. **Show Original**: Click "Show Original" to see content in original language
3. **Translation Indicators**: See when content is machine translated

### Visualizations
1. **Poll Charts**: Click "Show Chart" after voting to see visual results
2. **Trend Analysis**: View how opinions change over time (needs historical data)

### Mobile Experience
1. **Responsive Design**: Test on mobile devices or browser dev tools
2. **Touch Interactions**: Tap to vote, swipe-friendly interface
3. **Mobile Navigation**: Bottom navigation bar on small screens

## 🔌 API Testing

Test the REST API endpoints:

```bash
# Get trending polls
curl http://localhost:5000/api/polls?trending=true

# Get categories
curl http://localhost:5000/api/categories

# Register user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@tapvote.com","password":"testpassword123"}'
```

## 🔄 Real-time Features

Test WebSocket functionality:

1. Open multiple browser tabs to the same poll
2. Vote in one tab, see results update in others
3. Add comments and see them appear in real-time

## 🎨 Customization

### Adding New Languages

1. **Frontend**: Add translations to `frontend/src/lib/i18n.ts`
2. **Backend**: Add language support in database seed
3. **Database**: Add new language entries to translation tables

### Styling

- Modify `frontend/src/app/globals.css` for global styles
- Update Tailwind configuration in `frontend/tailwind.config.js`
- Components use Tailwind utility classes

### API Extensions

- Add new routes in `backend/src/routes/`
- Extend database schema in `backend/prisma/schema.prisma`
- Run `npm run db:push` after schema changes

## 🚀 Deployment

### Production Build

```bash
# Build frontend
cd frontend && npm run build

# Build backend
cd backend && npm run build
```

### Environment Variables (Production)

Update these for production:

```env
NODE_ENV="production"
DATABASE_URL="your-production-db-url"
JWT_SECRET="strong-production-secret"
CORS_ORIGIN="https://your-domain.com"
```

### Deployment Platforms

#### Frontend (Vercel/Netlify)
- Deploy `frontend` directory
- Set environment variables in platform dashboard
- Configure build command: `npm run build`

#### Backend (Railway/Heroku/DigitalOcean)
- Deploy `backend` directory
- Set environment variables
- Run database migrations: `npm run db:migrate`

### Database Migration (Production)

```bash
# Generate migration files
npx prisma migrate dev --name init

# Apply to production
npx prisma migrate deploy
```

## 🛠️ Troubleshooting

### Common Issues

1. **Database Connection**: Ensure PostgreSQL is running and credentials are correct
2. **Port Conflicts**: Change ports in `.env` if 3000/5000 are in use
3. **Missing Dependencies**: Run `npm install` in both frontend and backend
4. **Prisma Issues**: Run `npm run db:generate` after schema changes

### Development Tips

- Use `npm run db:studio` to inspect database
- Check browser console for frontend errors
- Monitor backend logs for API issues
- Use React DevTools for component debugging

### Performance

- Enable caching in production
- Use CDN for static assets
- Implement database connection pooling
- Add Redis for session storage (optional)

## 📞 Support

For issues or questions:
1. Check this setup guide
2. Review the README files in frontend/backend directories
3. Check the database schema documentation
4. Ensure all environment variables are set correctly

## 🎯 Next Steps

After basic setup:
1. Configure news API for trending topics
2. Set up Google Translate for better translations
3. Add social media sharing
4. Implement push notifications
5. Add user profile pictures
6. Create mobile app using React Native