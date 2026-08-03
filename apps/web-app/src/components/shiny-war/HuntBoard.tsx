import { useState } from 'react';
import type { Hunt, ParticipantHunts } from './types';
import SpeciesSpriteName from './SpeciesSpriteName';
import TeamBadge, { TEAM_LABELS } from './TeamBadge';

type HuntSpeciesDisplay = { name: string; slug?: string; form?: string; family_key?: string };

const huntSpecies = (hunt: Hunt): HuntSpeciesDisplay[] => {
  const species = hunt.details?.species;
  if (!Array.isArray(species)) return [];
  return species.flatMap((entry) => {
    if (typeof entry === 'string') return [{ name: entry }];
    return entry && typeof entry.name === 'string' ? [entry] : [];
  });
};

const normalizeSpeciesKey = (value: string) => value.trim().toLowerCase().replace(/[ .]+/g, '-');

const caughtSpeciesNames = (hunt: Hunt, caughtFamilyKeys: Set<string>) => huntSpecies(hunt)
  .filter((species) => [species.family_key, species.slug, species.name]
    .filter((key): key is string => Boolean(key))
    .some((key) => caughtFamilyKeys.has(normalizeSpeciesKey(key))))
  .map((species) => species.name);

const SWEET_SCENT_TERRAINS = new Set(['Grass', 'Dark Grass', 'Water', 'Cave', 'Inside']);

const huntLabel = (hunt: Hunt) => {
  const label = hunt.label.replace(
    /([35][x×])(?!\s+Sweet Scent)(?=\s*(?:·|$))/g,
    '$1 Sweet Scent',
  );
  const method = hunt.details?.spot?.method || hunt.spot_key.split('|')[1] || '';
  if (!SWEET_SCENT_TERRAINS.has(method)) return label;
  return label.replace(
    /Sweet Scent(?!\s+(?:Grass|Dark Grass|Water|Cave|Inside))/g,
    `Sweet Scent ${method}`,
  );
};

const huntSpotData = (hunt: Hunt) => {
  const spot = hunt.details?.spot;
  if (!spot) return '';
  const terrain = SWEET_SCENT_TERRAINS.has(spot.method) ? ` ${spot.method}` : '';
  const method = spot.horde_size ? `${spot.horde_size}× Sweet Scent${terrain}` : spot.method;
  const time = spot.time.charAt(0).toUpperCase() + spot.time.slice(1);
  return `${spot.region} · ${spot.season} ${time} · ${method}${spot.is_lure ? ' · Lure only' : ''}${spot.is_special ? ' · Special' : ''}`;
};

type Props = {
  rows: ParticipantHunts[];
  playerCaughtFamilyKeys?: string[];
  uniqueFamilyKeys?: string[];
  ownMemberId?: string;
  busy: boolean;
  onSave: (queue: Hunt[]) => Promise<void>;
};

type HuntCardProps = {
  busy: boolean;
  isOwn: boolean;
  row: ParticipantHunts;
  playerCaughtFamilyKeys: Set<string>;
  uniqueFamilyKeys: Set<string>;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
};

function HuntCard({ busy, isOwn, playerCaughtFamilyKeys, row, uniqueFamilyKeys, onMove, onRemove }: HuntCardProps) {
  return (
    <section className="break-inside-avoid rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold text-gray-950 dark:text-white">{row.ign}</h2>
          <TeamBadge team={row.team} />
        </div>
        {!row.has_app_user && <span className="text-xs font-medium text-amber-600">Account not linked</span>}
      </div>
      {row.hunts.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No hunt selected.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {row.hunts.map((hunt, index) => {
            const playerDuplicates = caughtSpeciesNames(hunt, playerCaughtFamilyKeys);
            const playerCaughtTarget = hunt.target_family_key
              && playerCaughtFamilyKeys.has(normalizeSpeciesKey(hunt.target_family_key));
            const teamDuplicates = caughtSpeciesNames(hunt, uniqueFamilyKeys);
            const teamCaughtTarget = hunt.target_family_key
              && uniqueFamilyKeys.has(normalizeSpeciesKey(hunt.target_family_key));
            return (
            <li key={hunt.id || `${hunt.spot_key}-${index}`} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <div className="flex gap-2">
                <span className="font-semibold text-primary-600">{index === 0 ? 'Current' : `Next ${index}`}</span>
                <span className="flex-1 text-gray-900 dark:text-white">{huntLabel(hunt)}</span>
              </div>
              {huntSpotData(hunt) && <p className="mt-1 text-sm text-gray-500">{huntSpotData(hunt)}</p>}
              {huntSpecies(hunt).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {huntSpecies(hunt).map((species, speciesIndex) => (
                    <SpeciesSpriteName
                      key={`${species.slug || species.name}-${species.form || ''}-${speciesIndex}`}
                      form={species.form}
                      name={species.name}
                      slug={species.slug}
                    />
                  ))}
                </div>
              )}
              {teamDuplicates.length > 0 || teamCaughtTarget ? (
                <p className="mt-1 text-xs font-medium text-yellow-500 dark:text-yellow-300">
                  Not eligible for unique species bonus: {teamDuplicates.length > 0
                    ? teamDuplicates.join(', ')
                    : hunt.target_family_key}.
                </p>
              ) : null}
              {isOwn && (playerDuplicates.length > 0 || playerCaughtTarget) ? (
                <p className="mt-1 text-xs font-medium text-orange-600 dark:text-orange-400">
                  Potential duplicate penalty. Already caught: {playerDuplicates.length > 0
                    ? playerDuplicates.join(', ')
                    : hunt.target_family_key}.
                </p>
              ) : null}
              {isOwn && (
                <div className="mt-2 flex gap-2">
                  <button className="text-xs text-primary-600" disabled={busy || index === 0} onClick={() => onMove(index, -1)}>Move up</button>
                  <button className="text-xs text-primary-600" disabled={busy || index === row.hunts.length - 1} onClick={() => onMove(index, 1)}>Move down</button>
                  <button className="text-xs text-rose-600" disabled={busy} onClick={() => onRemove(index)}>Remove</button>
                </div>
              )}
            </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function HuntBoard({
  rows,
  playerCaughtFamilyKeys = [],
  uniqueFamilyKeys = [],
  ownMemberId,
  busy,
  onSave,
}: Props) {
  const [view, setView] = useState<'official' | 'team'>('official');
  const playerCaughtFamilyKeySet = new Set(playerCaughtFamilyKeys.map(normalizeSpeciesKey));
  const uniqueFamilyKeySet = new Set(uniqueFamilyKeys.map(normalizeSpeciesKey));
  const own = rows.find((row) => row.member_id === ownMemberId);
  const otherRows = rows.filter((row) => row.member_id !== ownMemberId);
  const officialRows = otherRows.filter((row) => row.is_official);
  const mutate = async (index: number, direction: -1 | 1) => {
    if (!own) return;
    const queue = [...own.hunts].sort((a, b) => a.position - b.position);
    const target = index + direction;
    if (target < 0 || target >= queue.length) return;
    [queue[index], queue[target]] = [queue[target], queue[index]];
    await onSave(queue.map((hunt, position) => ({ ...hunt, position })));
  };
  const remove = async (index: number) => {
    if (!own) return;
    const queue = own.hunts.filter((_, itemIndex) => itemIndex !== index)
      .map((hunt, position) => ({ ...hunt, position }));
    await onSave(queue);
  };

  return (
    <div className="space-y-4">
      {own && <HuntCard busy={busy} isOwn playerCaughtFamilyKeys={playerCaughtFamilyKeySet} row={own} uniqueFamilyKeys={uniqueFamilyKeySet} onMove={mutate} onRemove={remove} />}
      <div className="flex flex-wrap gap-2" aria-label="Hunt Board view" role="group">
        {([['official', 'Official War'], ['team', 'Team War']] as const).map(([value, label]) => (
          <button
            aria-pressed={view === value}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${view === value
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
            key={value}
            onClick={() => setView(value)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'official' ? (
        <HuntCardColumns rows={officialRows} playerCaughtFamilyKeys={playerCaughtFamilyKeySet} uniqueFamilyKeys={uniqueFamilyKeySet} busy={busy} onMove={mutate} onRemove={remove} />
      ) : (
        <div className="space-y-7">
          {(['bidoof', 'arceus'] as const).map((team) => {
            const teamRows = otherRows.filter((row) => row.team === team);
            return (
              <section key={team}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-950 dark:text-white">{TEAM_LABELS[team]}</h2>
                  <span className="text-sm text-gray-500">{teamRows.length + (own?.team === team ? 1 : 0)} participants</span>
                </div>
                <HuntCardColumns rows={teamRows} playerCaughtFamilyKeys={playerCaughtFamilyKeySet} uniqueFamilyKeys={uniqueFamilyKeySet} busy={busy} onMove={mutate} onRemove={remove} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HuntCardColumns({ rows, playerCaughtFamilyKeys, uniqueFamilyKeys, busy, onMove, onRemove }: {
  rows: ParticipantHunts[];
  playerCaughtFamilyKeys: Set<string>;
  uniqueFamilyKeys: Set<string>;
  busy: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="columns-1 gap-4 lg:columns-2">
      {rows.map((row) => (
        <div className="mb-4" key={row.member_id}>
          <HuntCard busy={busy} isOwn={false} playerCaughtFamilyKeys={playerCaughtFamilyKeys} row={row} uniqueFamilyKeys={uniqueFamilyKeys} onMove={onMove} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}
