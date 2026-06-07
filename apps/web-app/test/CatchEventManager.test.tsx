import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import CatchEventManager from '../src/components/CatchEventManager';

describe('CatchEventManager', () => {
  const fetchMock = jest.fn();
  const privateEvent = {
    id: 'private-event',
    ownerUserId: 'other-user',
    ownerIgn: 'Host',
    name: 'Linked Private Catch',
    eventDate: '2026-05-20',
    startLocal: '2026-05-20T10:00',
    endLocal: '2026-05-20T11:00',
    timezone: 'America/Los_Angeles',
    region: 'Hoenn',
    route: 'Route 119',
    winnerCount: 4,
    targets: ['Milotic'],
    speciesBonuses: [],
    speciesPenalties: [],
    natureBonuses: [],
    naturePenalties: [],
    useLowestScoreFinalPlace: true,
    isLeaderboardPublished: false,
    isPrivate: true,
    submissionsClosed: false,
    createdAt: '2026-05-20T17:00:00Z',
    submissions: [],
  };
  const ownerNeutralEvent = {
    ...privateEvent,
    ownerUserId: 'user-id',
    ownerIgn: 'Trainer',
    name: 'Neutral Tropius Catch',
    targets: ['Tropius'],
    speciesBonuses: [],
    speciesPenalties: [],
    collaborators: [],
  };

  beforeEach(() => {
    fetchMock.mockReset();
    window.history.replaceState({}, '', '/tools/catch-events/create');
    // @ts-expect-error - tests provide the browser fetch implementation.
    global.fetch = fetchMock;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { id: 'user-id', email: 'trainer@example.com', ign: 'Trainer' },
          }),
        };
      }

      if (url.endsWith('/catch-events/private-event')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: privateEvent }),
        };
      }

      if (url.endsWith('/catch-events?owner=me')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        };
      }

      if (url.endsWith('/catch-events')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        };
      }

      throw new Error(`Unexpected fetch ${url}`);
    });
  });

  it('does not prefill Hoenn when creating a catch event', async () => {
    render(<CatchEventManager apiBaseUrl="http://localhost:3001/api" initialView="create" />);

    await waitFor(() => {
      expect(screen.queryByText('Checking session...')).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText('Region')).toHaveValue('');
  });

  it('defaults new catch events to private', async () => {
    render(<CatchEventManager apiBaseUrl="http://localhost:3001/api" initialView="create" />);

    await waitFor(() => {
      expect(screen.getByLabelText('Region')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/Private event/i)).toBeChecked();
  });

  it('hides event search when a private event is opened by link', async () => {
    window.history.replaceState({}, '', '/tools/catch-events?event=private-event');

    render(<CatchEventManager apiBaseUrl="http://localhost:3001/api" initialView="events" />);

    await waitFor(() => {
      expect(screen.getByText('Linked Private Catch')).toBeInTheDocument();
    });

    expect(screen.queryByPlaceholderText('Search events')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Search for Public events' })).toHaveAttribute(
      'href',
      'http://localhost/tools/catch-events?view=events'
    );
  });

  it('shows shared events in host manage for a co-host without owner-only controls', async () => {
    window.history.replaceState({}, '', '/tools/catch-events?view=host&tab=manage&event=private-event');
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { id: 'user-id', email: 'trainer@example.com', ign: 'Trainer' },
          }),
        };
      }

      if (url.endsWith('/catch-events?owner=me')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [privateEvent] }),
        };
      }

      if (url.endsWith('/catch-events/private-event')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: privateEvent }),
        };
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    render(<CatchEventManager apiBaseUrl="http://localhost:3001/api" initialView="admin" />);

    await waitFor(() => {
      expect(screen.getAllByText('Linked Private Catch').length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(screen.getByText('Shared admin')).toBeInTheDocument();
      expect(screen.getByText('Duplicate event')).toBeInTheDocument();
    });
    expect(screen.queryByText('Shared admins')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit event')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete event')).not.toBeInTheDocument();
  });

  it('lets the owner add a shared admin by email or IGN', async () => {
    const ownerEvent = {
      ...privateEvent,
      ownerUserId: 'user-id',
      collaborators: [],
    };
    window.history.replaceState({}, '', '/tools/catch-events?view=host&tab=manage&event=private-event');
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { id: 'user-id', email: 'trainer@example.com', ign: 'Trainer' },
          }),
        };
      }

      if (url.endsWith('/catch-events?owner=me')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [ownerEvent] }),
        };
      }

      if (url.endsWith('/catch-events/private-event/collaborators') && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [{ userId: 'cohost-1', email: 'cohost@example.com', ign: 'CoHost', role: 'co-host' }],
          }),
        };
      }

      if (url.endsWith('/catch-events/private-event')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: ownerEvent }),
        };
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    render(<CatchEventManager apiBaseUrl="http://localhost:3001/api" initialView="admin" />);

    const collaboratorInput = await screen.findByPlaceholderText('trainer@example.com or TrainerIGN');

    fireEvent.change(collaboratorInput, {
      target: { value: 'CoHost' },
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add shared admin' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add shared admin' }));

    await waitFor(() => {
      expect(screen.getByText('CoHost')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/catch-events/private-event/collaborators',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ identifier: 'CoHost' }),
      })
    );
  });

  it('prefills neutral target Pokemon when editing an owner event', async () => {
    window.history.replaceState({}, '', '/tools/catch-events?view=host&tab=manage&event=private-event');
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { id: 'user-id', email: 'trainer@example.com', ign: 'Trainer' },
          }),
        };
      }

      if (url.endsWith('/catch-events?owner=me')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [ownerNeutralEvent] }),
        };
      }

      if (url.endsWith('/catch-events/private-event')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: ownerNeutralEvent }),
        };
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    render(<CatchEventManager apiBaseUrl="http://localhost:3001/api" initialView="admin" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit event' }));

    await screen.findByRole('heading', { name: 'Edit Event' });
    expect(screen.getByLabelText('Pokemon species')).toHaveValue('Tropius');
    expect(screen.getByLabelText('Points')).toHaveValue('0');
  });

  it('saves edits with PUT instead of creating a duplicate event', async () => {
    window.history.replaceState({}, '', '/tools/catch-events?view=host&tab=manage&event=private-event');
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { id: 'user-id', email: 'trainer@example.com', ign: 'Trainer' },
          }),
        };
      }

      if (url.endsWith('/catch-events?owner=me')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [ownerNeutralEvent] }),
        };
      }

      if (url.endsWith('/catch-events/private-event') && init?.method === 'PUT') {
        return {
          ok: true,
          json: async () => ({ success: true, data: ownerNeutralEvent }),
        };
      }

      if (url.endsWith('/catch-events/private-event')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: ownerNeutralEvent }),
        };
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    render(<CatchEventManager apiBaseUrl="http://localhost:3001/api" initialView="admin" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit event' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Update event' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3001/api/catch-events/private-event',
        expect.objectContaining({ method: 'PUT' })
      );
    });
    expect(
      fetchMock.mock.calls.some(([url, init]) => String(url).endsWith('/catch-events') && init?.method === 'POST')
    ).toBe(false);
  });

  it('resets Create Event after leaving an edit with no cached draft', async () => {
    window.history.replaceState({}, '', '/tools/catch-events?view=host&tab=manage&event=private-event');
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { id: 'user-id', email: 'trainer@example.com', ign: 'Trainer' },
          }),
        };
      }

      if (url.endsWith('/catch-events?owner=me')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [ownerNeutralEvent] }),
        };
      }

      if (url.endsWith('/catch-events/private-event')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: ownerNeutralEvent }),
        };
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    render(<CatchEventManager apiBaseUrl="http://localhost:3001/api" initialView="admin" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit event' }));
    await screen.findByRole('heading', { name: 'Edit Event' });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('heading', { name: 'Create Event' })).toBeInTheDocument();
    expect(screen.getByLabelText('Event name')).toHaveValue('');
    expect(screen.getByLabelText('Region')).toHaveValue('');
    expect(screen.getByLabelText('Pokemon species')).toHaveValue('');
  });

  it('restores an in-page Create Event draft after editing another event', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/me')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { id: 'user-id', email: 'trainer@example.com', ign: 'Trainer' },
          }),
        };
      }

      if (url.endsWith('/catch-events?owner=me')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [ownerNeutralEvent] }),
        };
      }

      if (url.endsWith('/catch-events/private-event')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: ownerNeutralEvent }),
        };
      }

      if (url.endsWith('/catch-events')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        };
      }

      throw new Error(`Unexpected fetch ${url}`);
    });

    render(<CatchEventManager apiBaseUrl="http://localhost:3001/api" initialView="create" />);

    const eventNameInput = await screen.findByLabelText('Event name');
    fireEvent.change(eventNameInput, { target: { value: 'Draft Catch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit event' }));
    await screen.findByRole('heading', { name: 'Edit Event' });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByRole('heading', { name: 'Create Event' })).toBeInTheDocument();
    expect(screen.getByLabelText('Event name')).toHaveValue('Draft Catch');
  });
});
