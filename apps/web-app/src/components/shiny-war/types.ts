export type Hunt = {
  id?: string;
  position: number;
  spot_key: string;
  target_family_key?: string | null;
  label: string;
  details?: Record<string, unknown> & {
    species?: Array<string | Pick<HuntSpecies, 'name' | 'slug' | 'form'>>;
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
  form?: string;
  min_level: number;
  max_level: number;
  is_lure?: boolean;
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
  denominator: number;
  averagePoints: number;
  encountersPerHour: number | null;
  pointsPerHour: number | null;
  composition: HuntSpecies[];
};

export type PokemonHuntGroup = {
  species: HuntSpecies;
  spots: HuntSpot[];
};

export type Dashboard = {
  event: {
    name: string;
    starts_at: string;
    ends_at: string;
    roster_locked: boolean;
    seasons: string[];
    season_days?: number;
  };
  currentSeason: string | null;
  teamTotal: number;
  teamTotals: Record<ShinyWarTeam, number>;
  uniqueFamilyCount: number;
  uniqueFamilies: string[];
  standings: Array<ParticipantHunts & { points: number; catches: number }>;
  recentCatches: Array<{
    id: string;
    pokemon: string;
    ign: string;
    member_id: string;
    team: ShinyWarTeam;
    is_official: boolean;
    caught_at_utc: string;
    score: { base: number; secretBonus: number; safariBonus: number; uniqueBonus: number; total: number };
    war_eligibility_override?: boolean | null;
  }>;
};

export type PublicDashboard = Pick<Dashboard,
  'teamTotal' | 'teamTotals' | 'uniqueFamilyCount' | 'uniqueFamilies'
> & {
  standings: Array<Pick<Dashboard['standings'][number], 'ign' | 'team' | 'points' | 'catches'>>;
  recentCatches: Array<Omit<Dashboard['recentCatches'][number], 'id' | 'member_id' | 'is_official' | 'war_eligibility_override'>>;
};
