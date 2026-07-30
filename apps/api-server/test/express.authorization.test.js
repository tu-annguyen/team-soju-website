jest.mock('../src/express/models/User', () => ({
  findById: jest.fn(),
  findMembershipByUserId: jest.fn(),
  toSafeUser: jest.fn((user) => ({
    id: user.id,
    email: user.email,
    ign: user.ign,
    discord_id: user.discord_id,
  })),
}));
jest.mock('../src/middleware/auth', () => ({
  clearAuthCookie: jest.fn(),
  getTokenFromRequest: jest.fn(),
  verifyUserToken: jest.fn(),
}));

const User = require('../src/express/models/User');
const {
  getTokenFromRequest,
  verifyUserToken,
} = require('../src/middleware/auth');
const {
  getAuthorizedSafeUser,
  requirePermission,
  requireTeamMember,
} = require('../src/express/authorization');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('Express authorization', () => {
  const user = {
    id: 'user-1',
    email: 'trainer@example.com',
    ign: 'Trainer',
    discord_id: 'discord-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockResolvedValue(user);
    getTokenFromRequest.mockReturnValue(null);
  });

  it('enriches users with current membership', async () => {
    User.findMembershipByUserId.mockResolvedValue({ id: 'member-1', rank: 'Trainer' });

    await expect(getAuthorizedSafeUser(user)).resolves.toEqual({
      id: 'user-1',
      email: 'trainer@example.com',
      ign: 'Trainer',
      discord_id: 'discord-1',
      membership: { id: 'member-1', rank: 'Trainer' },
      roles: ['team_member'],
      permissions: [],
    });
  });

  it('allows active team members through the membership middleware', async () => {
    User.findMembershipByUserId.mockResolvedValue({ id: 'member-1', rank: 'Trainer' });
    const req = { user: { sub: 'user-1' } };
    const res = createResponse();
    const next = jest.fn();

    await requireTeamMember(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.authorization.roles).toEqual(['team_member']);
  });

  it('denies signed-in non-members', async () => {
    User.findMembershipByUserId.mockResolvedValue(null);
    const res = createResponse();
    const next = jest.fn();

    await requireTeamMember({ user: { sub: 'user-1' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('denies missing resource permissions independently', async () => {
    User.findMembershipByUserId.mockResolvedValue({ id: 'member-1', rank: 'Trainer' });
    const res = createResponse();
    const next = jest.fn();

    await requirePermission('shinies:delete')({ user: { sub: 'user-1' } }, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('authenticates valid request cookies when used as standalone middleware', async () => {
    getTokenFromRequest.mockReturnValue('session-token');
    verifyUserToken.mockReturnValue({ sub: 'user-1' });
    User.findMembershipByUserId.mockResolvedValue({ id: 'member-1', rank: 'Trainer' });
    const req = {};
    const res = createResponse();
    const next = jest.fn();

    await requireTeamMember(req, res, next);

    expect(verifyUserToken).toHaveBeenCalledWith('session-token');
    expect(next).toHaveBeenCalledWith();
  });
});
