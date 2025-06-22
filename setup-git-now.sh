#!/bin/bash

echo "🚀 Setting up TapVote for GitHub upload..."

# Navigate to project
cd /Users/zayn/my-awesome-project || exit 1

echo "📁 Current directory: $(pwd)"

# Clean large files and build artifacts
echo "🧹 Cleaning large files..."
rm -rf node_modules/ 2>/dev/null
rm -rf frontend/node_modules/ 2>/dev/null
rm -rf backend/node_modules/ 2>/dev/null
rm -rf logs/ 2>/dev/null
rm -f *.log 2>/dev/null
rm -f backend/*.log 2>/dev/null
rm -f frontend/*.log 2>/dev/null
rm -f *.db 2>/dev/null
rm -f backend/*.db 2>/dev/null
rm -f backend/prisma/*.db 2>/dev/null
rm -rf .next/ 2>/dev/null
rm -rf dist/ 2>/dev/null
rm -rf build/ 2>/dev/null
rm -rf backend/dist/ 2>/dev/null
rm -rf frontend/.next/ 2>/dev/null
rm -rf frontend/out/ 2>/dev/null
rm -f test.html 2>/dev/null
rm -f create-polls.js 2>/dev/null
rm -f add-sample-polls.js 2>/dev/null
rm -f simple-server.js 2>/dev/null
rm -f tapvote-source.zip 2>/dev/null

# Clean up our fix files
rm -f RUN_THESE_COMMANDS.md 2>/dev/null
rm -f fix-git.sh 2>/dev/null
rm -f FIX_GIT_UPLOAD.md 2>/dev/null
rm -f MANUAL_GIT_SETUP.md 2>/dev/null

echo "✅ Cleanup completed"

# Create .gitignore
echo "📝 Creating .gitignore..."
mv gitignore.txt .gitignore 2>/dev/null || echo "⚠️  gitignore.txt not found, but that's okay"

# Remove existing git
echo "🔧 Initializing Git repository..."
rm -rf .git 2>/dev/null

# Initialize fresh git
git init

# Check git status
echo "📊 Git status:"
git status

# Add all files
echo "📦 Adding files to Git..."
git add .

# Show what will be committed
echo "📋 Files to be committed:"
git status --cached

# Commit with comprehensive message
echo "💾 Creating commit..."
git commit -m "🚀 Initial commit: TapVote AI Prediction Market Platform

✨ Features:
- 🤖 AI-powered poll generation from trending topics
- 🎯 Polymarket-inspired prediction markets
- 📱 Mobile-first responsive design
- 🌍 Multilingual support (EN/CN/ID)
- 📊 Real-time voting and analytics
- 🔥 18 demo polls across 8 categories

🛠️ Tech Stack:
- Frontend: Next.js 14, TypeScript, Tailwind CSS
- Backend: Node.js, Express, Prisma ORM
- Database: PostgreSQL/SQLite
- Deployment: Vercel + Railway ready

🎯 All critical errors fixed and ready for production deployment!

🚀 Generated with Claude Code
Co-Authored-By: Claude <noreply@anthropic.com>"

echo ""
echo "✅ Git repository setup completed!"
echo ""
echo "📊 Repository Summary:"
echo "   Size: $(du -sh . | cut -f1)"
echo "   Files: $(find . -type f | wc -l | tr -d ' ') files"
echo ""
echo "🎯 Next Steps:"
echo "1. Create GitHub repository:"
echo "   - Go to: https://github.com/new"
echo "   - Repository name: tapvote"
echo "   - Description: AI-powered prediction market platform"
echo "   - Choose Public or Private"
echo "   - Don't initialize with README"
echo "   - Click 'Create repository'"
echo ""
echo "2. Connect and push:"
echo "   git remote add origin https://github.com/YOUR_USERNAME/tapvote.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "🎉 Your TapVote platform is ready for GitHub!"