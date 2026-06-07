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
  type TimezoneOption,
} from './shared';
import { CatchEventDateTimeInput } from './CatchEventDateTimeInput';
import { FilteredCombobox } from './FilteredCombobox';

type Props = {
  activeEvent: CatchEventConfig;
  submissionForm: SubmissionForm;
  submitMessage: string;
  submitMessageTone: 'success' | 'error';
  ocrMessage: string;
  isOcrLoading: boolean;
  browserTimezone: string;
  timezoneOptions: TimezoneOption[];
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
  timezoneOptions,
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
  const timezoneValues = React.useMemo(
    () => timezoneOptions.map((timezone) => timezone.value),
    [timezoneOptions]
  );
  const getTimezoneLabel = React.useCallback(
    (timezone: string) => timezoneOptions.find((option) => option.value === timezone)?.label || timezone,
    [timezoneOptions]
  );

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
              <FilteredCombobox
                className={fieldClasses}
                options={activeEvent.targets}
                value={submissionForm.species}
                onChange={(species) => setSubmissionForm({ ...submissionForm, species })}
                required
                getOptionLabel={translateSpeciesDisplay}
              />
            </label>
            <label className={labelClasses}>
              {tr('Nature')}{' '}
              {isNatureRequired ? (
                <span className="text-rose-600">*</span>
              ) : (
                <span className="font-normal text-gray-500 dark:text-gray-400">({tr('optional')})</span>
              )}
              <FilteredCombobox
                className={fieldClasses}
                options={POKEMON_NATURES}
                value={submissionForm.nature}
                onChange={(nature) => setSubmissionForm({ ...submissionForm, nature })}
                required={isNatureRequired}
                getOptionLabel={translateNatureDisplay}
              />
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
              <FilteredCombobox
                className={fieldClasses}
                options={timezoneValues}
                value={submissionForm.timezone}
                onChange={(timezone) => setSubmissionForm({ ...submissionForm, timezone })}
                required
                getOptionLabel={getTimezoneLabel}
              />
            </label>
            <label className={labelClasses}>
              {tr('Catch region')} <span className="text-rose-600">*</span>
              <FilteredCombobox
                className={fieldClasses}
                options={CATCH_EVENT_REGIONS}
                value={submissionForm.region}
                onChange={(region) => setSubmissionForm({ ...submissionForm, region, route: '' })}
                required
                getOptionLabel={translateRegion}
              />
            </label>
            <label className={labelClasses}>
              {tr('Catch route/location')} <span className="text-rose-600">*</span>
              <FilteredCombobox
                className={fieldClasses}
                options={CATCH_EVENT_ROUTES_BY_REGION[submissionForm.region as CatchEventRegion] || []}
                value={submissionForm.route}
                onChange={(route) => setSubmissionForm({ ...submissionForm, route })}
                required
                getOptionLabel={translateLocation}
              />
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
