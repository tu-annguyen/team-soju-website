import React from 'react';
import { render, screen } from '@testing-library/react';
import Anniversary from '../src/components/Anniversary';
import type { AnniversaryTeam } from '../src/types/anniversary';

jest.mock('../src/components/Leaderboard', () => ({ teams }: { teams: AnniversaryTeam[] }) => (
  <div data-testid="anniversary-leaderboard">
    {teams.map((team) => `${team.name}: ${team.score}`).join(', ')}
  </div>
));
jest.mock('../src/components/AnniversaryEventLog', () => () => (
  <div data-testid="anniversary-event-log" />
));

describe('Anniversary', () => {
  it('renders heading, forum link, and child sections', () => {
    const anniversaryData = {
      contentVideo: [],
      teams: [
        { name: 'Squirtle Squad', logo: '/squirtle.png', score: 999 },
        { name: 'Sloppy Spindas', logo: '/spinda.png', score: 999 },
      ],
      mainEvents: [
        {
          icon: '/main.png',
          name: 'Main Event',
          first: 'Squirtle Squad',
          second: 'Player Two - Sloppy Spindas',
        },
      ],
      miniEvents: [
        {
          icon: '/mini.png',
          name: 'Mini Event',
          first: 'Sloppy Spindas',
        },
      ],
      eventShinies: []
    };

    render(<Anniversary year={2025} anniversaryData={anniversaryData} />);

    expect(
      screen.getByText(/SOJU 1 Year Anniversary/i)
    ).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /forum post/i });
    expect(link).toHaveAttribute('href');

    expect(screen.getByTestId('anniversary-leaderboard')).toBeInTheDocument();
    expect(screen.getByTestId('anniversary-leaderboard')).toHaveTextContent(
      'Squirtle Squad: 5'
    );
    expect(screen.getByTestId('anniversary-leaderboard')).toHaveTextContent(
      'Sloppy Spindas: 5'
    );
    expect(screen.getByTestId('anniversary-event-log')).toBeInTheDocument();
  });
});
