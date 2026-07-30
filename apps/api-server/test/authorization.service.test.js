const {
  TEAM_MEMBER_ROLE,
  buildAuthorization,
  enrichUserAuthorization,
  hasPermission,
  isTeamMember,
} = require('../src/services/authorization');

describe('authorization policy', () => {
  it('assigns the team member role to active resolved memberships', () => {
    const authorization = buildAuthorization({ id: 'member-1', rank: 'Trainer' });

    expect(authorization).toEqual({
      membership: { id: 'member-1', rank: 'Trainer' },
      roles: [TEAM_MEMBER_ROLE],
      permissions: [],
    });
    expect(isTeamMember(authorization)).toBe(true);
  });

  it('returns an empty authorization context without membership', () => {
    expect(buildAuthorization(null)).toEqual({
      membership: null,
      roles: [],
      permissions: [],
    });
  });

  it('keeps permissions independent from membership', () => {
    const authorization = buildAuthorization({ id: 'member-1', rank: 'Trainer' });

    expect(hasPermission(authorization, 'shinies:create')).toBe(false);
    expect(hasPermission({
      ...authorization,
      permissions: ['shinies:create'],
    }, 'shinies:create')).toBe(true);
  });

  it('grants Shiny Wars management to Elite 4 and Champion ranks', () => {
    expect(buildAuthorization({ id: 'e4', rank: 'Elite 4' }).permissions)
      .toContain('shiny_war:manage');
    expect(buildAuthorization({ id: 'champ', rank: 'Champion' }).permissions)
      .toContain('shiny_war:manage');
  });

  it('enriches safe users without exposing additional database fields', () => {
    expect(enrichUserAuthorization({
      id: 'user-1',
      ign: 'Trainer',
    }, {
      id: 'member-1',
      rank: 'Commander',
      notes: 'private',
    })).toEqual({
      id: 'user-1',
      ign: 'Trainer',
      membership: { id: 'member-1', rank: 'Commander' },
      roles: ['team_member'],
      permissions: [],
    });
  });
});
