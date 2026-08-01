import { fireEvent, render, screen } from '@testing-library/react';
import HuntBoard from '../src/components/shiny-war/HuntBoard';
import type { ParticipantHunts } from '../src/components/shiny-war/types';

const rows: ParticipantHunts[] = [
  { member_id: 'other-1', ign: 'Alpha', rank: 'Member', has_app_user: true, team: 'bidoof', is_official: true, hunts: [] },
  {
    member_id: 'own', ign: 'SignedInHunter', rank: 'Member', has_app_user: true, team: 'arceus', is_official: true,
    hunts: [{ id: 'own-hunt', position: 0, spot_key: 'mansion', label: 'Pokemon Mansion 2F' }],
  },
  { member_id: 'other-2', ign: 'Bravo', rank: 'Member', has_app_user: true, team: 'arceus', is_official: true, hunts: [] },
];

describe('HuntBoard', () => {
  it('renders the signed-in member first in a separate row', () => {
    const { container } = render(
      <HuntBoard rows={rows} ownMemberId="own" busy={false} onSave={jest.fn()} />
    );

    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['SignedInHunter', 'Alpha', 'Bravo']);
    expect(container.firstElementChild?.firstElementChild).toContainElement(headings[0].closest('section'));
  });

  it('identifies Sweet Scent in legacy horde labels', () => {
    const legacyRows: ParticipantHunts[] = [{
      member_id: 'legacy', ign: 'LegacyHunter', rank: 'Member', has_app_user: true, team: 'bidoof', is_official: true,
      hunts: [
        { position: 0, spot_key: 'route-1|Grass|Summer|day|5', label: 'Route 1 · Summer Day · 5x' },
        { position: 1, spot_key: 'route-2|Dark Grass|Winter|night|3', label: 'Route 2 · Winter Night · 3× · Lure only' },
        { position: 2, spot_key: 'route-3|Water|Any|day|5', label: 'Route 3 · Any Day · 5× Sweet Scent' },
      ],
    }];

    render(<HuntBoard rows={legacyRows} busy={false} onSave={jest.fn()} />);

    expect(screen.getByText('Route 1 · Summer Day · 5x Sweet Scent Grass')).toBeInTheDocument();
    expect(screen.getByText('Route 2 · Winter Night · 3× Sweet Scent Dark Grass · Lure only')).toBeInTheDocument();
    expect(screen.getByText('Route 3 · Any Day · 5× Sweet Scent Water')).toBeInTheDocument();
  });

  it('shows the queued spot title and the same spot metadata as the finder card', () => {
    const spotRows: ParticipantHunts[] = [{
      member_id: 'spot', ign: 'SpotHunter', rank: 'Member', has_app_user: true, team: 'bidoof', is_official: true,
      hunts: [{
        position: 0,
        spot_key: 'sky-pillar',
        label: 'Sky Pillar · 1F · Sweet Scent Grass',
        details: {
          spot: {
            region: 'Hoenn', season: 'Summer', time: 'day', method: 'Grass', horde_size: 5, is_lure: true,
          },
        },
      }],
    }];

    render(<HuntBoard rows={spotRows} busy={false} onSave={jest.fn()} />);

    expect(screen.getByText('Sky Pillar · 1F · Sweet Scent Grass')).toBeInTheDocument();
    expect(screen.getByText('Hoenn · Summer Day · 5× Sweet Scent Grass · Lure only')).toBeInTheDocument();
  });

  it('groups all participants by team in the Team War view', () => {
    const teamRows: ParticipantHunts[] = [
      ...rows,
      { member_id: 'extra', ign: 'ExtraHunter', rank: 'Member', has_app_user: true, team: 'bidoof', is_official: false, hunts: [] },
    ];
    render(<HuntBoard rows={teamRows} ownMemberId="own" busy={false} onSave={jest.fn()} />);

    expect(screen.queryByText('ExtraHunter')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Team War' }));

    expect(screen.getByText('ExtraHunter')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team Bidoof' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Team Arceus' })).toBeInTheDocument();
  });
});
