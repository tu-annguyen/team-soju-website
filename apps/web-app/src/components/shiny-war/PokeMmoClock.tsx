import { useEffect, useState } from 'react';
import { getHuntFinderMessages } from '../hunt-finder/messages';
import ClockAttributeIcon from './ClockAttributeIcon';
import { getPokeMmoClockState, type ShinyWarClockEvent } from './pokeMmoClockState';

type Props = {
  event?: ShinyWarClockEvent;
  locale?: string;
};

export default function PokeMmoClock({ event, locale }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const clock = getPokeMmoClockState(now, event);
  const huntMessages = getHuntFinderMessages(locale);
  const messages = huntMessages.clock;
  const localizeCalendar = (value: string) => huntMessages.calendar[value as keyof typeof huntMessages.calendar] || value;
  const values = [
    { label: messages.time, value: clock.time },
    { label: messages.season, value: localizeCalendar(clock.season), icon: <ClockAttributeIcon kind="season" value={clock.season} /> },
    { label: messages.timeOfDay, value: localizeCalendar(clock.timeOfDay), icon: <ClockAttributeIcon kind="timeOfDay" value={clock.timeOfDay} /> },
    { label: messages.weekday, value: localizeCalendar(clock.weekday) },
  ];

  return (
    <section
      className="mb-5 rounded-2xl border border-primary-200 bg-primary-50/70 px-4 py-3 dark:border-primary-800 dark:bg-primary-950/30"
      aria-label={messages.label}
    >
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
        {values.map(({ icon, label, value }) => (
          <div key={label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">{label}</p>
            <p className="mt-0.5 flex items-center gap-2 text-lg font-bold tabular-nums text-gray-950 dark:text-white">{icon}{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
