import React from 'react';
import { motion } from 'framer-motion';

interface ShinyCardProps {
  pokemonName: string;
  trainerName: string;
  imageUrl: string;
  date: string;
  description?: string;
}

const ShinyCard = ({ pokemonName, imageUrl }: ShinyCardProps) => {
  return (
    <motion.div 
      className="card"
      whileHover={{ y: -5 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center p-2">
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