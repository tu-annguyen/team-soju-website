export type TeamMembership = {
  id: string;
  rank: string;
};

export type AuthRole = 'team_member';

export type AuthUser = {
  id: string;
  email: string;
  ign: string;
  discord_id?: string | null;
  discord_username?: string | null;
  discord_global_name?: string | null;
  discord_avatar?: string | null;
  auth_provider?: string | null;
  membership?: TeamMembership | null;
  roles?: AuthRole[];
  permissions?: string[];
};

export type AuthResponse = {
  success: boolean;
  data?: AuthUser | null;
  message?: string;
};
