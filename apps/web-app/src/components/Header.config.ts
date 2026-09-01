import type { Locale } from '../i18n';
import { hasPermission, isTeamMember } from '../auth/authorization';
import type { AuthUser } from '../auth/types';

export type ToolLink = {
  href: string;
  labelKey: 'catchEventsCard' | 'feebasCard' | 'huntFinderCard';
  requiresTeamMembership?: boolean;
  requiredPermission?: string;
};

export const toolsLinks: ToolLink[] = [
  {
    href: '/tools/hunt-finder',
    labelKey: 'huntFinderCard',
  },
  {
    href: '/tools/catch-events',
    labelKey: 'catchEventsCard',
  },
  {
    href: '/feebas-tile-checker',
    labelKey: 'feebasCard',
  },
];

export function canAccessToolLink(user: AuthUser | null, link: ToolLink): boolean {
  if (link.requiresTeamMembership && !isTeamMember(user)) return false;
  if (link.requiredPermission && !hasPermission(user, link.requiredPermission)) return false;
  return true;
}

export const localeStorageKey = 'team-soju-locale';

export const languageOptions: Array<{ value: Locale; label: string; code: string }> = [
  { value: 'en', label: 'English', code: 'EN' },
  { value: 'es', label: 'Español', code: 'ES' },
  { value: 'zh', label: '中文', code: 'ZH' },
];

export type { AuthUser };
