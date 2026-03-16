import React from 'react';
import { render, screen, within } from '@testing-library/react';
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
        tier="Tier 7"
        pointValue={1}
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
        tier="Tier 7"
        pointValue={1}
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
        tier="Tier 7"
        pointValue={1}
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

    const dialog = screen.getByRole('dialog');

    expect(dialog).toBeInTheDocument();
    expect(screen.getAllByAltText(/Shiny Pikachu/i)).toHaveLength(2);
    expect(within(dialog).getByAltText(/Shiny Pikachu/i)).toBeInTheDocument();
    expect(within(dialog).getByAltText(/honey_tree encounter/i)).toBeInTheDocument();
    expect(screen.getByText('Trainer: Trainer')).toBeInTheDocument();
    expect(screen.getByText('Tier 7')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2026-01-15')).toBeInTheDocument();
    expect(screen.getByText('20,374')).toBeInTheDocument();
    expect(screen.getByText('3,332')).toBeInTheDocument();
    expect(screen.getByText('Honey Tree')).toBeInTheDocument();
    expect(screen.getByText('Bold')).toBeInTheDocument();
    expect(screen.getByText('11 / 1 / 15 / 31 / 14 / 4')).toBeInTheDocument();
  });

  it('uses a shortened card name and expanded details name for hyphenated pokemon', async () => {
    const user = userEvent.setup();

    render(
      <ShinyCard
        pokemonName="Basculin-red-striped"
        trainerName="Trainer"
        imageUrl="/basculin.png"
        isFailed={false}
        isSecret={false}
        isAlpha={false}
        encounterType=""
        tier="Tier 7"
        pointValue={1}
      />
    );

    expect(screen.getByRole('button', { name: /Basculin-red-striped/i })).toBeInTheDocument();
    expect(screen.getByText('Basculin')).toBeInTheDocument();
    expect(screen.queryByText('Basculin-red-striped')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Basculin-red-striped/i }));

    expect(screen.getByRole('heading', { name: 'Basculin (red striped)' })).toBeInTheDocument();
  });
});
