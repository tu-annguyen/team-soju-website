import type { Hunt, ParticipantHunts } from './types';

type Props = {
  rows: ParticipantHunts[];
  ownMemberId?: string;
  busy: boolean;
  onSave: (queue: Hunt[]) => Promise<void>;
};

export default function HuntBoard({ rows, ownMemberId, busy, onSave }: Props) {
  const own = rows.find((row) => row.member_id === ownMemberId);
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
    <div className="grid gap-4 lg:grid-cols-2">
      {rows.map((row) => (
        <section key={row.member_id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
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
                    <span className="flex-1 text-gray-900 dark:text-white">{hunt.label}</span>
                  </div>
                  {hunt.overlap_member_ids?.length ? (
                    <p className="mt-1 text-xs font-medium text-amber-600">Overlaps another participant’s location or family.</p>
                  ) : null}
                  {row.member_id === ownMemberId && (
                    <div className="mt-2 flex gap-2">
                      <button className="text-xs text-primary-600" disabled={busy || index === 0} onClick={() => mutate(index, -1)}>Move up</button>
                      <button className="text-xs text-primary-600" disabled={busy || index === row.hunts.length - 1} onClick={() => mutate(index, 1)}>Move down</button>
                      <button className="text-xs text-rose-600" disabled={busy} onClick={() => remove(index)}>Remove</button>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}

