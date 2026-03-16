import React, { useState, useEffect } from 'react';
import MonthlyShiniesResults from './MonthlyShiniesResults';
import { Pokedex } from 'pokeapi-js-wrapper';
const P = new Pokedex();

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

interface MonthlyShiniesProps {
  apiBaseUrl?: string;
}

const transformAPIDataToMonthly = async (shinies: ShinyFromAPI[]): Promise<MonthlyShiny[]> => {
  const transformed = await Promise.all(
    shinies.map(async (shiny) => {
      const isFailed = !!(shiny.notes && shiny.notes.toLowerCase().includes('failed'));
      const pokemonData = await P.getPokemonByName(shiny.pokemon_name.toLowerCase()).catch(err => {
        console.error('Error fetching Pokémon data:', err);
      });
      const baseUrl = pokemonData ? pokemonData.sprites.versions["generation-v"]["black-white"].animated.front_shiny : '';

      return {
        name: shiny.pokemon_name[0].toUpperCase() + shiny.pokemon_name.slice(1).toLowerCase(),
        trainerName: shiny.trainer_name,
        imageUrl: baseUrl || '',
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
  
const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const MonthlyShinies = ({
  apiBaseUrl = 'http://localhost:3001/api',
}: MonthlyShiniesProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [shinyData, setShinyData] = useState<MonthlyShiny[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState<Date>(new Date());
  const selectedMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const today = new Date();
  const currentRealMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const isNextDisabled = nextMonth > currentRealMonth;

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

        const response = await fetch(
          `${apiBaseUrl}/shinies?sort_order=asc&catch_date_after=${catchDateAfter}&catch_date_before=${catchDateBefore}&limit=10000`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch shinies: ${response.statusText}`);
        }

        const data = await response.json();
        const shinies = data.data || [];
        const transformedData = await transformAPIDataToMonthly(shinies);
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

  const handleLastMonth = () => {
    setDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    if (isNextDisabled) return;

    setDate(nextMonth);
  };

  return (
    <section className="py-16">
      <div className="container">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-8">
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">{selectedMonth.toLocaleString('default', { month: 'long', year: 'numeric' })} Shinies</h2>
          <div className="flex justify-left mb-8">
            <button className="mr-4 btn btn-primary cursor-pointer" onClick={handleLastMonth}>
              Last Month
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={isNextDisabled}
              className={`mx-4 btn cursor-pointer ${
                isNextDisabled
                  ? 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-500 cursor-not-allowed opacity-60'
                  : 'btn-primary'
              }`}
            >
              Next Month
            </button>
          </div>
        </div>

        <div className="max-w-md mb-8">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by Pokémon or trainer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
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
        </div>

        <div className="min-h-[500px]">
          <MonthlyShiniesResults date={date} searchTerm={searchTerm} />
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

export default MonthlyShinies;
