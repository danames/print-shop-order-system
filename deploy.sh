#!/bin/bash

# Print Shop Order Management System - Deployment Script
# This script deploys the application to DigitalOcean

echo "🚀 Starting deployment of Print Shop Order Management System..."

# Check if we're on the server
if [ ! -f "/etc/os-release" ]; then
    echo "❌ This script should be run on the DigitalOcean server"
    exit 1
fi

# Update system packages
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install Node.js if not already installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs
fi

# Install PM2 if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Install nginx if not already installed
if ! command -v nginx &> /dev/null; then
    echo "📦 Installing nginx..."
    apt install nginx -y
fi

# Install SQLite if not already installed
if ! command -v sqlite3 &> /dev/null; then
    echo "📦 Installing SQLite..."
    apt install sqlite3 -y
fi

# Create application directory
APP_DIR="/opt/print-shop-order-system"
echo "📁 Creating application directory: $APP_DIR"
mkdir -p $APP_DIR

# Copy application files
echo "📋 Copying application files..."
cp -r . $APP_DIR/
cd $APP_DIR

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Create uploads directory
echo "📁 Creating uploads directory..."
mkdir -p uploads
chmod 755 uploads

# Set up nginx configuration
echo "⚙️ Configuring nginx..."
cat > /etc/nginx/sites-available/print-shop-order-system << EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /uploads/ {
        alias $APP_DIR/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/print-shop-order-system /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Restart nginx
systemctl restart nginx
systemctl enable nginx

# Set up PM2 configuration
echo "⚙️ Configuring PM2..."
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'print-shop-order-system',
    script: 'server.js',
    cwd: '$APP_DIR',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF

# Start the application with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Set up firewall
echo "🔥 Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Create systemd service for PM2
echo "⚙️ Creating systemd service..."
pm2 startup systemd -u root --hp /root

echo "✅ Deployment complete!"
echo ""
echo "🌐 Your application is now running at:"
echo "   TV Display: http://$(curl -s ifconfig.me)/"
echo "   Admin Panel: http://$(curl -s ifconfig.me)/admin"
echo "   Order Form: http://$(curl -s ifconfig.me)/order"
echo ""
echo "🔑 Default admin credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "📊 To monitor the application:"
echo "   pm2 status"
echo "   pm2 logs"
echo "   pm2 restart print-shop-order-system"
echo ""
echo "🔧 To update the application:"
echo "   1. Copy new files to $APP_DIR"
echo "   2. Run: pm2 restart print-shop-order-system"
