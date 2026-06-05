type Props = {
  className: string;
};

export function LoadingPlaceholder({ className }: Props) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-full bg-slate-200/90 dark:bg-slate-700/80 ${className}`}
    />
  );
}
