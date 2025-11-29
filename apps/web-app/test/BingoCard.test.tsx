import React from 'react';
import { render, screen } from '@testing-library/react';
import BingoCard from '../src/components/BingoCard';

describe('BingoCard', () => {
  it('renders with default styling when no trainers', () => {
    render(<BingoCard value="Tile" />);
    const card = screen.getByText('Tile');
    expect(card.className).toMatch(/bg-gray-2/);
  });

  it('uses Team Buddha styling for Buddha member', () => {
    render(<BingoCard value="Tile" trainerNames={['Buddhalicious']} />);
    const card = screen.getByText('Tile');
    expect(card.className).toMatch(/primary-100/);
  });

  it('uses Team Aisu styling for Aisu member', () => {
    render(<BingoCard value="Tile" trainerNames={['XiaoLongBao']} />);
    const card = screen.getByText('Tile');
    expect(card.className).toMatch(/secondary-100/);
  });

  it('shows tooltip content when trainers present', () => {
    render(<BingoCard value="Tile" trainerNames={['Buddhalicious', 'XiaoLongBao']} />);
    expect(screen.getByText(/Completed by:/i)).toBeInTheDocument();
    expect(screen.getByText(/Buddhalicious, XiaoLongBao/)).toBeInTheDocument();
  });
});
