import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShinyCard from '../src/components/ShinyCard';

describe('ShinyCard', () => {
  it('renders pokemon name, image, and secret icon', () => {
    render(
      <ShinyCard
        pokemonName="Pikachu"
        trainerName="Trainer"
        imageUrl="/pikachu.png"
        isFailed={false}
        isSecret={true}
        isAlpha={false}
        encounterType=""
      />
    );

    expect(screen.getByText('Pikachu')).toBeInTheDocument();
    expect(screen.getByAltText(/Shiny Pikachu/i)).toHaveAttribute(
      'src',
      '/pikachu.png'
    );
    expect(screen.getByAltText(/Secret shiny/i)).toBeInTheDocument();
  });

  it('does not render the secret icon when not provided', () => {
    render(
      <ShinyCard
        pokemonName="Pikachu"
        trainerName="Trainer"
        imageUrl="/pikachu.png"
        isFailed={false}
        isSecret={false}
        isAlpha={false}
        encounterType=""
      />
    );

    expect(screen.queryByAltText(/Secret shiny/i)).not.toBeInTheDocument();
  });

  it('opens shiny details for the default variant when clicked', async () => {
    const user = userEvent.setup();

    render(
      <ShinyCard
        pokemonName="Pikachu"
        trainerName="Trainer"
        imageUrl="/pikachu.png"
        isFailed={false}
        isSecret={false}
        isAlpha={false}
        encounterType="honey_tree"
        catchDate="2026-01-15"
        totalEncounters={20374}
        speciesEncounters={3332}
        nature="Bold"
        ivHp={11}
        ivAttack={1}
        ivDefense={15}
        ivSpAttack={31}
        ivSpDefense={14}
        ivSpeed={4}
      />
    );

    await user.click(screen.getByRole('button', { name: /Pikachu/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Trainer: Trainer')).toBeInTheDocument();
    expect(screen.getByText('2026-01-15')).toBeInTheDocument();
    expect(screen.getByText('20,374')).toBeInTheDocument();
    expect(screen.getByText('3,332')).toBeInTheDocument();
    expect(screen.getByText('Honey Tree')).toBeInTheDocument();
    expect(screen.getByText('Bold')).toBeInTheDocument();
    expect(screen.getByText('11 / 1 / 15 / 31 / 14 / 4')).toBeInTheDocument();
  });
});
