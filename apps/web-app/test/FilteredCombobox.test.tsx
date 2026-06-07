import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilteredCombobox } from '../src/components/catch-events/FilteredCombobox';

function TestCombobox() {
  const [value, setValue] = React.useState('');

  return (
    <label>
      Pokemon species
      <FilteredCombobox
        options={['Amoonguss', 'Ampharos', 'Arbok', 'Tropius']}
        value={value}
        onChange={setValue}
      />
    </label>
  );
}

describe('FilteredCombobox', () => {
  it('filters visible options while the user types', async () => {
    const user = userEvent.setup();
    render(<TestCombobox />);

    const input = screen.getByLabelText('Pokemon species');
    await act(async () => {
      await user.click(input);
    });

    expect(screen.getByRole('option', { name: 'Amoonguss' })).toBeInTheDocument();

    await act(async () => {
      await user.type(input, 'Tro');
    });

    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'Tropius' })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: 'Amoonguss' })).not.toBeInTheDocument();
  });

  it('selects an option from the filtered menu', async () => {
    const user = userEvent.setup();
    render(<TestCombobox />);

    const input = screen.getByLabelText('Pokemon species');
    await act(async () => {
      await user.type(input, 'Tro');
    });
    await act(async () => {
      await user.click(screen.getByRole('option', { name: 'Tropius' }));
    });

    expect(input).toHaveValue('Tropius');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
