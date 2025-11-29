import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import DiscordWidget from '../src/components/DiscordWidget';

describe('DiscordWidget', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          id: 'guild-id',
          name: 'Team Soju',
          instant_invite: 'https://discord.gg/invite',
          presence_count: 5,
          channels: [],
          members: [
            {
              id: '1',
              username: 'UserOne',
              discriminator: '0001',
              avatar_url: '/avatar.png',
              status: 'online',
              bot: false,
            },
          ],
        }),
    });
  });

  it('shows loading state then renders widget content', async () => {
    render(<DiscordWidget />);

    expect(
      screen.getByText(/Loading Discord widget/i)
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText(/Team Soju Discord/i)).toBeInTheDocument()
    );

    expect(screen.getByText('UserOne')).toBeInTheDocument();
    const joinButton = screen.getByRole('link', { name: /Join Discord/i });
    expect(joinButton).toHaveAttribute('href', 'https://discord.gg/invite');
  });
});
