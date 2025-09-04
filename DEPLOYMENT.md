# 🚀 Confession Game - Production Deployment Guide

This guide provides step-by-step instructions for deploying the Confession Game application to a VPS using Docker.

## 📋 Prerequisites

### VPS Requirements
- **OS**: Ubuntu 20.04 LTS or newer (recommended) / Any Linux distribution with Docker support
- **RAM**: Minimum 2GB (4GB recommended)
- **CPU**: 2 vCPU minimum
- **Storage**: 20GB minimum
- **Network**: Public IP address
- **Ports**: 80, 443 (for HTTPS), 22 (SSH)

### Required Software
- Docker (version 20.10+)
- Docker Compose (version 2.0+)
- Git
- SSL certificates (Let's Encrypt recommended)

## 🛠️ Installation Steps

### 1. Connect to Your VPS
```bash
ssh your_user@your_server_ip
```

### 2. Install Docker and Docker Compose

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version

# Logout and login again for group changes to take effect
exit
```

### 3. Clone the Repository

```bash
# Create app directory
sudo mkdir -p /opt/confession-game
sudo chown $USER:$USER /opt/confession-game
cd /opt

# Clone repository
git clone https://github.com/yourusername/confession-game.git
cd confession-game
```

### 4. Configure Environment Variables

```bash
# Copy production environment template
cp .env.production .env

# Edit the .env file with your production values
nano .env
```

**Important variables to update:**
- `POSTGRES_PASSWORD` - Strong database password
- `REDIS_PASSWORD` - Strong Redis password
- `SESSION_SECRET` - Long random string for sessions
- `JWT_SECRET` - Long random string for JWT
- `JWT_REFRESH_SECRET` - Different long random string
- `CLIENT_URL` - Your domain (e.g., https://yourdomain.com)
- `CORS_ORIGINS` - Your domain(s)

### 5. Set Up SSL Certificates (Recommended)

#### Option A: Using Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install certbot -y

# Stop nginx if running
sudo systemctl stop nginx

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates to project
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./nginx/ssl/
sudo chown $USER:$USER ./nginx/ssl/*
```

#### Option B: Using Self-Signed Certificates (Development only)

```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem
```

### 6. Update Nginx Configuration

```bash
# Edit nginx configuration with your domain
nano nginx/conf.d/default.conf
```

Uncomment the SSL sections and update `server_name` with your domain.

### 7. Deploy the Application

```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Run deployment
./scripts/deploy.sh
```

Or manually:

```bash
# Build and start all services
docker-compose -f docker-compose.production.yml up -d --build

# Check service status
docker-compose -f docker-compose.production.yml ps

# Run database migrations
docker-compose -f docker-compose.production.yml exec app npx prisma migrate deploy
```

## 🔧 Configuration

### Domain Setup

1. Point your domain's A record to your VPS IP address
2. If using www subdomain, create a CNAME record pointing to your main domain

### Firewall Configuration

```bash
# Install UFW (if not installed)
sudo apt install ufw -y

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

### Automatic SSL Renewal

```bash
# Add to crontab for automatic renewal
sudo crontab -e

# Add this line:
0 0 * * * certbot renew --quiet && docker-compose -f /opt/confession-game/docker-compose.production.yml restart nginx
```

## 📊 Monitoring

### View Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f app
docker-compose -f docker-compose.production.yml logs -f nginx
```

### Check Service Health

```bash
# Service status
docker-compose -f docker-compose.production.yml ps

# Health check
curl http://localhost/health
```

### Resource Usage

```bash
# Docker stats
docker stats

# System resources
htop
```

## 🔄 Maintenance

### Backup Database

```bash
# Run backup script
./scripts/backup.sh

# Or manually
docker exec confession_game_postgres pg_dump -U postgres confession_game > backup_$(date +%Y%m%d).sql
```

### Update Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.production.yml up -d --build

# Run new migrations if any
docker-compose -f docker-compose.production.yml exec app npx prisma migrate deploy
```

### Restart Services

```bash
# Restart all services
docker-compose -f docker-compose.production.yml restart

# Restart specific service
docker-compose -f docker-compose.production.yml restart app
```

### Scale Application

```bash
# Scale app service (if configured for scaling)
docker-compose -f docker-compose.production.yml up -d --scale app=3
```

## 🛡️ Security Best Practices

1. **Keep system updated**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Use strong passwords** for all services (database, Redis, etc.)

3. **Enable automatic security updates**
   ```bash
   sudo apt install unattended-upgrades -y
   sudo dpkg-reconfigure unattended-upgrades
   ```

4. **Set up fail2ban** for SSH protection
   ```bash
   sudo apt install fail2ban -y
   sudo systemctl enable fail2ban
   ```

5. **Regular backups** - Set up automated daily backups
   ```bash
   # Add to crontab
   0 2 * * * /opt/confession-game/scripts/backup.sh
   ```

6. **Monitor logs** regularly for suspicious activity

7. **Use SSH keys** instead of passwords for server access

## 🔍 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs app

# Check if ports are in use
sudo netstat -tulpn | grep -E ':(80|443|3004)'
```

### Database Connection Issues

```bash
# Check if database is running
docker-compose -f docker-compose.production.yml ps postgres

# Test database connection
docker-compose -f docker-compose.production.yml exec postgres psql -U postgres -d confession_game -c "SELECT 1"
```

### Permission Issues

```bash
# Fix ownership
sudo chown -R $USER:$USER /opt/confession-game

# Fix permissions
find /opt/confession-game -type d -exec chmod 755 {} \;
find /opt/confession-game -type f -exec chmod 644 {} \;
chmod +x scripts/*.sh
```

### High Memory Usage

```bash
# Check memory usage
docker stats

# Restart services to free memory
docker-compose -f docker-compose.production.yml restart

# Or restart specific service
docker-compose -f docker-compose.production.yml restart app
```

## 📱 Admin Tools

### Enable Admin Tools (Development only)

```bash
# Start with tools profile
docker-compose -f docker-compose.production.yml --profile tools up -d
```

Access:
- **Adminer** (Database): http://your-ip:8080
- **Redis Commander**: http://your-ip:8081

⚠️ **Warning**: Disable these in production or secure them with additional authentication.

## 🆘 Support

For issues or questions:
1. Check application logs
2. Review this documentation
3. Check the [GitHub Issues](https://github.com/yourusername/confession-game/issues)
4. Contact the development team

## 📝 Quick Reference

```bash
# Start services
docker-compose -f docker-compose.production.yml up -d

# Stop services
docker-compose -f docker-compose.production.yml down

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Restart app
docker-compose -f docker-compose.production.yml restart app

# Backup database
./scripts/backup.sh

# Update application
git pull && docker-compose -f docker-compose.production.yml up -d --build

# Check health
curl http://localhost/health
```

---

**Last Updated**: December 2024
**Version**: 1.0.0