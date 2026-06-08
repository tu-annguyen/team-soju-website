import type { AuthMessages, AuthUser, FeebasBoard, FeebasCheckerMessages } from './shared';
import { formatCopy, LEADERBOARD_SIGN_IN_CTA_CLASSES } from './shared';
import type { LocationOption } from './locations';
import { LoadingPlaceholder } from './LoadingPlaceholder';

type Props = {
  activeLocation: string;
  activeLocationOption: LocationOption;
  authHref: string;
  authMessages: AuthMessages;
  authUser: AuthUser | null;
  board: FeebasBoard | null;
  countdown: string;
  isAuthLoading: boolean;
  loading: boolean;
  locationOptions: readonly LocationOption[];
  messages: FeebasCheckerMessages;
  onLocationChange: (locationId: string) => void;
};

function getLocationGroupId(option: LocationOption) {
  return option.groupId || option.id;
}

function getLocationGroupLabel(option: LocationOption) {
  return option.groupTabLabel || option.tabLabel;
}

export function LocationHeader({
  activeLocation,
  activeLocationOption,
  authHref,
  authMessages,
  authUser,
  board,
  countdown,
  isAuthLoading,
  loading,
  locationOptions,
  messages,
  onLocationChange,
}: Props) {
  const activeLocationGroupId = getLocationGroupId(activeLocationOption);
  const locationGroupOptions = locationOptions.filter((option, index) => (
    locationOptions.findIndex((candidate) => getLocationGroupId(candidate) === getLocationGroupId(option)) === index
  ));
  const activeLocationGroupOptions = activeLocationOption.groupId
    ? locationOptions.filter((option) => option.groupId === activeLocationOption.groupId)
    : [];

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={messages.locationsTabLabel}>
          {locationGroupOptions.map((option) => {
            const optionGroupId = getLocationGroupId(option);
            const isActive = optionGroupId === activeLocationGroupId;

            return (
              <button
                key={optionGroupId}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  if (!isActive) onLocationChange(option.id);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {getLocationGroupLabel(option)}
              </button>
            );
          })}
        </div>

        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          {loading && !board ? (
            <LoadingPlaceholder className="h-10 w-56 max-w-full rounded-xl" />
          ) : (
            activeLocationOption.displayName
          )}
        </h2>

        {activeLocationGroupOptions.length > 1 ? (
          <div
            className="inline-flex w-fit max-w-full rounded-full bg-slate-100 p-1 dark:bg-slate-900"
            role="tablist"
            aria-label={`${activeLocationOption.displayName} sections`}
          >
            {activeLocationGroupOptions.map((option) => {
              const isActive = option.id === activeLocation;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onLocationChange(option.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {option.areaLabel || option.tabLabel}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid gap-3 rounded-2xl bg-slate-100 p-4 dark:bg-slate-900/70">
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {messages.general.nextReset}
            </span>
            {loading && !board ? (
              <>
                <LoadingPlaceholder className="h-10 w-28 rounded-xl" />
                <LoadingPlaceholder className="h-4 w-48 max-w-full rounded-md" />
              </>
            ) : (
              <>
                <span className="font-display text-3xl text-slate-900 dark:text-white">{countdown}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatCopy(messages.general.resetsEvery, {
                    minutes: board?.resetIntervalMinutes || 45,
                  })}
                </span>
              </>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
            {loading && !board ? (
              <div className="space-y-2">
                <LoadingPlaceholder className="h-4 w-full rounded-md" />
                <LoadingPlaceholder className="h-4 w-11/12 rounded-md" />
                <LoadingPlaceholder className="h-4 w-8/12 rounded-md" />
              </div>
            ) : (
              messages.general.rules
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        {isAuthLoading ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300">
            {authMessages.loading}
          </div>
        ) : authUser ? (
          <p className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm font-medium text-primary-800 dark:border-primary-800/60 dark:bg-primary-950/40 dark:text-primary-200">
            {formatCopy(messages.general.signedInAs, { ign: authUser.ign })}
          </p>
        ) : (
          <a href={authHref} className={LEADERBOARD_SIGN_IN_CTA_CLASSES}>
            {messages.general.signInToTrackLeaderboardStats}
          </a>
        )}
      </div>
    </section>
  );
}
