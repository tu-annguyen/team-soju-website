const TEAM_MEMBER_ROLE = 'team_member';

const RANK_PERMISSIONS = Object.freeze({
  'Elite 4': Object.freeze(['shiny_war:manage']),
  Champion: Object.freeze(['shiny_war:manage']),
});

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
