import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from '../src/components/Header';
import * as i18n from '../src/i18n';

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

  it('renders translated navigation labels when a locale is provided', () => {
    render(<Header locale="es" />);

    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/?lang=es');
    expect(screen.getByRole('link', { name: 'Herramientas' })).toHaveAttribute('href', '/tools?lang=es');
  });

  it('renders a language picker with the active locale selected', () => {
    render(<Header locale="zh" />);

    expect(screen.getAllByRole('combobox')[0]).toHaveValue('zh');
  });

  it('prefers the current URL locale when no locale prop is provided', () => {
    window.history.replaceState({}, '', '/feebas-tile-checker?lang=zh');

    render(<Header />);

    expect(screen.getAllByRole('combobox')[0]).toHaveValue('zh');
  });

  it('stores the selected locale when the language picker changes', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/tools?foo=bar');
    const navigateSpy = jest.spyOn(i18n, 'navigateToLocaleOverride').mockImplementation(() => {});
    render(<Header locale="en" />);

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'es');

    expect(window.localStorage.getItem('team-soju-locale')).toBe('es');
    expect(navigateSpy).toHaveBeenCalledWith('http://localhost/tools?foo=bar&lang=es');

    navigateSpy.mockRestore();
  });
});
