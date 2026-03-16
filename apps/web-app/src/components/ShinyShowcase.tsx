import React, { useState, useEffect } from 'react';
import ShinyShowcaseResults from './ShinyShowcaseResults';
import { Pokedex } from 'pokeapi-js-wrapper';
import { calculateShinyPoints } from '@team-soju/utils';
const P = new Pokedex();

export interface ShinyPokemon {
  id: string;
  name: string;
  imageUrl: string;
  isFailed: boolean;
  isSecret: boolean;
  isAlpha: boolean;
  encounterType: string;
  pointValue: number;
}

interface Trainer {
  name: string;
  numOT: number;
  totalPoints: number;
  shinies: ShinyPokemon[];
}

interface ShinyFromAPI {
  id: string;
  pokemon_name: string;
  trainer_name: string;
  encounter_type: string | null;
  is_secret: boolean;
  is_alpha: boolean;
  notes: string | null;
}

type BooleanFilter = 'any' | 'true' | 'false';

interface ShowcaseFilters {
  trainerName: string;
  points: string;
  pokemonName: string;
  encounterType: string;
  isSecret: BooleanFilter;
  isAlpha: BooleanFilter;
  catchDateAfter: string;
  catchDateBefore: string;
}

interface ShowcaseSort {
  sortBy: 'number_ot' | 'points';
  sortOrder: 'asc' | 'desc';
}

const ENCOUNTER_TYPE_CHOICES = [
  { label: 'Any', value: '' },
  { label: 'Horde', value: 'horde' },
  { label: 'Single', value: 'single' },
  { label: 'Fishing', value: 'fishing' },
  { label: 'Safari', value: 'safari' },
  { label: 'Egg', value: 'egg' },
  { label: 'Swarm', value: 'swarm' },
  { label: 'Honey Tree', value: 'honey_tree' },
  { label: 'Rock Smash', value: 'rock_smash' },
  { label: 'Fossil', value: 'fossil' },
  { label: 'Headbutt', value: 'headbutt' },
  { label: 'Mysterious Ball', value: 'mysterious_ball' },
  { label: 'Gift/Event', value: 'gift' },
] as const;

const defaultFilters: ShowcaseFilters = {
  trainerName: '',
  points: '',
  pokemonName: '',
  encounterType: '',
  isSecret: 'any',
  isAlpha: 'any',
  catchDateAfter: '',
  catchDateBefore: '',
};

const defaultSort: ShowcaseSort = {
  sortBy: 'number_ot',
  sortOrder: 'desc',
};

const getApiBaseUrl = (): string => {
  try {
    return Function('return import.meta.env.PUBLIC_API_BASE_URL')() || 'http://localhost:3001/api';
  } catch {
    const env = typeof globalThis !== 'undefined'
      ? (globalThis as typeof globalThis & {
          process?: {
            env?: Record<string, string | undefined>;
          };
        }).process?.env
      : undefined;

    return env?.PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
  }
};

const boolFilterToParam = (value: BooleanFilter): string | null => {
  if (value === 'any') {
    return null;
  }

  return value;
};

const sortTrainers = (
  trainers: Trainer[],
  sortBy: ShowcaseSort['sortBy'],
  sortOrder: ShowcaseSort['sortOrder']
): Trainer[] => {
  const direction = sortOrder === 'asc' ? 1 : -1;
  const sorted = [...trainers];

  sorted.sort((a, b) => {
    if (sortBy === 'points') {
      if (a.totalPoints !== b.totalPoints) {
        return (a.totalPoints - b.totalPoints) * direction;
      }

      if (a.numOT !== b.numOT) {
        return (a.numOT - b.numOT) * direction;
      }
    } else {
      if (a.numOT !== b.numOT) {
        return (a.numOT - b.numOT) * direction;
      }

      if (a.totalPoints !== b.totalPoints) {
        return (a.totalPoints - b.totalPoints) * direction;
      }
    }

    return a.name.localeCompare(b.name);
  });

  return sorted;
};

const transformAPIDataToShowcase = async (
  shinies: ShinyFromAPI[],
  apiBaseUrl: string
): Promise<Trainer[]> => {
  // Group shinies by trainer
  const trainerMap = new Map<string, ShinyFromAPI[]>();
  
  shinies.forEach(shiny => {
    const existing = trainerMap.get(shiny.trainer_name) || [];
    trainerMap.set(shiny.trainer_name, [...existing, shiny]);
  });

  // Transform to showcase format
  const trainers = await Promise.all(
    Array.from(trainerMap.entries()).map(async ([trainerName, trainerShinies]) => {
      // Count unique OT shinies
      let otCount = trainerShinies.length;
      
      const shiniesWithUrls = await Promise.all(
        trainerShinies.map(async (shiny) => {
          const isFailed = !!(shiny.notes && shiny.notes.toLowerCase().includes('failed'));
          if (isFailed) otCount--; // Don't count failed shinies as OT
          const isSecret = shiny.is_secret;
          const isAlpha = shiny.is_alpha;
          const encounterType = shiny.encounter_type || '';
          const pointValue = isFailed
            ? 0
            : await calculateShinyPoints(shiny.id, apiBaseUrl);
          const pokemonData = await P.getPokemonByName(shiny.pokemon_name.toLowerCase()).catch(err => {
            console.error('Error fetching Pokémon data:', err);
          });
          const baseUrl = pokemonData ? pokemonData.sprites.versions["generation-v"]["black-white"].animated.front_shiny : '';

          return {
            id: shiny.id,
            name: shiny.pokemon_name[0].toUpperCase() + shiny.pokemon_name.slice(1).toLowerCase(), // Capitalize first letter
            imageUrl: baseUrl || '',
            isFailed,
            isSecret,
            isAlpha,
            encounterType,
            pointValue,
          };
        })
      );

      const totalPoints = shiniesWithUrls.reduce((sum, shiny) => sum + shiny.pointValue, 0);

      return {
        name: trainerName,
        numOT: otCount,
        totalPoints,
        shinies: shiniesWithUrls
      };
    })
  );

  return trainers;
};

const applyTrainerFiltersAndSort = (
  trainers: Trainer[],
  filters: ShowcaseFilters,
  sort: ShowcaseSort
): Trainer[] => {
  const trainerNameFilter = filters.trainerName.trim().toLowerCase();
  const minPoints = Number(filters.points);

  const filtered = trainers.filter((trainer) => {
    const matchesTrainerName = trainerNameFilter
      ? trainer.name.toLowerCase().includes(trainerNameFilter)
      : true;
    const matchesPoints = Number.isFinite(minPoints) && filters.points.trim() !== ''
      ? trainer.totalPoints >= minPoints
      : true;

    return matchesTrainerName && matchesPoints;
  });

  return sortTrainers(filtered, sort.sortBy, sort.sortOrder);
};

const ShinyShowcase = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [allTrainerData, setAllTrainerData] = useState<Trainer[]>([]);
  const [shinyData, setShinyData] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ShowcaseFilters>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<ShowcaseFilters>(defaultFilters);
  const [sort, setSort] = useState<ShowcaseSort>(defaultSort);
  const [draftSort, setDraftSort] = useState<ShowcaseSort>(defaultSort);
  const [openPanel, setOpenPanel] = useState<'filter' | 'sort' | null>(null);

  useEffect(() => {
    const fetchShinies = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const apiBaseUrl = getApiBaseUrl();
        const params = new URLSearchParams({
          limit: '10000',
        });

        if (filters.pokemonName) {
          params.set('pokemon_name', filters.pokemonName);
        }
        if (filters.encounterType) {
          params.set('encounter_type', filters.encounterType);
        }
        if (filters.catchDateAfter) {
          params.set('catch_date_after', filters.catchDateAfter);
        }
        if (filters.catchDateBefore) {
          params.set('catch_date_before', filters.catchDateBefore);
        }

        const secretParam = boolFilterToParam(filters.isSecret);
        if (secretParam) {
          params.set('is_secret', secretParam);
        }

        const alphaParam = boolFilterToParam(filters.isAlpha);
        if (alphaParam) {
          params.set('is_alpha', alphaParam);
        }

        const response = await fetch(`${apiBaseUrl}/shinies?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch shinies: ${response.statusText}`);
        }
        
        const data = await response.json();
        const shinies = data.data || [];
        const transformedData = await transformAPIDataToShowcase(shinies, apiBaseUrl);
        setAllTrainerData(transformedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shinies');
        console.error('Error fetching shinies:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchShinies();
  }, [
    filters.pokemonName,
    filters.encounterType,
    filters.isSecret,
    filters.isAlpha,
    filters.catchDateAfter,
    filters.catchDateBefore,
  ]);

  useEffect(() => {
    setShinyData(applyTrainerFiltersAndSort(allTrainerData, filters, sort));
  }, [allTrainerData, filters, sort]);

  const activeFilterCount = [
    filters.trainerName,
    filters.points,
    filters.pokemonName,
    filters.encounterType,
    filters.catchDateAfter,
    filters.catchDateBefore,
    filters.isSecret !== 'any' ? filters.isSecret : '',
    filters.isAlpha !== 'any' ? filters.isAlpha : '',
  ].filter(Boolean).length;

  const openFilterPanel = () => {
    setDraftFilters(filters);
    setOpenPanel(openPanel === 'filter' ? null : 'filter');
  };

  const openSortPanel = () => {
    setDraftSort(sort);
    setOpenPanel(openPanel === 'sort' ? null : 'sort');
  };
  
  return (
    <section className="py-16">
      <div className="container">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Showcase</h2>
          <div className="relative flex flex-row flex-wrap gap-4 w-full">
            <div className="relative max-w-md flex-grow">
              <input
                type="text"
                placeholder="Search by Pokémon or trainer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-nowrap overflow-hidden overflow-ellipsis"
              >
              </input>
              <svg 
                className="absolute right-3 top-2.5 w-5 h-5 text-gray-400 dark:text-gray-500" 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <div className="relative flex gap-4">
              <button
                type="button"
                aria-label="Open filters"
                aria-expanded={openPanel === 'filter'}
                onClick={openFilterPanel}
                className="relative bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-lg"
              >
                <svg className="w-5 h-5 inline-block" fill="currentColor" stroke="none" viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg">
                  <path d="M96 128C83.1 128 71.4 135.8 66.4 147.8C61.4 159.8 64.2 173.5 73.4 182.6L256 365.3L256 480C256 488.5 259.4 496.6 265.4 502.6L329.4 566.6C338.6 575.8 352.3 578.5 364.3 573.5C376.3 568.5 384 556.9 384 544L384 365.3L566.6 182.7C575.8 173.5 578.5 159.8 573.5 147.8C568.5 135.8 556.9 128 544 128L96 128z"/>
                </svg>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[1.25rem] h-5 rounded-full bg-white text-primary-700 text-xs font-bold px-1 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                aria-label="Open sorting"
                aria-expanded={openPanel === 'sort'}
                onClick={openSortPanel}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-4 rounded-lg"
              >
                <svg className="w-5 h-5 inline-block" fill="currentColor" stroke="none" viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg">
                  <path d="M130.4 268.2C135.4 280.2 147 288 160 288L480 288C492.9 288 504.6 280.2 509.6 268.2C514.6 256.2 511.8 242.5 502.7 233.3L342.7 73.3C330.2 60.8 309.9 60.8 297.4 73.3L137.4 233.3C128.2 242.5 125.5 256.2 130.5 268.2zM130.4 371.7C125.4 383.7 128.2 397.4 137.3 406.6L297.3 566.6C309.8 579.1 330.1 579.1 342.6 566.6L502.6 406.6C511.8 397.4 514.5 383.7 509.5 371.7C504.5 359.7 492.9 352 480 352L160 352C147.1 352 135.4 359.8 130.4 371.8z"/>
                </svg>
              </button>
            </div>

            {openPanel === 'filter' && (
              <div
                role="dialog"
                aria-label="Filter shinies"
                className="absolute top-full left-1/2 -translate-x-1/2 z-20 mt-2 w-[min(92vw,42rem)] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-5 md:left-auto md:right-14 md:translate-x-0 md:w-full md:max-w-xl"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Pokemon name
                    <input
                      type="text"
                      value={draftFilters.pokemonName}
                      onChange={(e) => setDraftFilters({ ...draftFilters, pokemonName: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </label>
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Trainer name
                    <input
                      type="text"
                      value={draftFilters.trainerName}
                      onChange={(e) => setDraftFilters({ ...draftFilters, trainerName: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </label>
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Points (minimum)
                    <input
                      type="number"
                      min="0"
                      value={draftFilters.points}
                      onChange={(e) => setDraftFilters({ ...draftFilters, points: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </label>
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Encounter type
                    <select
                      value={draftFilters.encounterType}
                      onChange={(e) => setDraftFilters({ ...draftFilters, encounterType: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      {ENCOUNTER_TYPE_CHOICES.map((choice) => (
                        <option key={choice.value || 'any'} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Secret shinies
                    <select
                      value={draftFilters.isSecret}
                      onChange={(e) => setDraftFilters({ ...draftFilters, isSecret: e.target.value as BooleanFilter })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="any">Any</option>
                      <option value="true">Only secret</option>
                      <option value="false">Exclude secret</option>
                    </select>
                  </label>
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Alpha shinies
                    <select
                      value={draftFilters.isAlpha}
                      onChange={(e) => setDraftFilters({ ...draftFilters, isAlpha: e.target.value as BooleanFilter })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="any">Any</option>
                      <option value="true">Only alpha</option>
                      <option value="false">Exclude alpha</option>
                    </select>
                  </label>
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Catch date after
                    <input
                      type="date"
                      value={draftFilters.catchDateAfter}
                      onChange={(e) => setDraftFilters({ ...draftFilters, catchDateAfter: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </label>
                  <label className="text-sm text-gray-700 dark:text-gray-300 sm:col-start-2">
                    Catch date before
                    <input
                      type="date"
                      value={draftFilters.catchDateBefore}
                      onChange={(e) => setDraftFilters({ ...draftFilters, catchDateBefore: e.target.value })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftFilters(defaultFilters);
                      setFilters(defaultFilters);
                      setOpenPanel(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilters(draftFilters);
                      setOpenPanel(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            {openPanel === 'sort' && (
              <div
                role="dialog"
                aria-label="Sort shinies"
                className="absolute top-full left-1/2 -translate-x-1/2 z-20 mt-2 w-[min(92vw,24rem)] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-5 md:left-auto md:right-0 md:translate-x-0 md:w-full md:max-w-sm"
              >
                <div className="grid grid-cols-1 gap-4">
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Sort by
                    <select
                      value={draftSort.sortBy}
                      onChange={(e) => setDraftSort({
                        ...draftSort,
                        sortBy: e.target.value as ShowcaseSort['sortBy']
                      })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="number_ot">Number OT</option>
                      <option value="points">Points</option>
                    </select>
                  </label>
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Order
                    <select
                      value={draftSort.sortOrder}
                      onChange={(e) => setDraftSort({ ...draftSort, sortOrder: e.target.value as ShowcaseSort['sortOrder'] })}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftSort(defaultSort);
                      setSort(defaultSort);
                      setOpenPanel(null);
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSort(draftSort);
                      setOpenPanel(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="min-h-[500px]">
          <ShinyShowcaseResults
            searchTerm={searchTerm}
            shinyData={shinyData}
            loading={loading}
            error={error}
          />
        </div>
        
        <div className="mt-12 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            This showcase is updated using our in house Discord application.
            <a 
              href="./discord"
              className="text-primary-600 dark:text-primary-400 hover:underline ml-1"
            >
              Join our Discord server
            </a> to add your shinies today!
          </p>
        </div>
      </div>
    </section>
  );
};

export default ShinyShowcase;
