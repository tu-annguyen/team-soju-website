import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import NumberSpinner from '../src/components/NumberSpinner';

type HarnessProps = Omit<React.ComponentProps<typeof NumberSpinner>, 'onValueChange'>;

function Harness({ value: initialValue, ...props }: HarnessProps) {
  const [value, setValue] = useState(initialValue);
  return <NumberSpinner {...props} value={value} onValueChange={setValue} />;
}

describe('NumberSpinner', () => {
  it('steps with its buttons and keyboard while respecting bounds', () => {
    render(<Harness aria-label="Winners" min={1} max={3} value="2" />);
    const input = screen.getByLabelText('Winners');

    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }));
    expect(input).toHaveValue(3);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue(3);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue(2);
  });

  it('supports decimal and negative steps', () => {
    render(<Harness aria-label="Points" step={0.001} value="0" />);
    const input = screen.getByLabelText('Points');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue(0.001);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue(-0.001);
    fireEvent.change(input, { target: { value: '-5' } });
    expect(input).toHaveValue(-5);
  });

  it('supports reversed stepping and clears after decrementing the maximum', () => {
    render(
      <Harness
        aria-label="Minimum tier"
        clearOnDecrementAtMax
        min={0}
        max={7}
        reverse
        value=""
      />
    );
    const input = screen.getByLabelText('Minimum tier');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue(null);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue(7);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue(6);
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue(null);
  });

  it('does not step while disabled', () => {
    render(<Harness aria-label="Disabled value" disabled value="4" />);
    const input = screen.getByLabelText('Disabled value');
    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }));
    expect(input).toHaveValue(4);
    expect(input).toHaveClass('disabled:bg-gray-100', 'disabled:text-gray-500');
    expect(input.parentElement).toHaveClass('opacity-50');
  });
});
