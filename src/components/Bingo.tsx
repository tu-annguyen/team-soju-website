import React from 'react';
import BingoCard from './BingoCard';
import bingo from '../data/bingo.json';

interface BingoSquare {
  value: string;
  trainerNames?: string[];
  position?: "left" | "center" | "right";
}

const bingoData: BingoSquare[] = bingo["squares"];
const teamBuddha = bingo["Team Buddha"];
const teamAisu = bingo["Team Aisu"];
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
        <div className="grid grid-cols-5 gap-1 max-w-3xl mx-auto mb-12">
          {bingoData.map((square, index) => (
            <BingoCard
              key={index}
              value={square.value}
              trainerNames={square.trainerNames || []}
              position={square.position || 'center'}
            />
          ))}
        </div>
        <div className="mb-12 grid grid-cols-2">
          <h3 className="text-center text-2xl font-bold mb-4 text-primary-700 dark:text-white">Team Buddha</h3>
          <h3 className="text-center text-2xl font-bold mb-4 text-secondary-700 dark:text-white">Team Aisu</h3>
          <p className="text-center text-gray-700 dark:text-gray-300 mb-8">Team Points: {Object.values(teamBuddha).reduce((a, b) => a + b, 0)}</p>
          <p className="text-center text-gray-700 dark:text-gray-300 mb-8">Team Points: {Object.values(teamAisu).reduce((a, b) => a + b, 0)}</p>
          <div>
            <h4 className="text-center text-xl font-bold text-gray-900 dark:text-white">Member List</h4>
            <p className="text-center text-xs text-gray-400 dark:text-gray-600 mb-4">(IGN: MVP points)</p>
          </div>
          <div>
            <h4 className="text-center text-xl font-bold text-gray-900 dark:text-white">Member List</h4>
            <p className="text-center text-xs text-gray-400 dark:text-gray-600 mb-4">(IGN: MVP points)</p>
          </div>
          <div>
            {Object.entries(teamBuddha).map(([trainer, points]) => (
              <p key={trainer} className="text-center text-gray-700 dark:text-gray-300 mb-2">
                {trainer}: {points}
              </p>
            ))}
          </div>
          <div>
            {Object.entries(teamAisu).map(([trainer, points]) => (
              <p key={trainer} className="text-center text-gray-700 dark:text-gray-300 mb-2">
                {trainer}: {points}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Bingo;