const request = require('supertest');

jest.mock('../src/models/FeebasBoard', () => ({
  getBoard: jest.fn(),
  resetBoard: jest.fn(),
  updateTile: jest.fn(),
}));

const app = require('../src/server');
const FeebasBoard = require('../src/models/FeebasBoard');

const boardFixture = {
  location: 'route-119-main',
  displayName: 'Route 119, Hoenn',
  description: 'Main Route 119 pond tiles for live Feebas coordination.',
  cycleStart: '2026-04-09T20:15:00.000Z',
  cycleEnd: '2026-04-09T21:00:00.000Z',
  serverTime: '2026-04-09T20:20:00.000Z',
  resetIntervalMinutes: 45,
  requiresDistinctConfirmation: true,
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
      updatedAt: null,
      updatedByName: null,
      pendingReportedByName: null,
      pendingReportedByFingerprint: null,
      confirmedByName: null,
      confirmedAt: null,
    },
  ],
};

describe('Feebas routes', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    FeebasBoard.getBoard.mockResolvedValue(boardFixture);
    FeebasBoard.resetBoard.mockResolvedValue(boardFixture);
    FeebasBoard.updateTile.mockResolvedValue(boardFixture);
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns the active Feebas board', async () => {
    const response = await request(app).get('/api/feebas/route-119-main');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(boardFixture);
    expect(FeebasBoard.getBoard).toHaveBeenCalledWith('route-119-main');
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
      actorName: 'May',
    });
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
