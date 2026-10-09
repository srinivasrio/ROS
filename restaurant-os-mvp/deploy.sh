#!/bin/bash
set -e

echo "🚀 ========================================="
echo "🚀 Starting Dine In One Production Deploy"
echo "🚀 ========================================="

# Navigate to restaurant-os-mvp directory
cd "$(dirname "$0")"

echo "📥 1. Pulling latest code from origin/main..."
git fetch origin main
git reset --hard origin/main

echo "📦 2. Installing root dependencies..."
npm install --legacy-peer-deps

echo "📦 3. Installing super-admin dependencies..."
cd super-admin
npm install --legacy-peer-deps
cd ..

echo "🔨 4. Building main application (Port 3000)..."
rm -f .next/lock
NODE_OPTIONS='--max-http-header-size=131072 --max-old-space-size=4096' npm run build

echo "🔨 5. Building super-admin application (Port 3005)..."
npm run build:superadmin

echo "🔄 6. Zero-downtime reload via PM2..."
pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js

echo "💾 7. Saving PM2 state..."
pm2 save

echo "🎉 ========================================="
echo "🎉 Deployment completed successfully!"
echo "🎉 ========================================="
