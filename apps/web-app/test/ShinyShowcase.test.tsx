import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShinyShowcase from '../src/components/ShinyShowcase';
import { calculateShinyPoints } from '@team-soju/utils';

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      whileHover: _whileHover,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      whileHover?: unknown;
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
    }) => <div {...props}>{children}</div>,
    button: ({
      children,
      whileHover: _whileHover,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...props
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
      whileHover?: unknown;
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
    }) => <button {...props}>{children}</button>,
  },
}));

jest.mock('@team-soju/utils', () => ({
  calculateShinyPoints: jest.fn(),
  getPokemonTier: jest.fn().mockReturnValue('A'),
  capitalize: jest.fn((value: string) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : value
  ),
}));

const mockFetch = jest.fn();
const mockCalculateShinyPoints = calculateShinyPoints as jest.MockedFunction<typeof calculateShinyPoints>;

beforeEach(() => {
  mockCalculateShinyPoints.mockImplementation(async (shinyId: string) => {
    const pointsById: Record<string, number> = {
      'shiny-1': 12,
      'shiny-2': 20,
      'shiny-3': 30,
    };

    return pointsById[shinyId] ?? 0;
  });

  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [
        {
          id: 'shiny-1',
          pokemon_name: 'pikachu',
          trainer_name: 'TrainerOne',
          encounter_type: 'swarm',
          is_secret: false,
          is_alpha: false,
          notes: null,
        },
        {
          id: 'shiny-2',
          pokemon_name: 'charmander',
          trainer_name: 'TrainerTwo',
          encounter_type: 'single',
          is_secret: false,
          is_alpha: false,
          notes: null,
        },
        {
          id: 'shiny-3',
          pokemon_name: 'bulbasaur',
          trainer_name: 'TrainerTwo',
          encounter_type: 'horde',
          is_secret: false,
          is_alpha: false,
          notes: null,
        },
      ],
    }),
    statusText: 'OK',
  });

  global.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('ShinyShowcase', () => {
  it('defaults to sorting trainers by number ot descending', async () => {
    render(<ShinyShowcase />);

    const trainerOne = await screen.findByText('TrainerOne');
    const trainerTwo = screen.getByText('TrainerTwo');

    expect(
      trainerTwo.compareDocumentPosition(trainerOne) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByText(/\(2 OT shinies • 50 pts\)/i)).toBeInTheDocument();
  });

  it('can sort trainers by points', async () => {
    render(<ShinyShowcase />);

    const trainerOne = await screen.findByText('TrainerOne');
    expect(screen.getByText('TrainerTwo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open sorting/i }));
    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'points' },
    });
    fireEvent.change(screen.getByLabelText(/^order$/i), {
      target: { value: 'asc' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      const trainerTwo = screen.getByText('TrainerTwo');
      expect(
        trainerOne.compareDocumentPosition(trainerTwo) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });
  });

  it('filters trainers by search term', async () => {
    render(<ShinyShowcase />);

    expect(await screen.findByText('TrainerOne')).toBeInTheDocument();
    expect(screen.getByText('TrainerTwo')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Search by Pokémon or trainer name/i);
    fireEvent.change(input, { target: { value: 'TrainerTwo' } });

    await waitFor(() => {
      expect(screen.getByText('TrainerTwo')).toBeInTheDocument();
      expect(screen.queryByText('TrainerOne')).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no shinies match search', async () => {
    render(<ShinyShowcase />);

    expect(await screen.findByText('TrainerOne')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Search by Pokémon or trainer name/i);
    fireEvent.change(input, { target: { value: 'Nonexistent' } });

    await waitFor(() => {
      expect(
        screen.getByText(/No shiny Pokémon found. Try adjusting your search./i)
      ).toBeInTheDocument();
    });
  });

  it('applies filter selections to the shinies request and keeps sorting local', async () => {
    render(<ShinyShowcase />);

    expect(await screen.findByText('TrainerOne')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open filters/i }));
    fireEvent.change(screen.getByLabelText(/trainer name/i), {
      target: { value: 'TrainerTwo' },
    });
    fireEvent.change(screen.getByLabelText(/encounter type/i), {
      target: { value: 'swarm' },
    });
    fireEvent.change(screen.getByLabelText(/secret shinies/i), {
      target: { value: 'true' },
    });
    fireEvent.change(screen.getByLabelText(/points/i), {
      target: { value: '40' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(screen.getByText('TrainerTwo')).toBeInTheDocument();
      expect(screen.queryByText('TrainerOne')).not.toBeInTheDocument();
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('encounter_type=swarm')
      );
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('is_secret=true')
      );
      expect(String(mockFetch.mock.lastCall?.[0] ?? '')).not.toContain('trainer_id=');
    });

    const requestCountBeforeSort = mockFetch.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /open sorting/i }));
    fireEvent.change(screen.getByLabelText(/sort by/i), {
      target: { value: 'points' },
    });
    fireEvent.change(screen.getByLabelText(/^order$/i), {
      target: { value: 'asc' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(requestCountBeforeSort);
      expect(screen.getByText('TrainerTwo')).toBeInTheDocument();
    });
  });
});
