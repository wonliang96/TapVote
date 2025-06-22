# 🚀 TapVote Deployment Guide

This guide covers deploying TapVote to various platforms. Choose the option that best fits your needs.

## 📋 Prerequisites

- Node.js 18+ installed
- Git repository set up
- Domain name (optional but recommended)

## 🌐 Option 1: Vercel + Railway (Recommended)

### Frontend on Vercel

1. **Push to GitHub first:**
   ```bash
   git remote add origin https://github.com/yourusername/tapvote.git
   git push -u origin main
   ```

2. **Deploy Frontend:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Set **Root Directory** to `frontend`
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - Add environment variables:
     ```
     NEXT_PUBLIC_API_URL=https://your-backend-url.up.railway.app
     ```

### Backend on Railway

1. **Deploy Backend:**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Set **Root Directory** to `backend`
   - **Start Command:** `npm run build && npm start`

2. **Add Environment Variables:**
   ```
   DATABASE_URL=file:./dev.db
   JWT_SECRET=your-super-secret-jwt-key-here
   NODE_ENV=production
   PORT=5000
   FRONTEND_URL=https://your-frontend-url.vercel.app
   ```

3. **Generate Domain:**
   - Railway will provide a public URL
   - Update Vercel's `NEXT_PUBLIC_API_URL` with this URL

---

## 🔵 Option 2: Netlify + Heroku

### Frontend on Netlify

1. **Build Settings:**
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** `frontend/.next`

2. **Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://your-app-name.herokuapp.com
   ```

### Backend on Heroku

1. **Create Heroku App:**
   ```bash
   heroku create your-app-name
   git subtree push --prefix backend heroku main
   ```

2. **Set Environment Variables:**
   ```bash
   heroku config:set DATABASE_URL=file:./dev.db
   heroku config:set JWT_SECRET=your-secret-key
   heroku config:set NODE_ENV=production
   ```

---

## 🟠 Option 3: DigitalOcean Droplet (Full Control)

### 1. Create Droplet
- **OS:** Ubuntu 22.04 LTS
- **Size:** $6/month basic droplet
- **Add your SSH key**

### 2. Server Setup
```bash
# Connect to server
ssh root@your-droplet-ip

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install Nginx
apt install nginx -y
```

### 3. Deploy Application
```bash
# Clone repository
git clone https://github.com/yourusername/tapvote.git
cd tapvote

# Setup Backend
cd backend
npm install
npm run build
pm2 start dist/server.js --name "tapvote-backend"

# Setup Frontend
cd ../frontend
npm install
npm run build
pm2 start npm --name "tapvote-frontend" -- start
```

### 4. Configure Nginx
```bash
# Create Nginx config
nano /etc/nginx/sites-available/tapvote
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/tapvote /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Setup SSL with Let's Encrypt
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

---

## 📱 Option 4: Docker Deployment

### 1. Create Dockerfile for Backend
```dockerfile
# backend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

### 2. Create Dockerfile for Frontend
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### 3. Docker Compose
```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=file:./dev.db
      - JWT_SECRET=your-secret-key
      - NODE_ENV=production
    volumes:
      - ./backend/prisma:/app/prisma

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:5000
    depends_on:
      - backend
```

```bash
# Deploy
docker-compose up -d
```

---

## 🔧 Environment Variables Reference

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

### Backend (.env)
```env
DATABASE_URL=file:./dev.db
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-url.com
```

---

## 🛠️ Post-Deployment Checklist

### 1. Database Setup
```bash
cd backend
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 2. Test Endpoints
```bash
# Health check
curl https://your-api-url.com/api/health

# Test registration
curl -X POST https://your-api-url.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

### 3. DNS Configuration
- Point your domain to deployment IP/URL
- Set up CNAME for www subdomain
- Configure SSL certificate

### 4. Monitoring Setup
```bash
# For DigitalOcean - Set up PM2 monitoring
pm2 startup
pm2 save
pm2 install pm2-logrotate
```

---

## 🚨 Troubleshooting

### Common Issues

1. **CORS Errors:**
   ```typescript
   // backend/src/server.ts - Update CORS settings
   app.use(cors({
     origin: process.env.FRONTEND_URL || 'http://localhost:3000',
     credentials: true
   }))
   ```

2. **Database Connection:**
   ```bash
   # Ensure Prisma schema is up to date
   npx prisma generate
   npx prisma db push
   ```

3. **Environment Variables:**
   - Double-check all environment variables are set
   - Restart services after changes

4. **Build Errors:**
   ```bash
   # Clear build cache
   rm -rf .next node_modules package-lock.json
   npm install
   npm run build
   ```

---

## 📊 Recommended Architecture

**Production Setup:**
- **Frontend:** Vercel (CDN + Edge functions)
- **Backend:** Railway (Database + API)
- **Domain:** Cloudflare (DNS + Security)
- **Monitoring:** Sentry (Error tracking)

**Budget:** ~$10/month total

---

**🎉 Your TapVote platform will be live and ready for users!**