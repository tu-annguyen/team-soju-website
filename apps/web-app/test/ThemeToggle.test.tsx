import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../src/components/ThemeToggle';

describe('ThemeToggle', () => {
  let systemIsDark = false;
  let themeChangeHandler: ((event: MediaQueryListEvent) => void) | undefined;

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
    systemIsDark = false;
    themeChangeHandler = undefined;

    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' && systemIsDark,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn((_event, handler) => {
        themeChangeHandler = handler;
      }),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

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
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('uses and follows the system theme when there is no saved preference', () => {
    systemIsDark = true;
    render(<ThemeToggle />);

    expect(screen.getByRole('button', { name: /Switch to light mode/i })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('theme')).toBeNull();

    act(() => {
      themeChangeHandler?.({ matches: false } as MediaQueryListEvent);
    });

    expect(screen.getByRole('button', { name: /Switch to dark mode/i })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('keeps a saved preference when the system theme changes', () => {
    window.localStorage.setItem('theme', 'light');
    render(<ThemeToggle />);

    act(() => {
      themeChangeHandler?.({ matches: true } as MediaQueryListEvent);
    });

    expect(screen.getByRole('button', { name: /Switch to dark mode/i })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
