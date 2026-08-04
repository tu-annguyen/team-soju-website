import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import HuntFinder from '../src/components/shiny-war/HuntFinder';
import { shinyWarRequest } from '../src/components/shiny-war/api';
import type { HuntSpot } from '../src/components/shiny-war/types';

jest.mock('../src/components/shiny-war/api', () => ({
  shinyWarRequest: jest.fn(),
}));

const makeSpot = (spotKey: string, location: string): HuntSpot => ({
  spot_key: spotKey,
  location,
  region: 'Kanto',
  method: 'Sweet Scent',
  season: 'Summer',
  time: 'night',
  horde_size: 5,
  denominator: 27000,
  averagePoints: 30,
  encountersPerHour: 1200,
  pointsPerHour: 1.333,
  composition: [{
    name: 'Vulpix', slug: 'vulpix', family_key: 'vulpix', tier: 'Tier 3',
    points: 30, split: 1, form: '', min_level: 20, max_level: 22,
  }],
});

describe('HuntFinder', () => {
  it('uses Any labels and lets card chips update season and time filters', async () => {
    const spot = makeSpot('mirage', 'Mirage Tower');
    (shinyWarRequest as jest.Mock).mockResolvedValue({ items: [spot], locations: ['Mirage Tower'], total: 1 });

    render(<HuntFinder apiBaseUrl="https://example.test" defaultSeason="Summer" participants={[]} onQueue={jest.fn()} />);

    expect(await screen.findByRole('option', { name: 'Any season' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Any time' })).toBeInTheDocument();
    expect(await screen.findByText('Mirage Tower')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Any season' }));
    fireEvent.click(screen.getByRole('button', { name: 'Night time' }));

    await waitFor(() => {
      const latestUrl = (shinyWarRequest as jest.Mock).mock.calls.at(-1)[1] as string;
      expect(latestUrl).not.toContain('season=');
      expect(latestUrl).toContain('time=night');
    });
  });

  it('collapses and opens all visible super-locations from the view row', async () => {
    const spots = [
      makeSpot('mansion', 'Pokemon Mansion 2F'),
      makeSpot('route-7', 'Route 7'),
    ];
    (shinyWarRequest as jest.Mock).mockResolvedValue({
      items: spots,
      locations: spots.map(({ location }) => location),
      total: spots.length,
    });

    render(<HuntFinder apiBaseUrl="https://example.test" defaultSeason="Summer" participants={[]} onQueue={jest.fn()} />);

    const collapseAll = await screen.findByRole('button', { name: 'Collapse all' });
    await waitFor(() => expect(collapseAll).toBeEnabled());
    expect(collapseAll).toHaveTextContent('- Collapse all');

    fireEvent.click(collapseAll);

    expect(screen.getByRole('button', { name: 'Expand Pokemon Mansion 2F' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Expand Route 7' })).toHaveAttribute('aria-expanded', 'false');
    const openAll = screen.getByRole('button', { name: 'Open all' });
    expect(openAll).toHaveTextContent('+ Open all');

    fireEvent.click(openAll);

    expect(screen.getByRole('button', { name: 'Collapse Pokemon Mansion 2F' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Collapse Route 7' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Collapse all' })).toHaveTextContent('- Collapse all');
  });

  it('only enables the non-Safari filter for Singles and Fishing', async () => {
    (shinyWarRequest as jest.Mock).mockResolvedValue({ items: [], locations: [], total: 0 });

    render(<HuntFinder apiBaseUrl="https://example.test" defaultSeason="Summer" participants={[]} onQueue={jest.fn()} />);

    const method = screen.getByLabelText('Encounter method');
    const nonSafari = screen.getByLabelText('Non-Safari only');
    expect(nonSafari).toBeDisabled();

    fireEvent.change(method, { target: { value: 'Singles' } });
    expect(nonSafari).toBeEnabled();
    fireEvent.click(nonSafari);

    await waitFor(() => {
      const latestUrl = (shinyWarRequest as jest.Mock).mock.calls.at(-1)[1] as string;
      expect(latestUrl).toContain('method=Singles');
      expect(latestUrl).toContain('nonSafari=true');
    });

    fireEvent.change(method, { target: { value: 'Sweet Scent' } });
    expect(nonSafari).toBeDisabled();
    await waitFor(() => {
      const latestUrl = (shinyWarRequest as jest.Mock).mock.calls.at(-1)[1] as string;
      expect(latestUrl).not.toContain('nonSafari');
    });

    fireEvent.change(method, { target: { value: 'Fishing' } });
    expect(nonSafari).toBeEnabled();
  });

  it('defaults to Official unique scoring and keeps the war bonuses mutually exclusive', async () => {
    (shinyWarRequest as jest.Mock).mockResolvedValue({ items: [], locations: [], total: 0 });

    render(
      <HuntFinder
        apiBaseUrl="https://example.test"
        defaultSeason="Summer"
        officialCaughtFamilyKeys={['vulpix']}
        participants={[]}
        teamCaughtFamilyKeys={['grimer']}
        onQueue={jest.fn()}
      />
    );

    const officialBonus = screen.getByLabelText('Official unique species +8');
    const teamBonus = screen.getByLabelText('Team War unique species +8');
    expect(officialBonus).toBeChecked();
    expect(teamBonus).not.toBeChecked();

    await waitFor(() => {
      const latestUrl = (shinyWarRequest as jest.Mock).mock.calls.at(-1)[1] as string;
      expect(latestUrl).toContain('officialUniqueBonus=true');
      expect(latestUrl).toContain('officialCaughtFamilyKeys=vulpix');
    });

    fireEvent.click(teamBonus);
    expect(teamBonus).toBeChecked();
    expect(officialBonus).not.toBeChecked();

    await waitFor(() => {
      const latestUrl = (shinyWarRequest as jest.Mock).mock.calls.at(-1)[1] as string;
      expect(latestUrl).toContain('teamUniqueBonus=true');
      expect(latestUrl).toContain('teamCaughtFamilyKeys=grimer');
      expect(latestUrl).toContain('officialUniqueBonus=false');
    });
  });

  it('keeps Official and Team War caught-line exclusions mutually exclusive', async () => {
    (shinyWarRequest as jest.Mock).mockResolvedValue({ items: [], locations: [], total: 0 });

    render(
      <HuntFinder
        apiBaseUrl="https://example.test"
        defaultSeason="Summer"
        officialCaughtFamilyKeys={['vulpix']}
        participants={[]}
        teamCaughtFamilyKeys={['grimer']}
        onQueue={jest.fn()}
      />
    );

    const officialExclusion = screen.getByLabelText('Exclude Official caught evolution lines');
    const teamExclusion = screen.getByLabelText('Exclude Team War caught evolution lines');
    expect(officialExclusion).not.toBeChecked();
    expect(teamExclusion).not.toBeChecked();

    fireEvent.click(officialExclusion);
    expect(officialExclusion).toBeChecked();
    expect(teamExclusion).not.toBeChecked();

    fireEvent.click(teamExclusion);
    expect(officialExclusion).not.toBeChecked();
    expect(teamExclusion).toBeChecked();

    await waitFor(() => {
      const latestUrl = (shinyWarRequest as jest.Mock).mock.calls.at(-1)[1] as string;
      expect(latestUrl).toContain('excludeOfficialCaught=false');
      expect(latestUrl).toContain('excludeTeamCaught=true');
      expect(latestUrl).toContain('teamCaughtFamilyKeys=grimer');
    });
  });
});
