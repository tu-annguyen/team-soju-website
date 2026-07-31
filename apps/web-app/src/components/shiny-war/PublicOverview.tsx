import { useCallback, useEffect, useState } from 'react';
import { shinyWarRequest } from './api';
import Overview from './Overview';
import type { PublicDashboard } from './types';

type Props = {
  apiBaseUrl: string;
  showLoginPrompt?: boolean;
};

export default function PublicOverview({ apiBaseUrl, showLoginPrompt = false }: Props) {
  const [dashboard, setDashboard] = useState<PublicDashboard | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setDashboard(await shinyWarRequest<PublicDashboard>(apiBaseUrl, '/dashboard/public'));
      setError('');
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not load the standings.');
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return (
    <section className="py-10">
      <div className="container">
        <div className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary-600">Team Soju event</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-950 dark:text-white">Shiny Wars 2026</h1>
          <p className="mt-2 max-w-3xl text-gray-600 dark:text-gray-300">
            Follow Team Soju's points, participant standings, species coverage, and latest catches.
          </p>
        </div>
        {showLoginPrompt && (
          <aside className="mb-7 flex flex-col gap-4 rounded-2xl border border-primary-200 bg-primary-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-primary-800 dark:bg-primary-950">
            <div>
              <h2 className="font-bold text-gray-950 dark:text-white">Team Soju member?</h2>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                Sign in to access the organizer, Hunt Board, Hunt Finder, and additional controls.
              </p>
            </div>
            <a className="btn btn-primary inline-flex shrink-0 justify-center" href="/auth">
              Sign in for member tools
            </a>
          </aside>
        )}
        {!dashboard && (
          <p className="py-16 text-center text-gray-600" aria-live="polite">
            {error || 'Loading Shiny Wars standings…'}
          </p>
        )}
        {dashboard && error && (
          <p className="mb-5 rounded-xl bg-rose-50 p-3 text-rose-700 dark:bg-rose-950 dark:text-rose-200" role="alert">
            {error}
          </p>
        )}
        {dashboard && <Overview dashboard={dashboard} showEventStatus={false} />}
      </div>
    </section>
  );
}
