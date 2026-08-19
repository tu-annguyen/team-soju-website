import { render, screen } from '@testing-library/react';
import PublicOverview from '../src/components/shiny-war/PublicOverview';
import { shinyWarRequest } from '../src/components/shiny-war/api';

jest.mock('../src/components/shiny-war/api', () => ({
  shinyWarRequest: jest.fn(),
}));

const dashboard = {
  officialWar: {
    teamTotal: 38,
    uniqueFamilyCount: 1,
    uniqueFamilies: ['vulpix'],
    standings: [{
      ign: 'SojuHunter', team: 'bidoof' as const, points: 38, basePoints: 30, bonusPoints: 8, catches: 1,
    }],
    recentCatches: [],
  },
  teamWar: {
    teamTotals: { bidoof: 20, arceus: 18 },
    uniqueFamilies: { bidoof: ['vulpix'], arceus: [] },
    standings: [],
    recentCatches: [],
  },
};

describe('Shiny Wars public overview', () => {
  beforeEach(() => {
    (shinyWarRequest as jest.Mock).mockResolvedValue(dashboard);
  });

  it('prompts logged-out visitors to sign in for member tools', async () => {
    render(<PublicOverview apiBaseUrl="https://example.test/api" showLoginPrompt />);

    expect(screen.getByText(/access the organizer, Hunt Board, Hunt Finder/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in for member tools' })).toHaveAttribute('href', '/auth');
    expect(await screen.findByText('SojuHunter')).toBeInTheDocument();
  });

  it('hides the sign-in prompt for authenticated visitors', async () => {
    render(<PublicOverview apiBaseUrl="https://example.test/api" />);

    expect(screen.queryByRole('link', { name: 'Sign in for member tools' })).not.toBeInTheDocument();
    expect(await screen.findByText('SojuHunter')).toBeInTheDocument();
  });
});
