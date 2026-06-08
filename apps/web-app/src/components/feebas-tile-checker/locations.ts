export type LocationOption = {
  id: string;
  tabLabel: string;
  displayName: string;
  terrain: readonly (readonly string[])[];
};

type FeebasLocationMessages = {
  route119: {
    tabLabel: string;
    displayName: string;
  };
  route119Upstream: {
    tabLabel: string;
    displayName: string;
  };
  mtCoronet: {
    tabLabel: string;
    displayName: string;
  };
};

export const DEFAULT_LOCATION = 'route-119-main';

export const ROUTE_119_MAIN_TERRAIN = [
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water'],
  ['rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass'],
  ['rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['rock', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
] as const;

export const ROUTE_119_UPSTREAM_TERRAIN = [
  ['grass', 'grass', 'water', 'cliff', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'water', 'water', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['water', 'water', 'water', 'water', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'water', 'water', 'water', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'water', 'water', 'water', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'water', 'water', 'water', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'water', 'water', 'water', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['cliff', 'water', 'water', 'water', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['cliff', 'water', 'water', 'water', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'rock', 'rock', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'grass', 'grass'],
  ['cliff', 'water', 'water', 'water', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'rock', 'rock', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'grass', 'grass'],
  ['cliff', 'water', 'water', 'water', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'cliff', 'cliff', 'grass', 'grass', 'grass'],
  ['grass', 'water', 'water', 'water', 'grass', 'cliff', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'bank', 'grass', 'grass', 'cliff', 'cliff', 'cliff', 'grass', 'grass'],
  ['grass', 'water', 'water', 'water', 'grass', 'cliff', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'cliff', 'cliff', 'cliff', 'grass', 'grass'],
  ['water', 'water', 'water', 'water', 'water', 'cliff', 'cliff', 'cliff', 'cliff', 'rock', 'rock', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'grass'],
  ['water', 'water', 'water', 'water', 'water', 'cliff', 'cliff', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'grass'],
  ['cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'bank', 'bank', 'bank', 'bank', 'grass', 'grass', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff'],
  ['cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'bank', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'cliff', 'cliff', 'cliff', 'cliff'],
  ['water', 'water', 'water', 'water', 'water', 'cliff', 'cliff', 'grass', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'cliff', 'grass', 'grass', 'grass'],
  ['water', 'water', 'water', 'water', 'water', 'cliff', 'cliff', 'cliff', 'cliff', 'rock', 'rock', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['water', 'water', 'water', 'water', 'water', 'cliff', 'cliff', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'cliff', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'cliff', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'cliff', 'cliff', 'rock', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'cliff', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'cliff', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'cliff', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'cliff', 'cliff', 'cliff', 'rock', 'rock', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water'],
  ['cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'rock', 'rock'],
  ['cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'rock', 'rock'],
  ['cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water'],
  ['cliff', 'cliff', 'cliff', 'rock', 'rock', 'cliff', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'rock', 'rock', 'water', 'water', 'water'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'rock', 'rock', 'water', 'water', 'water'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'water', 'rock', 'rock', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'water', 'rock', 'rock', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
] as const;

export const MT_CORONET_TERRAIN = [
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'water', 'water'],
  ['water', 'water', 'water', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'rock', 'rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
] as const;

export const LOCATION_OPTIONS: readonly LocationOption[] = [
  {
    id: 'route-119-main',
    tabLabel: 'Route 119',
    displayName: 'Route 119, Hoenn',
    terrain: ROUTE_119_MAIN_TERRAIN,
  },
  {
    id: 'route-119-upstream',
    tabLabel: 'Route 119 Upstream',
    displayName: 'Route 119 Upstream, Hoenn',
    terrain: ROUTE_119_UPSTREAM_TERRAIN,
  },
  {
    id: 'mt-coronet',
    tabLabel: 'Mt. Coronet',
    displayName: 'Mt. Coronet, Sinnoh',
    terrain: MT_CORONET_TERRAIN,
  },
] as const;

export const LOCATION_OPTIONS_BY_ID = new Map(LOCATION_OPTIONS.map((option) => [option.id, option]));

export function getLocalizedLocationOptions(messages: FeebasLocationMessages): readonly LocationOption[] {
  return [
    {
      id: 'route-119-main',
      tabLabel: messages.route119.tabLabel,
      displayName: messages.route119.displayName,
      terrain: ROUTE_119_MAIN_TERRAIN,
    },
    {
      id: 'route-119-upstream',
      tabLabel: messages.route119Upstream.tabLabel,
      displayName: messages.route119Upstream.displayName,
      terrain: ROUTE_119_UPSTREAM_TERRAIN,
    },
    {
      id: 'mt-coronet',
      tabLabel: messages.mtCoronet.tabLabel,
      displayName: messages.mtCoronet.displayName,
      terrain: MT_CORONET_TERRAIN,
    },
  ] as const;
}
