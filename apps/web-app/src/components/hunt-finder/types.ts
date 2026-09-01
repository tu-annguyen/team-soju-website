export type HuntFinderContext = 'public' | 'shinyWar';
export type HuntSort = 'pointsPerHour' | 'expPerHour' | 'alphabetical';
export type SortDirection = 'asc' | 'desc';
export type EvStat = 'hp' | 'attack' | 'defense' | 'spAttack' | 'spDefense' | 'speed';
export type EvAmount = '1' | '2';

export type HuntFinderFilters = {
  season: string;
  region: string;
  location: string;
  species: string;
  minTier: string;
  minLevel: string;
  time: string;
  method: string;
  hordeSize: string;
  hordesPerHour: string;
  eventBoost: boolean;
  donator: boolean;
  fullSplitOnly: boolean;
  minPointsPerHour: string;
  personalCharm: boolean;
  linkCharm: boolean;
  chumBucket: boolean;
  nonSafari: boolean;
  officialUniqueBonus: boolean;
  teamUniqueBonus: boolean;
  excludeOfficialCaught: boolean;
  excludeTeamCaught: boolean;
  evStats: EvStat[];
  evAmounts: EvAmount[];
  expCharm: '' | '0.25' | '0.5' | '1';
  expReamplifier: boolean;
  expDonator: boolean;
  tradeBonus: boolean;
  sort: HuntSort;
  sortDirection: SortDirection;
};

export const EV_STAT_OPTIONS: Array<[EvStat, string]> = [
  ['hp', 'HP'],
  ['attack', 'Attack'],
  ['defense', 'Defense'],
  ['spAttack', 'Special Attack'],
  ['spDefense', 'Special Defense'],
  ['speed', 'Speed'],
];
