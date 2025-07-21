const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.CALLER_URL || 'http://localhost:8000',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:3000',
    // Add your production domains here
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

// Enhanced Socket.IO configuration
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

// Import routes
const qrRoutes = require('./routes/qr');
const callRoutes = require('./routes/calls');
const agoraRoutes = require('./routes/agora');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

// Import middleware
const { globalRateLimit } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Security middleware
app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(globalRateLimit);

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/qr_vehicle_emergency', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Enhanced Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);

  socket.on('join-user', (userId) => {
    socket.join(userId);
    console.log(`🏠 User ${userId} joined room`);
    socket.emit('joined', { userId, socketId: socket.id });
  });

  socket.on('call-initiated', (data) => {
    console.log('📞 Call initiated via socket:', data.callId);
    socket.to(data.receiverId).emit('incoming-call', data);
  });

  socket.on('call-answered', (data) => {
    console.log('✅ Call answered via socket:', data.callId);
    socket.to(data.callerId).emit('call-accepted', data);
  });

  socket.on('call-rejected', (data) => {
    console.log('❌ Call rejected via socket:', data.callId);
    socket.to(data.callerId).emit('call-rejected', data);
  });

  socket.on('call-ended', (data) => {
    console.log('📴 Call ended via socket:', data.callId);
    socket.to(data.participantId).emit('call-ended', data);
  });

  socket.on('emergency-alert', (data) => {
    console.log('🚨 Emergency alert:', data);
    socket.broadcast.emit('emergency-alert', data);
  });

  socket.on('disconnect', (reason) => {
    console.log('👋 User disconnected:', socket.id, 'Reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('🔥 Socket error:', error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'QR Vehicle Emergency System API',
    version: '2.0.0',
    description: 'Complete API for QR-based vehicle emergency calling system',
    endpoints: {
      auth: '/api/auth',
      qr: '/api/qr',
      calls: '/api/calls',
      agora: '/api/agora',
      notifications: '/api/notifications',
      admin: '/api/admin'
    },
    documentation: 'See README.md for complete API documentation'
  });
});

// API routes
app.use('/api/qr', qrRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/agora', agoraRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: ['/api', '/health']
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 QR Vehicle Emergency System API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API info: http://localhost:${PORT}/api`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = { app, io };