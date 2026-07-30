import type { AuthUser } from './types';

export function isTeamMember(user: AuthUser | null | undefined): boolean {
  return user?.roles?.includes('team_member') === true;
}

export function hasPermission(
  user: AuthUser | null | undefined,
  permission: string
): boolean {
  return user?.permissions?.includes(permission) === true;
}
