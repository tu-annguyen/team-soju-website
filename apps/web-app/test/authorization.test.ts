import { hasPermission, isTeamMember } from '../src/auth/authorization';
import type { AuthUser } from '../src/auth/types';
import { canAccessToolLink } from '../src/components/Header.config';

describe('frontend authorization helpers', () => {
  const member: AuthUser = {
    id: 'user-1',
    email: 'trainer@example.com',
    ign: 'Trainer',
    roles: ['team_member'],
    permissions: ['shinies:create'],
  };

  it('recognizes team membership independently from permissions', () => {
    expect(isTeamMember(member)).toBe(true);
    expect(hasPermission(member, 'shinies:create')).toBe(true);
    expect(hasPermission(member, 'shinies:delete')).toBe(false);
  });

  it('filters protected navigation metadata', () => {
    expect(canAccessToolLink(null, {
      href: '/tools/private',
      labelKey: 'catchEventsCard',
      requiresTeamMembership: true,
    })).toBe(false);

    expect(canAccessToolLink(member, {
      href: '/tools/private',
      labelKey: 'catchEventsCard',
      requiresTeamMembership: true,
    })).toBe(true);

    expect(canAccessToolLink(member, {
      href: '/tools/delete',
      labelKey: 'catchEventsCard',
      requiredPermission: 'shinies:delete',
    })).toBe(false);
  });
});
