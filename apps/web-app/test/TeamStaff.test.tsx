import React from 'react';
import { render, screen } from '@testing-library/react';
import TeamStaff from '../src/components/TeamStaff';

describe('TeamStaff', () => {
  it('renders team staff section and at least one staff member', () => {
    render(<TeamStaff />);

    expect(screen.getByText('Team Staff')).toBeInTheDocument();
    expect(
      screen.getByText(/Meet the dedicated team members who manage and lead Team Soju./i)
    ).toBeInTheDocument();

    // The underlying data includes several known staff members; assert at least one is present
    expect(screen.getByText('Buddhalicious')).toBeInTheDocument();
  });
});
