import React, { useState, useEffect } from 'react';
import ShinyCard from './ShinyCard';
import { getSpriteUrl } from '@team-soju/utils/pokeapi'

export interface ShinyPokemon {
  name: string;
  imageUrl: string;
  isFailed: boolean;
  isSecret: boolean;
  isAlpha: boolean;
  encounterType: string;
}

interface Trainer {
  name: string;
  numOT: number;
  shinies: ShinyPokemon[];
}

interface ShinyFromAPI {
  pokemon_name: string;
  trainer_name: string;
  encounter_type: string | null;
  is_secret: boolean;
  is_alpha: boolean;
  notes: string | null;
}

const transformAPIDataToShowcase = async (shinies: ShinyFromAPI[]): Promise<Trainer[]> => {
  const trainerMap = new Map<string, ShinyFromAPI[]>();

  shinies.forEach(shiny => {
    const existing = trainerMap.get(shiny.trainer_name) || [];
    trainerMap.set(shiny.trainer_name, [...existing, shiny]);
  });

  const trainers = await Promise.all(
    Array.from(trainerMap.entries()).map(async ([trainerName, trainerShinies]) => {
      let otCount = trainerShinies.length;

      const shiniesWithUrls = await Promise.all(
        trainerShinies.map(async (shiny) => {
          const isFailed = !!(shiny.notes && shiny.notes.toLowerCase().includes('failed'));
          if (isFailed) otCount--;
          const isSecret = shiny.is_secret;
          const isAlpha = shiny.is_alpha;
          const encounterType = shiny.encounter_type || '';
          const baseUrl = await getSpriteUrl(shiny.pokemon_name.toLowerCase());

          return {
            name: shiny.pokemon_name[0].toUpperCase() + shiny.pokemon_name.slice(1).toLowerCase(),
            imageUrl: baseUrl || '',
            isFailed,
            isSecret,
            isAlpha,
            encounterType,
          };
        })
      );

      return {
        name: trainerName,
        numOT: otCount,
        shinies: shiniesWithUrls
      };
    })
  );

  return trainers.sort((a, b) => b.numOT - a.numOT);
};

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MonthlyShinies = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [shinyData, setShinyData] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const currentMonth = date.toLocaleString('default', { month: 'long' });

  useEffect(() => {
    const fetchShinies = async () => {
      try {
        setLoading(true);
        setError(null);

        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        const catchDateAfter = formatLocalDate(firstDayOfMonth);
        const catchDateBefore = formatLocalDate(lastDayOfMonth);

        console.log(`Fetching shinies caught between ${catchDateAfter} and ${catchDateBefore}`);

        const apiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
        const response = await fetch(
          `${apiBaseUrl}/shinies?sort_order=asc&catch_date_after=${catchDateAfter}&catch_date_before=${catchDateBefore}&limit=10000`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch shinies: ${response.statusText}`);
        }

        const data = await response.json();
        const shinies = data.data || [];
        const transformedData = await transformAPIDataToShowcase(shinies);
        setShinyData(transformedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shinies');
        console.error('Error fetching shinies:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchShinies();
  }, [date]);

  const filteredTrainers = shinyData.filter(trainer =>
    trainer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trainer.shinies.some(shiny =>
      shiny.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleLastMonth = () => {
    setDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  if (loading) {
    return (
      <section className="py-16">
        <div className="container">
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Loading shiny collection...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16">
        <div className="container">
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">Error loading shinies: {error}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16">
      <div className="container">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Search</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-8 max-w-3xl">
            Search this month's collection! Search terms may include trainer or pokemon names.
          </p>

          <div className="max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by Pokémon or trainer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">{currentMonth} Shinies</h2>
        <div className="flex justify-left mb-8">
          <a className="mr-4 btn btn-secondary cursor-pointer" onClick={handleLastMonth}>Last Month</a>
          <a className="mx-4 btn btn-secondary cursor-pointer" onClick={handleNextMonth}>Next Month</a>
        </div>

        {filteredTrainers.length > 0 ? (
          filteredTrainers.map(trainer => (
            <div key={trainer.name} className="mb-12">
              <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                {trainer.name}
                <span className="text-lg font-normal text-gray-600 dark:text-gray-400">
                  ({trainer.numOT} OT shinies)
                </span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                {trainer.shinies.map((shiny, index) => (
                  <ShinyCard
                    key={`${trainer.name}-${shiny.name}-${index}`}
                    pokemonName={shiny.name}
                    trainerName={trainer.name}
                    imageUrl={shiny.imageUrl}
                    isFailed={shiny.isFailed}
                    isSecret={shiny.isSecret}
                    isAlpha={shiny.isAlpha}
                    encounterType={shiny.encounterType}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No shiny Pokémon found this month. Try adjusting your search.</p>
          </div>
        )}

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

export default MonthlyShinies;