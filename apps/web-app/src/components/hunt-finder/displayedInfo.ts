import type { DisplayedPokemonInfo, HuntSort } from './types';

export const DISPLAYED_POKEMON_INFO_OPTIONS: DisplayedPokemonInfo[] = [
  'pointsPerHour',
  'expPerHour',
  'averageExp',
  'averageShiny',
  'encountersPerHour',
  'effectiveOdds',
  'tier',
  'level',
  'evYield',
  'eggGroups',
];

export const DEFAULT_DISPLAYED_INFO_BY_SORT: Record<HuntSort, DisplayedPokemonInfo[]> = {
  alphabetical: [],
  pointsPerHour: ['pointsPerHour', 'averageShiny', 'encountersPerHour', 'effectiveOdds', 'tier'],
  expPerHour: ['expPerHour', 'averageExp', 'encountersPerHour', 'tier', 'level', 'evYield', 'eggGroups'],
};
