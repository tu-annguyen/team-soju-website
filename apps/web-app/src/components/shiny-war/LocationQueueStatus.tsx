import type { Hunt, HuntSpot, ParticipantHunts } from './types';
import TeamBadge from './TeamBadge';

type QueueEntry = {
  hunt: Hunt;
  participant: ParticipantHunts;
};

type Props = {
  participants: ParticipantHunts[];
  spot: HuntSpot;
};

const queueLabel = (position: number) => position === 0 ? 'Current' : `Next ${position}`;

export default function LocationQueueStatus({ participants, spot }: Props) {
  const spotKeys = new Set(spot.spot_keys || [spot.spot_key]);
  const entries: QueueEntry[] = participants.flatMap((participant) => participant.hunts
    .filter((hunt) => spotKeys.has(hunt.spot_key))
    .map((hunt) => ({ hunt, participant })))
    .sort((a, b) => a.hunt.position - b.hunt.position || a.participant.ign.localeCompare(b.participant.ign));

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
      <span className="font-semibold text-gray-500 dark:text-gray-400">Team queue</span>
      {entries.length === 0 ? (
        <span className="text-gray-400 dark:text-gray-500">No one hunting or queued</span>
      ) : entries.map(({ hunt, participant }) => (
        <span
          className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-2.5 py-1 font-medium text-primary-700 dark:bg-primary-950 dark:text-primary-200"
          key={`${participant.member_id}-${hunt.id || `${hunt.spot_key}-${hunt.position}`}`}
        >
          {participant.ign} · {queueLabel(hunt.position)} <TeamBadge team={participant.team} />
        </span>
      ))}
    </div>
  );
}
