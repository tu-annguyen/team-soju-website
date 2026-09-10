import React from 'react';
import { render } from '@testing-library/react';
import ClockAttributeIcon from '../src/components/shiny-war/ClockAttributeIcon';

describe('ClockAttributeIcon', () => {
  it.each([
    ['season', 'Spring', 'seedling'],
    ['season', 'Summer', 'sun'],
    ['season', 'Autumn', 'leaf'],
    ['season', 'Winter', 'snowflake'],
    ['timeOfDay', 'Morning', 'cloud-sun'],
    ['timeOfDay', 'Day', 'sun'],
    ['timeOfDay', 'Night', 'moon'],
  ] as const)('renders the %s %s icon', (kind, value, iconName) => {
    const { container } = render(<ClockAttributeIcon kind={kind} value={value} />);

    expect(container.querySelector(`[data-clock-icon="${iconName}"]`)).toBeInTheDocument();
  });

  it('renders nothing for an unknown value', () => {
    const { container } = render(<ClockAttributeIcon kind="season" value="Unknown" />);

    expect(container).toBeEmptyDOMElement();
  });
});
