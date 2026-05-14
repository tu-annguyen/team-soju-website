import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthPage from '../src/components/AuthPage';

describe('AuthPage', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    window.history.replaceState({}, '', '/auth');
    // @ts-expect-error - tests provide the browser fetch implementation.
    global.fetch = fetchMock;
  });

  it('renders a form-shaped loading skeleton while checking the session', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    render(<AuthPage apiBaseUrl="http://localhost:3001/api" />);

    expect(screen.getByTestId('auth-loading-skeleton')).toBeInTheDocument();
    expect(screen.getByText('Checking your session...')).toBeInTheDocument();
  });

  it('registers with email, password, and IGN, then asks for email verification', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: null,
          message: 'Account created. Check your email to verify it before signing in.',
        }),
      });

    render(<AuthPage apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() => {
      expect(screen.queryByText('Checking your session...')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Email'), 'trainer@example.com');
    await user.type(screen.getByLabelText('In-game name'), 'Trainer');
    expect(screen.getByLabelText('Password')).toHaveAttribute('pattern', '(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,128}');
    await user.type(screen.getByLabelText('Password'), 'hunter42!');
    await user.type(screen.getByLabelText('Re-type new password'), 'hunter42!');
    await user.click(screen.getAllByRole('button', { name: 'Create account' })[1]);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            email: 'trainer@example.com',
            password: 'hunter42!',
            ign: 'Trainer',
          }),
        })
      );
    });
    expect(await screen.findByText('Account created. Check your email to verify it before signing in.')).toBeInTheDocument();
  });

  it('requests a password reset email from the forgot password flow', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'If an account uses that email, a reset link has been sent.',
        }),
      });

    render(<AuthPage apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() => {
      expect(screen.queryByText('Checking your session...')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await user.type(screen.getByLabelText('Email'), 'trainer@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/auth/forgot-password',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            email: 'trainer@example.com',
          }),
        })
      );
    });
    expect(screen.getByText('If an account uses that email, a reset link has been sent.')).toBeInTheDocument();
  });

  it('resets a password from a reset token URL', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/auth?resetToken=reset-token-0000000000000000000000');
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Password reset successfully.',
          data: {
            id: 'user-id',
            email: 'trainer@example.com',
            ign: 'Trainer',
            discord_id: null,
          },
        }),
      });

    render(<AuthPage apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() => {
      expect(screen.queryByText('Checking your session...')).not.toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('New password'), 'newhunter42!');
    await user.type(screen.getByLabelText('Re-type new password'), 'newhunter42!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        'http://localhost:3001/api/auth/reset-password',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            token: 'reset-token-0000000000000000000000',
            password: 'newhunter42!',
          }),
        })
      );
    });
    expect(await screen.findByText('Welcome back, Trainer.')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('requires an IGN before starting Discord registration', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: null }),
    });

    render(<AuthPage apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() => {
      expect(screen.queryByText('Checking your session...')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.click(screen.getByRole('button', { name: 'Create with Discord' }));

    expect(screen.getByText('Enter your IGN before continuing with Discord.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows a success notice after returning from email verification', async () => {
    window.history.replaceState({}, '', '/auth?status=email-verified');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: null }),
    });

    render(<AuthPage apiBaseUrl="http://localhost:3001/api" />);

    expect(await screen.findByText('Email verified. You can sign in now.')).toBeInTheDocument();
  });

  it('finishes Discord sign-in by exchanging the handoff token from the returned URL hash', async () => {
    window.history.replaceState({}, '', '/auth?status=signed-in#discordAuthToken=handoff-token');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Signed in successfully.',
        data: {
          id: 'user-id',
          email: 'trainer@example.com',
          ign: 'Trainer',
          discord_id: 'discord-id',
          auth_provider: 'discord',
        },
      }),
    });

    render(<AuthPage apiBaseUrl="http://localhost:3001/api" />);

    expect(await screen.findByText('Welcome back, Trainer.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth/discord/session',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ token: 'handoff-token' }),
      })
    );
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('');
  });

  it('lets a signed-in user change their email and password', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'user-id',
            email: 'trainer@example.com',
            ign: 'Trainer',
            discord_id: null,
            auth_provider: 'password',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Email updated. Check your new inbox to verify it.',
          data: {
            id: 'user-id',
            email: 'new@example.com',
            ign: 'Trainer',
            discord_id: null,
            auth_provider: 'password',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Password updated successfully.',
          data: {
            id: 'user-id',
            email: 'new@example.com',
            ign: 'Trainer',
            discord_id: null,
            auth_provider: 'password',
          },
        }),
      });

    render(<AuthPage apiBaseUrl="http://localhost:3001/api" />);

    expect(await screen.findByText('Welcome back, Trainer.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('New email'));
    await user.type(screen.getByLabelText('New email'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Update email' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3001/api/auth/change-email',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            email: 'new@example.com',
          }),
        })
      );
    });

    await user.type(screen.getByLabelText('Current password'), 'hunter42!');
    await user.type(screen.getByLabelText('New password'), 'newhunter42!');
    await user.type(screen.getByLabelText('Re-type new password'), 'newhunter42!');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        'http://localhost:3001/api/auth/change-password',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            currentPassword: 'hunter42!',
            newPassword: 'newhunter42!',
          }),
        })
      );
    });

    expect(await screen.findByText('Password updated successfully.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Discord' })).toBeInTheDocument();
  });

  it('blocks password updates when the re-typed password does not match', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'user-id',
          email: 'trainer@example.com',
          ign: 'Trainer',
          discord_id: null,
          auth_provider: 'password',
        },
      }),
    });

    render(<AuthPage apiBaseUrl="http://localhost:3001/api" />);

    expect(await screen.findByText('Welcome back, Trainer.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Current password'), 'hunter42!');
    await user.type(screen.getByLabelText('New password'), 'newhunter42!');
    await user.type(screen.getByLabelText('Re-type new password'), 'different42!');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
