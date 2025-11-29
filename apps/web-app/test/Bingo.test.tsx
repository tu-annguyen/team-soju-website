import React from 'react';
import { render, screen } from '@testing-library/react';
import Bingo from '../src/components/Bingo';

jest.mock('../src/data/bingo.json', () => ({
  __esModule: true,
  default: {
    squares: [
      { value: 'A1', trainerNames: ['Alice'], position: 'left' },
      { value: 'B1', trainerNames: ['Bob'], position: 'center' }
    ],
    'Team Buddha': { Alice: 2 },
    'Team Aisu': { Bob: 3 }
  }
}));

describe('Bingo', () => {
  it('renders bingo heading, board and team stats', () => {
    render(<Bingo />);

    expect(
      screen.getByRole('heading', { name: /SOJU Bingo/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Bingo Board/i)).toBeInTheDocument();

    expect(screen.getByText('Team Buddha')).toBeInTheDocument();
    expect(screen.getByText('Team Aisu')).toBeInTheDocument();

    expect(screen.getAllByText(/Tiles Completed:/i).length).toBeGreaterThanOrEqual(2);
  });
});
