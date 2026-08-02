import type { ShinyWarTeam } from './types';

export const TEAM_LABELS: Record<ShinyWarTeam, string> = {
  bidoof: 'Team Bidoof',
  arceus: 'Team Arceus',
};

const TEAM_ICON_URLS: Record<ShinyWarTeam, string> = {
  bidoof: 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0399/Normal.png',
  arceus: 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0493/Normal.png',
};

export default function TeamBadge({ team }: { team: ShinyWarTeam }) {
  return (
    <img
      alt={TEAM_LABELS[team]}
      className="inline-block h-7 w-7 shrink-0 rounded-md object-contain"
      src={TEAM_ICON_URLS[team]}
      title={TEAM_LABELS[team]}
    />
  );
}
