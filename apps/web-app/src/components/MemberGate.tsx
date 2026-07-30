import type { ReactNode } from 'react';
import { hasPermission, isTeamMember } from '../auth/authorization';
import { useAuthUser } from '../auth/useAuthUser';

type Props = {
  apiBaseUrl: string;
  children: ReactNode;
  requiredPermission?: string;
};

function GateMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-16">
      <div className="container max-w-2xl">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-2xl font-bold text-gray-950 dark:text-white">{title}</h1>
          <div className="mt-4 text-gray-700 dark:text-gray-300">{children}</div>
        </div>
      </div>
    </section>
  );
}

export default function MemberGate({ apiBaseUrl, children, requiredPermission }: Props) {
  const { authUser, isAuthLoading } = useAuthUser(apiBaseUrl);
  const normalizedApiBaseUrl = apiBaseUrl.replace(/\/+$/, '');
  const returnTo = typeof window === 'undefined'
    ? '/'
    : `${window.location.pathname}${window.location.search}`;

  if (isAuthLoading) {
    return (
      <GateMessage title="Checking access">
        <p aria-live="polite">Confirming your Team Soju membership…</p>
      </GateMessage>
    );
  }

  if (!authUser) {
    return (
      <GateMessage title="Sign in required">
        <p>Sign in to your Team Soju account to access this page.</p>
        <a className="btn btn-primary mt-6 inline-flex" href="/auth">Sign in</a>
      </GateMessage>
    );
  }

  if (!authUser.discord_id) {
    const params = new URLSearchParams({ mode: 'connect', returnTo });
    return (
      <GateMessage title="Connect Discord">
        <p>Connect your Discord account so we can confirm your Team Soju membership.</p>
        <a
          className="btn btn-primary mt-6 inline-flex"
          href={`${normalizedApiBaseUrl}/auth/discord?${params.toString()}`}
        >
          Connect Discord
        </a>
      </GateMessage>
    );
  }

  if (!isTeamMember(authUser)) {
    return (
      <GateMessage title="Team membership required">
        <p>This page is available only to active Team Soju members.</p>
      </GateMessage>
    );
  }

  if (requiredPermission && !hasPermission(authUser, requiredPermission)) {
    return (
      <GateMessage title="Permission required">
        <p>Your Team Soju account does not have permission to access this page.</p>
      </GateMessage>
    );
  }

  return <>{children}</>;
}
