#!/bin/bash

echo "🚀 Setting up Confess & Play application..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build shared package
echo "🔨 Building shared package..."
cd packages/shared
npm run build
cd ../..

# Initialize Prisma
echo "🗄️ Setting up database..."
cd apps/server

# Generate Prisma client
npx prisma generate

# Create initial migration
npx prisma migrate dev --name init --skip-seed

cd ../..

echo "✅ Setup complete!"
echo ""
echo "To start the application:"
echo "1. Start PostgreSQL and Redis (via Docker or locally)"
echo "2. Run: npm run dev"
echo ""
echo "The application will be available at:"
echo "- Client: http://localhost:3000"
echo "- Server: http://localhost:3001"