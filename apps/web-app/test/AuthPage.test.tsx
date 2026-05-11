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
    await user.type(screen.getByLabelText('Password'), 'hunter42!');
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
});
