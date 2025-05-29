import React from 'react';

const bingoValues = [
  [
    "Johto Rotational Safari Shiny",
    "3x Horde",
    "Johto Shiny",
    "Dratini / Larvitar",
    "Egg Shiny"
  ],
  [
    "Gym Leaders Full Team Shiny",
    "Water Shiny",
    "5x Horde",
    "Electric Shiny",
    "Petalburg Shiny"
  ],
  [
    "Single / Double",
    "3x Horde",
    "SOJU Mascot Squirtle Shiny",
    "Hoenn Shiny",
    "Zorua"
  ],
  [
    "Ralts",
    "Kanto Shiny",
    "5x Horde",
    "Fire Shiny",
    "Hoenn Safari"
  ],
  [
    "Honey Tree Shiny",
    "Sinnoh Shiny",
    "Unova Shiny",
    "Single / Double",
    "Fishing Shiny"
  ]
];

const Bingo = () => {
  return (
    <section className="py-16">
      <div className="container">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">SOJU Bingo</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-8">
            SOJU Bingo is a shiny hunting event with two teams racing to complete as many tiles as they can! For more details about the SOJU Bingo, please visit our 
            <a 
              href="https://forums.pokemmo.com/index.php?/topic/189005-team-soju-bingo-shiny-wars/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary-600 dark:text-primary-400 hover:underline ml-1"
            >
              forum post
            </a>.
          </p>
        </div>
        <h3 className="text-center text-2xl font-bold mb-4 text-gray-900 dark:text-white">Bingo Board</h3>
        <div className="grid grid-cols-5 gap-1 max-w-3xl mx-auto">
          {bingoValues.flat().map((value, idx) => (
            <div
              key={idx}
              className="text-center text-xs sm:text-lg font-medium text-gray-900 dark:text-white relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center p-2"
            >
              {value}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Bingo;
