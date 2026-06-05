import type { FeebasCheckerMessages, PendingNominationNotification } from './shared';

type Props = {
  notification: PendingNominationNotification;
  messages: FeebasCheckerMessages;
  onDismiss: () => void;
};

export function PendingNominationToast({ notification, messages, onDismiss }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 top-4 z-[80] w-[min(calc(100vw-2rem),24rem)] rounded-xl border border-amber-200 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-950/20 dark:border-amber-400/40 dark:bg-slate-950 dark:text-white"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-slate-950">
          !
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{notification.title}</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notification.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto rounded-full px-2 text-lg leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label={messages.notifications.dismiss}
        >
          x
        </button>
      </div>
    </div>
  );
}
