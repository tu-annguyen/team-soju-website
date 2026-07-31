import { render, screen } from '@testing-library/react';
import HuntBoard from '../src/components/shiny-war/HuntBoard';
import type { ParticipantHunts } from '../src/components/shiny-war/types';

const rows: ParticipantHunts[] = [
  { member_id: 'other-1', ign: 'Alpha', rank: 'Member', has_app_user: true, hunts: [] },
  {
    member_id: 'own', ign: 'SignedInHunter', rank: 'Member', has_app_user: true,
    hunts: [{ id: 'own-hunt', position: 0, spot_key: 'mansion', label: 'Pokemon Mansion 2F' }],
  },
  { member_id: 'other-2', ign: 'Bravo', rank: 'Member', has_app_user: true, hunts: [] },
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
      member_id: 'legacy', ign: 'LegacyHunter', rank: 'Member', has_app_user: true,
      hunts: [
        { position: 0, spot_key: 'five-horde', label: 'Route 1 · Summer Day · 5x' },
        { position: 1, spot_key: 'three-horde', label: 'Route 2 · Winter Night · 3× · Lure only' },
        { position: 2, spot_key: 'current-label', label: 'Route 3 · Any Day · 5× Sweet Scent' },
      ],
    }];

    render(<HuntBoard rows={legacyRows} busy={false} onSave={jest.fn()} />);

    expect(screen.getByText('Route 1 · Summer Day · 5x Sweet Scent')).toBeInTheDocument();
    expect(screen.getByText('Route 2 · Winter Night · 3× Sweet Scent · Lure only')).toBeInTheDocument();
    expect(screen.getByText('Route 3 · Any Day · 5× Sweet Scent')).toBeInTheDocument();
  });
});
