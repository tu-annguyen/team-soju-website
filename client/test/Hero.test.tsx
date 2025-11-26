import React from 'react';
import { render, screen } from '@testing-library/react';
import Hero from '../src/components/Hero';

describe('Hero', () => {
  it('renders heading, description, and primary/secondary CTAs', () => {
    render(<Hero />);

    expect(
      screen.getByText(/Welcome to/i)
    ).toBeInTheDocument();

    const applyLink = screen.getByRole('link', { name: /Apply Now/i });
    expect(applyLink).toHaveAttribute(
      'href',
      'https://forums.pokemmo.com/index.php?/topic/182111-team-soju-is-recruiting/#comment-2123917'
    );

    const discordLink = screen.getByRole('link', { name: /Join Discord/i });
    expect(discordLink).toHaveAttribute('href', '/discord');

    expect(screen.getByAltText(/Team Soju Logo/i)).toBeInTheDocument();
  });
});
