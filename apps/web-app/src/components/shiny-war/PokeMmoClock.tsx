import { useEffect, useState } from 'react';
import { getPokeMmoClockState, type ShinyWarClockEvent } from './pokeMmoClock';

type Props = {
  event: ShinyWarClockEvent;
};

export default function PokeMmoClock({ event }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const clock = getPokeMmoClockState(now, event);
  const values = [
    ['In-game time', clock.time],
    ['Season', clock.season],
    ['Time of day', clock.timeOfDay],
    ['Day of week', clock.weekday],
  ];

  return (
    <section
      className="mb-5 rounded-2xl border border-primary-200 bg-primary-50/70 px-4 py-3 dark:border-primary-800 dark:bg-primary-950/30"
      aria-label="Current PokeMMO time"
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
