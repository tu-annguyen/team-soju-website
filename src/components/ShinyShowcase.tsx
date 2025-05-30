import React, { useState } from 'react';
import ShinyCard from './ShinyCard';
import showcase from '../data/showcase.json';

export interface ShinyPokemon {
  name: string;
  imageUrl: string;
  attribute: string; // Optional: denote secret or safari shinies 
}

interface Trainer {
  name: string;
  numOT: number;
  shinies: ShinyPokemon[];
}

const shinyData: Trainer[] = showcase;
const ShinyShowcase = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredTrainers = shinyData.filter(trainer => 
    trainer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trainer.shinies.some(shiny => 
      shiny.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );
  
  return (
    <section className="py-16">
      <div className="container">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Search</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-8 max-w-3xl">
            Search our team's shiny Pokémon collection! Search terms may include trainer or pokemon names.
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
        </div>
        
        <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Showcase</h2>
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
                    attribute={shiny.attribute}
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
            This showcase is automatically updated from our 
            <a 
              href="https://forums.pokemmo.com/index.php?/topic/181636-team-soj%C3%BC-shiny-showcase/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary-600 dark:text-primary-400 hover:underline ml-1"
            >
              forum thread
            </a>.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ShinyShowcase;