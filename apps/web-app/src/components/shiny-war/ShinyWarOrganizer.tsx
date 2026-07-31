import { useCallback, useEffect, useState } from 'react';
import { hasPermission } from '../../auth/authorization';
import { useAuthUser } from '../../auth/useAuthUser';
import { shinyWarRequest } from './api';
import HordeFinder from './HordeFinder';
import HuntBoard from './HuntBoard';
import Overview from './Overview';
import RosterManager from './RosterManager';
import type { Dashboard, HordeSpot, Hunt, ParticipantHunts } from './types';

type Tab = 'overview' | 'hunts' | 'finder' | 'roster';

export default function ShinyWarOrganizer({ apiBaseUrl }: { apiBaseUrl: string }) {
  const { authUser } = useAuthUser(apiBaseUrl);
  const [tab, setTab] = useState<Tab>('overview');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [hunts, setHunts] = useState<ParticipantHunts[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage = hasPermission(authUser, 'shiny_war:manage');
  const ownMemberId = authUser?.membership?.id;

  const refresh = useCallback(async () => {
    try {
      const [nextDashboard, nextHunts] = await Promise.all([
        shinyWarRequest<Dashboard>(apiBaseUrl, '/dashboard'),
        shinyWarRequest<ParticipantHunts[]>(apiBaseUrl, '/hunts'),
      ]);
      setDashboard(nextDashboard);
      setHunts(nextHunts);
      setError('');
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not load the organizer.');
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const saveQueue = async (queue: Hunt[]) => {
    setBusy(true);
    try {
      await shinyWarRequest(apiBaseUrl, '/queue', {
        method: 'PUT',
        body: JSON.stringify({ queue }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const queueSpot = async (spot: HordeSpot, current: boolean) => {
    const own = hunts.find((row) => row.member_id === ownMemberId);
    if (!own) {
      setError('You must be on the official roster to maintain a hunt queue.');
      return;
    }
    const hunt: Hunt = {
      position: 0,
      spot_key: spot.spot_key,
      target_family_key: spot.composition[0]?.family_key,
      label: `${spot.location} · ${spot.season} ${spot.time} · ${spot.horde_size}×`,
      details: {
        region: spot.region,
        species: spot.composition.map(({ name, slug, form }) => ({ name, slug, form })),
        points_per_hour: spot.pointsPerHour,
      },
    };
    const existing = [...own.hunts].sort((a, b) => a.position - b.position);
    const queue = (current ? [hunt, ...existing] : [...existing, hunt])
      .map((entry, position) => ({ ...entry, position }));
    await saveQueue(queue);
    setTab('hunts');
  };

  const setEligibility = async (id: string, eligible: boolean | null) => {
    await shinyWarRequest(apiBaseUrl, `/shinies/${id}/eligibility`, {
      method: 'PUT',
      body: JSON.stringify({ eligible }),
    });
    await refresh();
  };

  if (!dashboard) {
    return <p className="py-16 text-center text-gray-600" aria-live="polite">{error || 'Loading Shiny Wars organizer…'}</p>;
  }

  const tabs: Array<[Tab, string]> = [
    ['overview', 'Overview'], ['hunts', 'Hunt Board'], ['finder', 'Horde Finder'],
    ...(canManage ? [['roster', 'Roster Management'] as [Tab, string]] : []),
  ];

  return (
    <section className="py-10">
      <div className="container">
        <div className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Team Soju internal tool</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950 dark:text-white">Shiny Wars 2026 Organizer</h1>
          <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-300">
            Coordinate hunts, compare horde value, and follow catches submitted through the Discord bot. The official leaderboard remains authoritative.
          </p>
        </div>
        <nav className="mb-7 flex gap-2 overflow-x-auto" aria-label="Organizer sections">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </nav>
        {error && <p className="mb-5 rounded-xl bg-rose-50 p-3 text-rose-700 dark:bg-rose-950 dark:text-rose-200" role="alert">{error}</p>}
        {tab === 'overview' && (
          <Overview dashboard={dashboard} canManage={canManage} onEligibility={setEligibility} />
        )}
        {tab === 'hunts' && <HuntBoard rows={hunts} ownMemberId={ownMemberId} busy={busy} onSave={saveQueue} />}
        {tab === 'finder' && <HordeFinder apiBaseUrl={apiBaseUrl} defaultSeason={dashboard.currentSeason || 'Summer'} onQueue={queueSpot} />}
        {tab === 'roster' && canManage && (
          <RosterManager
            apiBaseUrl={apiBaseUrl}
            participants={hunts}
            locked={dashboard.event.roster_locked}
            onChanged={refresh}
          />
        )}
      </div>
    </section>
  );
}
