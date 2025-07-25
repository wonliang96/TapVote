# TapVote Deployment Guide

## Railway Backend Deployment

### IMPORTANT: Set Root Directory to `backend`
1. **Railway Settings:**
   - Root Directory: `backend` ⚠️ MUST SET THIS
   - Start Command: `node server.js`
   - Build Command: Leave empty (auto-detect)

2. **Environment Variables:**
   ```
   DATABASE_URL=file:./dev.db
   NODE_ENV=production
   PORT=3000
   ```

### Method 2: Manual Configuration
If auto-detection fails:
- Ensure `backend/package.json` has minimal dependencies
- Use `simple-server.js` (not complex TypeScript build)

## Vercel Frontend Deployment

1. **Import from GitHub**
2. **Settings:**
   - Framework: Next.js
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Environment Variables: 
     ```
     NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
     ```

## File Structure
```
TapVote/
├── backend/           # Railway deploys this
│   ├── simple-server.js
│   ├── package.json   # Minimal dependencies only
│   └── prisma/
└── frontend/          # Vercel deploys this
    ├── package.json
    └── src/
```

## Key Points
- Backend uses simplified `package.json` with minimal deps
- No railway.json conflicts at root level
- Clean separation of frontend/backend