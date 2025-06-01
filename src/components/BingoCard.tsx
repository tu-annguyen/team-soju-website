import React from 'react';
import { motion } from 'framer-motion';

interface BingoCardProps {
  value: string;
  trainerNames?: string[];
  position?: "left" | "center" | "right";
}

const teamBuddhaMembers = [
  "Buddhalicious",
  "MumenRider",
  "CaliKingCorey",
  "pikachutiyaL",
  "BlossomsDream",
  "Jaap",
  "Axelokara",
  "tunacore",
  "belley",
  "spounch",
  "SpriggyMew",
  "Zofina",
  "Ubela",
  "Megu"
];
const teamAisuMembers = [
  "XiaoLongBao",
  "gaandusulayman",
  "ReefBarrierGreat",
  "HogXD",
  "Misc",
  "Electra",
  "spook",
  "TXMPXp",
  "JustMagoo",
  "fabriksgjord",
  "Colty",
  "thelayar",
  "DingusDestiny",
  "hefferson"
];

const getCardClasses = (trainerNames?: string[]) => {
  if (!trainerNames || trainerNames.length === 0) return "bg-gray-200 dark:bg-gray-700";

  if (trainerNames.length === 1) {
    if (teamBuddhaMembers.includes(trainerNames[0])) {
      return "bg-primary-100 dark:bg-primary-800";
    }
    if (teamAisuMembers.includes(trainerNames[0])) {
      return "bg-secondary-100 dark:bg-secondary-800";
    }
  }

  return "bg-gray-100 dark:bg-gray-800";
};

const BingoCard = ({ value, trainerNames = [], position = "center" }: BingoCardProps) => {
  const diagonalSplit =
    trainerNames &&
    trainerNames.some(name => teamBuddhaMembers.includes(name)) &&
    trainerNames.some(name => teamAisuMembers.includes(name));

  const hasTrainers = trainerNames && trainerNames.filter(name => name && name.trim() !== '').length > 0;

  let tooltipAlign = "";
  if (position === "left") {
    tooltipAlign = "left-0";
  } else if (position === "right") {
    tooltipAlign = "right-0";
  } else {
    tooltipAlign = "left-1/2 -translate-x-1/2";
  }

  return (
    <div className="relative group">
      <motion.div 
        className={`text-center text-xs sm:text-lg font-medium text-gray-900 dark:text-white aspect-square overflow-hidden flex items-center justify-center p-2 ${getCardClasses(trainerNames)}`}
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
        <div
          className={`invisible group-hover:visible absolute top-full ${tooltipAlign} translate-y-2 z-50 max-w-[90vw]`}
        >
          <div className="bg-gray-800 text-white dark:bg-gray-100 dark:text-black text-sm rounded px-3 py-1 relative w-max max-w-[90vw]">
            <div
              className={`absolute -top-1 ${
                position === "right"
                  ? "right-4"
                  : position === "left"
                  ? "left-4"
                  : "left-1/2 -translate-x-1/2"
              } w-2 h-2 bg-gray-800 dark:bg-gray-100 rotate-45`}
            ></div>
            <p className="hidden sm:block text-left">Completed by:</p>
            <p className="text-left whitespace-nowrap">
              {trainerNames.filter(name => name && name.trim() !== '').join(', ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BingoCard;