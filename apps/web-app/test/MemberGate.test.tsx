import React from 'react';
import { render, screen } from '@testing-library/react';
import MemberGate from '../src/components/MemberGate';
import type { AuthUser } from '../src/auth/types';

function mockAuthUser(user: AuthUser | null) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: user }),
  }) as jest.Mock;
}

describe('MemberGate', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/tools/private?lang=en');
  });

  it('asks signed-out visitors to sign in', async () => {
    mockAuthUser(null);

    render(
      <MemberGate apiBaseUrl="https://api.example.com/api">
        <p>Private content</p>
      </MemberGate>
    );

    expect(await screen.findByRole('heading', { name: 'Sign in required' })).toBeInTheDocument();
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
  });

  it('offers Discord connection to signed-in accounts without Discord', async () => {
    mockAuthUser({
      id: 'user-1',
      email: 'trainer@example.com',
      ign: 'Trainer',
      discord_id: null,
      roles: [],
      permissions: [],
    });

    render(
      <MemberGate apiBaseUrl="https://api.example.com/api">
        <p>Private content</p>
      </MemberGate>
    );

    const link = await screen.findByRole('link', { name: 'Connect Discord' });
    expect(link).toHaveAttribute(
      'href',
      'https://api.example.com/api/auth/discord?mode=connect&returnTo=%2Ftools%2Fprivate%3Flang%3Den'
    );
  });

  it('denies Discord-linked non-members', async () => {
    mockAuthUser({
      id: 'user-1',
      email: 'trainer@example.com',
      ign: 'Trainer',
      discord_id: 'discord-1',
      membership: null,
      roles: [],
      permissions: [],
    });

    render(
      <MemberGate apiBaseUrl="https://api.example.com/api">
        <p>Private content</p>
      </MemberGate>
    );

    expect(await screen.findByRole('heading', {
      name: 'Team membership required',
    })).toBeInTheDocument();
  });

  it('renders protected content for active members', async () => {
    mockAuthUser({
      id: 'user-1',
      email: 'trainer@example.com',
      ign: 'Trainer',
      discord_id: 'discord-1',
      membership: { id: 'member-1', rank: 'Trainer' },
      roles: ['team_member'],
      permissions: [],
    });

    render(
      <MemberGate apiBaseUrl="https://api.example.com/api">
        <p>Private content</p>
      </MemberGate>
    );

    expect(await screen.findByText('Private content')).toBeInTheDocument();
  });

  it('checks optional resource permissions after membership', async () => {
    mockAuthUser({
      id: 'user-1',
      email: 'trainer@example.com',
      ign: 'Trainer',
      discord_id: 'discord-1',
      membership: { id: 'member-1', rank: 'Trainer' },
      roles: ['team_member'],
      permissions: [],
    });

    render(
      <MemberGate
        apiBaseUrl="https://api.example.com/api"
        requiredPermission="shinies:create"
      >
        <p>Private content</p>
      </MemberGate>
    );

    expect(await screen.findByRole('heading', { name: 'Permission required' })).toBeInTheDocument();
  });
});
