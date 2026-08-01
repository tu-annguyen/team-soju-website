import { useLayoutEffect, useRef, useState } from 'react';
import { capitalize } from '../../utils/pokemonName';
import TeamBadge from './TeamBadge';
import type { Dashboard, PublicDashboard } from './types';

type Catch = Dashboard['recentCatches'][number] | PublicDashboard['recentCatches'][number];

type Props = {
  catches: Catch[];
  canManage?: boolean;
  maxHeight?: number;
  onEligibility?: (id: string, eligible: boolean | null) => Promise<void>;
};

const CARD_GAP = 12;
const PANEL_VERTICAL_PADDING = 40;
const LIST_TOP_MARGIN = 16;
const PAGINATION_HEIGHT = 54;

export default function RecentCatches({ catches, canManage, maxHeight, onEligibility }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const tallestCardRef = useRef(0);
  const measurementKeyRef = useRef('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(1);
  const measurementKey = `${canManage ? 'manager' : 'viewer'}:${catches.map(getCatchKey).join('|')}`;
  if (measurementKeyRef.current !== measurementKey) {
    measurementKeyRef.current = measurementKey;
    tallestCardRef.current = 0;
  }
  const pageCount = Math.max(1, Math.ceil(catches.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleCatches = catches.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useLayoutEffect(() => {
    const list = listRef.current;
    const heading = headingRef.current;
    if (!list || !heading || !maxHeight || catches.length === 0) return undefined;

    const calculatePageSize = () => {
      const cards = Array.from(list.children) as HTMLElement[];
      const measuredTallestCard = Math.max(...cards.map((card) => card.getBoundingClientRect().height));
      if (!measuredTallestCard) return;
      tallestCardRef.current = Math.max(tallestCardRef.current, measuredTallestCard);

      const availableHeight = maxHeight
        - PANEL_VERTICAL_PADDING
        - heading.getBoundingClientRect().height
        - LIST_TOP_MARGIN
        - PAGINATION_HEIGHT;
      setPageSize(Math.max(1, Math.floor((availableHeight + CARD_GAP) / (tallestCardRef.current + CARD_GAP))));
    };

    calculatePageSize();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(calculatePageSize);
    observer.observe(list);
    observer.observe(heading);
    return () => observer.disconnect();
  }, [catches, canManage, currentPage, maxHeight, onEligibility, pageSize]);

  return (
    <section className="relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 lg:absolute lg:inset-0 lg:overflow-hidden">
      <h2 ref={headingRef} className="text-xl font-bold text-gray-950 dark:text-white">Recent catches</h2>
      {catches.length === 0 ? (
        <p className="mt-4 text-gray-500">No eligible catches yet.</p>
      ) : (
        <>
          <div ref={listRef} className="mt-4 space-y-3">
            {visibleCatches.map((entry) => (
              <CatchCard key={getCatchKey(entry)} entry={entry} canManage={canManage} onEligibility={onEligibility} />
            ))}
          </div>
          {pageCount > 1 && (
            <nav aria-label="Recent catches pagination" className="mt-auto flex items-center justify-between gap-3 pt-4">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </button>
              <span className="text-xs font-semibold text-gray-500">Page {currentPage} of {pageCount}</span>
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
                disabled={currentPage === pageCount}
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function CatchCard({ entry, canManage, onEligibility }: Pick<Props, 'canManage' | 'onEligibility'> & { entry: Catch }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
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
          <button type="button" className="text-rose-600" onClick={() => onEligibility(entry.id, false)}>Mark invalid</button>
          <button type="button" className="text-primary-600" onClick={() => onEligibility(entry.id, true)}>Force eligible</button>
          <button type="button" className="text-gray-500" onClick={() => onEligibility(entry.id, null)}>Use rules</button>
        </div>
      )}
    </div>
  );
}

function getCatchKey(entry: Catch) {
  return 'id' in entry ? entry.id : `${entry.ign}-${entry.pokemon}-${entry.caught_at_utc}`;
}

function formatUtc(value: string) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(new Date(value));
}
