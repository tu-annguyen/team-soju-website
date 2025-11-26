import React from 'react';
import { render, screen } from '@testing-library/react';
import AnniversaryLeaderboard from '../src/components/AnniversaryLeaderboard';

describe('AnniversaryLeaderboard', () => {
  it('renders leaderboard table with at least one team row', () => {
    render(<AnniversaryLeaderboard />);

    expect(screen.getByText(/Leaderboard/i)).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    // header row + at least one team row
    expect(rows.length).toBeGreaterThan(1);
  });
});
