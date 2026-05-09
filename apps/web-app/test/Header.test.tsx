import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Header from '../src/components/Header';
import * as i18n from '../src/i18n';

jest.mock('../src/components/ThemeToggle', () => () => (
  <button aria-label="theme-toggle-mock" />
));

describe('Header', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

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

  it('renders the compact language menu with the active locale code', () => {
    render(<Header locale="zh" />);

    expect(screen.getByRole('button', { name: /language|idioma|语言/i })).toHaveTextContent('ZH');
  });

  it('prefers the current URL locale when no locale prop is provided', () => {
    window.history.replaceState({}, '', '/feebas-tile-checker?lang=zh');

    render(<Header />);

    expect(screen.getByRole('button', { name: /language|idioma|语言/i })).toHaveTextContent('ZH');
  });

  it('stores the selected locale when the language menu changes', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/tools?foo=bar');
    const navigateSpy = jest.spyOn(i18n, 'navigateToLocaleOverride').mockImplementation(() => {});
    render(<Header locale="en" />);

    await user.click(screen.getByRole('button', { name: /language|idioma|语言/i }));
    await user.click(screen.getByRole('button', { name: /Español ES/i }));

    expect(window.localStorage.getItem('team-soju-locale')).toBe('es');
    expect(navigateSpy).toHaveBeenCalledWith('http://localhost/tools?foo=bar&lang=es');

    navigateSpy.mockRestore();
  });

  it('shows the signed-in IGN and sign out action in the account menu', async () => {
    const user = userEvent.setup();
    render(<Header />);

    act(() => {
      window.dispatchEvent(new CustomEvent('team-soju-auth-updated', {
        detail: {
          id: 'user-id',
          email: 'trainer@example.com',
          ign: 'Trainer',
        },
      }));
    });

    await user.click(await screen.findByRole('button', { name: 'Account' }));

    expect(screen.getByRole('link', { name: 'Trainer' })).toHaveAttribute('href', '/auth');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('toggles tool links inside the mobile tools menu', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await user.click(screen.getByRole('button', { name: /toggle menu|abrir o cerrar menu|切换菜单/i }));

    const toolsToggle = screen.getByRole('button', { name: 'Tools' });

    expect(toolsToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('link', { name: 'Feebas Tile Tracker' })).toHaveLength(1);

    await user.click(toolsToggle);

    expect(toolsToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('link', { name: 'Feebas Tile Tracker' })).toHaveLength(2);

    await user.click(toolsToggle);

    expect(toolsToggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: 'Feebas Tile Tracker' })).toHaveLength(1);
    });
  });
});
