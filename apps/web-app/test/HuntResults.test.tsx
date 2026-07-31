import { fireEvent, render, screen } from '@testing-library/react';
import HuntResults from '../src/components/shiny-war/HuntResults';
import type { HuntSpot, ParticipantHunts } from '../src/components/shiny-war/types';

const vulpix = {
  name: 'Vulpix', slug: 'vulpix', family_key: 'vulpix', tier: 'Tier 3',
  points: 30, split: 1, form: '', min_level: 20, max_level: 22,
};

const spot: HuntSpot = {
  spot_key: 'mansion',
  location: 'Pokemon Mansion 2F',
  region: 'Kanto',
  method: 'Sweet Scent',
  season: 'Summer',
  time: 'night',
  horde_size: 5,
  denominator: 27000,
  averagePoints: 30,
  encountersPerHour: 1200,
  pointsPerHour: 1.333,
  composition: [vulpix],
};

const participants: ParticipantHunts[] = [{
  member_id: 'member-1', ign: 'SojuHunter', rank: 'Member', has_app_user: true,
  hunts: [
    { id: 'hunt-1', position: 0, spot_key: 'mansion', label: 'Pokemon Mansion 2F' },
    { id: 'hunt-2', position: 2, spot_key: 'mansion', label: 'Pokemon Mansion 2F' },
  ],
}];

describe('HuntResults', () => {
  it('shows Pokémon groups with each location-level metric and queues the grouped species', () => {
    const onQueue = jest.fn();

    render(
      <HuntResults
        expanded={new Set()}
        participants={participants}
        speciesFilter=""
        spots={[spot]}
        view="pokemon"
        onQueue={onQueue}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText('Vulpix')).toBeInTheDocument();
    expect(screen.getByText('Tier 3')).toBeInTheDocument();
    expect(screen.getByText('30 points')).toBeInTheDocument();
    expect(screen.getByText('Pokemon Mansion 2F')).toBeInTheDocument();
    expect(screen.getByText('1.333')).toBeInTheDocument();
    expect(screen.getByText('30.00')).toBeInTheDocument();
    expect(screen.getByText('SojuHunter · Current')).toBeInTheDocument();
    expect(screen.getByText('SojuHunter · Next 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Queue' }));
    expect(onQueue).toHaveBeenCalledWith(spot, false, vulpix);
  });

  it('shows an empty team queue row when no participant selected the location', () => {
    render(
      <HuntResults
        expanded={new Set()}
        participants={[]}
        speciesFilter=""
        spots={[spot]}
        view="location"
        onQueue={jest.fn()}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText('Team queue')).toBeInTheDocument();
    expect(screen.getByText('No one hunting or queued')).toBeInTheDocument();
  });
});
