import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ScrollToTop from '../src/components/ScrollToTop';

describe('ScrollToTop', () => {
  const scrollTo = jest.fn();
  const matchMedia = jest.fn().mockReturnValue({ matches: false });

  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    Object.defineProperty(window, 'scrollTo', { configurable: true, value: scrollTo });
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
    scrollTo.mockClear();
    matchMedia.mockClear();
  });

  it('only displays after the page has been scrolled down', () => {
    render(<ScrollToTop />);

    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument();

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 301 });
    act(() => fireEvent.scroll(window));

    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument();

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
    act(() => fireEvent.scroll(window));

    expect(screen.queryByRole('button', { name: 'Back to top' })).not.toBeInTheDocument();
  });

  it('smoothly scrolls back to the top when clicked', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
    render(<ScrollToTop />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to top' }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
