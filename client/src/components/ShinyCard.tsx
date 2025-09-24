import React from 'react';
import { motion } from 'framer-motion';

interface ShinyCardProps {
  pokemonName: string;
  trainerName: string;
  imageUrl: string;
  attribute?: string; // Optional: denote secret or safari shinies
}

const attributeIcons: Record<string, string> = {
  secret: '/images/secret.png',
  safari: '/images/safari.png',
};

const ShinyCard = ({ pokemonName, imageUrl, attribute }: ShinyCardProps) => {
  return (
    <motion.div 
      className="card"
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center p-2">
        {attribute && attributeIcons[attribute] && (
          <img
            src={attributeIcons[attribute]}
            alt={attribute}
            className="absolute top-2 right-2 w-6 h-6 z-10"
            draggable={false}
          />
        )}
        <img 
          src={imageUrl} 
          alt={`Shiny ${pokemonName}`} 
          className="w-full h-full object-contain pixelated"
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