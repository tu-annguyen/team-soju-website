import React from 'react';
import { motion } from 'framer-motion';

interface ShinyCardProps {
  pokemonName: string;
  trainerName: string;
  imageUrl: string;
  isFailed: boolean;
  isSecret: boolean;
  encounterType: string;
  isSafari: boolean;
  isEgg: boolean;
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
  gift: '/images/gift.png',
  alpha: '/images/alpha.png',
};

const ShinyCard = ({ pokemonName, imageUrl, isFailed, isSecret, isSafari, isEgg, encounterType}: ShinyCardProps) => {
  return (
    <motion.div 
      className="card"
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
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
        {isSafari && (
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
      <div className="p-2 text-center">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{pokemonName}</h3>
      </div>
    </motion.div>
  );
};

export default ShinyCard;