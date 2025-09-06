const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Import routes
const { router: authRoutes } = require('./src/backend/routes/auth');
const orderRoutes = require('./src/backend/routes/orders');
const settingsRoutes = require('./src/backend/routes/settings');
const uploadRoutes = require('./src/backend/routes/upload');

// Import database
const { initDatabase } = require('./src/database/init');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);

// Serve React apps
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

app.get('/order', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'order', 'index.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display', 'index.html'));
});

// Socket.io for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Make io available to routes
app.set('io', io);

// Initialize database and start server
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`TV Display: http://localhost:${PORT}`);
    console.log(`Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`Order Form: http://localhost:${PORT}/order`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

module.exports = { app, io };
