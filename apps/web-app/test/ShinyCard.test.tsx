import React from 'react';
import { render, screen } from '@testing-library/react';
import ShinyCard from '../src/components/ShinyCard';

describe('ShinyCard', () => {
  it('renders pokemon name and image', () => {
    render(
      <ShinyCard
        pokemonName="Pikachu"
        trainerName="Trainer"
        imageUrl="/pikachu.png"
        attribute="secret"
      />
    );

    expect(screen.getByText('Pikachu')).toBeInTheDocument();
    expect(screen.getByAltText(/Shiny Pikachu/i)).toHaveAttribute('src', '/pikachu.png');
    expect(screen.getByAltText(/secret/i)).toBeInTheDocument();
  });

  it('does not render attribute icon when attribute is not provided', () => {
    render(
      <ShinyCard
        pokemonName="Pikachu"
        trainerName="Trainer"
        imageUrl="/pikachu.png"
      />
    );

    expect(screen.queryByAltText(/secret/i)).not.toBeInTheDocument();
  });
});
