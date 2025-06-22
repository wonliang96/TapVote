#!/bin/bash

# TapVote GitHub Preparation Script
# This script prepares the repository for GitHub upload

echo "🚀 Preparing TapVote for GitHub..."

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo "📝 Creating .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env.production

# Database files
*.db
*.db-journal
database.db
dev.db
prisma/dev.db*

# Logs
logs/
*.log
combined.log
error.log
backend.log
frontend.log
server.log

# Build outputs
dist/
build/
.next/
out/

# IDEs and editors
.vscode/
.idea/
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Temporary files
tmp/
temp/
.tmp/

# Development test files
test.html
create-polls.js
add-sample-polls.js
simple-server.js
tapvote-source.zip
EOF
fi

# Initialize git if not already done
if [ ! -d .git ]; then
    echo "🔧 Initializing Git repository..."
    git init
fi

# Add all files
echo "📦 Adding files to Git..."
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "⚠️  No changes to commit"
else
    # Commit changes
    echo "💾 Committing changes..."
    git commit -m "🚀 Initial TapVote MVP - AI-powered prediction market platform

Features:
- 🤖 AI poll generation from trending topics
- 🎯 Polymarket-inspired prediction markets  
- 📱 Mobile-first responsive design
- 🌍 Multilingual support (EN/CN/ID)
- 📊 Real-time voting and analytics
- 🔥 Trending content curation

Tech Stack:
- Frontend: Next.js 14, TypeScript, Tailwind CSS
- Backend: Node.js, Express, Prisma ORM
- Database: PostgreSQL/SQLite
- AI: OpenAI GPT-4 integration
- Deployment: Vercel + Railway ready

Ready for production deployment! 🎉"
fi

echo ""
echo "✅ Repository prepared for GitHub!"
echo ""
echo "🎯 Next steps:"
echo "1. Create repository on GitHub: https://github.com/new"
echo "2. Add remote origin:"
echo "   git remote add origin https://github.com/yourusername/tapvote.git"
echo "3. Push to GitHub:"
echo "   git push -u origin main"
echo ""
echo "🚀 Deploy to production:"
echo "1. Backend: Railway.app"
echo "2. Frontend: Vercel.com"
echo "3. Follow PRODUCTION_DEPLOYMENT.md guide"
echo ""
echo "📊 Your TapVote MVP is ready to launch! 🎉"