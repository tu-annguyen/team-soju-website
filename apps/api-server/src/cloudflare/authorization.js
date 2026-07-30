const {
  enrichUserAuthorization,
  hasPermission,
  isTeamMember,
} = require('../services/authorization');

function createCloudflareAuthorization({ json, requireUser }) {
  async function getAuthorizedSafeUser(repositories, user) {
    if (!user) return null;

    const membership = typeof repositories.users.findMembershipByUserId === 'function'
      ? await repositories.users.findMembershipByUserId(user.id)
      : null;
    return enrichUserAuthorization(repositories.users.toSafeUser(user), membership);
  }

  async function getAuthorizationResult(request, env, repositories) {
    const auth = await requireUser(request, env, repositories);
    if (auth.response) return auth;

    const safeUser = await getAuthorizedSafeUser(repositories, auth.user);
    return {
      ...auth,
      safeUser,
      membership: safeUser.membership,
      roles: safeUser.roles,
      permissions: safeUser.permissions,
    };
  }

  async function requireTeamMember(request, env, repositories) {
    const auth = await getAuthorizationResult(request, env, repositories);
    if (auth.response) return auth;

    if (!isTeamMember(auth)) {
      return {
        response: json({
          success: false,
          message: 'Team Soju membership is required.',
        }, { status: 403 }),
      };
    }

    return auth;
  }

  async function requirePermission(request, env, repositories, permission) {
    const auth = await getAuthorizationResult(request, env, repositories);
    if (auth.response) return auth;

    if (!hasPermission(auth, permission)) {
      return {
        response: json({
          success: false,
          message: `Permission required: ${permission}.`,
        }, { status: 403 }),
      };
    }

    return auth;
  }

  return {
    getAuthorizedSafeUser,
    getAuthorizationResult,
    requirePermission,
    requireTeamMember,
  };
}

module.exports = {
  createCloudflareAuthorization,
};
