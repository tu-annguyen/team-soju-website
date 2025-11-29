import React from 'react';
import { render, screen } from '@testing-library/react';
import StaffCard from '../src/components/StaffCard';

describe('StaffCard', () => {
  it('renders staff info and optional links', () => {
    render(
      <StaffCard
        name="Buddhalicious"
        role="Co-Leader"
        avatar="/avatar.png"
        discord="https://discordapp.com/users/123"
        forum="https://forums.pokemmo.com/profile/123"
      />
    );

    expect(screen.getByText('Buddhalicious')).toBeInTheDocument();
    expect(screen.getByText('Co-Leader')).toBeInTheDocument();
    expect(screen.getByAltText('Buddhalicious')).toHaveAttribute('src', '/avatar.png');

    const discordLink = screen.getByLabelText("Buddhalicious's Discord");
    expect(discordLink).toHaveAttribute('href', 'https://discordapp.com/users/123');

    const forumLink = screen.getByLabelText("Buddhalicious's Forum Profile");
    expect(forumLink).toHaveAttribute('href', 'https://forums.pokemmo.com/profile/123');
  });
});
