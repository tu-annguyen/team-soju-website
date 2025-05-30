import React from 'react';
import BingoCard from './BingoCard';
import bingo from '../data/bingo.json';

interface BingoSquare {
  value: string;
  teamNames?: string[];
  trainerNames?: string[];
}

const bingoData: BingoSquare[] = bingo;
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
          {bingoData.map((square, index) => (
            <BingoCard
              key={index}
              value={square.value}
              teamNames={square.teamNames || []}
              trainerNames={square.trainerNames || []}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Bingo;
