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
  member_id: 'member-1', ign: 'SojuHunter', rank: 'Member', has_app_user: true, team: 'bidoof', is_official: true,
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
    expect(onQueue).toHaveBeenCalledWith(spot, false, vulpix, 'Sweet Scent');
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

  it('moves locations containing a caught species below uncaught locations', () => {
    render(
      <HuntResults
        caughtFamilyKeys={['vulpix']}
        expanded={new Set()}
        participants={[]}
        speciesFilter=""
        spots={[
          spot,
          {
            ...spot,
            spot_key: 'forest',
            location: 'Berry Forest',
            composition: [{ ...vulpix, name: 'Pikachu', slug: 'pikachu', family_key: 'pichu' }],
          },
        ]}
        view="location"
        onQueue={jest.fn()}
        onToggle={jest.fn()}
      />
    );

    const uncaughtLocation = screen.getByText('Berry Forest');
    const caughtLocation = screen.getByText('Pokemon Mansion 2F');
    expect(uncaughtLocation.compareDocumentPosition(caughtLocation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('moves an entire caught Pokémon section below uncaught Pokémon sections', () => {
    render(
      <HuntResults
        caughtFamilyKeys={['vulpix']}
        expanded={new Set()}
        participants={[]}
        speciesFilter=""
        spots={[
          spot,
          {
            ...spot,
            composition: [{
              ...vulpix,
              name: 'Pikachu',
              slug: 'pikachu',
              family_key: 'pichu',
              points: 10,
            }],
          },
        ]}
        view="pokemon"
        onQueue={jest.fn()}
        onToggle={jest.fn()}
      />
    );

    const uncaughtSection = screen.getByText('Pikachu').closest('section');
    const caughtSection = screen.getByText('Vulpix').closest('section');
    expect(uncaughtSection).not.toBeNull();
    expect(caughtSection).not.toBeNull();
    expect(uncaughtSection!.compareDocumentPosition(caughtSection!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('moves a Pokémon location down when its encounter split contains another caught species', () => {
    const surskit = {
      ...vulpix,
      name: 'Surskit',
      slug: 'surskit',
      family_key: 'surskit',
    };
    const seviper = {
      ...vulpix,
      name: 'Seviper',
      slug: 'seviper',
      family_key: 'seviper',
    };

    render(
      <HuntResults
        caughtFamilyKeys={['seviper']}
        expanded={new Set()}
        participants={[]}
        speciesFilter="Surskit"
        spots={[
          {
            ...spot,
            spot_key: 'route-114',
            location: 'Route 114',
            composition: [surskit, seviper],
          },
          {
            ...spot,
            spot_key: 'pond',
            location: 'Uncaught Pond',
            composition: [surskit],
          },
        ]}
        view="pokemon"
        onQueue={jest.fn()}
        onToggle={jest.fn()}
      />
    );

    const uncaughtLocation = screen.getByText('Uncaught Pond');
    const caughtSplitLocation = screen.getByText('Route 114');
    expect(uncaughtLocation.compareDocumentPosition(caughtSplitLocation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ranks Pokémon by their best non-deprioritized location', () => {
    const surskit = {
      ...vulpix,
      name: 'Surskit',
      slug: 'surskit',
      family_key: 'surskit',
    };
    const seviper = {
      ...vulpix,
      name: 'Seviper',
      slug: 'seviper',
      family_key: 'seviper',
    };
    const zigzagoon = {
      ...vulpix,
      name: 'Zigzagoon',
      slug: 'zigzagoon',
      family_key: 'zigzagoon',
    };

    render(
      <HuntResults
        caughtFamilyKeys={['seviper']}
        expanded={new Set()}
        participants={[]}
        speciesFilter=""
        spots={[
          {
            ...spot,
            spot_key: 'route-114',
            location: 'Route 114',
            pointsPerHour: 1,
            composition: [surskit, seviper],
          },
          {
            ...spot,
            spot_key: 'route-102',
            location: 'Route 102',
            pointsPerHour: 0.4,
            composition: [surskit],
          },
          {
            ...spot,
            spot_key: 'route-101',
            location: 'Route 101',
            pointsPerHour: 0.7,
            composition: [zigzagoon],
          },
        ]}
        view="pokemon"
        onQueue={jest.fn()}
        onToggle={jest.fn()}
      />
    );

    const zigzagoonSection = screen.getByText('Zigzagoon').closest('section');
    const surskitSection = screen.getByText('Surskit').closest('section');
    expect(zigzagoonSection).not.toBeNull();
    expect(surskitSection).not.toBeNull();
    expect(zigzagoonSection!.compareDocumentPosition(surskitSection!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows an unknown rate for Zorua Illusion horde encounters', () => {
    render(
      <HuntResults
        expanded={new Set(['mansion'])}
        participants={[]}
        speciesFilter=""
        spots={[{
          ...spot,
          composition: [{
            ...vulpix,
            name: 'Zorua',
            slug: 'zorua',
            family_key: 'zorua',
            split: 0,
            rate_unknown: true,
          }],
        }]}
        view="location"
        onQueue={jest.fn()}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText('Zorua')).toBeInTheDocument();
    expect(screen.getByLabelText('Unknown encounter rate')).toHaveTextContent('???');
  });

  it('labels Special encounters without showing a lure label', () => {
    render(
      <HuntResults
        expanded={new Set(['mansion'])}
        participants={[]}
        speciesFilter=""
        spots={[{
          ...spot,
          is_special: true,
          composition: [{ ...vulpix, is_special: true, split: 0 }],
        }]}
        view="location"
        onQueue={jest.fn()}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText('Special')).toBeInTheDocument();
    expect(screen.getByText(/Includes Special encounters/)).toBeInTheDocument();
    expect(screen.queryByText(/Lure only/i)).not.toBeInTheDocument();
  });

  it('shows queue entries from every floor represented by a grouped location', () => {
    const floorParticipant: ParticipantHunts = {
      member_id: 'member-2', ign: 'FloorHunter', rank: 'Member', has_app_user: true, team: 'arceus', is_official: true,
      hunts: [{ id: 'floor-hunt', position: 0, spot_key: 'mansion-3f', label: 'Pokemon Mansion (3F)' }],
    };

    render(
      <HuntResults
        expanded={new Set()}
        participants={[floorParticipant]}
        speciesFilter=""
        spots={[{ ...spot, spot_keys: ['mansion', 'mansion-3f'] }]}
        view="location"
        onQueue={jest.fn()}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText('FloorHunter · Current')).toBeInTheDocument();
  });

  it('keeps different floor splits inside one parent location card', () => {
    const skyPillarSpots: HuntSpot[] = [
      { ...spot, spot_key: 'sky-1f', location: 'Sky Pillar', location_areas: ['1F'] },
      {
        ...spot,
        spot_key: 'sky-3f',
        location: 'Sky Pillar',
        location_areas: ['3F'],
        time: 'morning',
        averagePoints: 10,
        composition: [{ ...vulpix, name: 'Altaria', slug: 'altaria' }],
      },
    ];

    render(
      <HuntResults
        expanded={new Set(['sky-1f', 'sky-3f'])}
        participants={[]}
        speciesFilter=""
        spots={skyPillarSpots}
        view="location"
        onQueue={jest.fn()}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getAllByText('Sky Pillar')).toHaveLength(1);
    expect(screen.getByText('1F · Sweet Scent split 1')).toBeInTheDocument();
    expect(screen.getByText('3F · Sweet Scent split 2')).toBeInTheDocument();
    expect(screen.getByText('Altaria')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Pokémon available · Kanto · 2 encounter splits')).toBeInTheDocument();
  });

  it('labels non-horde splits by encounter method and puts actions after the team queue', () => {
    render(
      <HuntResults
        expanded={new Set()}
        participants={[]}
        speciesFilter=""
        spots={[{ ...spot, method: 'Grass', horde_size: 0 }]}
        view="location"
        onQueue={jest.fn()}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText('Singles Grass')).toBeInTheDocument();
    const teamQueue = screen.getByText('Team queue').parentElement;
    const queueButton = screen.getByRole('button', { name: 'Queue' });
    expect(teamQueue?.compareDocumentPosition(queueButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ['Grass', 'Sweet Scent Grass'],
    ['Dark Grass', 'Sweet Scent Dark Grass'],
    ['Water', 'Sweet Scent Water'],
  ])('includes the %s terrain in Sweet Scent split labels', (method, label) => {
    render(
      <HuntResults
        expanded={new Set()}
        participants={[]}
        speciesFilter=""
        spots={[{ ...spot, method }]}
        view="location"
        onQueue={jest.fn()}
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('separates collapsing a super-location from showing all of its Pokemon', () => {
    const onToggle = jest.fn();
    const skyPillarSpots: HuntSpot[] = [
      { ...spot, spot_key: 'sky-1f', location: 'Sky Pillar', location_areas: ['1F'] },
      { ...spot, spot_key: 'sky-3f', location: 'Sky Pillar', location_areas: ['3F'] },
    ];
    render(
      <HuntResults
        expanded={new Set()}
        participants={[]}
        speciesFilter=""
        spots={skyPillarSpots}
        view="location"
        onQueue={jest.fn()}
        onToggle={onToggle}
      />
    );

    expect(screen.getByText('1F · Sweet Scent split 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Sky Pillar' }));
    expect(screen.queryByText('1F · Sweet Scent split 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show Pokemon' }));
    expect(onToggle).toHaveBeenCalledWith('sky-1f');
    expect(onToggle).toHaveBeenCalledWith('sky-3f');
    expect(screen.getByText('1F · Sweet Scent split 1')).toBeInTheDocument();
  });
});
