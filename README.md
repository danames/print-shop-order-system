# Print Shop Order Management System v0.1

A comprehensive web-based order management system for print shops with live display capabilities, admin panel, and public order submission.

## 🚀 Features

### TV Display Monitor
- **Real-time order status display** for shop floor visibility
- **Dark mode interface** optimized for 55" 4K displays
- **Automatic page rotation** when multiple pages of orders exist
- **Status color coding** (Received: Blue, Paid: Green, In Progress: Orange, Ready: Yellow)
- **Live statistics** showing order counts by status
- **Pioneer Party branding** with logo and company colors

### Admin Panel
- **Complete order management** (Create, Read, Update, Delete)
- **User authentication** with secure login
- **Order search and filtering** capabilities
- **Settings management** for display colors, rotation timing, and business hours
- **CSV export** functionality for order data
- **Real-time updates** via WebSocket connections
- **Mobile responsive** design for tablet/phone access

### Public Order Form
- **Customer-friendly interface** for order submission
- **File upload support** (PDF, Word, Images up to 25MB)
- **Real-time price estimation** based on print specifications
- **Comprehensive print options** (paper size, type, color, binding, finishing)
- **Order confirmation** with order number and details
- **Mobile responsive** design for all devices

## 🏗️ Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: SQLite with comprehensive schema
- **Real-time**: Socket.io for live updates
- **File Upload**: Multer with validation
- **Authentication**: JWT tokens with bcrypt
- **Security**: Helmet, CORS, rate limiting
- **Frontend**: Vanilla JavaScript with modern ES6+
- **Styling**: CSS3 with responsive design
- **Deployment**: PM2 process manager with nginx reverse proxy

## 📁 Project Structure

```
├── README.md
├── package.json
├── server.js                 # Main server file
├── deploy.sh                 # Deployment script
├── src/
│   ├── backend/
│   │   └── routes/           # API routes (auth, orders, settings, upload)
│   └── database/
│       └── init.js           # Database initialization
├── public/
│   ├── display/              # TV display interface
│   ├── admin/                # Admin panel interface
│   ├── order/                # Public order form
│   ├── uploads/              # File upload storage
│   └── logo.svg              # Company logo
└── uploads/                  # File storage directory
```

## 🚀 Quick Start

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd print-shop-order-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - TV Display: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin
   - Order Form: http://localhost:3000/order

### Production Deployment (DigitalOcean)

1. **Connect to your DigitalOcean droplet**
   ```bash
   ssh root@YOUR_DROPLET_IP
   ```

2. **Upload the application files**
   ```bash
   scp -r . root@YOUR_DROPLET_IP:/opt/print-shop-order-system/
   ```

3. **Run the deployment script**
   ```bash
   cd /opt/print-shop-order-system
   chmod +x deploy.sh
   ./deploy.sh
   ```

4. **Access your live application**
   - TV Display: http://YOUR_DROPLET_IP/
   - Admin Panel: http://YOUR_DROPLET_IP/admin
   - Order Form: http://YOUR_DROPLET_IP/order

## 🔑 Default Credentials

- **Username**: admin
- **Password**: admin123

**⚠️ Important**: Change these credentials immediately after deployment!

## 📊 Order Workflow

1. **Customer submits order** via public form
2. **Order appears on TV display** with "Received" status
3. **Admin updates status** through admin panel:
   - Received → Paid → In Progress → Ready for Pickup
   - Or mark as Picked Up or Abandoned
4. **Real-time updates** sync across all interfaces
5. **Completed orders** remain in database but hidden from display

## ⚙️ Configuration

### Display Settings
- **Display Mode**: Dark/Light theme
- **Page Rotation**: 5-60 seconds between pages
- **Status Colors**: Customizable color scheme
- **Business Hours**: Configurable operating hours

### Pricing Configuration
- **Paper Sizes**: Letter, Legal, A4, 11x17
- **Paper Types**: Standard, Glossy, Matte, Cardstock
- **Color Modes**: Black & White, Color
- **Binding Options**: None, Staples, Spiral, Comb
- **Finishing**: None, Lamination, Folding, Cutting

## 🔒 Security Features

- **JWT Authentication** for admin access
- **Password hashing** with bcrypt
- **Rate limiting** to prevent abuse
- **File upload validation** (type and size)
- **Input sanitization** and validation
- **CORS protection** and security headers

## 📱 Mobile Support

- **Responsive design** for all screen sizes
- **Touch-friendly interfaces** for tablets
- **Mobile-optimized** order form
- **Admin panel** accessible on phones/tablets

## 🔄 Real-time Features

- **WebSocket connections** for live updates
- **Automatic refresh** when orders change
- **Live statistics** on display monitor
- **Instant synchronization** across all interfaces

## 📈 Future Versions

### v0.2 (Planned)
- File preview before submission
- Pre-defined print packages
- Enhanced pricing system

### v0.3 (Planned)
- Basic file editing/cropping
- Shopify payment integration
- Advanced order tracking

### v0.4 (Planned)
- Multiple file uploads
- Customer order history
- Online order tracking

### v0.5 (Planned)
- Customer accounts
- Reorder functionality
- Advanced analytics

## 🛠️ Maintenance

### Monitoring
```bash
pm2 status                    # Check application status
pm2 logs                      # View application logs
pm2 restart print-shop-order-system  # Restart application
```

### Database Backup
```bash
cp /opt/print-shop-order-system/orders.db /backup/orders-$(date +%Y%m%d).db
```

### Updates
1. Copy new files to `/opt/print-shop-order-system/`
2. Run `pm2 restart print-shop-order-system`
3. Check logs with `pm2 logs`

## 📞 Support

For technical support or feature requests, please contact the development team.

## 📄 License

This project is proprietary software developed for Pioneer Party. All rights reserved.

---

**Version**: 0.1  
**Last Updated**: December 2024  
**Status**: Production Ready
