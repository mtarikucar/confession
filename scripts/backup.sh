#!/bin/bash

# Database Backup Script for Confession Game
# This script creates backups of the PostgreSQL database

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
COMPOSE_FILE="docker-compose.production.yml"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Database configuration
DB_CONTAINER="confession_game_postgres"
DB_NAME="confession_game"
DB_USER="postgres"

echo -e "${GREEN}📦 Starting database backup...${NC}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create backup filename
BACKUP_FILE="${BACKUP_DIR}/backup_${DB_NAME}_${TIMESTAMP}.sql"
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"

# Check if container is running
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo -e "${RED}❌ Database container is not running!${NC}"
    echo -e "${YELLOW}Start the services first with: docker-compose -f $COMPOSE_FILE up -d${NC}"
    exit 1
fi

# Create backup
echo -e "${YELLOW}🔄 Creating backup...${NC}"
docker exec -t "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"

# Check if backup was created
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Backup failed!${NC}"
    exit 1
fi

# Compress backup
echo -e "${YELLOW}🗜️  Compressing backup...${NC}"
gzip "$BACKUP_FILE"

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_FILE_GZ" | cut -f1)

echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo -e "${GREEN}📁 Backup saved to: $BACKUP_FILE_GZ${NC}"
echo -e "${GREEN}📊 Backup size: $BACKUP_SIZE${NC}"

# Clean old backups (keep last 7 days)
echo -e "${YELLOW}🧹 Cleaning old backups...${NC}"
find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -mtime +7 -delete

# List recent backups
echo -e "${YELLOW}📋 Recent backups:${NC}"
ls -lh "$BACKUP_DIR"/backup_${DB_NAME}_*.sql.gz 2>/dev/null | tail -5 || echo "No backups found"

echo ""
echo -e "${YELLOW}To restore from this backup:${NC}"
echo "  1. Decompress: gunzip $BACKUP_FILE_GZ"
echo "  2. Restore: docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME < ${BACKUP_FILE}"