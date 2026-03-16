import React, { useState, useEffect } from 'react';
import ShinyCard from './ShinyCard';
import { Pokedex } from 'pokeapi-js-wrapper';
const P = new Pokedex();

interface ShinyShowcaseResultsProps {
  searchTerm: string;
}

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
          const pokemonData = await P.getPokemonByName(shiny.pokemon_name.toLowerCase()).catch(err => {
            console.error('Error fetching Pokémon data:', err);
          });
          const baseUrl = pokemonData ? pokemonData.sprites.versions["generation-v"]["black-white"].animated.front_shiny : '';
          // const baseUrl = await getSpriteUrl(shiny.pokemon_name.toLowerCase());

          return {
            name: shiny.pokemon_name[0].toUpperCase() + shiny.pokemon_name.slice(1).toLowerCase(), // Capitalize first letter
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

  return trainers.sort((a, b) => b.numOT - a.numOT); // Sort by OT count descending
};

const ShinyShowcaseResults = ({
  searchTerm,
}: ShinyShowcaseResultsProps) => {
  const [shinyData, setShinyData] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShinies = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const apiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
        const response = await fetch(`${apiBaseUrl}/shinies?sort_order=asc&limit=10000`);
        
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
  }, []);
  
  const filteredTrainers = shinyData.filter(trainer => 
    trainer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trainer.shinies.some(shiny => 
      shiny.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );
  
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
    <section>
      <div className="container">
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
            <p className="text-gray-600 dark:text-gray-400">No shiny Pokémon found. Try adjusting your search.</p>
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

export default ShinyShowcaseResults;