const jwt = require('jsonwebtoken');

// Simple authentication middleware for Discord bot requests
const authenticateBot = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.bot = decoded;
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Generate a token for the Discord bot
const generateBotToken = () => {
  return jwt.sign(
    { 
      type: 'discord_bot',
      permissions: ['read', 'write', 'delete']
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

module.exports = {
  authenticateBot,
  generateBotToken
};