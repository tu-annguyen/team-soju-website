import React from 'react';
import type { FormEvent } from 'react';
import {
  POKEMON_NATURES,
  calculateCatchEventScore,
  catchEventHasNatureScoring,
} from '../../utils/catchEventScoring';
import type { CatchEventConfig } from '../../utils/catchEventScoring';
import type { Locale } from '../../i18n';
import {
  CATCH_EVENT_REGIONS,
  CATCH_EVENT_ROUTES_BY_REGION,
  type CatchEventRegion,
} from '../../utils/catchEventLocations';
import {
  fieldClasses,
  getSubmissionDisabledReason,
  getSubmissionProofs,
  labelClasses,
  panelClasses,
  readImageProofs,
  smallButtonClasses,
  type SubmissionForm,
} from './shared';
import { CatchEventDateTimeInput } from './CatchEventDateTimeInput';

type Props = {
  activeEvent: CatchEventConfig;
  submissionForm: SubmissionForm;
  submitMessage: string;
  submitMessageTone: 'success' | 'error';
  ocrMessage: string;
  isOcrLoading: boolean;
  browserTimezone: string;
  locale: Locale | string;
  tr: (text: string) => string;
  translateSpeciesDisplay: (species: string) => string;
  translateNatureDisplay: (nature: string) => string;
  translateRegion: (region: string) => string;
  translateLocation: (location: string) => string;
  setSubmissionForm: React.Dispatch<React.SetStateAction<SubmissionForm>>;
  setOcrMessage: (message: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onAutofill: () => void;
};

export function EventSubmissionPanel({
  activeEvent,
  submissionForm,
  submitMessage,
  submitMessageTone,
  ocrMessage,
  isOcrLoading,
  browserTimezone,
  locale,
  tr,
  translateSpeciesDisplay,
  translateNatureDisplay,
  translateRegion,
  translateLocation,
  setSubmissionForm,
  setOcrMessage,
  onSubmit,
  onAutofill,
}: Props) {
  const disabledReason = getSubmissionDisabledReason(activeEvent);
  const isNatureRequired = catchEventHasNatureScoring(activeEvent);

  return (
    <div className={`${panelClasses} ${disabledReason ? 'opacity-60' : ''}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{tr('Player Submission')}</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {tr('Required fields are marked. Screenshots are optional proof and can speed up host review or autofill.')}
        </p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {tr('Browser timezone suggestion:')} {browserTimezone}
        </p>
        {disabledReason && (
          <p className="mt-3 rounded-lg bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-600 dark:bg-gray-950 dark:text-gray-300">
            {disabledReason}
          </p>
        )}
      </div>
      <form className="space-y-5" onSubmit={onSubmit}>
        <fieldset className="space-y-5" disabled={Boolean(disabledReason)}>
          <label className={labelClasses}>
            {tr('Nature/OT screenshot')} <span className="font-normal text-gray-500 dark:text-gray-400">({tr('optional')})</span>
            <input
              className={fieldClasses}
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const screenshotProofs = await readImageProofs(event.target.files);
                setOcrMessage('');

                setSubmissionForm((prev) => ({
                  ...prev,
                  natureOtScreenshot: screenshotProofs[0] ?? null,
                }));
              }}
            />
          </label>
          <label className={labelClasses}>
            {tr('IVs screenshot')} <span className="font-normal text-gray-500 dark:text-gray-400">({tr('optional')})</span>
            <input
              className={fieldClasses}
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const screenshotProofs = await readImageProofs(event.target.files);
                setOcrMessage('');

                setSubmissionForm((prev) => ({
                  ...prev,
                  ivsScreenshot: screenshotProofs[0] ?? null,
                }));
              }}
            />
          </label>
          <label className={labelClasses}>
            {tr('Catch time/location screenshot')} <span className="font-normal text-gray-500 dark:text-gray-400">({tr('optional')})</span>
            <input
              className={fieldClasses}
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const screenshotProofs = await readImageProofs(event.target.files);
                setOcrMessage('');

                setSubmissionForm((prev) => ({
                  ...prev,
                  infoScreenshot: screenshotProofs[0] ?? null,
                }));
              }}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={smallButtonClasses}
              type="button"
              disabled={isOcrLoading || getSubmissionProofs(submissionForm).length < 3}
              onClick={onAutofill}
            >
              {isOcrLoading ? tr('Reading screenshots...') : tr('Autofill from screenshots')}
            </button>
            {ocrMessage && (
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{ocrMessage}</p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClasses}>
              {tr('Player IGN / OT')} <span className="text-rose-600">*</span>
              <input className={fieldClasses} value={submissionForm.playerIgn} onChange={(event) => setSubmissionForm({ ...submissionForm, playerIgn: event.target.value })} required />
            </label>
            <label className={labelClasses}>
              {tr('Pokemon species')} <span className="text-rose-600">*</span>
              <input className={fieldClasses} list="catch-event-targets" value={submissionForm.species} onChange={(event) => setSubmissionForm({ ...submissionForm, species: event.target.value })} required />
              <datalist id="catch-event-targets">
                {activeEvent.targets.map((target) => (
                  <option key={target} value={target} label={translateSpeciesDisplay(target)} />
                ))}
              </datalist>
            </label>
            <label className={labelClasses}>
              {tr('Nature')}{' '}
              {isNatureRequired ? (
                <span className="text-rose-600">*</span>
              ) : (
                <span className="font-normal text-gray-500 dark:text-gray-400">({tr('optional')})</span>
              )}
              <input className={fieldClasses} list="submission-nature-options" value={submissionForm.nature} onChange={(event) => setSubmissionForm({ ...submissionForm, nature: event.target.value })} required={isNatureRequired} />
              <datalist id="submission-nature-options">
                {POKEMON_NATURES.map((nature) => (
                  <option key={nature} value={nature} label={translateNatureDisplay(nature)} />
                ))}
              </datalist>
            </label>
            <label className={labelClasses}>
              {tr('Total IV')} <span className="text-rose-600">*</span>
              <input className={fieldClasses} min={0} max={186} type="number" value={submissionForm.totalIv} onChange={(event) => setSubmissionForm({ ...submissionForm, totalIv: Number(event.target.value) })} required />
            </label>
            <label className={labelClasses}>
              {tr('Catch date/time')} <span className="text-rose-600">*</span>
              <CatchEventDateTimeInput value={submissionForm.catchLocal} locale={locale} onChange={(catchLocal) => setSubmissionForm({ ...submissionForm, catchLocal })} required ariaLabel={tr('Catch date/time')} />
            </label>
            <label className={labelClasses}>
              {tr('Player timezone')} <span className="text-rose-600">*</span>
              <input className={fieldClasses} list="timezone-options" value={submissionForm.timezone} onChange={(event) => setSubmissionForm({ ...submissionForm, timezone: event.target.value })} required />
            </label>
            <label className={labelClasses}>
              {tr('Catch region')} <span className="text-rose-600">*</span>
              <input
                className={fieldClasses}
                list="submission-region-options"
                value={submissionForm.region}
                onChange={(event) => setSubmissionForm({ ...submissionForm, region: event.target.value, route: '' })}
                required
              />
              <datalist id="submission-region-options">
                {CATCH_EVENT_REGIONS.map((region) => (
                  <option key={region} value={region} label={translateRegion(region)} />
                ))}
              </datalist>
            </label>
            <label className={labelClasses}>
              {tr('Catch route/location')} <span className="text-rose-600">*</span>
              <input
                className={fieldClasses}
                list="submission-route-options"
                value={submissionForm.route}
                onChange={(event) => setSubmissionForm({ ...submissionForm, route: event.target.value })}
                required
              />
              <datalist id="submission-route-options">
                {(CATCH_EVENT_ROUTES_BY_REGION[submissionForm.region as CatchEventRegion] || []).map((route) => (
                  <option key={route} value={route} label={translateLocation(route)} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-950 dark:text-gray-300">
            <p className="font-semibold text-gray-950 dark:text-white">{tr('Verify before submitting')}</p>
            <p>
              {tr('Score preview:')}{' '}
              {calculateCatchEventScore(
                { species: submissionForm.species, nature: submissionForm.nature, totalIv: Number(submissionForm.totalIv) },
                activeEvent
              )}
            </p>
          </div>
          <button className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
            {tr('Submit entry')}
          </button>
          {submitMessage && (
            <p className={`text-sm font-semibold ${submitMessageTone === 'error' ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
              {submitMessage}
            </p>
          )}
        </fieldset>
      </form>
    </div>
  );
}
