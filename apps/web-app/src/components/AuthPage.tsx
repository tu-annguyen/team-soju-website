import React, { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { getClientLocale, getTranslations, type Locale } from '../i18n';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

type AuthUser = {
  id: string;
  email: string;
  ign: string;
  discord_id?: string | null;
};

type AuthResponse = {
  success: boolean;
  data?: AuthUser | null;
  message?: string;
};

type Props = {
  apiBaseUrl: string;
  locale?: Locale | string;
};

function formatCopy(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

const AuthPage = ({ apiBaseUrl, locale }: Props) => {
  const normalizedApiBaseUrl = useMemo(() => apiBaseUrl.replace(/\/+$/, ''), [apiBaseUrl]);
  const [activeLocale, setActiveLocale] = useState<Locale>(() => getClientLocale(locale));
  const messages = getTranslations(activeLocale).auth;
  const [mode, setMode] = useState<AuthMode>('login');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [ign, setIgn] = useState('');
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setActiveLocale(getClientLocale(locale));
  }, [locale]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryMode = params.get('mode');
    const queryError = params.get('error');
    const queryStatus = params.get('status');
    const queryResetToken = params.get('resetToken');

    if (queryResetToken) {
      setMode('reset');
      setResetToken(queryResetToken);
    } else if (queryMode === 'register') {
      setMode('register');
    }

    if (queryError) {
      setError(queryError);
    }

    if (queryStatus === 'signed-in') {
      setNotice(messages.successLogin);
    }
  }, [messages.successLogin]);

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      try {
        const response = await fetch(`${normalizedApiBaseUrl}/auth/me`, {
          credentials: 'include',
        });
        const body = await response.json() as AuthResponse;

        if (isMounted && response.ok && body.success) {
          setUser(body.data || null);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsSessionLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      isMounted = false;
    };
  }, [normalizedApiBaseUrl]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${normalizedApiBaseUrl}/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mode === 'login' ? { email, password } : { email, password, ign }),
      });
      const body = await response.json() as AuthResponse;

      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.message || messages.errors.generic);
      }

      setUser(body.data);
      setPassword('');
      setNotice(mode === 'login' ? messages.successLogin : messages.successRegister);
      window.dispatchEvent(new CustomEvent('team-soju-auth-updated', { detail: body.data }));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : messages.errors.generic);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${normalizedApiBaseUrl}/auth/forgot-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      const body = await response.json() as AuthResponse;

      if (!response.ok || !body.success) {
        throw new Error(body.message || messages.errors.generic);
      }

      setPassword('');
      setNotice(body.message || messages.resetEmailSent);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : messages.errors.generic);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeResetTokenFromUrl = () => {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete('resetToken');
    window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  };

  const submitPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setNotice('');

    try {
      if (!resetToken) {
        throw new Error(messages.errors.resetTokenMissing);
      }

      const response = await fetch(`${normalizedApiBaseUrl}/auth/reset-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: resetToken, password }),
      });
      const body = await response.json() as AuthResponse;

      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.message || messages.errors.generic);
      }

      setUser(body.data);
      setPassword('');
      setResetToken('');
      setMode('login');
      setNotice(body.message || messages.successPasswordReset);
      removeResetTokenFromUrl();
      window.dispatchEvent(new CustomEvent('team-soju-auth-updated', { detail: body.data }));
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : messages.errors.generic);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = async () => {
    setIsSubmitting(true);
    setError('');
    setNotice('');

    try {
      await fetch(`${normalizedApiBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      setUser(null);
      setIsSubmitting(false);
      window.dispatchEvent(new CustomEvent('team-soju-auth-updated', { detail: null }));
    }
  };

  const continueWithDiscord = () => {
    setError('');

    if (mode === 'register' && ign.trim().length === 0) {
      setError(messages.errors.discordIgnRequired);
      return;
    }

    const params = new URLSearchParams({
      mode,
      returnTo: '/auth',
    });

    if (mode === 'register') {
      params.set('ign', ign.trim());
    }

    window.location.assign(`${normalizedApiBaseUrl}/auth/discord?${params.toString()}`);
  };

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-50 py-16 dark:bg-gray-950">
      <div className="container max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-gray-950 dark:text-white">{messages.heading}</h1>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          {isSessionLoading ? (
            <p className="text-center text-gray-700 dark:text-gray-300">{messages.loading}</p>
          ) : mode === 'reset' ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{messages.resetPasswordHeading}</h2>
                <p className="mt-2 text-gray-700 dark:text-gray-300">{messages.resetPasswordCopy}</p>
              </div>

              <form className="space-y-5" onSubmit={submitPasswordReset}>
                <div>
                  <label htmlFor="auth-new-password" className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {messages.newPassword}
                  </label>
                  <input
                    id="auth-new-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-primary-800"
                  />
                </div>

                <div className="space-y-3" aria-live="polite">
                  {error && <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>}
                  {notice && <p className="text-sm font-medium text-primary-700 dark:text-primary-300">{notice}</p>}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isSubmitting}
                >
                  {messages.resetPasswordSubmit}
                </button>
              </form>

              <button
                type="button"
                className="text-sm font-semibold text-primary-700 transition hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
                onClick={() => {
                  setMode('login');
                  setPassword('');
                  setResetToken('');
                  removeResetTokenFromUrl();
                  setError('');
                  setNotice('');
                }}
              >
                {messages.backToSignIn}
              </button>
            </div>
          ) : user ? (
            <div className="space-y-6 text-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{messages.signedInHeading}</h2>
                <p className="mt-2 text-gray-700 dark:text-gray-300">
                  {formatCopy(messages.signedInCopy, { ign: user.ign })}
                </p>
              </div>
              <div className="grid gap-3 rounded-lg border border-gray-200 bg-slate-50 p-4 text-left text-sm dark:border-gray-800 dark:bg-gray-950 sm:grid-cols-2">
                <div>
                  <span className="block font-semibold text-gray-950 dark:text-white">{messages.email}</span>
                  <span className="break-all text-gray-700 dark:text-gray-300">{user.email}</span>
                </div>
                <div>
                  <span className="block font-semibold text-gray-950 dark:text-white">Discord</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {user.discord_id ? messages.discordLinked : messages.discordNotLinked}
                  </span>
                </div>
              </div>
              {notice && <p className="text-sm font-medium text-primary-700 dark:text-primary-300">{notice}</p>}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={signOut}
                disabled={isSubmitting}
              >
                {messages.signOut}
              </button>
            </div>
          ) : (
            <>
              {mode !== 'forgot' && (
                <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1 dark:bg-gray-950">
                  <button
                    type="button"
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                      mode === 'login'
                        ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-white'
                        : 'text-gray-700 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white'
                    }`}
                    onClick={() => {
                      setMode('login');
                      setPassword('');
                      setError('');
                      setNotice('');
                    }}
                  >
                    {messages.loginTab}
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                      mode === 'register'
                        ? 'bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-white'
                        : 'text-gray-700 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white'
                    }`}
                    onClick={() => {
                      setMode('register');
                      setPassword('');
                      setError('');
                      setNotice('');
                    }}
                  >
                    {messages.registerTab}
                  </button>
                </div>
              )}

              {mode === 'forgot' ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-950 dark:text-white">{messages.forgotPasswordHeading}</h2>
                    <p className="mt-2 text-gray-700 dark:text-gray-300">{messages.forgotPasswordCopy}</p>
                  </div>

                  <form className="space-y-5" onSubmit={submitForgotPassword}>
                    <div>
                      <label htmlFor="auth-email" className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {messages.email}
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        required
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-primary-800"
                      />
                    </div>

                    <div className="space-y-3" aria-live="polite">
                      {error && <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>}
                      {notice && <p className="text-sm font-medium text-primary-700 dark:text-primary-300">{notice}</p>}
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary w-full"
                      disabled={isSubmitting}
                    >
                      {messages.sendResetLink}
                    </button>
                  </form>

                  <button
                    type="button"
                    className="text-sm font-semibold text-primary-700 transition hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
                    onClick={() => {
                      setMode('login');
                      setPassword('');
                      setError('');
                      setNotice('');
                    }}
                  >
                    {messages.backToSignIn}
                  </button>
                </div>
              ) : (
                <>
              <form className="space-y-5" onSubmit={submitAuth}>
                <div>
                  <label htmlFor="auth-email" className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {messages.email}
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-primary-800"
                  />
                </div>

                {mode === 'register' && (
                  <div>
                    <label htmlFor="auth-ign" className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {messages.ign}
                    </label>
                    <input
                      id="auth-ign"
                      type="text"
                      value={ign}
                      onChange={(event) => setIgn(event.target.value)}
                      autoComplete="nickname"
                      required
                      maxLength={50}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-primary-800"
                    />
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="auth-password" className="block text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {messages.password}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        className="text-sm font-semibold text-primary-700 transition hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
                        onClick={() => {
                          setMode('forgot');
                          setPassword('');
                          setError('');
                          setNotice('');
                        }}
                      >
                        {messages.forgotPassword}
                      </button>
                    )}
                  </div>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={mode === 'register' ? 8 : 1}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-950 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:ring-primary-800"
                  />
                </div>

                <div className="space-y-3" aria-live="polite">
                  {error && <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{error}</p>}
                  {notice && <p className="text-sm font-medium text-primary-700 dark:text-primary-300">{notice}</p>}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={isSubmitting}
                >
                  {mode === 'login' ? messages.loginSubmit : messages.registerSubmit}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                <span>Discord</span>
                <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              </div>

              <button
                type="button"
                className="w-full rounded-lg border border-[#5865f2] bg-[#5865f2] px-6 py-3 font-semibold text-white transition hover:bg-[#4752c4] focus:outline-none focus:ring-2 focus:ring-[#5865f2]/40"
                onClick={continueWithDiscord}
                disabled={isSubmitting}
              >
                {mode === 'login' ? messages.discordLogin : messages.discordRegister}
              </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default AuthPage;
