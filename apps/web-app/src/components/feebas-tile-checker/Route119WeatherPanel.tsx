import { LoadingPlaceholder } from './LoadingPlaceholder';
import type {
  FeebasBoard,
  FeebasCheckerMessages,
  Route119Weather,
} from './shared';
import { formatActorName, formatCopy } from './shared';

type Props = {
  board: FeebasBoard | null;
  loading: boolean;
  messages: FeebasCheckerMessages;
  pendingAction: string | null;
  onUpdateWeather: (weather: Route119Weather) => void;
};

function getWeatherLabel(weather: Route119Weather, messages: FeebasCheckerMessages) {
  return messages.weather.values[weather];
}

function getPendingReport(weather: Route119Weather, board: FeebasBoard | null) {
  return board?.weather?.pending.find((report) => report.weather === weather) || null;
}

export function Route119WeatherPanel({
  board,
  loading,
  messages,
  pendingAction,
  onUpdateWeather,
}: Props) {
  const weatherStatus = board?.weather || null;

  if (!weatherStatus && !loading) {
    return null;
  }

  const confirmedWeather = weatherStatus?.confirmed?.weather || null;
  const currentUserVote = weatherStatus?.currentUserVote || null;

  return (
    <div className="card p-5">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white">{messages.weather.heading}</h3>
      {loading && !board ? (
        <div className="mt-4 space-y-3">
          <LoadingPlaceholder className="h-14 w-full rounded-xl" />
          <LoadingPlaceholder className="h-10 w-full rounded-xl" />
        </div>
      ) : weatherStatus ? (
        <div className="mt-4 space-y-4 text-sm text-slate-700 dark:text-slate-200">
          <div className="rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {messages.weather.currentLabel}
            </span>
            <span className="mt-1 block text-lg font-bold text-slate-950 dark:text-white">
              {confirmedWeather ? getWeatherLabel(confirmedWeather, messages) : messages.weather.unknown}
            </span>
            {weatherStatus.confirmed?.actorName ? (
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                {formatCopy(messages.weather.confirmedBy, {
                  actorName: formatActorName(weatherStatus.confirmed.actorName, messages.general.anonymousName),
                })}
              </span>
            ) : null}
          </div>

          <div className="rounded-xl bg-slate-100 px-4 py-3 dark:bg-slate-900">
            <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {messages.weather.minimumCyclesLabel}
            </span>
            <span className="mt-1 block text-lg font-bold text-slate-950 dark:text-white">
              {weatherStatus.minimumCyclesUntilPossibleChange}
            </span>
          </div>

          <div className="grid gap-2">
            {(['rainy', 'clear'] as const).map((weather) => {
              const pendingReport = getPendingReport(weather, board);
              const isPending = pendingAction === `weather:${weather}`;
              const isCurrentUserVote = currentUserVote === weather;
              const buttonLabel = pendingReport && !isCurrentUserVote
                ? formatCopy(messages.weather.confirmAction, { weather: getWeatherLabel(weather, messages) })
                : formatCopy(messages.weather.reportAction, { weather: getWeatherLabel(weather, messages) });

              return (
                <button
                  key={weather}
                  type="button"
                  onClick={() => onUpdateWeather(weather)}
                  disabled={isPending || isCurrentUserVote}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left font-semibold text-slate-800 transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-primary-700 dark:hover:bg-primary-950/40"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span>{isCurrentUserVote ? messages.weather.alreadyReported : buttonLabel}</span>
                  </span>
                  {pendingReport ? (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      {formatCopy(messages.weather.pendingCount, { count: pendingReport.confirmations })}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
