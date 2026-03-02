const jwt = require('jsonwebtoken');

// Simple authentication middleware for Discord bot requests
const authenticateBot = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ success: false, message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ make sure this token is specifically for the bot
    if (decoded?.type !== "discord_bot") {
      return res.status(403).json({ success: false, message: "Forbidden. Not a bot token." });
    }

    req.bot = decoded;
    next();
  } catch {
    return res.status(400).json({ success: false, message: "Invalid token." });
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