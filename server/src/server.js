const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const membersRoutes = require('./routes/members');
const shiniesRoutes = require('./routes/shinies');
const { generateBotToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://team-soju.netlify.app', 'https://your-domain.com']
    : ['http://localhost:3000', 'http://localhost:4321'],
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Team Soju API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔑 Generate bot token: http://localhost:${PORT}/generate-bot-token`);
  }
});

module.exports = app;