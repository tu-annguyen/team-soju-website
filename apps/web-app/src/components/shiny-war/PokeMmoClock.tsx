import { useEffect, useState } from 'react';
import { getHuntFinderMessages } from '../hunt-finder/messages';
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
    [messages.time, clock.time],
    [messages.season, localizeCalendar(clock.season)],
    [messages.timeOfDay, localizeCalendar(clock.timeOfDay)],
    [messages.weekday, localizeCalendar(clock.weekday)],
  ];

  return (
    <section
      className="mb-5 rounded-2xl border border-primary-200 bg-primary-50/70 px-4 py-3 dark:border-primary-800 dark:bg-primary-950/30"
      aria-label={messages.label}
    >
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
        {values.map(([label, value]) => (
          <div key={label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">{label}</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-950 dark:text-white">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
