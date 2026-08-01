import type { Dashboard, PublicDashboard } from './types';
import { capitalize } from '../../utils/pokemonName';
import TeamBadge from './TeamBadge';

function formatUtc(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(new Date(value));
}

type Props = {
  dashboard: Dashboard | PublicDashboard;
  showEventStatus?: boolean;
  canManage?: boolean;
  onEligibility?: (id: string, eligible: boolean | null) => Promise<void>;
};

export default function Overview({ dashboard, showEventStatus = true, canManage, onEligibility }: Props) {
  const fullDashboard = 'event' in dashboard ? dashboard : null;
  const eventStats = fullDashboard && showEventStatus ? [
    ['Current season', fullDashboard.currentSeason || 'Outside event window'],
    ['Schedule', getScheduleLabel(fullDashboard)],
  ] : [];
  const stats = [
    ['Team points', dashboard.teamTotal.toLocaleString()],
    ['Unique species', dashboard.uniqueFamilyCount.toLocaleString()],
    ...eventStats,
  ];
  const splitTotal = dashboard.teamTotals.bidoof + dashboard.teamTotals.arceus;
  const bidoofWidth = splitTotal ? (dashboard.teamTotals.bidoof / splitTotal) * 100 : 50;

  return (
    <div className="space-y-6">
      <div className={`grid gap-4 sm:grid-cols-2 ${showEventStatus ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
        {stats.map(([title, value]) => (
          <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
            <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-400">Team Bidoof</p>
            <p className="text-2xl font-bold text-gray-950 dark:text-white">{dashboard.teamTotals.bidoof.toLocaleString()} pts</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-300">Team Arceus</p>
            <p className="text-2xl font-bold text-gray-950 dark:text-white">{dashboard.teamTotals.arceus.toLocaleString()} pts</p>
          </div>
        </div>
        <div
          aria-label={`Team Bidoof ${dashboard.teamTotals.bidoof} points, Team Arceus ${dashboard.teamTotals.arceus} points`}
          className="mt-3 flex h-4 overflow-hidden rounded-full bg-gray-200"
          role="img"
        >
          <div className="bg-[#8b5a2b] transition-[width]" style={{ width: `${bidoofWidth}%` }} />
          <div className="flex-1 bg-[#c0c0c0]" />
        </div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-950 dark:text-white">Participant standings</h2>
          <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {dashboard.standings.map((row, index) => (
              <div key={'member_id' in row ? row.member_id : `${row.ign}-${index}`} className="flex items-center gap-3 py-3">
                <span className="w-7 text-gray-500">{index + 1}</span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 font-medium text-gray-900 dark:text-white">
                  {row.ign} <TeamBadge team={row.team} />
                </span>
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
              <div key={'id' in entry ? entry.id : `${entry.ign}-${entry.pokemon}-${entry.caught_at_utc}`} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                <div className="flex justify-between gap-3">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-gray-900 dark:text-white">
                    {entry.ign} · {capitalize(entry.pokemon)} <TeamBadge team={entry.team} />
                  </p>
                  <strong className="text-primary-600">+{entry.score.total}</strong>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {formatUtc(entry.caught_at_utc)} UTC · base {entry.score.base}
                  {entry.score.uniqueBonus ? ' · first species +8' : ''}
                  {entry.score.secretBonus ? ' · secret +20' : ''}
                  {entry.score.safariBonus ? ' · safari +10' : ''}
                </p>
                {canManage && onEligibility && 'id' in entry && (
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
        <h2 className="text-xl font-bold text-gray-950 dark:text-white">Species coverage</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {dashboard.uniqueFamilies.length === 0 && <p className="text-gray-500">No species covered yet.</p>}
          {dashboard.uniqueFamilies.map((species) => (
            <span key={species} className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700 dark:bg-primary-950 dark:text-primary-200">
              {capitalize(species)}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

function getScheduleLabel(dashboard: Dashboard) {
  const now = Date.now();
  const start = new Date(dashboard.event.starts_at).getTime();
  const end = new Date(dashboard.event.ends_at).getTime();
  if (now < start) return `Starts in ${Math.ceil((start - now) / 86400000)} days`;
  return now < end ? `${Math.ceil((end - now) / 86400000)} days remaining` : 'Event complete';
}
