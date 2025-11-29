import React from 'react';
import { render, screen } from '@testing-library/react';
import Anniversary from '../src/components/Anniversary';

jest.mock('../src/components/AnniversaryLeaderboard', () => () => (
  <div data-testid="anniversary-leaderboard" />
));
jest.mock('../src/components/AnniversaryEventLog', () => () => (
  <div data-testid="anniversary-event-log" />
));

describe('Anniversary', () => {
  it('renders heading, forum link, and child sections', () => {
    render(<Anniversary />);

    expect(
      screen.getByText(/SOJU 1 Year Anniversary/i)
    ).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /forum post/i });
    expect(link).toHaveAttribute('href');

    expect(screen.getByTestId('anniversary-leaderboard')).toBeInTheDocument();
    expect(screen.getByTestId('anniversary-event-log')).toBeInTheDocument();
  });
});
