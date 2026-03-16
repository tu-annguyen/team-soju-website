import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface ShinyDetailsProps {
  open: boolean;
  onClose: () => void;
  pokemonName: string;
  trainerName: string;
  imageUrl: string;
  isFailed: boolean;
  isSecret: boolean;
  isAlpha: boolean;
  catchDate?: string | null;
  totalEncounters?: number | null;
  speciesEncounters?: number | null;
  encounterType?: string | null;
  nature?: string | null;
  ivHp?: number | null;
  ivAttack?: number | null;
  ivDefense?: number | null;
  ivSpAttack?: number | null;
  ivSpDefense?: number | null;
  ivSpeed?: number | null;
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

const formatLabel = (value: string) =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatNumber = (value?: number | null) =>
  value === null || value === undefined ? null : value.toLocaleString();

const ShinyDetails = ({
  open,
  onClose,
  pokemonName,
  trainerName,
  imageUrl,
  isFailed,
  isSecret,
  isAlpha,
  catchDate,
  totalEncounters,
  speciesEncounters,
  encounterType,
  nature,
  ivHp,
  ivAttack,
  ivDefense,
  ivSpAttack,
  ivSpDefense,
  ivSpeed,
}: ShinyDetailsProps) => {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const hasIvs = [ivHp, ivAttack, ivDefense, ivSpAttack, ivSpDefense, ivSpeed].every(
    (value) => value !== null && value !== undefined
  );

  const details = [
    { label: 'Catch Date', value: catchDate || null },
    { label: 'Total Encounters', value: formatNumber(totalEncounters) },
    { label: 'Species Encounters', value: formatNumber(speciesEncounters) },
    {
      label: 'Encounter Type',
      value: encounterType ? formatLabel(encounterType) : null,
    },
    { label: 'Nature', value: nature || null },
    {
      label: 'IVs',
      value: hasIvs
        ? [ivHp, ivAttack, ivDefense, ivSpAttack, ivSpDefense, ivSpeed].join(' / ')
        : null,
    },
  ].filter((detail) => detail.value);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shiny-details-title"
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-white p-6 shadow-2xl dark:bg-gray-900"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gray-100 p-2 dark:bg-gray-800">
                  {isSecret && (
                    <img
                      src={attributeIcons.secret}
                      alt="Secret shiny"
                      className="absolute left-2 top-2 h-5 w-5"
                      draggable={false}
                    />
                  )}
                  {isAlpha && (
                    <img
                      src={attributeIcons.alpha}
                      alt="Alpha shiny"
                      className="absolute bottom-2 right-2 h-5 w-5"
                      draggable={false}
                    />
                  )}
                  {encounterType && attributeIcons[encounterType] && (
                    <img
                      src={attributeIcons[encounterType]}
                      alt={`${encounterType} encounter`}
                      className="absolute right-2 top-2 h-5 w-5"
                      draggable={false}
                    />
                  )}
                  <img
                    src={imageUrl}
                    alt={`Shiny ${pokemonName}`}
                    className={`h-full w-full object-contain pixelated ${isFailed ? 'grayscale' : ''}`}
                    loading="lazy"
                  />
                </div>

                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-primary-600 dark:text-primary-400">
                    Shiny Details
                  </p>
                  <h2
                    id="shiny-details-title"
                    className="text-2xl font-bold text-gray-900 dark:text-white"
                  >
                    {pokemonName}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Trainer: {trainerName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-gray-200 px-3 py-1 text-sm text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                aria-label="Close shiny details"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {details.map((detail) => (
                <div
                  key={detail.label}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-950/70"
                >
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    {detail.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {detail.value}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ShinyDetails;
