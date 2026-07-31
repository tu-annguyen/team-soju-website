const User = require('./models/User');
const {
  clearAuthCookie,
  getTokenFromRequest,
  verifyUserToken,
} = require('../middleware/auth');
const {
  enrichUserAuthorization,
  hasPermission,
  isTeamMember,
} = require('../services/authorization');

async function getAuthorizedSafeUser(user) {
  if (!user) return null;

  const membership = await User.findMembershipByUserId(user.id);
  return enrichUserAuthorization(User.toSafeUser(user), membership);
}

async function loadRequestAuthorization(req, res) {
  if (!req.user?.sub) {
    const token = getTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ success: false, message: 'Not signed in.' });
      return null;
    }

    try {
      req.user = verifyUserToken(token);
    } catch {
      clearAuthCookie(res);
      res.status(401).json({ success: false, message: 'Invalid or expired session.' });
      return null;
    }
  }

  const user = await User.findById(req.user.sub);
  if (!user) {
    clearAuthCookie(res);
    res.status(401).json({ success: false, message: 'Invalid or expired session.' });
    return null;
  }

  const safeUser = await getAuthorizedSafeUser(user);
  req.authUser = user;
  req.authorization = {
    membership: safeUser.membership,
    roles: safeUser.roles,
    permissions: safeUser.permissions,
  };
  return safeUser;
}

async function requireTeamMember(req, res, next) {
  try {
    const safeUser = await loadRequestAuthorization(req, res);
    if (!safeUser) return;

    if (!isTeamMember(req.authorization)) {
      res.status(403).json({
        success: false,
        message: 'Team Soju membership is required.',
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}

function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const safeUser = await loadRequestAuthorization(req, res);
      if (!safeUser) return;

      if (!hasPermission(req.authorization, permission)) {
        res.status(403).json({
          success: false,
          message: `Permission required: ${permission}.`,
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  getAuthorizedSafeUser,
  loadRequestAuthorization,
  requirePermission,
  requireTeamMember,
};
