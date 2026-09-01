export type Hunt = {
  id?: string;
  position: number;
  spot_key: string;
  target_family_key?: string | null;
  label: string;
  details?: Record<string, unknown> & {
    species?: Array<string | (
      Pick<HuntSpecies, 'name' | 'slug' | 'form'>
      & Partial<Pick<HuntSpecies, 'family_key'>>
    )>;
    spot?: Pick<HuntSpot, 'region' | 'season' | 'time' | 'method' | 'horde_size' | 'is_lure' | 'is_special'>;
  };
  overlap_member_ids?: string[];
};

export type ShinyWarTeam = 'bidoof' | 'arceus';

export type ParticipantHunts = {
  member_id: string;
  ign: string;
  rank: string;
  has_app_user: boolean;
  team: ShinyWarTeam;
  is_official: boolean;
  hunts: Hunt[];
};

export type HuntSpecies = {
  name: string;
  slug: string;
  family_key: string;
  tier: string;
  points: number;
  split: number;
  rate_unknown?: boolean;
  form?: string;
  min_level: number;
  max_level: number;
  base_exp?: number;
  ev_hp?: number;
  ev_attack?: number;
  ev_defense?: number;
  ev_sp_attack?: number;
  ev_sp_defense?: number;
  ev_speed?: number;
  egg_groups?: string[];
  is_lure?: boolean;
  is_special?: boolean;
};

export type HuntSpot = {
  spot_key: string;
  spot_keys?: string[];
  location_areas?: string[];
  region: string;
  location: string;
  method: string;
  season: string;
  time: string;
  times?: string[];
  horde_size: number;
  is_lure?: boolean;
  is_special?: boolean;
  denominator: number;
  averagePoints: number;
  averageExp?: number | null;
  encountersPerHour: number | null;
  pointsPerHour: number | null;
  expPerHour?: number | null;
  composition: HuntSpecies[];
};

export type PokemonHuntGroup = {
  species: HuntSpecies;
  spots: HuntSpot[];
};

export type DashboardCatch = {
  id: string;
  pokemon: string;
  ign: string;
  member_id: string;
  team: ShinyWarTeam;
  is_official: boolean;
  caught_at_utc: string;
  score: { base: number; secretBonus: number; safariBonus: number; uniqueBonus: number; total: number };
  war_eligibility_override?: boolean | null;
};

export type DashboardStanding = ParticipantHunts & {
  points: number;
  basePoints: number;
  bonusPoints: number;
  catches: number;
  caughtFamilyKeys: string[];
};

export type Dashboard = {
  familySpecies: Record<string, string[]>;
  event: {
    name: string;
    starts_at: string;
    ends_at: string;
    roster_locked: boolean;
    seasons: string[];
    season_days?: number;
  };
  currentSeason: string | null;
  officialWar: {
    teamTotal: number;
    uniqueFamilyCount: number;
    uniqueFamilies: string[];
    standings: DashboardStanding[];
    recentCatches: DashboardCatch[];
  };
  teamWar: {
    teamTotals: Record<ShinyWarTeam, number>;
    uniqueFamilies: Record<ShinyWarTeam, string[]>;
    standings: DashboardStanding[];
    recentCatches: DashboardCatch[];
  };
};

type PublicStanding = Pick<
  DashboardStanding,
  'ign' | 'team' | 'points' | 'basePoints' | 'bonusPoints' | 'catches'
>;
type PublicCatch = Omit<DashboardCatch, 'id' | 'member_id' | 'is_official' | 'war_eligibility_override'>;

export type PublicDashboard = {
  familySpecies: Dashboard['familySpecies'];
  officialWar: Omit<Dashboard['officialWar'], 'standings' | 'recentCatches'> & {
    standings: PublicStanding[];
    recentCatches: PublicCatch[];
  };
  teamWar: Omit<Dashboard['teamWar'], 'standings' | 'recentCatches'> & {
    standings: PublicStanding[];
    recentCatches: PublicCatch[];
  };
};
