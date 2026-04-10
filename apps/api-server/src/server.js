const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
}

const membersRoutes = require('./routes/members');
const shiniesRoutes = require('./routes/shinies');
const feebasRoutes = require('./routes/feebas');
const { generateBotToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

const explicitProductionOrigins = new Set([
  'https://team-soju.netlify.app',
  'https://teamsoju.com',
  'https://www.teamsoju.com',
  'https://soju.team',
  'https://www.soju.team',
  'https://team-soju-hpzrujm4n-tu-annguyens-projects.vercel.app',
]);

const allowedPreviewOriginPatterns = [
  /^https:\/\/[a-z0-9-]+\.netlify\.app$/i,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/i,
];

function isAllowedProductionOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (explicitProductionOrigins.has(origin)) {
    return true;
  }

  return allowedPreviewOriginPatterns.some((pattern) => pattern.test(origin));
}

function isAllowedDevelopmentOrigin(origin) {
  return !origin || origin === 'http://localhost:3000' || origin === 'http://localhost:4321';
}

// Middleware
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    const isAllowed = process.env.NODE_ENV === 'production'
      ? isAllowedProductionOrigin(origin)
      : isAllowedDevelopmentOrigin(origin);

    if (isAllowed) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Team Soju API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Generate bot token endpoint (for initial setup)
app.get('/generate-bot-token', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Token generation not available in production'
    });
  }
  
  const token = generateBotToken();
  res.json({
    success: true,
    token: token,
    message: 'Bot token generated successfully'
  });
});

// API Routes
app.use('/api/members', membersRoutes);
app.use('/api/shinies', shiniesRoutes); 
app.use('/api/feebas', feebasRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: error.message })
  });
});

// Start server (skipped during tests)
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Team Soju API server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔑 Generate bot token: http://localhost:${PORT}/generate-bot-token`);
    }
  });
}

// Trust proxy settings for secure cookies in production
app.set("trust proxy", 1);

// Start the cron job to keep the server alive
const job = require('./cron').job;
job.start();

module.exports = app;
