export type Hunt = {
  id?: string;
  position: number;
  spot_key: string;
  target_family_key?: string | null;
  label: string;
  details?: Record<string, unknown>;
  overlap_member_ids?: string[];
};

export type ParticipantHunts = {
  member_id: string;
  ign: string;
  rank: string;
  has_app_user: boolean;
  hunts: Hunt[];
};

export type HordeSpecies = {
  name: string;
  slug: string;
  family_key: string;
  tier: string;
  points: number;
  split: number;
  form?: string;
  min_level: number;
  max_level: number;
};

export type HordeSpot = {
  spot_key: string;
  region: string;
  location: string;
  method: string;
  season: string;
  time: string;
  horde_size: number;
  denominator: number;
  averagePoints: number;
  encountersPerHour: number;
  pointsPerHour: number;
  composition: HordeSpecies[];
};

export type Dashboard = {
  event: {
    name: string;
    starts_at: string;
    ends_at: string;
    roster_locked: boolean;
    seasons: string[];
  };
  currentSeason: string | null;
  teamTotal: number;
  uniqueFamilyCount: number;
  uniqueFamilies: string[];
  standings: Array<ParticipantHunts & { points: number; catches: number }>;
  recentCatches: Array<{
    id: string;
    pokemon: string;
    ign: string;
    caught_at_utc: string;
    score: { base: number; secretBonus: number; safariBonus: number; uniqueBonus: number; total: number };
    war_eligibility_override?: boolean | null;
  }>;
};
