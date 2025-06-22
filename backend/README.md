# TapVote Backend

RESTful API backend for the TapVote multilingual polling platform.

## 🚀 Features

- **RESTful API** with comprehensive endpoints
- **Real-time updates** via Socket.io
- **Multilingual support** with translation management
- **Authentication & Authorization** with JWT
- **Database** with Prisma ORM and PostgreSQL
- **News integration** for auto-generating trending polls
- **Rate limiting** and security middleware
- **Comprehensive logging** with Winston

## 📦 Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with bcrypt
- **Real-time**: Socket.io
- **Validation**: express-validator
- **Logging**: Winston
- **Security**: Helmet, CORS, Rate limiting

## 🛠️ Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**:
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # Seed database with initial data
   npx tsx prisma/seed.ts
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

## 📝 Environment Variables

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/tapvote"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# Server
PORT=5000
NODE_ENV="development"

# News API
NEWS_API_KEY="your-news-api-key"

# Optional: Google Translate API
GOOGLE_TRANSLATE_API_KEY="your-translate-api-key"

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN="http://localhost:3000"
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `PUT /api/auth/password` - Change password

### Polls
- `GET /api/polls` - Get polls with pagination/filtering
- `GET /api/polls/:id` - Get single poll
- `POST /api/polls` - Create new poll
- `POST /api/polls/:id/vote` - Vote on poll
- `GET /api/polls/:id/analytics` - Get poll analytics

### Comments
- `GET /api/comments?pollId=:id` - Get poll comments
- `POST /api/comments` - Create comment
- `DELETE /api/comments/:id` - Delete comment
- `POST /api/comments/:id/flag` - Flag comment

### Categories
- `GET /api/categories` - Get all categories
- `GET /api/categories/:slug` - Get category by slug

### News
- `GET /api/news/trending` - Get trending news
- `POST /api/news/generate-poll` - Generate poll from news
- `GET /api/news/polls` - Get news-based polls

## 🔄 Real-time Events

The backend supports real-time updates via Socket.io:

### Client Events
- `join-poll` - Join poll room for updates
- `leave-poll` - Leave poll room
- `vote-cast` - Notify of new vote
- `new-comment` - Notify of new comment
- `typing-start/stop` - Typing indicators

### Server Events
- `poll-results-updated` - Live poll results
- `new-comment` - New comment notification
- `user-typing` - Typing indicators
- `poll-updated` - General poll updates

## 🗄️ Database Schema

The database is designed for multilingual content with translation tables:

- **users** - User accounts and preferences
- **categories** - Poll categories with translations
- **polls** - Poll metadata
- **poll_translations** - Poll text in different languages
- **poll_options** - Poll voting options
- **poll_option_translations** - Option text translations
- **votes** - User votes with duplicate prevention
- **vote_snapshots** - Historical data for analytics
- **comments** - Threaded comments with translations
- **comment_translations** - Comment text translations

## 🔐 Security Features

- **Rate limiting** to prevent abuse
- **JWT authentication** for secure sessions
- **Input validation** with express-validator
- **Password hashing** with bcrypt
- **CORS protection** for cross-origin requests
- **Helmet middleware** for security headers
- **IP-based voting** protection for anonymous users

## 📊 Monitoring & Logging

- **Winston logging** with file rotation
- **Request/response logging** for debugging
- **Error tracking** with stack traces
- **Health check endpoint** at `/health`

## 🚀 Deployment

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start production server**:
   ```bash
   npm start
   ```

3. **Database migration** (production):
   ```bash
   npm run db:migrate
   ```

## 📈 Performance Considerations

- **Database indexing** for query optimization
- **Connection pooling** with Prisma
- **Caching strategies** for frequently accessed data
- **Pagination** for large data sets
- **Rate limiting** to prevent overload

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run database studio for inspection
npm run db:studio
```