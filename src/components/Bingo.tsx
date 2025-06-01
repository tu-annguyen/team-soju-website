import React from 'react';
import BingoCard from './BingoCard';
import bingo from '../data/bingo.json';

interface BingoSquare {
  value: string;
  teamNames?: string[];
  trainerNames?: string[];
}

const mvpPoints = {
  "Team Aisu": {
    "XiaoLongBao": 1,
    "gaandusulayman": 0,
    "ReefBarrierGreat": 0,
    "HogXD": 0,
    "Misc": 1,
    "Electra": 0,
    "spook": 0,
    "TXMPXp": 0,
    "JustMagoo": 0,
    "fabriksgjord": 0,
    "Colty": 0,
    "thelayar": 0,
    "DingusDestiny": 0,
    "hefferson": 0,
  },
  "Team Buddha": {
    "Buddhalicious": 0,
    "MumenRider": 0,
    "CaliKingCorey": 0,
    "pikachutiyaL": 0,
    "BlossomsDream": 0,
    "Jaap": 0,
    "Axelokara": 0,
    "tunacore": 0,
    "belley": 0,
    "spounch": 0,
    "SpriggyMew": 3,
    "Zofina": 0,
    "Ubela": 0,
    "Megu": 0,
  }
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
        <div className="grid grid-cols-5 gap-1 max-w-3xl mx-auto mb-12">
          {bingoData.map((square, index) => (
            <BingoCard
              key={index}
              value={square.value}
              teamNames={square.teamNames || []}
              trainerNames={square.trainerNames || []}
            />
          ))}
        </div>
        <div className="mb-12 grid grid-cols-2">
          <h3 className="text-center text-2xl font-bold mb-4 text-gray-900 dark:text-white">Team Buddha</h3>
          <h3 className="text-center text-2xl font-bold mb-4 text-gray-900 dark:text-white">Team Aisu</h3>
          <p className="text-center text-gray-700 dark:text-gray-300 mb-8">Team Points: {Object.values(mvpPoints["Team Buddha"]).reduce((a, b) => a + b, 0)}</p>
          <p className="text-center text-gray-700 dark:text-gray-300 mb-8">Team Points: {Object.values(mvpPoints["Team Aisu"]).reduce((a, b) => a + b, 0)}</p>
          <div>
            <h4 className="text-center text-xl font-bold text-gray-900 dark:text-white">Member List</h4>
            <p className="text-center text-xs text-gray-400 dark:text-gray-600 mb-4">(IGN: MVP points)</p>
          </div>
          <div>
            <h4 className="text-center text-xl font-bold text-gray-900 dark:text-white">Member List</h4>
            <p className="text-center text-xs text-gray-400 dark:text-gray-600 mb-4">(IGN: MVP points)</p>
          </div>
          <div>
            {Object.entries(mvpPoints["Team Buddha"]).map(([trainer, points]) => (
              <p key={trainer} className="text-center text-gray-700 dark:text-gray-300 mb-2">
                {trainer}: {points}
              </p>
            ))}
          </div>
          <div>
            {Object.entries(mvpPoints["Team Aisu"]).map(([trainer, points]) => (
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