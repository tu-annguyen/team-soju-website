type Props = {
  label: string;
};

const Placeholder = ({ className }: { className: string }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded-md bg-gray-200/80 dark:bg-gray-800/80 ${className}`}
  />
);

const SKELETON_CARDS = ['first', 'second', 'third'] as const;

export default function HuntResultsSkeleton({ label }: Props) {
  return (
    <section aria-busy="true" aria-label={label} className="space-y-3">
      <span className="sr-only">{label}</span>
      {SKELETON_CARDS.map((card) => (
        <article
          aria-hidden="true"
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          key={card}
        >
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <div className="min-w-0 flex-1 space-y-2">
              <Placeholder className="h-5 w-44 max-w-[66%]" />
              <Placeholder className="h-3 w-28 max-w-1/2" />
            </div>
            <Placeholder className="h-8 w-8 shrink-0 rounded-full" />
          </div>
          <div className="px-4 py-3">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
              <div className="min-w-48 flex-1 space-y-2">
                <Placeholder className="h-4 w-32" />
                <Placeholder className="h-3 w-52 max-w-full" />
              </div>
              <div className="flex gap-5">
                <Placeholder className="h-10 w-20" />
                <Placeholder className="h-10 w-20" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 dark:border-gray-800 sm:grid-cols-2 lg:grid-cols-3">
              <Placeholder className="h-8 w-full" />
              <Placeholder className="h-8 w-full" />
              <Placeholder className="hidden h-8 w-full lg:block" />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
