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
              <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                {trainer.name}
                <span className="text-lg font-normal text-gray-600 dark:text-gray-400">
                  ({trainer.numOT} OT shinies • {trainer.totalPoints} pts)
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
