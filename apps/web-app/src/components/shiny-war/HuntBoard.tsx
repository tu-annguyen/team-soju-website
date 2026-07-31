import type { Hunt, ParticipantHunts } from './types';
import SpeciesSpriteName from './SpeciesSpriteName';

const huntSpecies = (hunt: Hunt) => {
  const species = hunt.details?.species;
  if (!Array.isArray(species)) return [];
  return species.flatMap((entry) => {
    if (typeof entry === 'string') return [{ name: entry }];
    return entry && typeof entry.name === 'string' ? [entry] : [];
  });
};

const huntLabel = (label: string) => label.replace(
  /([35][x×])(?!\s+Sweet Scent)(?=\s*(?:·|$))/g,
  '$1 Sweet Scent',
);

type Props = {
  rows: ParticipantHunts[];
  ownMemberId?: string;
  busy: boolean;
  onSave: (queue: Hunt[]) => Promise<void>;
};

type HuntCardProps = {
  busy: boolean;
  isOwn: boolean;
  row: ParticipantHunts;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
};

function HuntCard({ busy, isOwn, row, onMove, onRemove }: HuntCardProps) {
  return (
    <section className="break-inside-avoid rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-950 dark:text-white">{row.ign}</h2>
        {!row.has_app_user && <span className="text-xs font-medium text-amber-600">Account not linked</span>}
      </div>
      {row.hunts.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No hunt selected.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {row.hunts.map((hunt, index) => (
            <li key={hunt.id || `${hunt.spot_key}-${index}`} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
              <div className="flex gap-2">
                <span className="font-semibold text-primary-600">{index === 0 ? 'Current' : `Next ${index}`}</span>
                <span className="flex-1 text-gray-900 dark:text-white">{huntLabel(hunt.label)}</span>
              </div>
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
              {hunt.overlap_member_ids?.length ? (
                <p className="mt-1 text-xs font-medium text-amber-600">Overlaps another participant’s location or family.</p>
              ) : null}
              {isOwn && (
                <div className="mt-2 flex gap-2">
                  <button className="text-xs text-primary-600" disabled={busy || index === 0} onClick={() => onMove(index, -1)}>Move up</button>
                  <button className="text-xs text-primary-600" disabled={busy || index === row.hunts.length - 1} onClick={() => onMove(index, 1)}>Move down</button>
                  <button className="text-xs text-rose-600" disabled={busy} onClick={() => onRemove(index)}>Remove</button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function HuntBoard({ rows, ownMemberId, busy, onSave }: Props) {
  const own = rows.find((row) => row.member_id === ownMemberId);
  const otherRows = rows.filter((row) => row.member_id !== ownMemberId);
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
      {own && <HuntCard busy={busy} isOwn row={own} onMove={mutate} onRemove={remove} />}
      <div className="columns-1 gap-4 lg:columns-2">
        {otherRows.map((row) => (
          <div className="mb-4" key={row.member_id}>
            <HuntCard busy={busy} isOwn={false} row={row} onMove={mutate} onRemove={remove} />
          </div>
        ))}
      </div>
    </div>
  );
}
