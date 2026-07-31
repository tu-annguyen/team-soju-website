const { createCloudflareAuthorization } = require('../src/cloudflare/authorization');

function json(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status || 200,
    headers: { 'content-type': 'application/json' },
  });
}

function createRepositories(membership) {
  return {
    users: {
      findMembershipByUserId: jest.fn().mockResolvedValue(membership),
      toSafeUser: jest.fn((user) => ({
        id: user.id,
        email: user.email,
        ign: user.ign,
        discord_id: user.discord_id,
      })),
    },
  };
}

describe('Cloudflare authorization', () => {
  const user = {
    id: 'user-1',
    email: 'trainer@example.com',
    ign: 'Trainer',
    discord_id: 'discord-1',
  };

  it('allows active team members', async () => {
    const requireUser = jest.fn().mockResolvedValue({ user });
    const service = createCloudflareAuthorization({ json, requireUser });
    const repositories = createRepositories({ id: 'member-1', rank: 'Trainer' });

    const result = await service.requireTeamMember(new Request('https://example.com'), {}, repositories);

    expect(result.response).toBeUndefined();
    expect(result.roles).toEqual(['team_member']);
    expect(result.membership).toEqual({ id: 'member-1', rank: 'Trainer' });
  });

  it('denies authenticated users without active membership', async () => {
    const requireUser = jest.fn().mockResolvedValue({ user });
    const service = createCloudflareAuthorization({ json, requireUser });
    const repositories = createRepositories(null);

    const result = await service.requireTeamMember(new Request('https://example.com'), {}, repositories);

    expect(result.response.status).toBe(403);
  });

  it('preserves authentication failures before checking membership', async () => {
    const response = json({ success: false }, { status: 401 });
    const requireUser = jest.fn().mockResolvedValue({ response });
    const service = createCloudflareAuthorization({ json, requireUser });

    const result = await service.requireTeamMember(
      new Request('https://example.com'),
      {},
      createRepositories(null)
    );

    expect(result.response).toBe(response);
  });

  it('checks resource permissions independently', async () => {
    const requireUser = jest.fn().mockResolvedValue({ user });
    const service = createCloudflareAuthorization({ json, requireUser });

    const result = await service.requirePermission(
      new Request('https://example.com'),
      {},
      createRepositories({ id: 'member-1', rank: 'Trainer' }),
      'shinies:create'
    );

    expect(result.response.status).toBe(403);
  });
});
