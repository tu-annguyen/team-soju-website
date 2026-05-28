const request = require('supertest');

process.env.JWT_SECRET = 'test-secret';

jest.mock('../src/express/models/FeebasBoard', () => ({
  getBoard: jest.fn(),
  getLeaderboard: jest.fn(),
  getLeaderboardSortOptions: jest.fn(() => [
    { key: 'ign', defaultDirection: 'asc' },
    { key: 'weeklyContributionScore', defaultDirection: 'desc' },
    { key: 'allTimeContributionScore', defaultDirection: 'desc' },
    { key: 'verifiedDiscoveries', defaultDirection: 'desc' },
    { key: 'feebasUptimeCreatedMinutes', defaultDirection: 'desc' },
    { key: 'confirmations', defaultDirection: 'desc' },
    { key: 'searchCoverage', defaultDirection: 'desc' },
    { key: 'reportAccuracy', defaultDirection: 'desc' },
    { key: 'efficiency', defaultDirection: 'desc' },
    { key: 'currentStreak', defaultDirection: 'desc' },
  ]),
  resetBoard: jest.fn(),
  updateTile: jest.fn(),
}));

jest.mock('../src/express/models/User', () => ({
  findById: jest.fn(),
}));

const app = require('../src/server');
const FeebasBoard = require('../src/express/models/FeebasBoard');
const User = require('../src/express/models/User');
const { AUTH_COOKIE_NAME, signUserToken } = require('../src/middleware/auth');

const boardFixture = {
  location: 'route-119-main',
  displayName: 'Route 119, Hoenn',
  description: 'Main Route 119 pond tiles for live Feebas coordination.',
  cycleStart: '2026-04-09T20:15:00.000Z',
  cycleEnd: '2026-04-09T21:00:00.000Z',
  serverTime: '2026-04-09T20:20:00.000Z',
  resetIntervalMinutes: 45,
  requiresDistinctConfirmation: false,
  confirmedTileId: null,
  isLocked: false,
  layout: { rows: 10, cols: 12 },
  activity: [],
  tiles: [
    {
      tileId: 'r1c3',
      label: 'A3',
      row: 0,
      col: 2,
      status: 'unchecked',
      voteCounts: {
        checked: 0,
        pending: 0,
        confirmed: 0,
      },
      totalVotes: 0,
      currentUserVote: 'unchecked',
    },
  ],
};
const leaderboardFixture = {
  location: 'route-119-main',
  generatedAt: '2026-04-09T20:20:00.000Z',
  weeklySince: '2026-04-02T20:20:00.000Z',
  sort: {
    by: 'rank',
    direction: 'asc',
  },
  sortOptions: [
    { key: 'ign', defaultDirection: 'asc' },
  ],
  entries: [
    {
      rank: 1,
      userId: 'user-id',
      ign: 'May',
      verifiedDiscoveries: 2,
      feebasUptimeCreatedMinutes: 120,
      confirmations: 4,
      searchCoverage: 30,
      weeklyContributionScore: 260,
      allTimeContributionScore: 360,
      fastestFindSeconds: 90,
      earlyScoutSeconds: 30,
      efficiency: 0.067,
      reportAccuracy: 0.8,
      currentStreak: 3,
      mostPersistentChecks: 17,
      pendingReports: 5,
      verifiedReports: 4,
    },
  ],
};

describe('Feebas routes', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    delete process.env.IGN_BLACKLIST;
    FeebasBoard.getBoard.mockResolvedValue(boardFixture);
    FeebasBoard.getLeaderboard.mockResolvedValue(leaderboardFixture);
    FeebasBoard.resetBoard.mockResolvedValue(boardFixture);
    FeebasBoard.updateTile.mockResolvedValue(boardFixture);
    User.findById.mockResolvedValue(null);
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns the active Feebas board', async () => {
    const response = await request(app).get('/api/feebas/route-119-main');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(boardFixture);
    expect(FeebasBoard.getBoard).toHaveBeenCalledWith('route-119-main', {
      actorFingerprint: undefined,
      currentUserId: undefined,
    });
  });

  it('returns the Feebas leaderboard', async () => {
    const response = await request(app).get('/api/feebas/route-119-main/leaderboard?limit=5&sortBy=ign&sortDirection=asc');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(leaderboardFixture);
    expect(FeebasBoard.getLeaderboard).toHaveBeenCalledWith('route-119-main', {
      limit: 5,
      sortBy: 'ign',
      sortDirection: 'asc',
      currentUserId: undefined,
    });
  });

  it('validates tile update payloads', async () => {
    const response = await request(app)
      .post('/api/feebas/route-119-main/tiles/r1c3')
      .send({ status: 'pending' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Validation error');
  });

  it('updates a tile when payload is valid', async () => {
    const response = await request(app)
      .post('/api/feebas/route-119-main/tiles/r1c3')
      .send({
        status: 'pending',
        actorFingerprint: 'client-12345678',
        actorName: 'May',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Feebas tile updated successfully');
    expect(FeebasBoard.updateTile).toHaveBeenCalledWith('route-119-main', 'r1c3', {
      status: 'pending',
      actorFingerprint: 'client-12345678',
      actorName: null,
    }, {
      includeLeaderboard: false,
    });
  });

  it('uses the signed-in account identity for tile updates', async () => {
    const sessionUser = {
      id: 'user-id',
      email: 'trainer@example.com',
      ign: 'Trainer',
    };
    const token = signUserToken(sessionUser);
    User.findById.mockResolvedValue(sessionUser);

    const response = await request(app)
      .post('/api/feebas/route-119-main/tiles/r1c3')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`)
      .send({
        status: 'pending',
        actorFingerprint: 'client-12345678',
        actorName: 'Spoofed Name',
      });

    expect(response.status).toBe(200);
    expect(FeebasBoard.updateTile).toHaveBeenCalledWith('route-119-main', 'r1c3', {
      status: 'pending',
      actorFingerprint: 'account-user-id',
      actorName: 'Trainer',
    }, {
      includeLeaderboard: false,
    });
  });

  it('rejects forged account fingerprints without a valid session', async () => {
    const response = await request(app)
      .post('/api/feebas/route-119-main/tiles/r1c3')
      .send({
        status: 'pending',
        actorFingerprint: 'account-user-id',
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Signed-in activity requires a valid session.');
    expect(FeebasBoard.updateTile).not.toHaveBeenCalled();
  });

  it('blocks blacklisted signed-in IGNs from posting activity', async () => {
    process.env.IGN_BLACKLIST = 'BannedIGN';
    const sessionUser = {
      id: 'user-id',
      email: 'trainer@example.com',
      ign: 'Banned IGN',
    };
    const token = signUserToken(sessionUser);
    User.findById.mockResolvedValue(sessionUser);

    const response = await request(app)
      .post('/api/feebas/route-119-main/tiles/r1c3')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`)
      .send({
        status: 'pending',
        actorFingerprint: 'client-12345678',
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('This account IGN is not allowed on the Activity Log.');
    expect(FeebasBoard.updateTile).not.toHaveBeenCalled();
  });

  it('resets the board in non-production environments', async () => {
    const response = await request(app).post('/api/feebas/route-119-main/reset');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Feebas board reset successfully');
    expect(FeebasBoard.resetBoard).toHaveBeenCalledWith('route-119-main');
  });

  it('blocks board resets in production', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(app).post('/api/feebas/route-119-main/reset');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Feebas board reset is not available in production');
    expect(FeebasBoard.resetBoard).not.toHaveBeenCalled();
  });
});
