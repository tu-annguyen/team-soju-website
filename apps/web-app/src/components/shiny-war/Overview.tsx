import { useLayoutEffect, useRef, useState } from 'react';
import type { Dashboard, PublicDashboard } from './types';
import { capitalize } from '../../utils/pokemonName';
import RecentCatches from './RecentCatches';
import TeamBadge from './TeamBadge';

type Props = {
  dashboard: Dashboard | PublicDashboard;
  showEventStatus?: boolean;
  canManage?: boolean;
  onEligibility?: (id: string, eligible: boolean | null) => Promise<void>;
};

export default function Overview({ dashboard, showEventStatus = true, canManage, onEligibility }: Props) {
  const standingsRef = useRef<HTMLElement>(null);
  const [standingsHeight, setStandingsHeight] = useState<number>();
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

  useLayoutEffect(() => {
    const standings = standingsRef.current;
    if (!standings) return undefined;

    const updateHeight = () => setStandingsHeight(standings.getBoundingClientRect().height || undefined);
    updateHeight();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(standings);
    return () => observer.disconnect();
  }, [dashboard.standings.length]);

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
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-400">
              <TeamBadge team="bidoof" /> Team Bidoof
            </p>
            <p className="text-2xl font-bold text-gray-950 dark:text-white">{dashboard.teamTotals.bidoof.toLocaleString()} pts</p>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-2 text-sm font-semibold text-gray-500 dark:text-gray-300">
              Team Arceus <TeamBadge team="arceus" />
            </p>
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
        <section ref={standingsRef} className="min-h-64 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
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
        <div className="relative min-h-64 lg:min-h-0">
          <RecentCatches
            catches={dashboard.recentCatches}
            canManage={canManage}
            maxHeight={standingsHeight}
            onEligibility={onEligibility}
          />
        </div>
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
