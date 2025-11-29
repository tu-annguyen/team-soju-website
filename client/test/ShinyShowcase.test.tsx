import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ShinyShowcase from '../src/components/ShinyShowcase';

jest.mock('../src/data/showcase.json', () => ({
  __esModule: true,
  default: [
    {
      name: 'TrainerOne',
      numOT: 1,
      shinies: [
        { name: 'Pikachu', imageUrl: '/pikachu.png', attribute: 'secret' },
      ],
    },
    {
      name: 'TrainerTwo',
      numOT: 2,
      shinies: [
        { name: 'Charmander', imageUrl: '/charmander.png', attribute: '' },
      ],
    },
  ],
}));

describe('ShinyShowcase', () => {
  it('filters trainers by search term', () => {
    render(<ShinyShowcase />);

    expect(screen.getByText('TrainerOne')).toBeInTheDocument();
    expect(screen.getByText('TrainerTwo')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Search by Pokémon or trainer name/i);
    fireEvent.change(input, { target: { value: 'TrainerTwo' } });

    expect(screen.getByText('TrainerTwo')).toBeInTheDocument();
    expect(screen.queryByText('TrainerOne')).not.toBeInTheDocument();
  });

  it('shows empty state when no shinies match search', () => {
    render(<ShinyShowcase />);

    const input = screen.getByPlaceholderText(/Search by Pokémon or trainer name/i);
    fireEvent.change(input, { target: { value: 'Nonexistent' } });

    expect(
      screen.getByText(/No shiny Pokémon found. Try adjusting your search./i)
    ).toBeInTheDocument();
  });
});
