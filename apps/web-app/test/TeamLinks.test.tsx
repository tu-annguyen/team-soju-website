import React from 'react';
import { render, screen } from '@testing-library/react';
import TeamLinks from '../src/components/TeamLinks';

describe('TeamLinks', () => {
  it('renders link cards for key resources', () => {
    render(<TeamLinks />);

    expect(
      screen.getByText('[SOJÜ] SojuSanctuary Club')
    ).toBeInTheDocument();
    expect(screen.getByText('Join Our Team')).toBeInTheDocument();
    expect(screen.getByText('Discord Server')).toBeInTheDocument();

    const forumLink = screen.getByRole('link', {
      name: /SojuSanctuary Club/i,
    });
    expect(forumLink).toHaveAttribute('href');
  });
});
