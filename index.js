require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');

const app = express();

// ── Ensure logs directory exists ──────────────────────────────────────────────
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(mongoSanitize());

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000']
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── Rate Limiting ──────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please try again later.' }
});

// ── Body Parsing & Compression ────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HTTP Logging ──────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',       authLimiter, require('./routes/authRoutes'));
app.use('/api/users',      apiLimiter,  require('./routes/userRoutes'));
app.use('/api/properties', apiLimiter,  require('./routes/propertyRoutes'));
app.use('/api/apartments', apiLimiter,  require('./routes/apartmentRoutes'));
app.use('/api/contracts',  apiLimiter,  require('./routes/contractRoutes'));
app.use('/api/payments',   apiLimiter,  require('./routes/paymentRoutes'));
app.use('/api/expenses',   apiLimiter,  require('./routes/expenseRoutes'));
app.use('/api/meters',     apiLimiter,  require('./routes/meterRoutes'));
app.use('/api/bills',      apiLimiter,  require('./routes/billRoutes'));
app.use('/api/logs',       apiLimiter,  require('./routes/activityLogRoutes'));
app.use('/api/reports',    apiLimiter,  require('./routes/reportRoutes'));
app.use('/api/dashboard',  apiLimiter,  require('./routes/dashboardRoutes'));
app.use('/api/tenants',       apiLimiter,  require('./routes/tenantRoutes'));
app.use('/api/notifications', apiLimiter,  require('./routes/notificationRoutes'));
app.use('/api/suppliers',     apiLimiter,  require('./routes/supplierRoutes'));
app.use('/api/bank',          apiLimiter,  require('./routes/bankRoutes'));

// ── Serve React build in production ───────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, '../client/dist');
  app.use(express.static(buildPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(buildPath, 'index.html'));
    }
  });
}

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// ── Central Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Server Error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ── MongoDB Connection & Server Start ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    logger.info('✅ Connected to MongoDB Atlas');
    app.listen(PORT, () => logger.info(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`));
  })
  .catch(err => {
    logger.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

module.exports = app;
