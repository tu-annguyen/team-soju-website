import React from 'react';
import { motion } from 'framer-motion';

interface BingoCardProps {
  value: string;
  teamNames?: string[];
  trainerNames?: string[];
}

const getCardClasses = (teamNames?: string[]) => {
  if (!teamNames || teamNames.length === 0) return "bg-gray-200 dark:bg-gray-700";

  if (teamNames.length === 1) {
    if (teamNames[0] === "Team Buddha") {
      return "bg-primary-100 dark:bg-primary-800";
    }
    if (teamNames[0] === "Team Aisu") {
      return "bg-secondary-100 dark:bg-secondary-800";
    }
  }

  if (
    teamNames.includes("Team Buddha") &&
    teamNames.includes("Team Aisu")
  ) {
    // Will handle diagonal split with overlay divs
    return "relative";
  }

  return "bg-gray-100 dark:bg-gray-800";
};

const BingoCard = ({ value, teamNames = [], trainerNames = [] }: BingoCardProps) => {
  const diagonalSplit =
    teamNames &&
    teamNames.includes("Team Buddha") &&
    teamNames.includes("Team Aisu");

  const hasTrainers = trainerNames && trainerNames.filter(name => name && name.trim() !== '').length > 0;

  return (
    <div className="relative group">
      <motion.div 
        className={`text-center text-xs sm:text-lg font-medium text-gray-900 dark:text-white aspect-square overflow-hidden flex items-center justify-center p-2 ${getCardClasses(teamNames)}`}
        whileHover={{ y: -5 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        {diagonalSplit && (
          <>
            <div className="absolute inset-0 w-full h-full">
              <div className="w-full h-full bg-primary-100 dark:bg-primary-800 absolute left-0 top-0"/>
              <div
                className="w-full h-full bg-secondary-100 dark:bg-secondary-800 absolute left-0 top-0"
                style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
              />
            </div>
            <span className="relative z-10">{value}</span>
          </>
        )}
        {!diagonalSplit && value}
      </motion.div>
      
      {hasTrainers && (
        <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 translate-y-2 z-50 w-max">
          <div className="bg-gray-900 text-white text-sm rounded px-3 py-1">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
            <p className="whitespace-nowrap">
              Completed by: {trainerNames.filter(name => name && name.trim() !== '').join(', ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BingoCard;