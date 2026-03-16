import React, { useEffect, useMemo, useState } from 'react';
import ShinyCard from './ShinyCard';
import { Pokedex } from 'pokeapi-js-wrapper';

const P = new Pokedex();

interface MonthlyShiniesResultsProps {
  date: Date;
  searchTerm: string;
}

interface ShinyFromAPI {
  pokemon_name: string;
  trainer_name: string;
  encounter_type: string | null;
  is_secret: boolean;
  is_alpha: boolean;
  notes: string | null;
  total_encounters?: number | null;
  catch_date?: string | null;
}

interface MonthlyShiny {
  name: string;
  trainerName: string;
  imageUrl: string;
  isFailed: boolean;
  isSecret: boolean;
  isAlpha: boolean;
  encounterType: string;
  totalEncounters: number | null;
  catchDate: string | null;
}

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const transformAPIDataToMonthly = async (
  shinies: ShinyFromAPI[]
): Promise<MonthlyShiny[]> => {
  const transformed = await Promise.all(
    shinies.map(async (shiny) => {
      const isFailed = !!(
        shiny.notes && shiny.notes.toLowerCase().includes('failed')
      );

      const pokemonData = await P.getPokemonByName(
        shiny.pokemon_name.toLowerCase()
      ).catch((err) => {
        console.error('Error fetching Pokémon data:', err);
        return null;
      });

      const imageUrl = pokemonData
        ? pokemonData.sprites.versions['generation-v']['black-white'].animated
            .front_shiny || ''
        : '';

      return {
        name:
          shiny.pokemon_name[0].toUpperCase() +
          shiny.pokemon_name.slice(1).toLowerCase(),
        trainerName: shiny.trainer_name,
        imageUrl,
        isFailed,
        isSecret: shiny.is_secret,
        isAlpha: shiny.is_alpha,
        encounterType: shiny.encounter_type || '',
        totalEncounters: shiny.total_encounters ?? null,
        catchDate: shiny.catch_date ?? null,
      };
    })
  );

  return transformed;
};

const SummaryChip = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
    <div className="text-2xl font-bold text-gray-900 dark:text-white">
      {value}
    </div>
    <div className="text-sm text-gray-600 dark:text-gray-400">{label}</div>
  </div>
);

const MonthlyShiniesResults = ({
  date,
  searchTerm,
}: MonthlyShiniesResultsProps) => {
  const [shinyData, setShinyData] = useState<MonthlyShiny[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchShinies = async () => {
      try {
        setLoading(true);
        setError(null);

        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDayOfMonth = new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          0
        );

        const catchDateAfter = formatLocalDate(firstDayOfMonth);
        const catchDateBefore = formatLocalDate(lastDayOfMonth);

        const apiBaseUrl =
          import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

        const response = await fetch(
          `${apiBaseUrl}/shinies?sort_order=asc&catch_date_after=${catchDateAfter}&catch_date_before=${catchDateBefore}&limit=10000`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch shinies: ${response.statusText}`);
        }

        const data = await response.json();
        const shinies = data.data || [];
        const transformedData = await transformAPIDataToMonthly(shinies);

        if (!isCancelled) {
          setShinyData(transformedData);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load shinies'
          );
          console.error('Error fetching shinies:', err);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchShinies();

    return () => {
      isCancelled = true;
    };
  }, [date]);

  const filteredShinies = useMemo(() => {
    const term = searchTerm.toLowerCase();

    return shinyData.filter(
      (shiny) =>
        shiny.trainerName.toLowerCase().includes(term) ||
        shiny.name.toLowerCase().includes(term)
    );
  }, [shinyData, searchTerm]);

  const summary = useMemo(() => {
    const totalShinies = filteredShinies.length;
    const totalTrainers = new Set(
      filteredShinies.map((shiny) => shiny.trainerName)
    ).size;

    const shiniesWithEncounters = filteredShinies.filter(
      (shiny) => shiny.totalEncounters !== null && shiny.totalEncounters !== undefined && shiny.totalEncounters > 0
    );

    const totalEncounters = shiniesWithEncounters.reduce(
      (sum, shiny) => sum + (shiny.totalEncounters ?? 0),
      0
    );

    return {
      totalShinies,
      totalTrainers,
      totalEncounters,
      encounterCountedShinies: shiniesWithEncounters.length,
      avgEncounters:
        shiniesWithEncounters.length > 0
          ? Math.round(totalEncounters / shiniesWithEncounters.length)
          : 0,
    };
  }, [filteredShinies]);

  const SummaryChipSkeleton = () => (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 animate-pulse">
      <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
      <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  );

  const CompactShinyCardSkeleton = () => (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 animate-pulse">
      <div className="w-16 h-16 rounded-md bg-gray-200 dark:bg-gray-700 shrink-0" />

      <div className="min-w-0 flex-1">
        <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
        <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700 mb-2" />
        <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6 min-h-[500px]">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryChipSkeleton />
          <SummaryChipSkeleton />
          <SummaryChipSkeleton />
          <SummaryChipSkeleton />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CompactShinyCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="min-h-[500px] text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6 min-h-[500px]">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryChip label="Shinies" value={summary.totalShinies} />
        <SummaryChip label="Trainers" value={summary.totalTrainers} />
        <SummaryChip
          label="Total Encounters"
          value={summary.totalEncounters.toLocaleString()}
        />
        <SummaryChip
          label="Avg Encounters / Shiny"
          value={summary.avgEncounters.toLocaleString()}
        />
      </div>

      {filteredShinies.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredShinies.map((shiny, index) => (
            <ShinyCard
              key={`${shiny.trainerName}-${shiny.name}-${index}`}
              variant="compact"
              pokemonName={shiny.name}
              trainerName={shiny.trainerName}
              imageUrl={shiny.imageUrl}
              isFailed={shiny.isFailed}
              isSecret={shiny.isSecret}
              isAlpha={shiny.isAlpha}
              encounterType={shiny.encounterType}
              totalEncounters={shiny.totalEncounters}
              catchDate={shiny.catchDate}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">
            No shiny Pokémon found this month. Try adjusting your search.
          </p>
        </div>
      )}
    </div>
  );
};

export default MonthlyShiniesResults;