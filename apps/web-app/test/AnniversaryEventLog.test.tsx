import React from 'react';
import { render, screen } from '@testing-library/react';
import AnniversaryEventLog from '../src/components/AnniversaryEventLog';

jest.mock('../src/data/anniversary.json', () => ({
  __esModule: true,
  default: {
    mainEvents: [
      { icon: '/icon-main.png', name: 'Main Event', first: 'Alice', second: 'Bob', third: 'Carol' }
    ],
    miniEvents: [
      { icon: '/icon-mini.png', name: 'Mini Event', first: 'Dave' }
    ],
    eventShinies: [
      { icon: '/icon-shiny.png', name: 'Shiny Event', OT: 'Eve', shinyScore: 10 }
    ]
  }
}));

describe('AnniversaryEventLog', () => {
  it('renders sections and event cards from data', () => {
    render(<AnniversaryEventLog />);

    expect(screen.getByText(/Event Log/i)).toBeInTheDocument();
    expect(screen.getByText(/Main Events/i)).toBeInTheDocument();
    expect(screen.getByText(/Mini Events/i)).toBeInTheDocument();
    expect(screen.getByText(/Event Shinies/i)).toBeInTheDocument();

    expect(screen.getByText('Main Event')).toBeInTheDocument();
    expect(screen.getByText('Mini Event')).toBeInTheDocument();
    expect(screen.getByText('Shiny Event')).toBeInTheDocument();

    expect(screen.getByText(/1st place:/i)).toBeInTheDocument();
    expect(screen.getByText(/Winner:/i)).toBeInTheDocument();
    expect(screen.getByText(/OT:/i)).toBeInTheDocument();
  });
});
