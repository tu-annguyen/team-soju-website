import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FeebasTileChecker from '../src/components/feebas-tile-checker/FeebasTileChecker';

const ACTIVE_LOCATION_STORAGE_KEY = 'feebas-tile-checker-active-location';
const DISPLAY_MODE_HOTKEY_STORAGE_KEY = 'feebas-tile-checker-display-mode-hotkey';
const VOTE_OVERLAY_MODE_STORAGE_KEY = 'feebas-tile-checker-vote-overlay-mode';

const boardFixture = {
  location: 'route-119-main',
  displayName: 'Route 119, Hoenn',
  description: 'Main Route 119 pond tiles for live Feebas coordination.',
  cycleStart: '2026-04-09T20:15:00.000Z',
  cycleEnd: '2099-04-09T21:00:00.000Z',
  serverTime: '2026-04-09T20:20:00.000Z',
  resetIntervalMinutes: 45,
  requiresDistinctConfirmation: false,
  confirmedTileId: null,
  isLocked: false,
  previousConfirmedTiles: [
    {
      tileId: 'r1c1',
      confirmations: 1,
    },
    {
      tileId: 'r1c2',
      confirmations: 5,
    },
  ],
  layout: {
    rows: 2,
    cols: 2,
  },
  activity: [
    {
      id: 1,
      tileId: 'r1c1',
      tileLabel: 'A1',
      actionType: 'voted',
      previousStatus: 'checked',
      nextStatus: 'pending',
      actorName: 'May',
      createdAt: '2026-04-09T20:18:00.000Z',
    },
  ],
  leaderboard: {
    location: 'route-119-main',
    generatedAt: '2026-04-09T20:20:00.000Z',
    weeklySince: '2026-04-02T20:20:00.000Z',
    entries: [
      {
        rank: 1,
        userId: 'user-id',
        ign: 'May',
        verifiedDiscoveries: 2,
        feebasUptimeCreatedMinutes: 180,
        confirmations: 4,
        searchCoverage: 30,
        weeklyContributionScore: 212,
        allTimeContributionScore: 363,
        fastestFindSeconds: 90,
        earlyScoutSeconds: 30,
        efficiency: 0.067,
        reportAccuracy: 0.8,
        currentStreak: 3,
        mostPersistentChecks: 17,
      },
      {
        rank: 2,
        userId: 'user-id-2',
        ign: 'Brendan',
        verifiedDiscoveries: 1,
        feebasUptimeCreatedMinutes: 60,
        confirmations: 10,
        searchCoverage: 8,
        weeklyContributionScore: 64,
        allTimeContributionScore: 226,
        fastestFindSeconds: 120,
        earlyScoutSeconds: 75,
        efficiency: 0.125,
        reportAccuracy: 1,
        currentStreak: 1,
        mostPersistentChecks: 4,
      },
    ],
  },
  tiles: [
    {
      tileId: 'r1c1',
      label: 'A1',
      row: 0,
      col: 0,
      status: 'pending',
      voteCounts: {
        checked: 0,
        pending: 1,
        confirmed: 0,
      },
      totalVotes: 1,
      currentUserVote: 'unchecked',
    },
    {
      tileId: 'r1c2',
      label: 'A2',
      row: 0,
      col: 1,
      status: 'unchecked',
      voteCounts: {
        checked: 0,
        pending: 0,
        confirmed: 0,
      },
      totalVotes: 0,
      currentUserVote: 'unchecked',
    },
  ],
};

const mtCoronetBoardFixture = {
  ...boardFixture,
  location: 'mt-coronet',
  displayName: 'Mt. Coronet, Sinnoh',
  description: 'Mt. Coronet pond tiles for live Feebas coordination.',
  layout: {
    rows: 34,
    cols: 18,
  },
};

const route119UpstreamBoardFixture = {
  ...boardFixture,
  location: 'route-119-upstream',
  displayName: 'Route 119 Upstream, Hoenn',
  description: 'Upstream Route 119 river tiles for live Feebas coordination.',
  leaderboard: {
    ...boardFixture.leaderboard,
    location: 'route-119-upstream',
  },
};

const pendingB2Activity = {
  id: 2,
  tileId: 'r1c2',
  tileLabel: 'B2',
  actionType: 'voted',
  previousStatus: 'unchecked',
  nextStatus: 'pending',
  actorName: 'Brendan',
  createdAt: '2026-04-09T20:19:00.000Z',
};

function buildPendingB2Board(baseBoard: typeof boardFixture = boardFixture) {
  return {
    ...baseBoard,
    activity: [
      pendingB2Activity,
      ...baseBoard.activity,
    ],
    tiles: [
      baseBoard.tiles[0],
      {
        ...baseBoard.tiles[1],
        status: 'pending',
        voteCounts: {
          checked: 0,
          pending: 1,
          confirmed: 0,
        },
        totalVotes: 1,
        currentUserVote: 'unchecked',
      },
    ],
  };
}

function buildPendingB2ActivityDelta(baseBoard: typeof boardFixture = boardFixture, isSelfNomination = false) {
  return {
    success: true,
    type: 'activity_delta',
    data: {
      location: baseBoard.location,
      displayName: baseBoard.displayName,
      cycleStart: baseBoard.cycleStart,
      cycleEnd: baseBoard.cycleEnd,
      serverTime: baseBoard.serverTime,
      isSelfNomination,
      activity: [pendingB2Activity],
    },
  };
}

function buildPendingB2TileDelta(baseBoard: typeof boardFixture = boardFixture, isSelfNomination = false) {
  return {
    success: true,
    type: 'tile_delta',
    data: {
      location: baseBoard.location,
      displayName: baseBoard.displayName,
      cycleStart: baseBoard.cycleStart,
      cycleEnd: baseBoard.cycleEnd,
      serverTime: '2026-04-09T20:19:00.000Z',
      isSelfNomination,
      activity: [pendingB2Activity],
      tiles: [{
        tileId: 'r1c2',
        status: 'pending',
        voteCounts: {
          checked: 0,
          pending: 1,
          confirmed: 0,
        },
        totalVotes: 1,
      }],
    },
  };
}

const authUserFixture = {
  id: 'user-id',
  email: 'trainer@example.com',
  ign: 'Trainer',
};

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  onmessage: ((event: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.onclose?.();
  }

  emit(payload: unknown) {
    if (!this.closed) {
      this.onmessage?.({ data: JSON.stringify(payload) });
    }
  }

  fail() {
    if (!this.closed) {
      this.onerror?.();
    }
  }
}

function findMockWebSocket(path: string) {
  return MockWebSocket.instances.find((socket) => socket.url.includes(path));
}

function findLatestMockWebSocket(path: string) {
  const sockets = MockWebSocket.instances.filter((socket) => socket.url.includes(path));
  return sockets[sockets.length - 1];
}

function findFetchPostCall(fetchMock: jest.Mock, path: string) {
  return fetchMock.mock.calls.find(([input, init]) => (
    String(input).includes(path) && (init as RequestInit | undefined)?.method === 'POST'
  ));
}

function jsonResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFeebasFetch(authUser: typeof authUserFixture | null = null) {
  return jest.fn((input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes('/auth/me')) {
      return jsonResponse({
        success: true,
        data: authUser,
      });
    }

    if (url.includes('/feebas/route-119-upstream')) {
      return jsonResponse({
        success: true,
        data: route119UpstreamBoardFixture,
      });
    }

    if (url.includes('/feebas/mt-coronet')) {
      return jsonResponse({
        success: true,
        data: mtCoronetBoardFixture,
      });
    }

    return jsonResponse({
      success: true,
      data: boardFixture,
    });
  });
}

describe('FeebasTileChecker', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('feebas-tile-checker-client-id', 'client-self');
    MockWebSocket.instances = [];
    (global as any).WebSocket = undefined;

    (global as any).fetch = mockFeebasFetch();
  });

  it('renders the live board after loading', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    expect(screen.getByText(/Loading the Feebas board/i)).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText(/Route 119, Hoenn/i)).toBeInTheDocument()
    );

    expect(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 0 confirmed/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /B2 0 checked, 0 pending, 0 confirmed/i })).toBeInTheDocument();
    expect(screen.getByText(/Each browser can keep one active vote per tile/i)).toBeInTheDocument();
    expect(screen.getByText(/Scroll sideways to view the full board/i)).toBeInTheDocument();
    expect(screen.getByText('Shortcut: H')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Pattern overlays/i })).not.toBeChecked();
    expect(screen.getByText(/Mixed colors mean mixed opinions/i)).toBeInTheDocument();
    expect(localStorage.getItem(VOTE_OVERLAY_MODE_STORAGE_KEY)).toBeNull();
    expect(screen.getAllByText('May').length).toBeGreaterThan(0);
    expect(
      screen.getByText((_, element) => element?.textContent === 'May found Feebas on A1.')
    ).toBeInTheDocument();
  });

  it('toggles the board display mode with the default hotkey', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 0 confirmed/i })).toBeInTheDocument()
    );

    expect(screen.queryByText(/Historical confirmed Feebas tiles glow brighter/i)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'h' });

    expect(screen.getByText(/Historical confirmed Feebas tiles glow brighter/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'h' });

    expect(screen.queryByText(/Historical confirmed Feebas tiles glow brighter/i)).not.toBeInTheDocument();
  });

  it('does not toggle the board display mode while typing in an editable field', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 0 confirmed/i })).toBeInTheDocument()
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: 'h' });

    expect(screen.queryByText(/Historical confirmed Feebas tiles glow brighter/i)).not.toBeInTheDocument();

    input.remove();
  });

  it('stores a changed display mode hotkey and uses it for toggling', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText('Shortcut: H')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByRole('button', { name: 'Press a key' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'j' });

    expect(localStorage.getItem(DISPLAY_MODE_HOTKEY_STORAGE_KEY)).toBe('j');
    expect(screen.getByText('Shortcut: J')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.queryByText(/Historical confirmed Feebas tiles glow brighter/i)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.getByText(/Historical confirmed Feebas tiles glow brighter/i)).toBeInTheDocument();
  });

  it('resets the display mode hotkey to the default shortcut', async () => {
    localStorage.setItem(DISPLAY_MODE_HOTKEY_STORAGE_KEY, 'j');

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText('Shortcut: J')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(localStorage.getItem(DISPLAY_MODE_HOTKEY_STORAGE_KEY)).toBe('h');
    expect(screen.getByText('Shortcut: H')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'j' });
    expect(screen.queryByText(/Historical confirmed Feebas tiles glow brighter/i)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'h' });
    expect(screen.getByText(/Historical confirmed Feebas tiles glow brighter/i)).toBeInTheDocument();
  });

  it('retries the reset refresh when the first boundary fetch still returns the expired cycle', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-09T20:59:59.000Z'));

    const expiredBoard = {
      ...boardFixture,
      cycleEnd: '2026-04-09T21:00:00.000Z',
    };
    const resetBoard = {
      ...boardFixture,
      cycleStart: '2026-04-09T21:00:00.000Z',
      cycleEnd: '2026-04-09T21:45:00.000Z',
      activity: [],
      tiles: boardFixture.tiles.map((tile) => ({
        ...tile,
        status: 'unchecked',
        voteCounts: {
          checked: 0,
          pending: 0,
          confirmed: 0,
        },
        totalVotes: 0,
        currentUserVote: 'unchecked',
      })),
    };
    let boardRequestCount = 0;
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/auth/me')) {
        return jsonResponse({
          success: true,
          data: null,
        });
      }

      if (url.includes('/feebas/route-119-upstream')) {
        return jsonResponse({
          success: true,
          data: route119UpstreamBoardFixture,
        });
      }

      const isBoardRequest = url.includes('/public') || (
        url.includes('/feebas/route-119-main') && !url.includes('/votes') && !url.includes('/leaderboard')
      );
      if (isBoardRequest) {
        boardRequestCount += 1;
      }

      return jsonResponse({
        success: true,
        data: boardRequestCount < 3 ? expiredBoard : resetBoard,
      });
    });

    (global as any).fetch = fetchMock;

    try {
      render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 0 confirmed/i })).toBeInTheDocument()
      );
      expect(screen.getByText('00:01')).toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => expect(boardRequestCount).toBe(2));
      expect(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 0 confirmed/i })).toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /A2 0 checked, 0 pending, 0 confirmed/i })).toBeInTheDocument()
      );
      expect(boardRequestCount).toBe(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows leaderboard sign-in links when signed out', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /Sign in to track leaderboard statistics/i })).toHaveLength(2)
    );

    expect(screen.queryByLabelText(/Temporary display name/i)).not.toBeInTheDocument();
    const signInLinks = screen.getAllByRole('link', { name: /Sign in to track leaderboard statistics/i });
    expect(signInLinks).toHaveLength(2);
    expect(signInLinks.every((link) => link.getAttribute('href') === '/auth')).toBe(true);
  });

  it('renders the Feebas leaderboard metrics and tracked records', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText('All-time')).toBeInTheDocument()
    );

    expect(screen.getByText(/Feebas Leaderboard/i)).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();
    expect(screen.getByText('363')).toBeInTheDocument();
    expect(screen.getByText('3h')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText(/May in 1m 30s/i)).toBeInTheDocument();
    expect(screen.getByText(/May with 3 cycle\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/May after 17 tile\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Current position after applying the selected leaderboard sort/i)).toBeInTheDocument();
    expect(screen.getByText(/Score from the last 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified pending reports divided by pending reports that were later resolved/i)).toBeInTheDocument();
  });

  it('paginates the activity log at five entries per page', async () => {
    const boardWithActivity = {
      ...boardFixture,
      activity: Array.from({ length: 7 }, (_, index) => ({
        id: index + 1,
        tileId: `r${index + 1}c1`,
        tileLabel: `A${index + 1}`,
        actionType: 'voted',
        previousStatus: 'unchecked',
        nextStatus: 'checked',
        actorName: `Hunter ${index + 1}`,
        createdAt: `2026-04-09T20:${String(10 + index).padStart(2, '0')}:00.000Z`,
      })),
    };
    (global as any).fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/auth/me')) {
        return jsonResponse({
          success: true,
          data: null,
        });
      }

      return jsonResponse({
        success: true,
        data: boardWithActivity,
      });
    });

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText('Hunter 1')).toBeInTheDocument()
    );

    expect(screen.getByText('Hunter 5')).toBeInTheDocument();
    expect(screen.queryByText('Hunter 6')).not.toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Next/i }));

    expect(screen.getByText('Hunter 6')).toBeInTheDocument();
    expect(screen.getByText('Hunter 7')).toBeInTheDocument();
    expect(screen.queryByText('Hunter 1')).not.toBeInTheDocument();
    expect(screen.getByText(/Page 2 of 2/i)).toBeInTheDocument();
  });

  it('sorts the Feebas leaderboard columns with the expected sort icons', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    const trainerSortButton = await screen.findByRole('button', { name: /Trainer/i });

    expect(trainerSortButton.querySelector('svg')).toHaveAttribute('data-sort-icon', 'sort');

    fireEvent.click(trainerSortButton);

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent(/#1\s*Brendan/);
    });
    expect(trainerSortButton.querySelector('svg')).toHaveAttribute('data-sort-icon', 'sort-up');

    fireEvent.click(trainerSortButton);

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent(/#1\s*May/);
    });
    expect(trainerSortButton.querySelector('svg')).toHaveAttribute('data-sort-icon', 'sort-down');
  });

  it('highlights the signed-in user when they are in the top ten', async () => {
    (global as any).fetch = mockFeebasFetch({
      ...authUserFixture,
      ign: 'May',
    });

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    const rows = await screen.findAllByRole('row');
    const mayRow = rows.find((row) => row.textContent?.includes('May'));

    expect(mayRow).toHaveClass('bg-primary-50');
  });

  it('pins the signed-in user to the last leaderboard row when they rank outside the top ten', async () => {
    const topTenEntries = Array.from({ length: 10 }, (_, index) => ({
      ...boardFixture.leaderboard.entries[1],
      rank: index + 1,
      userId: `top-user-${index + 1}`,
      ign: `Top ${index + 1}`,
      allTimeContributionScore: 500 - index,
      weeklyContributionScore: 100 - index,
    }));
    const boardWithCurrentUserOutsideTopTen = {
      ...boardFixture,
      leaderboard: {
        ...boardFixture.leaderboard,
        entries: [
          ...topTenEntries,
          {
            ...boardFixture.leaderboard.entries[0],
            rank: 26,
            userId: authUserFixture.id,
            ign: authUserFixture.ign,
            allTimeContributionScore: 25,
            weeklyContributionScore: 12,
          },
        ],
      },
    };

    (global as any).fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/auth/me')) {
        return jsonResponse({
          success: true,
          data: authUserFixture,
        });
      }

      return jsonResponse({
        success: true,
        data: boardWithCurrentUserOutsideTopTen,
      });
    });

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getAllByRole('row').some((row) => row.textContent?.includes(authUserFixture.ign))).toBe(true)
    );

    fireEvent.click(screen.getByRole('button', { name: /Trainer/i }));

    const rows = screen.getAllByRole('row');
    const lastRow = rows[rows.length - 1];
    expect(lastRow).toHaveTextContent(/#26\s*Trainer/);
    expect(lastRow).toHaveClass('bg-primary-50');
  });

  it('keeps leaderboard header tooltips inside the viewport near an edge', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    const trainerSortButton = await screen.findByRole('button', { name: /Trainer/i });
    const tooltipTrigger = trainerSortButton.parentElement as HTMLElement;
    const originalInnerWidth = window.innerWidth;

    tooltipTrigger.getBoundingClientRect = jest.fn(() => ({
      bottom: 44,
      height: 20,
      left: 2,
      right: 70,
      top: 24,
      width: 68,
      x: 2,
      y: 24,
      toJSON: () => ({}),
    }));
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 320,
    });

    fireEvent.mouseEnter(tooltipTrigger);

    await waitFor(() => {
      const tooltip = screen.getByText(/Signed-in account IGN/i).parentElement;
      expect(tooltip).toHaveStyle({
        left: '8px',
        top: '52px',
        width: '288px',
      });
    });

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('uses the signed-in user IGN as the Feebas display name', async () => {
    const fetchMock = mockFeebasFetch(authUserFixture);
    (global as any).fetch = fetchMock;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText(/Currently signed in as Trainer/i)).toBeInTheDocument()
    );

    expect(screen.queryByLabelText(/Optional display name/i)).not.toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: /B2 0 checked, 0 pending, 0 confirmed/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3001/api/feebas/route-119-main/tiles/r1c2',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({
            status: 'checked',
            actorFingerprint: 'account-user-id',
            actorName: 'Trainer',
          }),
        }),
      )
    );
  });

  it('allows a second client to confirm a pending tile', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 0 confirmed/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 0 confirmed/i }));

    expect(screen.getByText(/Your vote: Unchecked/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Feebas Confirmed/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Feebas Found/i })).toBeDisabled();
  });

  it('shows a location-specific popup when another session adds a pending nomination', async () => {
    jest.useFakeTimers();
    (global as any).WebSocket = MockWebSocket;

    try {
      render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

      await waitFor(() =>
        expect(screen.getByText(/Route 119, Hoenn/i)).toBeInTheDocument()
      );

      expect(screen.queryByText('Pending nomination')).not.toBeInTheDocument();

      await waitFor(() =>
        expect(findMockWebSocket('/feebas/route-119-main/stream')).toBeTruthy()
      );

      act(() => {
        findMockWebSocket('/feebas/route-119-main/stream')?.emit(buildPendingB2ActivityDelta());
      });

      expect(screen.getByText('Pending nomination')).toBeInTheDocument();
      expect(screen.getByText(/Brendan nominated B2 at Route 119, Hoenn/i)).toBeInTheDocument();
      expect(screen.getByText((_, element) => element?.textContent === 'Brendan found Feebas on B2.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /B2 0 checked, 0 pending, 0 confirmed/i })).toBeInTheDocument();

      act(() => {
        findMockWebSocket('/feebas/route-119-main/stream')?.emit({
          success: true,
          data: buildPendingB2Board(),
        });
      });

      expect(screen.getByRole('button', { name: /B2 0 checked, 1 pending, 0 confirmed/i })).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(screen.getByText('Pending nomination')).toBeInTheDocument();

      act(() => {
        findMockWebSocket('/feebas/route-119-main/stream')?.emit({
          success: true,
          data: {
            ...boardFixture,
            cycleStart: '2026-04-09T21:00:00.000Z',
            cycleEnd: '2099-04-09T21:45:00.000Z',
            activity: [],
            tiles: boardFixture.tiles.map((tile) => ({
              ...tile,
              status: 'unchecked',
              voteCounts: {
                checked: 0,
                pending: 0,
                confirmed: 0,
              },
              totalVotes: 0,
              currentUserVote: 'unchecked',
            })),
          },
        });
      });

      expect(screen.queryByText('Pending nomination')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows Route 119 upstream pending nomination popups while viewing the pond', async () => {
    (global as any).WebSocket = MockWebSocket;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText(/Route 119, Hoenn/i)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(findMockWebSocket('/feebas/route-119-upstream/stream')).toBeTruthy()
    );

    act(() => {
      findMockWebSocket('/feebas/route-119-upstream/stream')?.emit({
        success: true,
        data: route119UpstreamBoardFixture,
      });
    });

    expect(screen.queryByText('Pending nomination')).not.toBeInTheDocument();

    act(() => {
      findMockWebSocket('/feebas/route-119-upstream/stream')?.emit(
        buildPendingB2ActivityDelta(route119UpstreamBoardFixture)
      );
    });

    expect(screen.getByText('Pending nomination')).toBeInTheDocument();
    expect(screen.getByText(/Brendan nominated B2 at Route 119, Hoenn \(Upstream\)/i)).toBeInTheDocument();

    act(() => {
      findMockWebSocket('/feebas/route-119-upstream/stream')?.emit({
        success: true,
        data: buildPendingB2Board(route119UpstreamBoardFixture),
      });
    });
  });

  it('keeps newer live tile updates when a stale same-cycle board refresh arrives', async () => {
    (global as any).WebSocket = MockWebSocket;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(findMockWebSocket('/feebas/route-119-main/stream')).toBeTruthy()
    );

    act(() => {
      findMockWebSocket('/feebas/route-119-main/stream')?.emit(buildPendingB2TileDelta());
    });

    expect(screen.getByRole('button', { name: /B2 0 checked, 1 pending, 0 confirmed/i })).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Brendan found Feebas on B2.')).toBeInTheDocument();

    act(() => {
      findMockWebSocket('/feebas/route-119-main/stream')?.emit({
        success: true,
        data: boardFixture,
      });
    });

    expect(screen.getByRole('button', { name: /B2 0 checked, 1 pending, 0 confirmed/i })).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Brendan found Feebas on B2.')).toBeInTheDocument();
  });

  it('shows Route 119 pond pending nomination popups while viewing upstream', async () => {
    (global as any).WebSocket = MockWebSocket;
    localStorage.setItem(ACTIVE_LOCATION_STORAGE_KEY, 'route-119-upstream');

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /^Upstream$/i })).toHaveAttribute('aria-selected', 'true')
    );
    await waitFor(() =>
      expect(findMockWebSocket('/feebas/route-119-main/stream')).toBeTruthy()
    );

    act(() => {
      findMockWebSocket('/feebas/route-119-main/stream')?.emit({
        success: true,
        data: boardFixture,
      });
    });

    expect(screen.queryByText('Pending nomination')).not.toBeInTheDocument();

    act(() => {
      findMockWebSocket('/feebas/route-119-main/stream')?.emit(buildPendingB2ActivityDelta());
    });

    expect(screen.getByText('Pending nomination')).toBeInTheDocument();
    expect(screen.getByText(/Brendan nominated B2 at Route 119, Hoenn \(Pond\)/i)).toBeInTheDocument();

    act(() => {
      findMockWebSocket('/feebas/route-119-main/stream')?.emit({
        success: true,
        data: buildPendingB2Board(),
      });
    });
  });

  it('does not show Route 119 pending nomination popups while viewing Mt. Coronet', async () => {
    (global as any).WebSocket = MockWebSocket;

    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const data = url.includes('/mt-coronet') ? mtCoronetBoardFixture : boardFixture;

      return jsonResponse({
        success: true,
        data,
      });
    });

    (global as any).fetch = fetchMock;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText(/Route 119, Hoenn/i)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(findMockWebSocket('/feebas/route-119-main/stream')).toBeTruthy()
    );

    const route119Stream = findMockWebSocket('/feebas/route-119-main/stream')!;
    fireEvent.click(screen.getByRole('tab', { name: /Mt. Coronet/i }));

    await waitFor(() =>
      expect(screen.getByText(/Mt. Coronet, Sinnoh/i)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(findMockWebSocket('/feebas/mt-coronet/stream')).toBeTruthy()
    );

    act(() => {
      route119Stream.emit({
        success: true,
        data: {
          ...boardFixture,
          activity: [
            {
              id: 2,
              tileId: 'r1c2',
              tileLabel: 'B2',
              actionType: 'voted',
              previousStatus: 'unchecked',
              nextStatus: 'pending',
              actorName: 'Brendan',
              createdAt: '2026-04-09T20:19:00.000Z',
            },
            ...boardFixture.activity,
          ],
        },
      });
    });

    expect(route119Stream.closed).toBe(true);
    expect(screen.queryByText(/Brendan nominated B2 at Route 119, Hoenn/i)).not.toBeInTheDocument();
  });

  it('stops reconnecting after repeated live update stream failures', async () => {
    jest.useFakeTimers();
    (global as any).WebSocket = MockWebSocket;

    try {
      render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

      await waitFor(() =>
        expect(findMockWebSocket('/feebas/route-119-main/stream')).toBeTruthy()
      );

      for (let attempt = 0; attempt < 4; attempt += 1) {
        act(() => {
          findLatestMockWebSocket('/feebas/route-119-main/stream')?.fail();
        });

        if (attempt < 3) {
          act(() => {
            jest.advanceTimersByTime(5000 * (2 ** attempt));
          });
          await waitFor(() =>
            expect(MockWebSocket.instances.filter((socket) => socket.url.includes('/feebas/route-119-main/stream'))).toHaveLength(attempt + 2)
          );
        }
      }

      act(() => {
        jest.advanceTimersByTime(60000);
      });

      expect(MockWebSocket.instances.filter((socket) => socket.url.includes('/feebas/route-119-main/stream'))).toHaveLength(4);
    } finally {
      jest.useRealTimers();
    }
  });

  it('sends the latest activity cursor when reconnecting live updates', async () => {
    jest.useFakeTimers();
    (global as any).WebSocket = MockWebSocket;

    try {
      render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

      await waitFor(() =>
        expect(findMockWebSocket('/feebas/route-119-main/stream')).toBeTruthy()
      );

      const firstSocket = findLatestMockWebSocket('/feebas/route-119-main/stream')!;
      expect(new URL(firstSocket.url).searchParams.get('lastActivityId')).toBeNull();

      act(() => {
        firstSocket.emit({
          success: true,
          data: boardFixture,
        });
        firstSocket.fail();
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() =>
        expect(MockWebSocket.instances.filter((socket) => socket.url.includes('/feebas/route-119-main/stream'))).toHaveLength(2)
      );
      expect(new URL(findLatestMockWebSocket('/feebas/route-119-main/stream')!.url).searchParams.get('lastActivityId')).toBe('1');

      act(() => {
        findLatestMockWebSocket('/feebas/route-119-main/stream')?.emit(buildPendingB2ActivityDelta());
        findLatestMockWebSocket('/feebas/route-119-main/stream')?.fail();
        jest.advanceTimersByTime(5000);
      });

      await waitFor(() =>
        expect(MockWebSocket.instances.filter((socket) => socket.url.includes('/feebas/route-119-main/stream'))).toHaveLength(3)
      );
      expect(new URL(findLatestMockWebSocket('/feebas/route-119-main/stream')!.url).searchParams.get('lastActivityId')).toBe('2');
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows the self notification after this session sends a pending nomination', async () => {
    jest.useFakeTimers();
    const boardWithCurrentUserVote = {
      ...boardFixture,
      activity: [],
      tiles: [
        boardFixture.tiles[0],
        {
          ...boardFixture.tiles[1],
          status: 'checked',
          voteCounts: {
            checked: 1,
            pending: 0,
            confirmed: 0,
          },
          totalVotes: 1,
          currentUserVote: 'checked',
        },
      ],
    };
    const boardAfterPendingVote = {
      ...boardWithCurrentUserVote,
      activity: [
        {
          id: 2,
          tileId: 'r1c2',
          tileLabel: 'B2',
          actionType: 'changed_vote',
          previousStatus: 'checked',
          nextStatus: 'pending',
          actorName: null,
          createdAt: '2026-04-09T20:19:00.000Z',
        },
      ],
      tiles: [
        boardFixture.tiles[0],
        {
          ...boardFixture.tiles[1],
          status: 'pending',
          voteCounts: {
            checked: 0,
            pending: 1,
            confirmed: 0,
          },
          totalVotes: 1,
          currentUserVote: 'pending',
        },
      ],
    };
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/auth/me')) {
        return jsonResponse({
          success: true,
          data: null,
        });
      }

      if (init?.method === 'POST') {
        return jsonResponse({
          success: true,
          data: boardAfterPendingVote,
        });
      }

      return jsonResponse({
        success: true,
        data: boardWithCurrentUserVote,
      });
    });

    (global as any).fetch = fetchMock;

    try {
      render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /B2 1 checked, 0 pending, 0 confirmed/i })).toBeInTheDocument()
      );

      fireEvent.click(screen.getByRole('button', { name: /B2 1 checked, 0 pending, 0 confirmed/i }));
      fireEvent.click(screen.getByRole('button', { name: /Feebas Found/i }));

      await waitFor(() =>
        expect(screen.getByText(/Nomination sent/i)).toBeInTheDocument()
      );
      expect(screen.getByText(/Your nomination for B2 at Route 119, Hoenn \(Pond\) has notified everyone here/i)).toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(6000);
      });

      expect(screen.queryByText(/Nomination sent/i)).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it('casts a checked vote when a tile is clicked', async () => {
    const checkedBoard = {
      ...boardFixture,
      tiles: [
        boardFixture.tiles[0],
        {
          ...boardFixture.tiles[1],
          status: 'checked',
          voteCounts: {
            checked: 1,
            pending: 0,
            confirmed: 0,
          },
          totalVotes: 1,
          currentUserVote: 'checked',
        },
      ],
    };
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/auth/me')) {
        return jsonResponse({
          success: true,
          data: null,
        });
      }

      if (init?.method === 'POST') {
        return jsonResponse({
          success: true,
          data: checkedBoard,
        });
      }

      return jsonResponse({
        success: true,
        data: url.includes('/route-119-upstream') ? route119UpstreamBoardFixture : boardFixture,
      });
    });

    (global as any).fetch = fetchMock;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /B2 0 checked, 0 pending, 0 confirmed/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /B2 0 checked, 0 pending, 0 confirmed/i }));

    await waitFor(() =>
      expect(screen.getByText(/Your vote: Checked/i)).toBeInTheDocument()
    );

    expect(findFetchPostCall(fetchMock, '/feebas/route-119-main/tiles/r1c2')).toEqual([
      'http://localhost:3001/api/feebas/route-119-main/tiles/r1c2',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          status: 'checked',
          actorFingerprint: 'client-self',
          actorName: undefined,
        }),
      }),
    ]);
  });

  it('casts a checked vote when another player already voted checked', async () => {
    const boardWithOtherCheckedVote = {
      ...boardFixture,
      tiles: [
        boardFixture.tiles[0],
        {
          ...boardFixture.tiles[1],
          status: 'checked',
          voteCounts: {
            checked: 1,
            pending: 0,
            confirmed: 0,
          },
          totalVotes: 1,
          currentUserVote: 'unchecked',
        },
      ],
    };

    const boardAfterCheckedVote = {
      ...boardFixture,
      tiles: [
        boardFixture.tiles[0],
        {
          ...boardFixture.tiles[1],
          status: 'checked',
          voteCounts: {
            checked: 2,
            pending: 0,
            confirmed: 0,
          },
          totalVotes: 2,
          currentUserVote: 'checked',
        },
      ],
    };
    const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/auth/me')) {
        return jsonResponse({
          success: true,
          data: null,
        });
      }

      if (init?.method === 'POST') {
        return jsonResponse({
          success: true,
          data: boardAfterCheckedVote,
        });
      }

      return jsonResponse({
        success: true,
        data: url.includes('/route-119-upstream') ? route119UpstreamBoardFixture : boardWithOtherCheckedVote,
      });
    });

    (global as any).fetch = fetchMock;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /B2 1 checked, 0 pending, 0 confirmed/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /B2 1 checked, 0 pending, 0 confirmed/i }));

    await waitFor(() =>
      expect(screen.getByText(/Your vote: Checked/i)).toBeInTheDocument()
    );

    expect(findFetchPostCall(fetchMock, '/feebas/route-119-main/tiles/r1c2')).toEqual([
      'http://localhost:3001/api/feebas/route-119-main/tiles/r1c2',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          status: 'checked',
          actorFingerprint: 'client-self',
          actorName: undefined,
        }),
      }),
    ]);
  });

  it('does not overwrite an existing vote to checked when selecting a tile', async () => {
    const votedBoard = {
      ...boardFixture,
      tiles: [
        {
          ...boardFixture.tiles[0],
          status: 'confirmed',
          voteCounts: {
            checked: 0,
            pending: 1,
            confirmed: 1,
          },
          totalVotes: 2,
          currentUserVote: 'confirmed',
        },
        boardFixture.tiles[1],
      ],
    };

    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: votedBoard,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: votedBoard,
        }),
      });

    (global as any).fetch = fetchMock;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 1 confirmed/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 1 confirmed/i }));

    expect(screen.getByText(/Your vote: Feebas Confirmed/i)).toBeInTheDocument();
    expect(findFetchPostCall(fetchMock, '/feebas/route-119-main/tiles/r1c1')).toBeUndefined();
  });

  it('does not let the pending voter confirm the same tile, but still lets them clear it', async () => {
    const pendingOwnerBoard = {
      ...boardFixture,
      tiles: [
        {
          ...boardFixture.tiles[0],
          currentUserVote: 'pending',
        },
        boardFixture.tiles[1],
      ],
    };

    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: pendingOwnerBoard,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: pendingOwnerBoard,
        }),
      });

    (global as any).fetch = fetchMock;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 0 confirmed/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 0 confirmed/i }));

    expect(screen.getByText(/Your vote: Feebas Found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Feebas Confirmed/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Clear My Vote/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /No Feebas/i })).toBeEnabled();
    expect(screen.getByText(/another player can confirm it, or you can clear your pending mark/i)).toBeInTheDocument();
    expect(findFetchPostCall(fetchMock, '/feebas/route-119-main/tiles/r1c1')).toBeUndefined();
  });

  it('lets a user clear their vote after selecting a tile', async () => {
    (global as any).fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            ...boardFixture,
            tiles: [
              {
                ...boardFixture.tiles[0],
                status: 'confirmed',
                voteCounts: {
                  checked: 0,
                  pending: 1,
                  confirmed: 1,
                },
                totalVotes: 2,
                currentUserVote: 'confirmed',
              },
              boardFixture.tiles[1],
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            ...boardFixture,
            tiles: [
              {
                ...boardFixture.tiles[0],
                status: 'confirmed',
                voteCounts: {
                  checked: 0,
                  pending: 1,
                  confirmed: 1,
                },
                totalVotes: 2,
                currentUserVote: 'confirmed',
              },
              boardFixture.tiles[1],
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            ...boardFixture,
            tiles: [
              {
                ...boardFixture.tiles[0],
                status: 'checked',
                voteCounts: {
                  checked: 1,
                  pending: 1,
                  confirmed: 0,
                },
                totalVotes: 2,
                currentUserVote: 'checked',
              },
              boardFixture.tiles[1],
            ],
          },
        }),
      });

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 1 confirmed/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 1 confirmed/i }));

    expect(screen.getByText(/Your vote: Feebas Confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear My Vote/i })).toBeEnabled();
    expect(screen.getByText(/Mixed colors mean mixed opinions/i)).toBeInTheDocument();
  });

  it('stores the pattern overlay preference when toggled', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText(/Route 119, Hoenn/i)).toBeInTheDocument()
    );

    const patternToggle = screen.getByRole('checkbox', { name: /Pattern overlays/i });

    fireEvent.click(patternToggle);

    expect(patternToggle).toBeChecked();
    expect(localStorage.getItem(VOTE_OVERLAY_MODE_STORAGE_KEY)).toBe('pattern');
    expect(screen.getByText(/Pattern overlays split mixed opinions/i)).toBeInTheDocument();
  });

  it('restores the saved pattern overlay preference', async () => {
    localStorage.setItem(VOTE_OVERLAY_MODE_STORAGE_KEY, 'pattern');

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText(/Route 119, Hoenn/i)).toBeInTheDocument()
    );

    expect(screen.getByRole('checkbox', { name: /Pattern overlays/i })).toBeChecked();
    expect(screen.getByText(/Pattern overlays split mixed opinions/i)).toBeInTheDocument();
  });

  it('renders separate pattern sections for mixed tile votes', async () => {
    localStorage.setItem(VOTE_OVERLAY_MODE_STORAGE_KEY, 'pattern');

    const mixedVoteBoard = {
      ...boardFixture,
      tiles: [
        {
          ...boardFixture.tiles[0],
          status: 'unchecked',
          voteCounts: {
            checked: 0,
            pending: 0,
            confirmed: 0,
          },
          totalVotes: 0,
          currentUserVote: 'unchecked',
        },
        {
          ...boardFixture.tiles[1],
          status: 'confirmed',
          voteCounts: {
            checked: 1,
            pending: 1,
            confirmed: 1,
          },
          totalVotes: 3,
          currentUserVote: 'unchecked',
        },
      ],
    };

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: mixedVoteBoard,
      }),
    });

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /B2 1 checked, 1 pending, 1 confirmed/i })).toBeInTheDocument()
    );

    expect(screen.getByTestId('feebas-pattern-vote-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('feebas-pattern-vote-checked')).toBeInTheDocument();
    expect(screen.getByTestId('feebas-pattern-vote-pending')).toBeInTheDocument();
    expect(screen.getByTestId('feebas-pattern-vote-confirmed')).toBeInTheDocument();
    expect(screen.queryByText('X1')).not.toBeInTheDocument();
    expect(screen.queryByText('?1')).not.toBeInTheDocument();
    expect(screen.queryByText('!1')).not.toBeInTheDocument();
  });

  it('switches to the Mt. Coronet tab and fetches that board', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const data = url.includes('/mt-coronet') ? mtCoronetBoardFixture : boardFixture;

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data,
        }),
      });
    });

    (global as any).fetch = fetchMock;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText(/Route 119, Hoenn/i)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('tab', { name: /Mt. Coronet/i }));

    await waitFor(() =>
      expect(screen.getByText(/Mt. Coronet, Sinnoh/i)).toBeInTheDocument()
    );

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/feebas/mt-coronet/public', {
      credentials: 'include',
    });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/feebas/mt-coronet/votes?actorFingerprint=client-self', {
      credentials: 'include',
    });
    expect(localStorage.getItem(ACTIVE_LOCATION_STORAGE_KEY)).toBe('mt-coronet');
  });

  it('switches between Route 119 pond and upstream from the nested tabs', async () => {
    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const data = url.includes('/route-119-upstream') ? route119UpstreamBoardFixture : boardFixture;

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data,
        }),
      });
    });

    (global as any).fetch = fetchMock;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText(/Route 119, Hoenn/i)).toBeInTheDocument()
    );

    expect(screen.getByRole('tab', { name: /^Route 119$/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Pond$/i })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: /^Upstream$/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/feebas/route-119-upstream?actorFingerprint=client-self', {
        credentials: 'include',
      })
    );

    await waitFor(() =>
      expect(screen.getByText(/Route 119, Hoenn/i)).toBeInTheDocument()
    );
    expect(screen.getByRole('tab', { name: /^Route 119$/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /^Upstream$/i })).toHaveAttribute('aria-selected', 'true');
    expect(localStorage.getItem(ACTIVE_LOCATION_STORAGE_KEY)).toBe('route-119-upstream');
  });

  it('restores the saved Feebas location tab on load', async () => {
    localStorage.setItem(ACTIVE_LOCATION_STORAGE_KEY, 'mt-coronet');

    const fetchMock = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const data = url.includes('/mt-coronet') ? mtCoronetBoardFixture : boardFixture;

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data,
        }),
      });
    });

    (global as any).fetch = fetchMock;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText(/Mt. Coronet, Sinnoh/i)).toBeInTheDocument()
    );

    expect(screen.getByRole('tab', { name: /Mt. Coronet/i })).toHaveAttribute('aria-selected', 'true');
    const feebasCalls = fetchMock.mock.calls.filter(([input]) => String(input).includes('/feebas/'));
    expect(feebasCalls.every(([input]) => String(input).includes('/mt-coronet'))).toBe(true);
  });

  it('toggles the grid between voting and historical heatmap modes', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText(/Route 119, Hoenn/i)).toBeInTheDocument()
    );

    expect(screen.getByText(/Unchecked/i)).toBeInTheDocument();
    expect(screen.queryByText(/Historical confirmed Feebas tiles glow brighter/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Heatmap/i }));

    expect(screen.getByText(/Low history/i)).toBeInTheDocument();
    expect(screen.getByText(/High history/i)).toBeInTheDocument();
    expect(screen.getByText(/Historical confirmed Feebas tiles glow brighter as more past confirmations stack up/i)).toBeInTheDocument();
    expect(screen.queryByText(/Unchecked/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Pattern overlays/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Voting/i }));

    expect(screen.getByText(/Unchecked/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Pattern overlays/i })).toBeInTheDocument();
  });

  it('disables voting interactions in heatmap mode', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: boardFixture,
      }),
    });

    (global as any).fetch = fetchMock;

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByText(/Route 119, Hoenn/i)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /Heatmap/i }));

    const tileButton = screen.getByRole('button', { name: /B2 0 checked, 0 pending, 0 confirmed/i });
    expect(tileButton).toBeDisabled();

    fireEvent.click(tileButton);

    expect(findFetchPostCall(fetchMock, '/feebas/route-119-main/tiles/r1c2')).toBeUndefined();
    expect(screen.getByText(/Select a tile to cast your vote or clear it/i)).toBeInTheDocument();
  });

  it('renders Simplified Chinese checker copy and localized location names', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" locale="zh" />);

    expect(screen.getByText(/正在加载丑丑鱼棋盘/i)).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText(/119 号道路，豐緣/i)).toBeInTheDocument()
    );

    expect(screen.getByRole('tab', { name: /天冠山/i })).toBeInTheDocument();
    expect(screen.getByText(/下次重置/i)).toBeInTheDocument();
    expect(screen.getAllByText(/发现丑丑鱼/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/确认丑丑鱼/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/丑丑鱼排行榜/i)).toBeInTheDocument();
    expect(screen.getByText(/本周/i)).toBeInTheDocument();
    expect(screen.getByText(/已登录账号的 IGN/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /登录以追踪排行榜统计/i })).toHaveLength(2);
  });

  it('renders Spanish location names and action labels', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" locale="es" />);

    await waitFor(() =>
      expect(screen.getByText(/Ruta 119, Hoenn/i)).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /A2 0 revisadas, 1 pendientes, 0 confirmadas/i }));

    expect(screen.getByRole('tab', { name: /Monte Corona/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Feebas confirmado/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Quitar mi voto/i })).toBeDisabled();
    expect(screen.getByText(/Clasificacion de Feebas/i)).toBeInTheDocument();
    expect(screen.getByText(/Semanal/i)).toBeInTheDocument();
    expect(screen.getByText(/IGN de la cuenta con sesion iniciada/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Inicia sesion para registrar estadisticas de clasificacion/i })).toHaveLength(2);
  });
});
