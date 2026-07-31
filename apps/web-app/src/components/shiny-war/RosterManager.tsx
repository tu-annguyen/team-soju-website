import { useEffect, useMemo, useState } from 'react';
import { FilteredCombobox } from '../catch-events/FilteredCombobox';
import { shinyWarRequest } from './api';
import TeamBadge, { TEAM_LABELS } from './TeamBadge';
import type { ParticipantHunts, ShinyWarTeam } from './types';

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
  const [selectedTeam, setSelectedTeam] = useState<ShinyWarTeam>('bidoof');
  const [selectedOfficial, setSelectedOfficial] = useState(true);
  const [error, setError] = useState('');
  const availableMembers = useMemo(() => {
    const participantIds = new Set(participants.map((entry) => entry.member_id));

    return members
      .filter((member) => !participantIds.has(member.id))
      .sort((left, right) => left.ign.localeCompare(right.ign, undefined, { sensitivity: 'base' }));
  }, [members, participants]);
  const selectedMember = availableMembers.find((member) => member.ign === selected);
  const officialCount = participants.filter((participant) => participant.is_official).length;

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
            <h2 className="text-xl font-bold text-gray-950 dark:text-white">Team war roster</h2>
            <p className="text-sm text-gray-500">
              {participants.length}/36 participants · {officialCount}/30 official · {locked ? 'Locked' : 'Open'}
            </p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => mutate('/roster-lock', { method: 'PUT', body: JSON.stringify({ locked: !locked }) })}
          >
            {locked ? 'Unlock roster' : 'Lock roster'}
          </button>
        </div>
        {!locked && (
          <div className="mt-5 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
            <div className="min-w-0 flex-1">
              <FilteredCombobox
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                options={availableMembers.map((member) => member.ign)}
                placeholder="Select an active member…"
                value={selected}
                onChange={setSelected}
              />
            </div>
            <label className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              Team
              <select
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                value={selectedTeam}
                onChange={(event) => setSelectedTeam(event.target.value as ShinyWarTeam)}
              >
                {Object.entries(TEAM_LABELS).map(([team, label]) => <option key={team} value={team}>{label}</option>)}
              </select>
            </label>
            <label className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium dark:border-gray-700">
              <input type="checkbox" checked={selectedOfficial} onChange={(event) => setSelectedOfficial(event.target.checked)} />
              Official war
            </label>
            <button
              className="btn btn-primary"
              disabled={!selectedMember}
              onClick={() =>
                selectedMember &&
                mutate('/participants', {
                  method: 'POST',
                  body: JSON.stringify({
                    member_id: selectedMember.id,
                    team: selectedTeam,
                    is_official: selectedOfficial,
                  }),
                })
              }
            >
              Add
            </button>
          </div>
        )}
        {error && <p className="mt-4 text-rose-600" role="alert">{error}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {participants.map((participant) => (
          <div key={participant.member_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-gray-950 dark:text-white">{participant.ign}</p>
                <TeamBadge team={participant.team} />
              </div>
              <p className={`text-xs ${participant.has_app_user ? 'text-emerald-600' : 'text-amber-600'}`}>
                {participant.has_app_user ? 'App account linked' : 'No usable app account'}
              </p>
            </div>
            <select
              aria-label={`${participant.ign} team`}
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950"
              disabled={locked}
              value={participant.team}
              onChange={(event) => mutate(`/participants/${participant.member_id}`, {
                method: 'PUT',
                body: JSON.stringify({
                  team: event.target.value,
                  is_official: participant.is_official,
                }),
              })}
            >
              {Object.entries(TEAM_LABELS).map(([team, label]) => <option key={team} value={team}>{label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
              <input
                aria-label={`${participant.ign} official war`}
                checked={participant.is_official}
                disabled={locked}
                type="checkbox"
                onChange={(event) => mutate(`/participants/${participant.member_id}`, {
                  method: 'PUT',
                  body: JSON.stringify({ team: participant.team, is_official: event.target.checked }),
                })}
              />
              Official
            </label>
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
