import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Footer from '../src/components/Footer';
import * as i18n from '../src/i18n';

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

  it('falls back to English for missing or unknown locale values', () => {
    render(<Footer locale="unknown-locale" />);

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
  });

  it('renders a language picker with the active locale selected', () => {
    render(<Footer locale="zh" />);

    expect(screen.getByRole('combobox')).toHaveValue('zh');
  });

  it('stores the selected locale when the footer language picker changes', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/discord');
    const navigateSpy = jest.spyOn(i18n, 'navigateToLocaleOverride').mockImplementation(() => {});
    render(<Footer locale="en" />);

    await user.selectOptions(screen.getByRole('combobox'), 'es');

    expect(window.localStorage.getItem('team-soju-locale')).toBe('es');
    expect(navigateSpy).toHaveBeenCalledWith('http://localhost/discord?lang=es');

    navigateSpy.mockRestore();
  });
});
