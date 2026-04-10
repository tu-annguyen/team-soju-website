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
  requiresDistinctConfirmation: true,
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
      actionType: 'reported',
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
      updatedAt: null,
      updatedByName: 'May',
      pendingReportedByName: 'May',
      pendingReportedByFingerprint: 'other-client',
      confirmedByName: null,
      confirmedAt: null,
    },
    {
      tileId: 'r1c2',
      label: 'A2',
      row: 0,
      col: 1,
      status: 'unchecked',
      updatedAt: null,
      updatedByName: null,
      pendingReportedByName: null,
      pendingReportedByFingerprint: null,
      confirmedByName: null,
      confirmedAt: null,
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

    expect(screen.getByRole('button', { name: /A2 Pending/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /B2 Unchecked/i })).toBeInTheDocument();
    expect(screen.getByText(/Confirmation requires a second distinct browser/i)).toBeInTheDocument();
    expect(screen.getAllByText('May').length).toBeGreaterThan(0);
    expect(screen.getByText(/reported as a Feebas tile/i)).toBeInTheDocument();
  });

  it('allows a second client to confirm a pending tile', async () => {
    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /A2 Pending/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /A2 Pending/i }));

    expect(screen.getByRole('button', { name: /Second And Confirm/i })).toBeEnabled();
  });

  it('keeps the board interactive after a tile is confirmed', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          ...boardFixture,
          isLocked: true,
          confirmedTileId: 'r1c1',
          tiles: [
            {
              ...boardFixture.tiles[0],
              status: 'confirmed',
              confirmedByName: 'Brendan',
              confirmedAt: '2026-04-09T20:19:00.000Z',
            },
            boardFixture.tiles[1],
          ],
        },
      }),
    });

    render(<FeebasTileChecker apiBaseUrl="http://localhost:3001/api" />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /A2 Confirmed/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /A2 Confirmed/i }));

    expect(screen.getByRole('button', { name: /A2 Confirmed/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Reset Tile/i })).toBeEnabled();
    expect(screen.getByText(/currently confirmed\. You can still adjust the board/i)).toBeInTheDocument();
  });
});
