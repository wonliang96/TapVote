# 🚀 Quick Deploy Commands

## After creating GitHub repository, run these commands:

```bash
# Connect to your GitHub repository
git remote add origin https://github.com/YOURUSERNAME/tapvote.git
git branch -M main
git push -u origin main
```

## Then deploy:

### 1. Deploy Frontend to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import from GitHub: `yourusername/tapvote`
4. **Root Directory:** `frontend`
5. **Framework:** Next.js (auto-detected)
6. **Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://tapvote-backend-production.up.railway.app
   ```
7. Click "Deploy"

### 2. Deploy Backend to Railway
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select `yourusername/tapvote`
4. **Root Directory:** `backend`
5. **Environment Variables:**
   ```
   DATABASE_URL=file:./dev.db
   JWT_SECRET=super-secret-jwt-key-minimum-32-characters-long
   NODE_ENV=production
   PORT=5000
   FRONTEND_URL=https://tapvote-frontend.vercel.app
   ```
6. Click "Deploy"

### 3. Update API URL
1. Copy Railway deployment URL (e.g., `https://tapvote-backend-production.up.railway.app`)
2. Go back to Vercel project settings
3. Update `NEXT_PUBLIC_API_URL` with Railway URL
4. Redeploy frontend

### 4. Update CORS
1. Copy Vercel deployment URL (e.g., `https://tapvote-frontend.vercel.app`)
2. Go back to Railway project settings
3. Update `FRONTEND_URL` with Vercel URL
4. Redeploy backend

## 🎉 Done! Your app will be live at:
- Frontend: https://tapvote-frontend.vercel.app
- Backend: https://tapvote-backend-production.up.railway.app

## Test with demo account:
- Email: test@tapvote.com
- Password: testpassword123