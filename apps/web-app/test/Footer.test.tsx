import React from 'react';
import { render, screen } from '@testing-library/react';
import Footer from '../src/components/Footer';

describe('Footer', () => {
  it('renders team name, navigation links, and legal text', () => {
    render(<Footer />);

    const logo = screen.getByAltText(/Team Soju Logo/i);
    expect(logo).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Shiny Showcase' })).toHaveAttribute(
      'href',
      '/shiny-showcase'
    );
    expect(screen.getByRole('link', { name: 'Events' })).toHaveAttribute('href', '/events');

    expect(
      screen.getByText(/This website is not affiliated with Nintendo/i)
    ).toBeInTheDocument();
  });
});
