import { useEffect, useState } from 'react';
import { shinyWarRequest } from './api';
import type { ParticipantHunts } from './types';

type Member = { id: string; ign: string };
type Props = {
  apiBaseUrl: string;
  participants: ParticipantHunts[];
  locked: boolean;
  onChanged: () => Promise<void>;
};

export default function RosterManager({ apiBaseUrl, participants, locked, onChanged }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const participantIds = new Set(participants.map((entry) => entry.member_id));

  useEffect(() => {
    fetch(`${apiBaseUrl.replace(/\/+$/, '')}/members`, { credentials: 'include' })
      .then((response) => response.json())
      .then((body) => setMembers(body.data || []))
      .catch(() => setError('Could not load Team Soju members.'));
  }, [apiBaseUrl]);

  const mutate = async (path: string, init: RequestInit) => {
    try {
      setError('');
      await shinyWarRequest(apiBaseUrl, path, init);
      await onChanged();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Roster update failed.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">Official roster</h2>
            <p className="text-sm text-gray-500">{participants.length} participants · {locked ? 'Locked' : 'Open'}</p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => mutate('/roster-lock', { method: 'PUT', body: JSON.stringify({ locked: !locked }) })}
          >
            {locked ? 'Unlock roster' : 'Lock roster'}
          </button>
        </div>
        {!locked && (
          <div className="mt-5 flex gap-3">
            <select value={selected} onChange={(event) => setSelected(event.target.value)} className="min-w-0 flex-1 rounded-lg border-gray-300 dark:bg-gray-800">
              <option value="">Select an active member…</option>
              {members.filter((member) => !participantIds.has(member.id)).map((member) => (
                <option key={member.id} value={member.id}>{member.ign}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              disabled={!selected}
              onClick={() => mutate('/participants', { method: 'POST', body: JSON.stringify({ member_id: selected }) })}
            >
              Add
            </button>
          </div>
        )}
        {error && <p className="mt-4 text-rose-600" role="alert">{error}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {participants.map((participant) => (
          <div key={participant.member_id} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="flex-1">
              <p className="font-semibold text-gray-950 dark:text-white">{participant.ign}</p>
              <p className={`text-xs ${participant.has_app_user ? 'text-emerald-600' : 'text-amber-600'}`}>
                {participant.has_app_user ? 'App account linked' : 'No usable app account'}
              </p>
            </div>
            {!locked && (
              <button
                className="text-sm text-rose-600"
                onClick={() => mutate(`/participants/${participant.member_id}`, { method: 'DELETE' })}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

