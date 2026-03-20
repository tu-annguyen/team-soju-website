import React, { useEffect, useMemo, useState } from 'react';
import { capitalize } from '../utils/pokemonName';
import { getShinySpriteUrl } from '../utils/pokemonSprite';
import { formatLocalDate, calculateShinyPoints } from '@team-soju/utils';
import ShinyCard from './ShinyCard';
import { applyTeamSpeciesDuplicatePenalty } from '../utils/teamDuplicatePenalty';

type EligiblePokemon = Record<string, string[]>;

interface ActivityLogProps {
  eligiblePokemon: EligiblePokemon;
  apiBaseUrl?: string;
  teamMembers?: Record<string, string[]>;
  onEligibleShiniesLoaded?: (shinies: EventShiny[]) => void;
}

interface ShinyFromAPI {
  id: string;
  pokemon_name: string;
  trainer_name: string;
  encounter_type: string | null;
  is_secret: boolean;
  is_alpha: boolean;
  notes: string | null;
  total_encounters?: number | null;
  catch_date?: string | null;
  created_at?: string | null;
}

export interface EventShiny {
  id: string;
  pokemonName: string;
  name: string;
  trainerName: string;
  imageUrl: string;
  isFailed: boolean;
  isSecret: boolean;
  isAlpha: boolean;
  encounterType: string;
  totalEncounters: number | null;
  catchDate: string | null;
  createdAt: string | null;
  points: number;
  isDuplicate?: boolean;
}

const buildEligiblePokemonSet = (eligiblePokemon: EligiblePokemon) =>
  new Set(
    Object.values(eligiblePokemon)
      .flat()
      .map((pokemonName) => pokemonName.trim().toLowerCase())
  );

const defaultApiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

const transformAPIDataToEvent = async (
  shinies: ShinyFromAPI[]
): Promise<EventShiny[]> => {
  return shinies.map((shiny) => {
      const isFailed = !!(
        shiny.notes && shiny.notes.toLowerCase().includes('failed')
      );

      return {
        id: shiny.id,
        pokemonName: shiny.pokemon_name,
        name: capitalize(shiny.pokemon_name),
        trainerName: shiny.trainer_name,
        imageUrl: getShinySpriteUrl(shiny.pokemon_name),
        isFailed,
        isSecret: shiny.is_secret,
        isAlpha: shiny.is_alpha,
        encounterType: shiny.encounter_type || '',
        totalEncounters: shiny.total_encounters ?? null,
        catchDate: shiny.catch_date ?? null,
        createdAt: shiny.created_at ?? null,
        points: isFailed
          ? 0
          : calculateShinyPoints(shiny.pokemon_name, {
              encounter_type: shiny.encounter_type,
              is_secret: shiny.is_secret,
              is_alpha: shiny.is_alpha,
            }),
        isDuplicate: false,
      };
    });
};

const ActivityLog = ({
  eligiblePokemon,
  apiBaseUrl = defaultApiBaseUrl,
  teamMembers,
  onEligibleShiniesLoaded,
}: ActivityLogProps) => {
  const [shinyData, setShinyData] = useState<EventShiny[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchShinies = async () => {
      try {
        setLoading(true);
        setError(null);

        const catchDateAfter = formatLocalDate(new Date(2026, 2, 19));
        const catchDateBefore = formatLocalDate(new Date(2026, 2, 30));

        const response = await fetch(
          `${apiBaseUrl}/shinies?sort_order=desc&catch_date_after=${catchDateAfter}&catch_date_before=${catchDateBefore}&limit=10000`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch shinies: ${response.statusText}`);
        }

        const data = await response.json();
        const shinies = data.data || [];
        const transformedData = await transformAPIDataToEvent(shinies);

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
  }, [apiBaseUrl]);

  const eligiblePokemonSet = useMemo(
    () => buildEligiblePokemonSet(eligiblePokemon),
    [eligiblePokemon]
  );

  const eligibleShinies = useMemo(
    () =>
      applyTeamSpeciesDuplicatePenalty(
        shinyData.filter((shiny) =>
          eligiblePokemonSet.has(shiny.pokemonName.trim().toLowerCase())
        ),
        teamMembers
      ),
    [eligiblePokemonSet, shinyData, teamMembers]
  );

  useEffect(() => {
    onEligibleShiniesLoaded?.(eligibleShinies);
  }, [eligibleShinies, onEligibleShiniesLoaded]);

  if (loading) {
    return (
      <section className="py-8">
        <div className="container text-center">
          <p className="text-gray-600 dark:text-gray-400">Loading activity log...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-8">
        <div className="container text-center">
          <p className="text-red-600 dark:text-red-400">Error loading shinies: {error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8">
      <div className="container">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
          Activity Log
        </h2>

        {eligibleShinies.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {eligibleShinies.map((shiny, index) => (
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
                points={shiny.points}
                isDuplicate={shiny.isDuplicate}
                totalEncounters={shiny.totalEncounters}
                catchDate={shiny.catchDate}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">
              No shiny Pokémon caught in this event yet. Check back soon!
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default ActivityLog;
