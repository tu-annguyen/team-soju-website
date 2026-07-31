import type { ShinyWarTeam } from './types';

export const TEAM_LABELS: Record<ShinyWarTeam, string> = {
  bidoof: 'Team Bidoof',
  arceus: 'Team Arceus',
};

export default function TeamBadge({ team }: { team: ShinyWarTeam }) {
  const colors = team === 'bidoof'
    ? 'bg-[#8b5a2b] text-amber-50 dark:bg-[#9a693a] dark:text-amber-50'
    : 'border border-gray-300 bg-[#c0c0c0] text-gray-900 dark:border-gray-400 dark:bg-[#a8a8a8] dark:text-gray-950';

  return (
    <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${colors}`}>
      {TEAM_LABELS[team]}
    </span>
  );
}
