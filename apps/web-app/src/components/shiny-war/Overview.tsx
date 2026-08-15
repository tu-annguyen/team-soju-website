import { useLayoutEffect, useRef, useState } from 'react';
import type { Dashboard, DashboardCatch, DashboardStanding, PublicDashboard, ShinyWarTeam } from './types';
import { capitalize } from '../../utils/pokemonName';
import RecentCatches from './RecentCatches';
import TeamBadge, { TEAM_LABELS } from './TeamBadge';

type Props = {
  dashboard: Dashboard | PublicDashboard;
  showEventStatus?: boolean;
  canManage?: boolean;
  onEligibility?: (id: string, eligible: boolean | null) => Promise<void>;
};

type View = 'official' | 'team';
type Standing = DashboardStanding | PublicDashboard['officialWar']['standings'][number];
type Catch = DashboardCatch | PublicDashboard['officialWar']['recentCatches'][number];

export default function Overview({ dashboard, showEventStatus = true, canManage, onEligibility }: Props) {
  const [view, setView] = useState<View>('official');
  const fullDashboard = 'event' in dashboard ? dashboard : null;
  const eventStats = fullDashboard && showEventStatus ? [
    ['Current season', fullDashboard.currentSeason || 'Outside event window'],
    ['Schedule', getScheduleLabel(fullDashboard)],
  ] : [];

  return (
    <div className="space-y-6">
      <ViewChips view={view} onChange={setView} />
      {view === 'official' ? (
        <WarContent
          catches={dashboard.officialWar.recentCatches}
          canManage={canManage}
          onEligibility={onEligibility}
          showTeamBadges={false}
          standings={dashboard.officialWar.standings}
          stats={[
            ['Team points', dashboard.officialWar.teamTotal.toLocaleString()],
            ['Unique species', dashboard.officialWar.uniqueFamilyCount.toLocaleString()],
            ...eventStats,
          ]}
        >
          <SpeciesCoverage species={dashboard.officialWar.uniqueFamilies} />
        </WarContent>
      ) : (
        <WarContent
          catches={dashboard.teamWar.recentCatches}
          canManage={canManage}
          onEligibility={onEligibility}
          showTeamBadges
          standings={dashboard.teamWar.standings}
          stats={eventStats}
        >
          <TeamScoreBar totals={dashboard.teamWar.teamTotals} />
          <div className="grid gap-6 lg:grid-cols-2">
            {(['bidoof', 'arceus'] as const).map((team) => (
              <SpeciesCoverage key={team} species={dashboard.teamWar.uniqueFamilies[team]} team={team} />
            ))}
          </div>
        </WarContent>
      )}
    </div>
  );
}

function ViewChips({ view, onChange }: { view: View; onChange: (view: View) => void }) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Overview view" role="group">
      {([['official', 'Official War'], ['team', 'Team War']] as const).map(([value, label]) => (
        <button
          aria-pressed={view === value}
          className={`rounded-full px-4 py-2 text-sm font-semibold ${view === value
            ? 'bg-primary-600 text-white'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
          key={value}
          onClick={() => onChange(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function WarContent({ catches, canManage, children, onEligibility, showTeamBadges, standings, stats }: {
  catches: Catch[];
  canManage?: boolean;
  children: React.ReactNode;
  onEligibility?: Props['onEligibility'];
  showTeamBadges: boolean;
  standings: Standing[];
  stats: string[][];
}) {
  const standingsRef = useRef<HTMLElement>(null);
  const [standingsHeight, setStandingsHeight] = useState<number>();

  useLayoutEffect(() => {
    const standingsElement = standingsRef.current;
    if (!standingsElement) return undefined;
    const updateHeight = () => setStandingsHeight(standingsElement.getBoundingClientRect().height || undefined);
    updateHeight();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(standingsElement);
    return () => observer.disconnect();
  }, [standings.length]);

  return (
    <div className="space-y-6">
      {stats.length > 0 && (
        <div className={`grid gap-4 sm:grid-cols-2 ${stats.length > 2 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
          {stats.map(([title, value]) => (
            <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
              <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">{value}</p>
            </div>
          ))}
        </div>
      )}
      {children}
      <div className="grid gap-6 lg:grid-cols-2">
        <section ref={standingsRef} className="min-h-64 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-950 dark:text-white">Participant standings</h2>
          <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
            {standings.map((row, index) => (
              <div key={'member_id' in row ? row.member_id : `${row.ign}-${index}`} className="flex items-center gap-3 py-3">
                <span className="w-7 text-gray-500">{index + 1}</span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 font-medium text-gray-900 dark:text-white">
                  {row.ign} {showTeamBadges && <TeamBadge team={row.team} />}
                </span>
                <span className="text-sm text-gray-500">{row.catches} catches</span>
                <strong className="text-primary-600 dark:text-primary-400">{row.points} pts</strong>
              </div>
            ))}
          </div>
        </section>
        <div className="relative min-h-64 lg:min-h-0">
          <RecentCatches
            catches={catches}
            canManage={canManage}
            maxHeight={standingsHeight}
            onEligibility={onEligibility}
            showTeamBadge={showTeamBadges}
          />
        </div>
      </div>
    </div>
  );
}

function TeamScoreBar({ totals }: { totals: Record<ShinyWarTeam, number> }) {
  const splitTotal = totals.bidoof + totals.arceus;
  const bidoofWidth = splitTotal ? (totals.bidoof / splitTotal) * 100 : 50;
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-400"><TeamBadge team="bidoof" /> Team Bidoof</p>
          <p className="text-2xl font-bold text-gray-950 dark:text-white">{totals.bidoof.toLocaleString()} pts</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-2 text-sm font-semibold text-gray-500 dark:text-gray-300">Team Arceus <TeamBadge team="arceus" /></p>
          <p className="text-2xl font-bold text-gray-950 dark:text-white">{totals.arceus.toLocaleString()} pts</p>
        </div>
      </div>
      <div aria-label={`Team Bidoof ${totals.bidoof} points, Team Arceus ${totals.arceus} points`} className="mt-3 flex h-4 overflow-hidden rounded-full bg-gray-200" role="img">
        <div className="bg-[#8b5a2b] transition-[width]" style={{ width: `${bidoofWidth}%` }} />
        <div className="flex-1 bg-[#c0c0c0]" />
      </div>
    </section>
  );
}

function SpeciesCoverage({ species, team }: { species: string[]; team?: ShinyWarTeam }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <h2 className="flex items-center gap-2 text-xl font-bold text-gray-950 dark:text-white">
        {team && <TeamBadge team={team} />}{team ? `${TEAM_LABELS[team]} species coverage` : 'Species coverage'}
      </h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {species.length === 0 && <p className="text-gray-500">No species covered yet.</p>}
        {species.map((family) => (
          <span key={family} className="rounded-full bg-primary-50 px-3 py-1 text-sm text-primary-700 dark:bg-primary-950 dark:text-primary-200">
            {capitalize(family)}
          </span>
        ))}
      </div>
    </section>
  );
}

function getScheduleLabel(dashboard: Dashboard) {
  const now = Date.now();
  const start = new Date(dashboard.event.starts_at).getTime();
  const end = new Date(dashboard.event.ends_at).getTime();
  if (now < start) return `Starts in ${Math.ceil((start - now) / 86400000)} days`;
  return now < end ? `${Math.ceil((end - now) / 86400000)} days remaining` : 'Event complete';
}
