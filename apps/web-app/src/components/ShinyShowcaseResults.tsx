import React from 'react';
import ShinyCard from './ShinyCard';

interface ShinyShowcaseResultsProps {
  searchTerm: string;
  shinyData: Trainer[];
  loading: boolean;
  error: string | null;
}

export interface ShinyPokemon {
  name: string;
  imageUrl: string;
  isFailed: boolean;
  isSecret: boolean;
  isAlpha: boolean;
  encounterType: string;
  tier: string;
  pointValue: number;
  catchDate: string | null;
  totalEncounters: number | null;
  speciesEncounters: number | null;
  nature: string | null;
  ivHp: number | null;
  ivAttack: number | null;
  ivDefense: number | null;
  ivSpAttack: number | null;
  ivSpDefense: number | null;
  ivSpeed: number | null;
}

interface Trainer {
  name: string;
  numOT: number;
  totalPoints: number;
  shinies: ShinyPokemon[];
}

const ShinyShowcaseResults = ({
  searchTerm,
  shinyData,
  loading,
  error,
}: ShinyShowcaseResultsProps) => {
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
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <h3 className="min-w-0 break-words text-2xl font-bold text-gray-900 dark:text-white">
                  {trainer.name}
                </h3>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-gray-600 dark:text-gray-400 sm:justify-end sm:text-lg sm:font-normal">
                  <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
                    {trainer.numOT} OT shinies
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
                    {trainer.totalPoints} pts
                  </span>
                </p>
              </div>
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
                    points={shiny.pointValue}
                    tier={shiny.tier}
                    pointValue={shiny.pointValue}
                    catchDate={shiny.catchDate}
                    totalEncounters={shiny.totalEncounters}
                    speciesEncounters={shiny.speciesEncounters}
                    nature={shiny.nature}
                    ivHp={shiny.ivHp}
                    ivAttack={shiny.ivAttack}
                    ivDefense={shiny.ivDefense}
                    ivSpAttack={shiny.ivSpAttack}
                    ivSpDefense={shiny.ivSpDefense}
                    ivSpeed={shiny.ivSpeed}
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
      </div>
    </section>
  );
};

export default ShinyShowcaseResults;
