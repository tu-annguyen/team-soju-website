import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AppUpdateBanner from '../src/components/AppUpdateBanner';

type MockResponseOptions = {
  ok?: boolean;
  body?: unknown;
};

function mockResponse({ ok = true, body }: MockResponseOptions = {}) {
  return {
    ok,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('AppUpdateBanner', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    fetchMock.mockReset();
    global.fetch = fetchMock;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays hidden when the deployed build matches the loaded build', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: { buildId: 'current' } }));

    render(
      <AppUpdateBanner currentBuildId="current" message="Update available" updateLabel="Update" />
    );
    await flushPromises();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/version\.json\?t=\d+$/),
      expect.objectContaining({ cache: 'no-store' })
    );
  });

  it('shows localized copy when a newer build is detected', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: { buildId: 'new' } }));

    render(
      <AppUpdateBanner
        currentBuildId="current"
        message="Hay una nueva version disponible."
        updateLabel="Actualizar"
      />
    );
    await flushPromises();

    expect(screen.getByRole('status')).toHaveTextContent('Hay una nueva version disponible.');
    expect(screen.getByRole('status')).toHaveClass('sticky', 'top-14', 'z-40');
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeInTheDocument();
  });

  it('reloads the page when Update is selected', async () => {
    const reloadPage = jest.fn();
    fetchMock.mockResolvedValue(mockResponse({ body: { buildId: 'new' } }));

    render(
      <AppUpdateBanner
        currentBuildId="current"
        message="Update available"
        updateLabel="Update"
        reloadPage={reloadPage}
      />
    );
    await flushPromises();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('checks every five minutes while visible and checks when visibility resumes', async () => {
    fetchMock.mockResolvedValue(mockResponse({ body: { buildId: 'current' } }));
    render(
      <AppUpdateBanner currentBuildId="current" message="Update available" updateLabel="Update" />
    );
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    fireEvent(document, new Event('visibilitychange'));
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not overlap requests and stops checking after unmount', async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    fetchMock.mockImplementation(
      () => new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      })
    );
    const { unmount } = render(
      <AppUpdateBanner currentBuildId="current" message="Update available" updateLabel="Update" />
    );

    await act(async () => {
      jest.advanceTimersByTime(10 * 60 * 1000);
    });
    fireEvent(document, new Event('visibilitychange'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();
    resolveRequest?.(mockResponse({ body: { buildId: 'new' } }));
    await flushPromises();
    jest.advanceTimersByTime(5 * 60 * 1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries after failed and malformed responses without showing the banner', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(mockResponse({ body: { buildId: '' } }))
      .mockResolvedValueOnce(mockResponse({ body: { buildId: 'new' } }));

    render(
      <AppUpdateBanner currentBuildId="current" message="Update available" updateLabel="Update" />
    );
    await flushPromises();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
    await flushPromises();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
    await flushPromises();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
