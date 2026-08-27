import { fireEvent, render, screen } from '@testing-library/react';
import Overview from '../src/components/shiny-war/Overview';

const dashboard = {
  familySpecies: { vulpix: ['Vulpix', 'Ninetales'] },
  event: {
    name: 'PokeMMO Shiny Wars 2026',
    starts_at: '2026-08-01T00:00:00.000Z',
    ends_at: '2026-08-29T00:00:00.000Z',
    roster_locked: false,
    seasons: ['Summer', 'Autumn', 'Winter', 'Spring'],
  },
  currentSeason: 'Summer',
  officialWar: {
    teamTotal: 38,
    uniqueFamilyCount: 1,
    uniqueFamilies: ['vulpix'],
    standings: [{
    member_id: 'member-1',
    ign: 'SojuHunter',
    rank: 'Trainer',
    has_app_user: true,
    team: 'bidoof' as const,
    is_official: true,
    hunts: [],
    points: 38,
    catches: 1,
    }],
    recentCatches: [{
    id: 'shiny-1',
    pokemon: 'vulpix',
    ign: 'SojuHunter',
    member_id: 'member-1',
    team: 'bidoof' as const,
    is_official: true,
    caught_at_utc: '2026-08-01T01:02:00.000Z',
    score: { base: 30, secretBonus: 0, safariBonus: 0, uniqueBonus: 8, total: 38 },
    }],
  },
  teamWar: {
    teamTotals: { bidoof: 20, arceus: 18 },
    uniqueFamilies: { bidoof: ['vulpix'], arceus: [] },
    standings: [],
    recentCatches: [],
  },
};

describe('Shiny Wars overview', () => {
  it('renders progress and lets managers correct eligibility', () => {
    const onEligibility = jest.fn().mockResolvedValue(undefined);
    render(<Overview dashboard={dashboard} canManage onEligibility={onEligibility} />);

    expect(screen.getByText('38 pts')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Team Bidoof' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Team Arceus' })).not.toBeInTheDocument();
    expect(screen.getByText('Vulpix/Ninetales')).toBeInTheDocument();
    expect(screen.getByText(/SojuHunter · Vulpix/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark invalid' }));
    expect(onEligibility).toHaveBeenCalledWith('shiny-1', false);

    fireEvent.click(screen.getByRole('button', { name: 'Team War' }));
    expect(screen.getByLabelText('Team Bidoof 20 points, Team Arceus 18 points')).toBeInTheDocument();
    expect(screen.queryByText('Team points')).not.toBeInTheDocument();
    expect(screen.queryByText('Unique species')).not.toBeInTheDocument();
  });

  it('uses species language and can hide internal event status', () => {
    render(<Overview dashboard={dashboard} showEventStatus={false} />);

    expect(screen.getByText('Unique species')).toBeInTheDocument();
    expect(screen.getByText('Species coverage')).toBeInTheDocument();
    const coverage = screen.getByRole('heading', { name: 'Species coverage' }).closest('section');
    const standings = screen.getByRole('heading', { name: 'Participant standings' }).closest('section');
    expect(standings?.compareDocumentPosition(coverage as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/first species \+8/)).toBeInTheDocument();
    expect(screen.queryByText('Current season')).not.toBeInTheDocument();
    expect(screen.queryByText('Schedule')).not.toBeInTheDocument();
  });

  it('paginates catches that do not fit beside the standings', () => {
    const catches = ['vulpix', 'eevee', 'pikachu'].map((pokemon, index) => ({
      ...dashboard.officialWar.recentCatches[0],
      id: `shiny-${index + 1}`,
      pokemon,
    }));

    render(<Overview dashboard={{
      ...dashboard,
      officialWar: { ...dashboard.officialWar, recentCatches: catches },
    }} />);

    expect(screen.getByText(/SojuHunter · Vulpix/)).toBeInTheDocument();
    expect(screen.queryByText(/SojuHunter · Eevee/)).not.toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.queryByText(/SojuHunter · Vulpix/)).not.toBeInTheDocument();
    expect(screen.getByText(/SojuHunter · Eevee/)).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });
});
