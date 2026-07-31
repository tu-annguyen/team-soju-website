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
});
