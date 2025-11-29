import React from 'react';
import { render, screen } from '@testing-library/react';
import EventsHeader from '../src/components/EventsHeader';

describe('EventsHeader', () => {
  it('renders heading and events link', () => {
    render(<EventsHeader />);

    expect(screen.getByText('Events')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /events page/i });
    expect(link).toHaveAttribute('href', '/events/');
  });
});
