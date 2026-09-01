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
  it('omits below-minimum species sections while retaining the complete split composition', () => {
    const mixedSpot = {
      ...spot,
      composition: [
        { ...vulpix, split: 0.5 },
        {
          ...vulpix, name: 'Grimer', slug: 'grimer', family_key: 'grimer',
          tier: 'Tier 6', points: 5, split: 0.5,
        },
      ],
    };

    render(
      <HuntResults
        minimumTier="3"
        participants={[]}
        speciesFilter=""
        spots={[mixedSpot]}
        view="pokemon"
        onQueue={jest.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: /Vulpix/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Grimer/ })).not.toBeInTheDocument();
    expect(screen.getByText('Grimer')).toBeInTheDocument();
  });

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

    expect(screen.getAllByText('Vulpix')).toHaveLength(2);
    expect(screen.getByText('Tier 3')).toBeInTheDocument();
    expect(screen.getByText('30 points')).toBeInTheDocument();
    expect(screen.getByText('Pokemon Mansion 2F')).toBeInTheDocument();
    expect(screen.getByText('Kanto · 5× Sweet Scent · Summer · Night')).toBeInTheDocument();
    expect(screen.queryByLabelText('Location season and time filters')).not.toBeInTheDocument();
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

  it('shows a single level without repeating the range', () => {
    render(
      <HuntResults
        participants={[]}
        speciesFilter=""
        spots={[{
          ...spot,
          composition: [{ ...vulpix, min_level: 2, max_level: 2 }],
        }]}
        view="location"
      />
    );

    expect(screen.getByText('Lv. 2')).toBeInTheDocument();
    expect(screen.queryByText('Lv. 2–2')).not.toBeInTheDocument();
  });

  it('shows egg groups beside EV yields and places Lure between rarity and tier', () => {
    render(
      <HuntResults
        participants={[]}
        speciesFilter=""
        spots={[{
          ...spot,
          is_lure: true,
          composition: [{
            ...vulpix,
            split: 0.5,
            ev_speed: 1,
            egg_groups: ['Field', 'Dragon'],
            is_lure: true,
          }],
        }]}
        view="location"
      />
    );

    const summary = screen.getByText(/50.00%/);
    expect(summary).toHaveTextContent('50.00% · Lure · Tier 3');
    const details = screen.getByText(/Field, Dragon/).parentElement;
    expect(details).toHaveTextContent('Speed +1 EV');
    expect(details).toHaveTextContent('Field, Dragon');
    expect(details).not.toHaveTextContent('Egg groups:');
    expect(screen.getByText(/Includes Lure encounters/)).toBeInTheDocument();
  });

  it('localizes locations, regions, species, and encounter details', () => {
    render(
      <HuntResults
        locale="zh"
        participants={[]}
        speciesFilter=""
        spots={[{
          ...spot,
          location: 'Abandoned Ship',
          region: 'Hoenn',
          method: 'Good Rod',
          season: 'Spring',
          time: 'Any',
          horde_size: 0,
          composition: [{
            ...vulpix,
            name: 'Magikarp',
            slug: 'magikarp',
            tier: 'Tier 7',
            split: 0.6,
            min_level: 20,
            max_level: 20,
            ev_speed: 1,
          }],
        }]}
        view="location"
      />
    );

    expect(screen.getByText('弃船')).toBeInTheDocument();
    expect(screen.getByText(/丰缘 · 1/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '好钓竿' })).toBeInTheDocument();
    expect(screen.getByText('丰缘 · 好钓竿 · 春季')).toBeInTheDocument();
    expect(screen.getByText('鲤鱼王')).toBeInTheDocument();
    expect(screen.getByText(/60.00% · 阶级 7/)).toBeInTheDocument();
    expect(screen.getByText(/等级 20/)).toHaveTextContent('速度 +1 EV');
  });

  it('keeps location results in their calculated order', () => {
    render(
      <HuntResults
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
    expect(caughtLocation.compareDocumentPosition(uncaughtLocation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ranks Pokémon sections by their calculated points per hour', () => {
    render(
      <HuntResults
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

    const uncaughtSection = screen.getAllByText('Pikachu')[0].closest('section');
    const caughtSection = screen.getAllByText('Vulpix')[0].closest('section');
    expect(uncaughtSection).not.toBeNull();
    expect(caughtSection).not.toBeNull();
    expect(caughtSection!.compareDocumentPosition(uncaughtSection!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not specially reorder Pokémon locations based on their composition', () => {
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
    expect(caughtSplitLocation.compareDocumentPosition(uncaughtLocation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('ranks Pokémon by their best calculated location', () => {
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

    const zigzagoonSection = screen.getAllByText('Zigzagoon')[0].closest('section');
    const surskitSection = screen.getAllByText('Surskit')[0].closest('section');
    expect(zigzagoonSection).not.toBeNull();
    expect(surskitSection).not.toBeNull();
    expect(surskitSection!.compareDocumentPosition(zigzagoonSection!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    expect(screen.getByText((_, element) => (
      element?.tagName === 'SPAN' && element.textContent === 'Kanto · 2 encounter splits'
    ))).toBeInTheDocument();
  });

  it('labels non-horde splits, keeps actions with metrics, and keeps collapse in the location header', () => {
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
    const queueButton = screen.getByRole('button', { name: 'Queue' });
    const collapseButton = screen.getByRole('button', { name: 'Collapse Pokemon Mansion 2F' });
    const metricsGrid = screen.getByText('1.333').parentElement?.parentElement?.parentElement;
    expect(metricsGrid).toContainElement(queueButton);
    expect(collapseButton.closest('header')).not.toBeNull();
    expect(queueButton.closest('header')).toBeNull();
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

  it('shows every Pokemon until its super-location is collapsed', () => {
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
        onToggle={jest.fn()}
      />
    );

    expect(screen.getByText('1F · Sweet Scent split 1')).toBeInTheDocument();
    expect(screen.getAllByText('Vulpix')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Pokemon/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Sky Pillar' }));
    expect(screen.queryByText('1F · Sweet Scent split 1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand Sky Pillar' }));
    expect(screen.getByText('1F · Sweet Scent split 1')).toBeInTheDocument();
    expect(screen.getAllByText('Vulpix')).toHaveLength(2);
  });

  it('keeps split numbering in natural order for descending alphabetical sorting', () => {
    render(
      <HuntResults
        participants={[]}
        sort="alphabetical"
        sortDirection="desc"
        speciesFilter=""
        spots={[
          { ...spot, spot_key: 'first', time: 'morning' },
          { ...spot, spot_key: 'second', time: 'night' },
        ]}
        view="location"
      />
    );

    const split1 = screen.getByText('Sweet Scent split 1');
    const split2 = screen.getByText('Sweet Scent split 2');
    expect(split1.compareDocumentPosition(split2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('collapses lower points-per-hour splits behind one location-level control', () => {
    render(
      <HuntResults
        participants={[]}
        speciesFilter=""
        spots={[
          { ...spot, spot_key: 'best', pointsPerHour: 1.5 },
          {
            ...spot,
            spot_key: 'lower',
            pointsPerHour: 0.75,
            composition: [{ ...vulpix, name: 'Raticate', slug: 'raticate' }],
          },
          {
            ...spot,
            spot_key: 'unknown',
            pointsPerHour: null,
            composition: [{ ...vulpix, name: 'Ditto', slug: 'ditto' }],
          },
        ]}
        view="location"
        onQueue={jest.fn()}
      />
    );

    expect(screen.getByText('Vulpix')).toBeInTheDocument();
    expect(screen.queryByText('Raticate')).not.toBeInTheDocument();
    expect(screen.queryByText('Ditto')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show 2 lower points/hour splits' }));

    expect(screen.getByText('Raticate')).toBeInTheDocument();
    expect(screen.getByText('Ditto')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide 2 lower points/hour splits' })).toBeInTheDocument();
  });
});
