import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RosterManager from '../src/components/shiny-war/RosterManager';
import { shinyWarRequest } from '../src/components/shiny-war/api';

jest.mock('../src/components/shiny-war/api', () => ({
  shinyWarRequest: jest.fn().mockResolvedValue([]),
}));

const participant = {
  member_id: 'member-1',
  ign: 'SojuHunter',
  rank: 'Member',
  has_app_user: true,
  team: 'bidoof' as const,
  is_official: true,
  hunts: [],
};

describe('Shiny Wars roster manager', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({ data: [] }),
    });
    (shinyWarRequest as jest.Mock).mockClear();
  });

  it('updates a participant team and official-war status independently', async () => {
    const onChanged = jest.fn().mockResolvedValue(undefined);
    render(
      <RosterManager
        apiBaseUrl="https://example.test/api"
        locked={false}
        participants={[participant]}
        onChanged={onChanged}
      />
    );
    expect(screen.getByText('1 participant · 1/30 official · Open')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('SojuHunter team'), { target: { value: 'arceus' } });
    await waitFor(() => expect(shinyWarRequest).toHaveBeenCalledWith(
      'https://example.test/api',
      '/participants/member-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ team: 'arceus', is_official: true }),
      })
    ));

    fireEvent.click(screen.getByLabelText('SojuHunter official war'));
    await waitFor(() => expect(shinyWarRequest).toHaveBeenCalledWith(
      'https://example.test/api',
      '/participants/member-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ team: 'bidoof', is_official: false }),
      })
    ));
  });
});
