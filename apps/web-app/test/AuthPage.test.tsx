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

  it('registers with email, password, and IGN', async () => {
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
    expect(await screen.findByText('Welcome back, Trainer.')).toBeInTheDocument();
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
});
