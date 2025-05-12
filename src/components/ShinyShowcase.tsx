import React, { useState } from 'react';
import ShinyCard from './ShinyCard';

interface ShinyTrainer {
  name: string;
  count: number;
  shinies: {
    name: string;
    imageUrl: string;
  }[];
}

// Real data from the forum post
const shinyData: ShinyTrainer[] = [
  {
    name: "xMEGUx",
    count: 31,
    shinies: [
      { name: "Smeargle", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/smeargle.gif" },
      { name: "Magikarp", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/magikarp.gif" },
      { name: "Magikarp", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/magikarp.gif" },
      { name: "Larvitar", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/larvitar.gif" },
      { name: "Dratini", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/dratini.gif" },
      { name: "Poochyena", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/poochyena.gif" },
      { name: "Cranidos", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/cranidos.gif" },
      { name: "Litwick", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/litwick.gif" },
      { name: "Ninetales", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/ninetales.gif" },
      { name: "Grimer", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/grimer.gif" },
      { name: "Woobat", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/woobat.gif" },
      { name: "Woobat", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/woobat.gif" },
      { name: "Seviper", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/seviper.gif" },
      { name: "Spearow", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/spearow.gif" },
      { name: "Donphan", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/donphan.gif" },
      { name: "Medicham", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/medicham-f.gif" },
      { name: "Haxorus", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/haxorus.gif" },
      { name: "Swoobat", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/swoobat.gif" },
      { name: "Woobat", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/woobat.gif" },
      { name: "Gigalith", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/gigalith.gif" },
      { name: "Onix", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/onix.gif" },
      { name: "Onix", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/onix.gif" },
      { name: "Snover", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/snover-f.gif" },
      { name: "Rapidash", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/rapidash.gif" },
      { name: "Golbat", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/golbat.gif" },
      { name: "Absol", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/absol.gif" },
      { name: "Bouffalant", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/bouffalant.gif" },
      { name: "Mankey", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/mankey.gif" },
      { name: "Mareep", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/mareep.gif" },
      { name: "Magikarp", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/magikarp.gif" },
      { name: "Dratini", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/dratini.gif" }
    ]
  },
  {
    name: "Aisukohi",
    count: 27,
    shinies: [
      { name: "Tentacruel", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/tentacruel.gif" },
      { name: "Mantine", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/mantine.gif" },
      { name: "Whimsicott", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/whimsicott.gif" },
      { name: "Golem", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/golem.gif" },
      { name: "Victreebel", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/victreebel.gif" },
      { name: "Bibarel", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/bibarel-f.gif" },
      { name: "Flygon", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/flygon.gif" },
      { name: "Joltik", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/joltik.gif" },
      { name: "Poochyena", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/poochyena.gif" },
      { name: "Sandshrew", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/sandshrew.gif" },
      { name: "Graveler", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/graveler.gif" },
      { name: "Graveler", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/graveler.gif" },
      { name: "Reuniclus", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/reuniclus.gif" },
      { name: "Bibarel", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/bibarel-f.gif" },
      { name: "Azumarill", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/azumarill.gif" },
      { name: "Mienshao", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/mienshao.gif" },
      { name: "Floatzel", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/floatzel.gif" },
      { name: "Meowth", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/meowth.gif" },
      { name: "Lilligant", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/lilligant.gif" },
      { name: "Sableye", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/sableye.gif" },
      { name: "Froslass", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/froslass.gif" },
      { name: "Ledian", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/ledian.gif" },
      { name: "Dunsparce", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/dunsparce.gif" },
      { name: "Mawile", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/mawile.gif" },
      { name: "Treecko", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/treecko.gif" },
      { name: "Mienfoo", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/mienfoo.gif" },
      { name: "Wooper", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/wooper-f.gif" }
    ]
  },
  {
    name: "hefferson",
    count: 22,
    shinies: [
      { name: "Vanillish", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/vanillish.gif" },
      { name: "Gyarados", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/gyarados.gif" },
      { name: "Smeargle", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/smeargle.gif" },
      { name: "Spearow", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/spearow.gif" },
      { name: "Lilligant", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/lilligant.gif" },
      { name: "Whirlipede", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/whirlipede.gif" },
      { name: "Houndoom", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/houndoom-f.gif" },
      { name: "Hoothoot", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/hoothoot.gif" },
      { name: "Treecko", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/treecko.gif" },
      { name: "Gligar", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/gligar-f.gif" },
      { name: "Cubchoo", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/cubchoo.gif" },
      { name: "Geodude", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/geodude.gif" },
      { name: "Poliwag", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/poliwag.gif" },
      { name: "Lunatone", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/lunatone.gif" },
      { name: "Golduck", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/golduck.gif" },
      { name: "Piloswine", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/piloswine-f.gif" },
      { name: "Larvitar", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/larvitar.gif" },
      { name: "Bouffalant", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/bouffalant.gif" },
      { name: "Dratini", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/dratini.gif" },
      { name: "Onix", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/onix.gif" },
      { name: "Meowth", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/meowth.gif" },
      { name: "Mareep", imageUrl: "https://img.pokemondb.net/sprites/black-white/anim/shiny/mareep.gif" }
    ]
  }
  // Additional trainers would be added here...
];

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
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Shiny Showcase</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-8 max-w-3xl">
            Explore our team's rare shiny Pokémon collection! This showcase features the dedication and 
            persistence of our trainers in finding these elusive variants.
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
        
        {filteredTrainers.length > 0 ? (
          filteredTrainers.map(trainer => (
            <div key={trainer.name} className="mb-12">
              <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                {trainer.name}
                <span className="text-lg font-normal text-gray-600 dark:text-gray-400">
                  ({trainer.count} shinies)
                </span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {trainer.shinies.map((shiny, index) => (
                  <ShinyCard
                    key={`${trainer.name}-${shiny.name}-${index}`}
                    pokemonName={shiny.name}
                    trainerName={trainer.name}
                    imageUrl={shiny.imageUrl}
                    date=""
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