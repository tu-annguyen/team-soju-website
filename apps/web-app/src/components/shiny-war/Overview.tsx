import type { Dashboard } from './types';

function formatUtc(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(new Date(value));
}

type Props = {
  dashboard: Dashboard;
  canManage?: boolean;
  onEligibility?: (id: string, eligible: boolean | null) => Promise<void>;
};

export default function Overview({ dashboard, canManage, onEligibility }: Props) {
  const now = Date.now();
  const start = new Date(dashboard.event.starts_at).getTime();
  const end = new Date(dashboard.event.ends_at).getTime();
  const label = now < start
    ? `Starts in ${Math.ceil((start - now) / 86400000)} days`
    : now < end ? `${Math.ceil((end - now) / 86400000)} days remaining` : 'Event complete';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Team points', dashboard.teamTotal.toLocaleString()],
          ['Current season', dashboard.currentSeason || 'Outside event window'],
          ['Unique families', dashboard.uniqueFamilyCount.toLocaleString()],
          ['Schedule', label],
        ].map(([title, value]) => (
          <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-950 dark:text-white">Participant standings</h2>
          <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {dashboard.standings.map((row, index) => (
              <div key={row.member_id} className="flex items-center gap-3 py-3">
                <span className="w-7 text-gray-500">{index + 1}</span>
                <span className="flex-1 font-medium text-gray-900 dark:text-white">{row.ign}</span>
                <span className="text-sm text-gray-500">{row.catches} catches</span>
                <strong className="text-primary-600 dark:text-primary-400">{row.points} pts</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-950 dark:text-white">Recent catches</h2>
          <div className="mt-4 space-y-3">
            {dashboard.recentCatches.length === 0 && <p className="text-gray-500">No eligible catches yet.</p>}
            {dashboard.recentCatches.map((entry) => (
              <div key={entry.id} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                <div className="flex justify-between gap-3">
                  <p className="font-medium text-gray-900 dark:text-white">{entry.ign} · {entry.pokemon}</p>
                  <strong className="text-primary-600">+{entry.score.total}</strong>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {formatUtc(entry.caught_at_utc)} UTC · base {entry.score.base}
                  {entry.score.uniqueBonus ? ' · first-family +8' : ''}
                  {entry.score.secretBonus ? ' · secret +20' : ''}
                  {entry.score.safariBonus ? ' · safari +10' : ''}
                </p>
                {canManage && onEligibility && (
                  <div className="mt-2 flex gap-3 text-xs">
                    <button className="text-rose-600" onClick={() => onEligibility(entry.id, false)}>Mark invalid</button>
                    <button className="text-primary-600" onClick={() => onEligibility(entry.id, true)}>Force eligible</button>
                    <button className="text-gray-500" onClick={() => onEligibility(entry.id, null)}>Use rules</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-xl font-bold text-gray-950 dark:text-white">Evolution-family coverage</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {dashboard.uniqueFamilies.length === 0 && <p className="text-gray-500">No families covered yet.</p>}
          {dashboard.uniqueFamilies.map((family) => (
            <span key={family} className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700 dark:bg-primary-950 dark:text-primary-200">
              {family}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
