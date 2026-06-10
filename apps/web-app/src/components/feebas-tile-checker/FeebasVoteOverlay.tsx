import type { FeebasTile, VoteOverlayMode } from './shared';
import { getVoteLayerColor, getVoteLayerOpacity } from './shared';
import {
  getVotePatternStyle,
  VOTE_OVERLAY_STATUSES,
} from './feebasVoteOverlayStyles';

type VoteCounts = FeebasTile['voteCounts'];

type Props = {
  mode: VoteOverlayMode;
  voteCounts: VoteCounts;
};

function getActiveVoteStatuses(voteCounts: VoteCounts) {
  return VOTE_OVERLAY_STATUSES.filter((status) => voteCounts[status] > 0);
}

function ColorVoteOverlay({ voteCounts }: Pick<Props, 'voteCounts'>) {
  return (
    <>
      {getActiveVoteStatuses(voteCounts).map((status) => (
        <div
          key={status}
          aria-hidden="true"
          className="absolute inset-[8%] rounded-[0.3rem]"
          style={{
            backgroundColor: getVoteLayerColor(status),
            opacity: getVoteLayerOpacity(voteCounts[status]),
          }}
        />
      ))}
    </>
  );
}

function PatternVoteOverlay({ voteCounts }: Pick<Props, 'voteCounts'>) {
  const activeStatuses = getActiveVoteStatuses(voteCounts);

  if (activeStatuses.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-[8%] grid overflow-hidden rounded-[0.3rem] ring-1 ring-white/35"
      data-testid="feebas-pattern-vote-overlay"
      style={{ gridTemplateColumns: `repeat(${activeStatuses.length}, minmax(0, 1fr))` }}
    >
      {activeStatuses.map((status, index) => (
        <div
          key={status}
          className={`relative min-w-0 ${index > 0 ? 'border-l border-white/40' : ''}`}
          data-testid={`feebas-pattern-vote-${status}`}
          style={getVotePatternStyle(status, voteCounts[status])}
        />
      ))}
    </div>
  );
}

export function FeebasVoteOverlay({ mode, voteCounts }: Props) {
  if (mode === 'pattern') {
    return <PatternVoteOverlay voteCounts={voteCounts} />;
  }

  return <ColorVoteOverlay voteCounts={voteCounts} />;
}
