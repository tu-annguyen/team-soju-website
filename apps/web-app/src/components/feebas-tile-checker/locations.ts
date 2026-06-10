export type LocationOption = {
  areaLabel?: string;
  environmentOverlay?: {
    imageUrl: string;
    opacity: number;
  };
  groupId?: string;
  groupTabLabel?: string;
  id: string;
  tabLabel: string;
  displayName: string;
  terrain: readonly (readonly string[])[];
};

type FeebasLocationMessages = {
  route119: {
    tabLabel: string;
    displayName: string;
    pondTabLabel: string;
    upstreamTabLabel: string;
  };
  mtCoronet: {
    tabLabel: string;
    displayName: string;
  };
};

export const DEFAULT_LOCATION = 'route-119-main';

export const ROUTE_119_MAIN_ENVIRONMENT_OVERLAY = {
  imageUrl: '/images/feebas/route-119-main-environment.webp',
  opacity: 0.58,
} as const;

export const ROUTE_119_UPSTREAM_ENVIRONMENT_OVERLAY = {
  imageUrl: '/images/feebas/route-119-upstream-environment.webp',
  opacity: 0.58,
} as const;

export const ROUTE_119_MAIN_TERRAIN = [
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'cliff', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'cliff'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'cliff', 'water', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'rock', 'cliff'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'cliff', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'rock', 'rock', 'water', 'water', 'cliff'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'cliff', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'cliff'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'cliff', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'cliff'],
  ['grass', 'grass', 'grass', 'cliff', 'rock', 'rock', 'cliff', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'cliff'],
  ['grass', 'grass', 'grass', 'cliff', 'bank', 'bank', 'bank', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['grass', 'cliff', 'cliff', 'cliff', 'bank', 'bank', 'bank', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['cliff', 'cliff', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water'],
  ['water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'water', 'water', 'water'],
  ['rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water'],
  ['rock', 'rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass'],
  ['rock', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['rock', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'bank', 'bank'],
  ['water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'bank', 'bank', 'bank'],
] as const;

export const ROUTE_119_UPSTREAM_TERRAIN = [
  ['water', 'rock', 'water', 'cliff', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['rock', 'rock', 'water', 'water', 'cliff', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'bank', 'bank', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
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
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'rock', 'rock', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'water', 'water', 'water', 'water', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'water', 'rock', 'rock', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
  ['grass', 'grass', 'grass', 'grass', 'grass', 'water', 'rock', 'rock', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
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
    areaLabel: 'Pond',
    groupId: 'route-119',
    groupTabLabel: 'Route 119',
    id: 'route-119-main',
    tabLabel: 'Route 119',
    displayName: 'Route 119, Hoenn',
    environmentOverlay: ROUTE_119_MAIN_ENVIRONMENT_OVERLAY,
    terrain: ROUTE_119_MAIN_TERRAIN,
  },
  {
    areaLabel: 'Upstream',
    groupId: 'route-119',
    groupTabLabel: 'Route 119',
    id: 'route-119-upstream',
    tabLabel: 'Upstream',
    displayName: 'Route 119, Hoenn',
    environmentOverlay: ROUTE_119_UPSTREAM_ENVIRONMENT_OVERLAY,
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
      areaLabel: messages.route119.pondTabLabel,
      groupId: 'route-119',
      groupTabLabel: messages.route119.tabLabel,
      id: 'route-119-main',
      tabLabel: messages.route119.tabLabel,
      displayName: messages.route119.displayName,
      environmentOverlay: ROUTE_119_MAIN_ENVIRONMENT_OVERLAY,
      terrain: ROUTE_119_MAIN_TERRAIN,
    },
    {
      areaLabel: messages.route119.upstreamTabLabel,
      groupId: 'route-119',
      groupTabLabel: messages.route119.tabLabel,
      id: 'route-119-upstream',
      tabLabel: messages.route119.upstreamTabLabel,
      displayName: messages.route119.displayName,
      environmentOverlay: ROUTE_119_UPSTREAM_ENVIRONMENT_OVERLAY,
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
