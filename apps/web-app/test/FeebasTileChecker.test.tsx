import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FeebasTileChecker from '../src/components/FeebasTileChecker';

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

describe('FeebasTileChecker', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('feebas-tile-checker-client-id', 'client-self');

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: boardFixture,
      }),
    });
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
    expect(screen.getAllByText('May').length).toBeGreaterThan(0);
    expect(
      screen.getByText((_, element) => element?.textContent === 'May found Feebas on A1.')
    ).toBeInTheDocument();
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

  it('casts a checked vote when a tile is clicked', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: boardFixture,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: boardFixture,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
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
          },
        }),
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

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3001/api/feebas/route-119-main/tiles/r1c2',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          status: 'checked',
          actorFingerprint: 'client-self',
          actorName: undefined,
        }),
      }),
    );
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

    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: boardWithOtherCheckedVote,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: boardWithOtherCheckedVote,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
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
          },
        }),
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

    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3001/api/feebas/route-119-main/tiles/r1c2',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          status: 'checked',
          actorFingerprint: 'client-self',
          actorName: undefined,
        }),
      }),
    );
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/feebas/mt-coronet?actorFingerprint=client-self');
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

    fireEvent.click(screen.getByRole('button', { name: /Voting/i }));

    expect(screen.getByText(/Unchecked/i)).toBeInTheDocument();
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
  });
});
