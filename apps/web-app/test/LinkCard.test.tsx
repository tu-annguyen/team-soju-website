import React from 'react';
import { render, screen } from '@testing-library/react';
import LinkCard from '../src/components/LinkCard';

describe('LinkCard', () => {
  it('renders title and description', () => {
    render(
      <LinkCard
        title="Test title"
        description="Test description"
        url="/internal"
        icon={<span>icon</span>}
      />
    );

    expect(screen.getByText('Test title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('renders internal links without target or rel attributes', () => {
    render(
      <LinkCard
        title="Internal"
        description="Internal link"
        url="/internal"
        icon={<span>icon</span>}
      />
    );

    const link = screen.getByRole('link', { name: /internal/i });

    expect(link).toHaveAttribute('href', '/internal');
    expect(link).not.toHaveAttribute('target');
    expect(link).not.toHaveAttribute('rel');
  });

  it('renders external links with target and rel attributes', () => {
    render(
      <LinkCard
        title="External"
        description="External link"
        url="https://example.com"
        icon={<span>icon</span>}
      />
    );

    const link = screen.getByRole('link', { name: /external/i });

    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
