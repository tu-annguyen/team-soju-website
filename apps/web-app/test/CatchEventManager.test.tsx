import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
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
});
