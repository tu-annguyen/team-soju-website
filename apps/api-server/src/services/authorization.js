const TEAM_MEMBER_ROLE = 'team_member';

// Keep rank-derived capabilities centralized. Ranks intentionally grant no
// additional permissions yet; resource permissions can be introduced here
// without changing route guards or response contracts.
const RANK_PERMISSIONS = Object.freeze({});

function normalizeMembership(row) {
  if (!row) return null;

  return {
    id: row.id,
    rank: row.rank,
  };
}

function getPermissionsForMembership(membership) {
  if (!membership) return [];
  return [...(RANK_PERMISSIONS[membership.rank] || [])];
}

function buildAuthorization(membershipRow) {
  const membership = normalizeMembership(membershipRow);

  return {
    membership,
    roles: membership ? [TEAM_MEMBER_ROLE] : [],
    permissions: getPermissionsForMembership(membership),
  };
}

function enrichUserAuthorization(safeUser, membershipRow) {
  if (!safeUser) return null;

  return {
    ...safeUser,
    ...buildAuthorization(membershipRow),
  };
}

function isTeamMember(authorization) {
  return authorization?.roles?.includes(TEAM_MEMBER_ROLE) === true;
}

function hasPermission(authorization, permission) {
  return authorization?.permissions?.includes(permission) === true;
}

module.exports = {
  RANK_PERMISSIONS,
  TEAM_MEMBER_ROLE,
  buildAuthorization,
  enrichUserAuthorization,
  getPermissionsForMembership,
  hasPermission,
  isTeamMember,
  normalizeMembership,
};
