#!/bin/bash

# Confession Game Deployment Script
# This script deploys the application using Docker Compose

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env"
ENV_EXAMPLE=".env.production"

echo -e "${GREEN}🚀 Starting Confession Game Deployment${NC}"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites satisfied${NC}"

# Check for .env file
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠️  .env file not found.${NC}"
    
    if [ -f "$ENV_EXAMPLE" ]; then
        echo -e "${YELLOW}📝 Copying .env.production to .env...${NC}"
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        echo -e "${RED}⚠️  Please edit .env file with your production values before continuing!${NC}"
        echo -e "${YELLOW}Press Enter after you've updated the .env file...${NC}"
        read -r
    else
        echo -e "${RED}❌ No .env.production template found!${NC}"
        exit 1
    fi
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Pull latest changes (optional, comment out if deploying from local)
# echo -e "${YELLOW}📥 Pulling latest changes from repository...${NC}"
# git pull origin main

# Build and start containers
echo -e "${YELLOW}🏗️  Building Docker images...${NC}"
docker-compose -f "$COMPOSE_FILE" build --no-cache

echo -e "${YELLOW}🚀 Starting services...${NC}"
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
docker-compose -f "$COMPOSE_FILE" exec -T app npx prisma migrate deploy

# Check service status
echo -e "${YELLOW}📊 Checking service status...${NC}"
docker-compose -f "$COMPOSE_FILE" ps

# Show logs (last 20 lines)
echo -e "${YELLOW}📜 Recent logs:${NC}"
docker-compose -f "$COMPOSE_FILE" logs --tail=20

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Application should be accessible at: http://localhost (or your domain)${NC}"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  View logs:       docker-compose -f $COMPOSE_FILE logs -f"
echo "  Stop services:   docker-compose -f $COMPOSE_FILE down"
echo "  Restart app:     docker-compose -f $COMPOSE_FILE restart app"
echo "  View status:     docker-compose -f $COMPOSE_FILE ps"
echo ""
echo -e "${YELLOW}To enable admin tools (Adminer, Redis Commander):${NC}"
echo "  docker-compose -f $COMPOSE_FILE --profile tools up -d"