import type { CSSProperties } from 'react';
import type { TileStatus } from './shared';
import { getVoteLayerOpacity } from './shared';

export type VoteOverlayStatus = Exclude<TileStatus, 'unchecked'>;

export const VOTE_OVERLAY_STATUSES: readonly VoteOverlayStatus[] = ['checked', 'pending', 'confirmed'];

export const VOTE_OVERLAY_MARKERS: Record<VoteOverlayStatus, string> = {
  checked: 'X',
  pending: '?',
  confirmed: '!',
};

const VOTE_PATTERN_COLORS: Record<VoteOverlayStatus, [number, number, number]> = {
  checked: [225, 29, 72],
  pending: [251, 191, 36],
  confirmed: [16, 185, 129],
};

function rgba([red, green, blue]: [number, number, number], alpha: number) {
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getVoteOverlayMarker(status: VoteOverlayStatus, voteCount?: number) {
  const countLabel = voteCount ? String(voteCount) : '';
  return `${VOTE_OVERLAY_MARKERS[status]}${countLabel}`;
}

export function getVotePatternStyle(status: VoteOverlayStatus, voteCount = 2): CSSProperties {
  const color = VOTE_PATTERN_COLORS[status];
  const opacity = getVoteLayerOpacity(voteCount);

  if (status === 'checked') {
    return {
      backgroundColor: rgba(color, opacity),
      backgroundImage:
        'repeating-linear-gradient(135deg, rgba(255,255,255,0.88) 0 2px, transparent 2px 6px)',
    };
  }

  if (status === 'pending') {
    return {
      backgroundColor: rgba(color, opacity),
      backgroundImage:
        'radial-gradient(circle, rgba(15,23,42,0.82) 1.4px, transparent 1.6px)',
      backgroundSize: '7px 7px',
    };
  }

  return {
    backgroundColor: rgba(color, opacity),
    backgroundImage: [
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.82) 0 1.5px, transparent 1.5px 6px)',
      'repeating-linear-gradient(-45deg, rgba(15,23,42,0.48) 0 1.5px, transparent 1.5px 6px)',
    ].join(', '),
  };
}
