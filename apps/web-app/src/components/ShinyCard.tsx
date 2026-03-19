import React, { useState } from 'react';
import { motion } from 'framer-motion';
import ShinyDetails from './ShinyDetails';
import { formatPokemonCardName } from '../utils/pokemonName';

interface ShinyCardProps {
  pokemonName: string;
  trainerName: string;
  imageUrl: string;
  isFailed: boolean;
  isSecret: boolean;
  isAlpha: boolean;
  encounterType: string;
  points?: number | null;
  tier?: string | null;
  pointValue?: number | null;
  totalEncounters?: number | null;
  catchDate?: string | null;
  speciesEncounters?: number | null;
  nature?: string | null;
  ivHp?: number | null;
  ivAttack?: number | null;
  ivDefense?: number | null;
  ivSpAttack?: number | null;
  ivSpDefense?: number | null;
  ivSpeed?: number | null;

  variant?: 'default' | 'compact';
}

const attributeIcons: Record<string, string> = {
  secret: '/images/secret.png',
  safari: '/images/safari.png',
  fishing: '/images/fishing.png',
  egg: '/images/egg.png',
  mysterious_ball: '/images/mysterious-ball.png',
  honey_tree: '/images/honey.png',
  swarm: '/images/swarm.png',
  fossil: '/images/fossil.png',
  rock_smash: '/images/rock.png',
  headbutt: '/images/headbutt.png',
  gift: '/images/gift.png',
  alpha: '/images/alpha.png',
};

const ShinyCard = ({
  pokemonName,
  trainerName,
  imageUrl,
  isFailed,
  isSecret,
  isAlpha,
  encounterType,
  points,
  tier,
  pointValue,
  totalEncounters,
  catchDate,
  speciesEncounters,
  nature,
  ivHp,
  ivAttack,
  ivDefense,
  ivSpAttack,
  ivSpDefense,
  ivSpeed,
  variant = 'default'
}: ShinyCardProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const cardPokemonName = formatPokemonCardName(pokemonName);
  const resolvedPoints = points ?? pointValue;

  if (variant === 'compact') {
    return (
      <motion.div
        className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-md p-1">
          {isSecret && (
            <img
              src={attributeIcons['secret']}
              alt="Secret shiny"
              className="absolute top-0 left-0 w-4 h-4"
              draggable={false}
            />
          )}

          {isAlpha && (
            <img
              src={attributeIcons['alpha']}
              alt="Alpha shiny"
              className="absolute bottom-0 right-0 w-4 h-4"
              draggable={false}
            />
          )}

          {encounterType && attributeIcons[encounterType] && (
            <img
              src={attributeIcons[encounterType]}
              alt={`${encounterType} encounter`}
              className="absolute top-0 right-0 w-4 h-4"
              draggable={false}
            />
          )}

          <img
            src={imageUrl}
            alt={`Shiny ${pokemonName}`}
            className={`w-full h-full object-contain pixelated ${isFailed ? 'grayscale' : ''}`}
            loading="lazy"
          />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {cardPokemonName}
          </h3>

          <p className="text-xs text-gray-600 dark:text-gray-400">
            {trainerName}
          </p>

          {resolvedPoints !== null && resolvedPoints !== undefined && (
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {resolvedPoints} pts
            </p>
          )}

          {(totalEncounters || catchDate) && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {totalEncounters ? `${totalEncounters.toLocaleString()} encounters` : ''}
              {totalEncounters && catchDate ? ' • ' : ''}
              {catchDate || ''}
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.button
        type="button"
        className="card block w-full cursor-pointer text-left"
        whileHover={{ y: -5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        onClick={() => setShowDetails(true)}
      >
        <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center p-2">
          {isSecret && (
            <img
              src={attributeIcons['secret']}
              alt="Secret shiny"
              className="absolute top-2 left-2 w-6 h-6 z-10"
              draggable={false}
            />
          )}
          {isAlpha && (
            <img
              src={attributeIcons['alpha']}
              alt="Alpha shiny"
              className="absolute bottom-2 right-2 w-6 h-6 z-10"
              draggable={false}
            />
          )}
          {encounterType && attributeIcons[encounterType] && (
            <img
              src={attributeIcons[encounterType]}
              alt={`${encounterType} encounter`}
              className="absolute top-2 right-2 w-6 h-6 z-10"
              draggable={false}
            />
          )}
          <img
            src={imageUrl}
            alt={`Shiny ${pokemonName}`}
            className={`w-full h-full object-contain pixelated ${isFailed ? 'grayscale' : ''}`}
            loading="lazy"
          />
        </div>
        <div className="p-2 bg-white dark:bg-gray-700 text-center">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{cardPokemonName}</h3>
        </div>
      </motion.button>

      <ShinyDetails
        open={showDetails}
        onClose={() => setShowDetails(false)}
        pokemonName={pokemonName}
        trainerName={trainerName}
        imageUrl={imageUrl}
        isFailed={isFailed}
        isSecret={isSecret}
        isAlpha={isAlpha}
        tier={tier}
        pointValue={resolvedPoints}
        catchDate={catchDate}
        totalEncounters={totalEncounters}
        speciesEncounters={speciesEncounters}
        encounterType={encounterType}
        nature={nature}
        ivHp={ivHp}
        ivAttack={ivAttack}
        ivDefense={ivDefense}
        ivSpAttack={ivSpAttack}
        ivSpDefense={ivSpDefense}
        ivSpeed={ivSpeed}
      />
    </>
  );
};

export default ShinyCard;
