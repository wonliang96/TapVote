# 🚀 TapVote Production Deployment Guide

## **Quick Deploy Commands**

### **1. Backend (Railway - Recommended)**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway link
railway up

# Set environment variables in Railway dashboard:
# DATABASE_URL, JWT_SECRET, CORS_ORIGIN
```

### **2. Frontend (Vercel - Recommended)**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy frontend
cd frontend
vercel

# Set environment variable in Vercel dashboard:
# NEXT_PUBLIC_API_URL=https://your-backend.railway.app
```

---

## 📋 **Environment Variables Checklist**

### **Backend (.env.production)**
```bash
# Copy and update these values
DATABASE_URL="postgresql://user:pass@host:port/db"
JWT_SECRET="your-super-secure-32-char-secret-key"
CORS_ORIGIN="https://your-frontend.vercel.app"
NODE_ENV="production"
PORT=5000

# Optional (will use demo mode if empty)
OPENAI_API_KEY=""
NEWS_API_KEY=""
```

### **Frontend (.env.local)**
```bash
NEXT_PUBLIC_API_URL="https://your-backend.railway.app"
NEXT_PUBLIC_APP_URL="https://your-frontend.vercel.app"
NEXT_PUBLIC_ENABLE_AI_POLLS=true
NEXT_PUBLIC_ENABLE_PREDICTIONS=true
```

---

## 🔧 **Deployment Services Comparison**

| Service | Backend | Frontend | Database | Cost |
|---------|---------|----------|----------|------|
| **Railway** | ✅ Best | ❌ | ✅ PostgreSQL | $5/month |
| **Render** | ✅ Good | ✅ Static | ✅ PostgreSQL | Free tier |
| **Vercel** | ❌ | ✅ Best | ❌ | Free for frontend |
| **Netlify** | ❌ | ✅ Good | ❌ | Free for frontend |

**Recommended Combo**: Railway (Backend) + Vercel (Frontend)

---

## 🎯 **Step-by-Step Deployment**

### **Phase 1: Backend Setup**

1. **Create Railway Account**
   - Sign up at [railway.app](https://railway.app)
   - Connect GitHub account

2. **Deploy Backend**
   ```bash
   cd backend
   railway login
   railway init
   railway up
   ```

3. **Add Database**
   - In Railway dashboard: Add PostgreSQL service
   - Copy DATABASE_URL from Variables tab

4. **Set Environment Variables** in Railway dashboard:
   ```
   DATABASE_URL=postgresql://... (auto-generated)
   JWT_SECRET=create-your-32-char-secret
   CORS_ORIGIN=https://your-frontend-domain.vercel.app
   NODE_ENV=production
   ```

5. **Verify Backend**
   ```bash
   curl https://your-backend.railway.app/health
   ```

### **Phase 2: Frontend Setup**

1. **Update API Configuration**
   ```bash
   cd frontend
   echo "NEXT_PUBLIC_API_URL=https://your-backend.railway.app" > .env.local
   ```

2. **Deploy to Vercel**
   ```bash
   vercel
   # Follow prompts, choose existing project or create new
   ```

3. **Set Environment Variables** in Vercel dashboard:
   - `NEXT_PUBLIC_API_URL`: Your Railway backend URL
   - `NEXT_PUBLIC_APP_URL`: Your Vercel app URL

4. **Verify Frontend**
   - Visit your Vercel URL
   - Test poll voting functionality

---

## 🔒 **Security Configuration**

### **Required Security Settings**

1. **JWT Secret**: Minimum 32 characters, unique for production
   ```bash
   # Generate secure secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **CORS Origin**: Exact frontend domain (no wildcards)
   ```bash
   CORS_ORIGIN="https://tapvote.vercel.app"  # No trailing slash
   ```

3. **Environment Variables**: Never commit to Git
   ```bash
   # Add to .gitignore
   .env
   .env.local
   .env.production
   ```

---

## 📊 **Health Checks & Monitoring**

### **Automated Health Checks**

1. **Backend Health Endpoint**
   ```bash
   curl https://your-backend.railway.app/health
   
   # Expected response:
   {
     "status": "ok",
     "database": "connected",
     "uptime": 12345
   }
   ```

2. **Frontend Accessibility**
   ```bash
   curl -I https://your-frontend.vercel.app
   # Should return 200 OK
   ```

### **Monitoring Setup** (Optional)

1. **UptimeRobot**: Free uptime monitoring
2. **Sentry**: Error tracking and performance
3. **Vercel Analytics**: Built-in performance metrics

---

## 🐛 **Troubleshooting Guide**

### **Common Issues & Solutions**

1. **502 Bad Gateway (Backend)**
   - Check Railway logs for startup errors
   - Verify DATABASE_URL is correct
   - Ensure all dependencies installed

2. **CORS Errors (Frontend)**
   ```bash
   # Fix CORS_ORIGIN in backend environment
   CORS_ORIGIN="https://your-exact-frontend-domain.vercel.app"
   ```

3. **Database Connection Failed**
   - Verify PostgreSQL service is running
   - Check DATABASE_URL format
   - Test connection manually

4. **Environment Variables Not Loading**
   - Redeploy after setting variables
   - Check spelling and capitalization
   - Verify no trailing spaces

### **Debug Commands**

```bash
# Check backend deployment status
railway status

# View backend logs
railway logs

# Check frontend build logs
vercel logs your-deployment-url

# Test API connectivity
curl -v https://your-backend.railway.app/api/polls
```

---

## 🚀 **Go Live Checklist**

- [ ] **Backend deployed to Railway**
- [ ] **PostgreSQL database connected**
- [ ] **Environment variables configured**
- [ ] **Health endpoint returning 200 OK**
- [ ] **Frontend deployed to Vercel**
- [ ] **API URL configured in frontend**
- [ ] **CORS properly configured**
- [ ] **Sample polls loaded and votable**
- [ ] **Mobile experience tested**
- [ ] **AI poll generation working (or gracefully failing)**
- [ ] **Custom domain configured** (optional)

---

## 🎉 **You're Live!**

Once deployed, your TapVote MVP will be accessible to users worldwide!

**Share your live URLs**:
- Frontend: `https://your-app.vercel.app`
- Backend API: `https://your-backend.railway.app`
- Mobile: `https://your-app.vercel.app/mobile`

**Next steps**:
1. Share with beta users for feedback
2. Monitor usage and performance
3. Iterate based on user feedback
4. Scale infrastructure as needed

🎯 **Your prediction market platform is ready to change the world!**