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
    expect(screen.getAllByText('May').length).toBeGreaterThan(0);
    expect(screen.getByText(/voted pending on/i)).toBeInTheDocument();
  });

  it('allows a second client to confirm a pending tile', async () => {
    (global as any).fetch = jest.fn()
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
              {
                ...boardFixture.tiles[0],
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
      expect(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 0 confirmed/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /A2 0 checked, 1 pending, 0 confirmed/i }));

    await waitFor(() =>
      expect(screen.getByText(/Your vote: Checked/i)).toBeInTheDocument()
    );

    expect(screen.getByRole('button', { name: /Vote Confirmed/i })).toBeEnabled();
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

    expect(screen.getByText(/Your vote: Confirmed/i)).toBeInTheDocument();
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

    expect(screen.getByText(/Your vote: Confirmed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear My Vote/i })).toBeEnabled();
    expect(screen.getByText(/Mixed colors mean mixed opinions/i)).toBeInTheDocument();
  });
});
