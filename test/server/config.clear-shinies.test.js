jest.mock('../../server/src/config/connection', () => ({
  query: jest.fn(),
}));

const pool = require('../../server/src/config/connection');

describe('clear-shinies script', () => {
  it('deletes all shinies and attempts to exit', () => {
    jest.isolateModules(() => {
      require('../../server/src/config/clear-shinies');
    });

    expect(pool.query).toHaveBeenCalledWith('DELETE FROM team_shinies');
  });
});
