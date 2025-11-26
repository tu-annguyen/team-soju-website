import React from 'react';
import { render, screen } from '@testing-library/react';
import Header from '../src/components/Header';

jest.mock('../src/components/ThemeToggle', () => () => (
  <button aria-label="theme-toggle-mock" />
));

describe('Header', () => {
  it('renders logo and primary navigation links', () => {
    const { container } = render(<Header />);

    const logoLink = screen.getByRole('link', { name: /Team Soju/i });
    expect(logoLink).toHaveAttribute('href', '/');

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Shiny Showcase' })).toHaveAttribute(
      'href',
      '/shiny-showcase'
    );
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/events');

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
  });
});
