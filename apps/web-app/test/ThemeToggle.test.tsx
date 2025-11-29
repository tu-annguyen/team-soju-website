import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../src/components/ThemeToggle';

describe('ThemeToggle', () => {
  it('toggles theme and updates aria-label and localStorage', () => {
    render(<ThemeToggle />);

    const buttonInitial = screen.getByRole('button', {
      name: /Switch to dark mode/i,
    });
    expect(buttonInitial).toBeInTheDocument();

    fireEvent.click(buttonInitial);

    const buttonAfter = screen.getByRole('button', {
      name: /Switch to light mode/i,
    });
    expect(buttonAfter).toBeInTheDocument();
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });
});
