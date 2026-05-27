import React from 'react';
import { selectPrizeRelevantSubmissions } from '../../utils/catchEventScoring';
import type {
  CatchEventConfig,
  CatchEventCollaborator,
  CatchEventStatus,
  CatchEventSubmission,
} from '../../utils/catchEventScoring';
import type { Locale } from '../../i18n';
import {
  fieldClasses,
  formatDateTime,
  formatLocalDateTime,
  labelClasses,
  makeToolUrl,
  panelClasses,
  smallButtonClasses,
  type AuthUser,
  type ScreenshotProof,
} from './shared';

export type SubmissionEditForm = {
  playerIgn: string;
  species: string;
  nature: string;
  totalIv: string;
  catchLocal: string;
  timezone: string;
  region: string;
  route: string;
};

type Props = {
  isAuthLoading: boolean;
  isLoading: boolean;
  authUser: AuthUser | null;
  activeEvent: CatchEventConfig | undefined;
  manageableEvents: CatchEventConfig[];
  activeSubmissions: CatchEventSubmission[];
  createdEventId: string;
  collaboratorIdentifier: string;
  collaboratorMessage: string;
  statusLabels: Record<CatchEventStatus, string>;
  locale: Locale | string;
  tr: (text: string) => string;
  translateSpeciesDisplay: (species: string) => string;
  translateNatureDisplay: (nature: string) => string;
  translateRegion: (region: string) => string;
  translateLocation: (location: string) => string;
  setActiveEventId: (eventId: string) => void;
  setSelectedProof: (proof: ScreenshotProof) => void;
  updateSubmissionStatus: (submissionId: string, status: CatchEventStatus) => void;
  updateSubmission: (submissionId: string, submission: SubmissionEditForm) => Promise<void>;
  updateLeaderboardPublished: (eventId: string, isPublished: boolean) => void;
  updateSubmissionsClosed: (eventId: string, isClosed: boolean) => void;
  updateAutoCheckEnabled: (eventId: string, autoCheckEnabled: boolean) => void;
  setCollaboratorIdentifier: (identifier: string) => void;
  addCollaborator: (event: React.FormEvent<HTMLFormElement>) => void;
  removeCollaborator: (collaborator: CatchEventCollaborator) => void;
  loadEventIntoForm: (event: CatchEventConfig, mode?: 'duplicate' | 'edit') => void;
  deleteEvent: (event: CatchEventConfig) => void;
};

export function HostManageView({
  isAuthLoading,
  isLoading,
  authUser,
  activeEvent,
  manageableEvents,
  activeSubmissions,
  createdEventId,
  collaboratorIdentifier,
  collaboratorMessage,
  statusLabels,
  locale,
  tr,
  translateSpeciesDisplay,
  translateNatureDisplay,
  translateRegion,
  translateLocation,
  setActiveEventId,
  setSelectedProof,
  updateSubmissionStatus,
  updateSubmission,
  updateLeaderboardPublished,
  updateSubmissionsClosed,
  updateAutoCheckEnabled,
  setCollaboratorIdentifier,
  addCollaborator,
  removeCollaborator,
  loadEventIntoForm,
  deleteEvent,
}: Props) {
  const [editingSubmissionId, setEditingSubmissionId] = React.useState('');
  const [submissionEditForm, setSubmissionEditForm] = React.useState<SubmissionEditForm | null>(null);
  const [submissionEditError, setSubmissionEditError] = React.useState('');

  if (isAuthLoading || isLoading) {
    return <HostManageSkeleton />;
  }

  if (!authUser) {
    return (
      <div className={panelClasses}>
        <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{tr('Sign In Required')}</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          {tr('Event management is only available to the owner and shared admins.')}
        </p>
        <a className="mt-4 inline-flex rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700" href="/auth">
          {tr('Sign in')}
        </a>
      </div>
    );
  }

  if (!activeEvent) {
    return <div className={panelClasses}>{tr('No events available to manage yet.')}</div>;
  }

  const prizeRelevantById = new Map(
    selectPrizeRelevantSubmissions(activeEvent, activeSubmissions).map((submission) => [
      submission.id,
      submission.reviewReasons,
    ])
  );
  const isOwner = Boolean(authUser && activeEvent.ownerUserId === authUser.id);
  const collaborators = activeEvent.collaborators || [];
  const startEditingSubmission = (submission: CatchEventSubmission) => {
    setEditingSubmissionId(submission.id);
    setSubmissionEditForm({
      playerIgn: submission.playerIgn,
      species: submission.species,
      nature: submission.nature,
      totalIv: String(submission.totalIv),
      catchLocal: submission.catchLocal,
      timezone: submission.timezone,
      region: submission.region,
      route: submission.route,
    });
    setSubmissionEditError('');
  };
  const saveSubmissionEdit = async () => {
    if (!editingSubmissionId || !submissionEditForm) return;
    try {
      await updateSubmission(editingSubmissionId, submissionEditForm);
      setEditingSubmissionId('');
      setSubmissionEditForm(null);
      setSubmissionEditError('');
    } catch (error) {
      setSubmissionEditError(error instanceof Error ? error.message : tr('Failed to update submission.'));
    }
  };

  return (
    <div className="space-y-6">
      <div className={panelClasses}>
        <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{tr('Manage Events')}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {manageableEvents.map((event) => {
            const eventIsOwner = Boolean(authUser && event.ownerUserId === authUser.id);
            return (
              <button
                key={event.id}
                type="button"
                className={`rounded-lg border p-4 text-left transition-colors ${
                  activeEvent.id === event.id
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                    : 'border-gray-200 hover:border-emerald-500 dark:border-gray-800'
                }`}
                onClick={() => setActiveEventId(event.id)}
              >
                <p className="font-bold text-gray-950 dark:text-white">{event.name}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {formatLocalDateTime(event.startLocal, locale)} {tr('to')} {formatLocalDateTime(event.endLocal, locale)} {event.timezone}
                </p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {translateLocation(event.route)}, {translateRegion(event.region)}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {eventIsOwner ? tr('Owner') : tr('Shared admin')}
                </p>
              </button>
            );
          })}
        </div>
      </div>
      <div className={panelClasses}>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{activeEvent.name}</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {formatLocalDateTime(activeEvent.startLocal, locale)} {tr('to')} {formatLocalDateTime(activeEvent.endLocal, locale)} {activeEvent.timezone}
            </p>
            <p className="mt-1 mb-4 text-sm text-gray-600 dark:text-gray-300">
              {translateLocation(activeEvent.route)}, {translateRegion(activeEvent.region)}
            </p>
            <span className={`mr-4 rounded-lg px-3 py-2 text-sm font-semibold ${
              activeEvent.isPrivate
                ? 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-950 dark:text-gray-300'
            }`}>
              {activeEvent.isPrivate ? tr('Private event') : tr('Public event')}
            </span>
            <span className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              activeEvent.isLeaderboardPublished
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
            }`}>
              {activeEvent.isLeaderboardPublished ? tr('Leaderboard published') : tr('Leaderboard unpublished')}
            </span>
          </div>
          <div className="grid gap-3 text-sm">
            <label className={labelClasses}>
              {tr('Event link')}
              <input className={fieldClasses} readOnly value={makeToolUrl('events', activeEvent.id)} />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={activeEvent.isLeaderboardPublished ? smallButtonClasses : 'rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700'}
                onClick={() => updateLeaderboardPublished(activeEvent.id, !activeEvent.isLeaderboardPublished)}
              >
                {activeEvent.isLeaderboardPublished ? tr('Unpublish leaderboard') : tr('Publish leaderboard')}
              </button>
              <button
                type="button"
                className={activeEvent.submissionsClosed ? smallButtonClasses : 'rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700'}
                onClick={() => updateSubmissionsClosed(activeEvent.id, !activeEvent.submissionsClosed)}
              >
                {activeEvent.submissionsClosed ? tr('Reopen submissions') : tr('Close submissions')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isOwner && (
                <button type="button" className={smallButtonClasses} onClick={() => loadEventIntoForm(activeEvent, 'edit')}>
                  {tr('Edit event')}
                </button>
              )}
              <button type="button" className={smallButtonClasses} onClick={() => loadEventIntoForm(activeEvent)}>
                {tr('Duplicate event')}
              </button>
              {isOwner && (
                <button
                  type="button"
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
                  onClick={() => deleteEvent(activeEvent)}
                >
                  {tr('Delete event')}
                </button>
              )}
            </div>
          </div>
        </div>
        {createdEventId === activeEvent.id && (
          <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {tr('Event saved. Share the submit link when entries open.')}
          </p>
        )}
      </div>
      {isOwner && (
        <div className={panelClasses}>
          <h3 className="text-xl font-bold text-gray-950 dark:text-white">{tr('Shared admins')}</h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {tr('Add an existing Team Soju account by email or IGN so they can help review and operate this event.')}
          </p>
          <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={addCollaborator}>
            <label className={`${labelClasses} flex-1`}>
              {tr('Account email or IGN')}
              <input
                className={fieldClasses}
                value={collaboratorIdentifier}
                onChange={(event) => setCollaboratorIdentifier(event.target.value)}
                placeholder={tr('trainer@example.com or TrainerIGN')}
              />
            </label>
            <button type="submit" className="self-end rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
              {tr('Add shared admin')}
            </button>
          </form>
          {collaboratorMessage && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              {collaboratorMessage}
            </p>
          )}
          <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {collaborators.map((collaborator) => (
              <div key={collaborator.userId} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-semibold text-gray-950 dark:text-white">{collaborator.ign}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{collaborator.email}</p>
                </div>
                <button type="button" className={smallButtonClasses} onClick={() => removeCollaborator(collaborator)}>
                  {tr('Remove')}
                </button>
              </div>
            ))}
            {collaborators.length === 0 && (
              <p className="p-4 text-sm text-gray-600 dark:text-gray-300">{tr('No shared admins yet.')}</p>
            )}
          </div>
        </div>
      )}
      <div className={panelClasses}>
        <h3 className="text-xl font-bold text-gray-950 dark:text-white">{tr('Review Queue')}</h3>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p>
            {tr('Auto-check lets lower-stakes community events accept clean submissions after the tool checks Pokemon, time, location, and score. Keep it off for official or competitive events so every entry stays pending until staff review.')}
          </p>
          <button
            type="button"
            className={activeEvent.autoCheckEnabled ? `mt-3 ${smallButtonClasses}` : 'mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700'}
            onClick={() => updateAutoCheckEnabled(activeEvent.id, !activeEvent.autoCheckEnabled)}
          >
            {activeEvent.autoCheckEnabled ? tr('Disable auto-check') : tr('Enable auto-check')}
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800">
              <tr>
                <th className="py-3 pr-4">{tr('Player')}</th>
                <th className="py-3 pr-4">{tr('Entry')}</th>
                <th className="py-3 pr-4">{tr('Proof')}</th>
                <th className="py-3 pr-4">{tr('Score')}</th>
                <th className="py-3 pr-4">{tr('Location')}</th>
                <th className="py-3 pr-4">{tr('Catch UTC')}</th>
                <th className="py-3 pr-4">{tr('Prize Review')}</th>
                <th className="py-3 pr-4">{tr('Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {activeSubmissions.map((submission) => {
                const prizeReasons = prizeRelevantById.get(submission.id) || [];
                const isEditing = editingSubmissionId === submission.id && submissionEditForm;

                return (
                <tr key={submission.id}>
                  <td className="py-3 pr-4 font-semibold text-gray-950 dark:text-white">
                    {isEditing ? (
                      <input className={fieldClasses} value={submissionEditForm.playerIgn} onChange={(event) => setSubmissionEditForm({ ...submissionEditForm, playerIgn: event.target.value })} />
                    ) : submission.playerIgn}
                  </td>
                  <td className="py-3 pr-4 text-gray-700 dark:text-gray-300">
                    {isEditing ? (
                      <div className="grid min-w-52 gap-2">
                        <input className={fieldClasses} list="host-submission-targets" value={submissionEditForm.species} onChange={(event) => setSubmissionEditForm({ ...submissionEditForm, species: event.target.value })} />
                        <input className={fieldClasses} value={submissionEditForm.nature} onChange={(event) => setSubmissionEditForm({ ...submissionEditForm, nature: event.target.value })} />
                        <input className={fieldClasses} min={0} max={186} type="number" value={submissionEditForm.totalIv} onChange={(event) => setSubmissionEditForm({ ...submissionEditForm, totalIv: event.target.value })} />
                      </div>
                    ) : (
                      <>
                        {translateSpeciesDisplay(submission.species)}, {translateNatureDisplay(submission.nature)}, {submission.totalIv} {tr('IV')}
                        <span className="block text-xs">{submission.screenshotNames.length} {tr('screenshot(s)')}</span>
                      </>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {submission.screenshotProofs?.length ? (
                      <div className="flex max-w-48 gap-2 overflow-x-auto pb-1">
                        {submission.screenshotProofs.map((proof, index) => (
                          <button
                            key={`${submission.id}-${proof.name || proof.fileName}-${index}`}
                            type="button"
                            className="group block shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                            onClick={() => setSelectedProof(proof)}
                            title={`${tr('Open proof')} ${proof.name || proof.fileName || tr('Screenshot proof')}`}
                            aria-label={`${tr('Open proof')} ${proof.name || proof.fileName || tr('Screenshot proof')}`}
                          >
                            <img
                              className="h-16 w-16 rounded-lg border border-gray-200 object-cover transition-opacity group-hover:opacity-80 dark:border-gray-700"
                              src={proof.dataUrl || proof.url}
                              alt={`${submission.playerIgn} ${tr('proof')} ${index + 1}`}
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">
                        {submission.screenshotNames.length
                          ? submission.screenshotNames.join(', ')
                          : tr('None')}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-bold">{submission.score}</td>
                  <td className="py-3 pr-4">
                    {isEditing ? (
                      <div className="grid min-w-52 gap-2">
                        <input className={fieldClasses} value={submissionEditForm.region} onChange={(event) => setSubmissionEditForm({ ...submissionEditForm, region: event.target.value })} />
                        <input className={fieldClasses} value={submissionEditForm.route} onChange={(event) => setSubmissionEditForm({ ...submissionEditForm, route: event.target.value })} />
                      </div>
                    ) : (
                      <>{submission.route ? translateLocation(submission.route) : tr('Unknown')}, {submission.region ? translateRegion(submission.region) : tr('Unknown')}</>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {isEditing ? (
                      <div className="grid min-w-56 gap-2">
                        <input className={fieldClasses} type="datetime-local" step={1} placeholder="YYYY-MM-DD HH:MM:SS" value={submissionEditForm.catchLocal} onChange={(event) => setSubmissionEditForm({ ...submissionEditForm, catchLocal: event.target.value })} />
                        <input className={fieldClasses} list="timezone-options" value={submissionEditForm.timezone} onChange={(event) => setSubmissionEditForm({ ...submissionEditForm, timezone: event.target.value })} />
                      </div>
                    ) : formatDateTime(submission.catchUtc, undefined, locale)}
                  </td>
                  <td className="py-3 pr-4">
                    {[...submission.flags, ...prizeReasons].length ? (
                      <span className="block text-xs font-semibold text-amber-700 dark:text-amber-300">
                        {[...submission.flags, ...prizeReasons].map((reason) => tr(reason)).join('; ')}
                      </span>
                    ) : tr('None')}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="grid gap-2">
                      <select className={fieldClasses} value={submission.status} onChange={(event) => updateSubmissionStatus(submission.id, event.target.value as CatchEventStatus)}>
                        {Object.entries(statusLabels).map(([status, label]) => (
                          <option key={status} value={status}>{label}</option>
                        ))}
                      </select>
                      {isEditing ? (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className={smallButtonClasses} onClick={saveSubmissionEdit}>{tr('Save')}</button>
                          <button type="button" className={smallButtonClasses} onClick={() => { setEditingSubmissionId(''); setSubmissionEditForm(null); }}>{tr('Cancel')}</button>
                        </div>
                      ) : (
                        <button type="button" className={smallButtonClasses} onClick={() => startEditingSubmission(submission)}>
                          {tr('Edit')}
                        </button>
                      )}
                      {isEditing && submissionEditError && (
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-300">{submissionEditError}</span>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          <datalist id="host-submission-targets">
            {activeEvent.targets.map((target) => (
              <option key={target} value={target} label={translateSpeciesDisplay(target)} />
            ))}
          </datalist>
          {activeSubmissions.length === 0 && <p className="py-8 text-center text-gray-600 dark:text-gray-300">{tr('No submissions yet.')}</p>}
        </div>
      </div>
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800 ${className}`} />;
}

function HostManageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading host events">
      <div className={panelClasses}>
        <SkeletonBlock className="h-8 w-44" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[0, 1].map((item) => (
            <div key={item} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <SkeletonBlock className="h-5 w-2/3" />
              <SkeletonBlock className="mt-3 h-4 w-full" />
              <SkeletonBlock className="mt-2 h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
      <div className={panelClasses}>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div>
            <SkeletonBlock className="h-8 w-2/3" />
            <SkeletonBlock className="mt-3 h-4 w-72" />
            <SkeletonBlock className="mt-2 h-4 w-48" />
            <div className="mt-4 flex gap-4">
              <SkeletonBlock className="h-9 w-28" />
              <SkeletonBlock className="h-9 w-40" />
            </div>
          </div>
          <div>
            <SkeletonBlock className="h-4 w-24" />
            <SkeletonBlock className="mt-2 h-10 w-full" />
            <div className="mt-4 flex flex-wrap gap-3">
              <SkeletonBlock className="h-10 w-40" />
              <SkeletonBlock className="h-10 w-36" />
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <SkeletonBlock className="h-10 w-24" />
              <SkeletonBlock className="h-10 w-32" />
              <SkeletonBlock className="h-10 w-28" />
            </div>
          </div>
        </div>
      </div>
      <div className={panelClasses}>
        <SkeletonBlock className="h-7 w-36" />
        <div className="mt-4 overflow-hidden">
          <div className="min-w-[760px] space-y-3">
            <SkeletonBlock className="h-8 w-full" />
            {[0, 1, 2].map((item) => <SkeletonBlock key={item} className="h-14 w-full" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
