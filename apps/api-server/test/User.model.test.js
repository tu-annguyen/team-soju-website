const User = require('../src/models/User');

jest.mock('../src/config/connection', () => ({
  query: jest.fn(),
}));

describe('User model', () => {
  const mockQuery = require('../src/config/connection').query;

  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('normalizes email and IGN for password account creation', async () => {
    const created = { id: 'user-id', email: 'trainer@example.com', ign: 'Trainer' };
    mockQuery.mockResolvedValue({ rows: [created] });

    const result = await User.createWithPassword({
      email: '  Trainer@Example.COM ',
      passwordHash: 'hashed-password',
      ign: ' Trainer ',
    });

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
      'trainer@example.com',
      'hashed-password',
      'Trainer',
    ]);
    expect(result).toEqual(created);
  });

  it('finds users by Discord ID', async () => {
    const row = { id: 'user-id', discord_id: '123' };
    mockQuery.mockResolvedValue({ rows: [row] });

    const result = await User.findByDiscordId('123');

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), ['123']);
    expect(result).toEqual(row);
  });

  it('attaches Discord data and returns the updated row', async () => {
    const updated = { id: 'user-id', discord_id: '123', auth_provider: 'password_discord' };
    mockQuery.mockResolvedValue({ rows: [updated] });

    const result = await User.attachDiscord('user-id', {
      id: '123',
      username: 'discord-user',
      global_name: 'Discord User',
      avatar: 'avatar-hash',
    });

    expect(mockQuery).toHaveBeenCalledWith(expect.any(String), [
      'user-id',
      '123',
      'discord-user',
      'Discord User',
      'avatar-hash',
    ]);
    expect(result).toEqual(updated);
  });

  it('removes password hashes from safe user objects', () => {
    expect(User.toSafeUser({
      id: 'user-id',
      email: 'trainer@example.com',
      password_hash: 'secret',
      ign: 'Trainer',
      discord_id: null,
      auth_provider: 'password',
    })).toEqual({
      id: 'user-id',
      email: 'trainer@example.com',
      ign: 'Trainer',
      discord_id: null,
      discord_username: undefined,
      discord_global_name: undefined,
      discord_avatar: undefined,
      auth_provider: 'password',
      created_at: undefined,
      updated_at: undefined,
      last_login_at: undefined,
    });
  });
});
