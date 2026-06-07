import React from 'react';
import { render, screen } from '@testing-library/react';
import { HostManageView } from '../src/components/catch-events/HostManageView';
import { statusLabelKeys } from '../src/components/catch-events/shared';
import type { CatchEventConfig, CatchEventStatus, CatchEventSubmission } from '../src/utils/catchEventScoring';

const statusLabels = Object.fromEntries(
  Object.entries(statusLabelKeys).map(([status, label]) => [status, label])
) as Record<CatchEventStatus, string>;

const eventFixture: CatchEventConfig = {
  id: 'event-1',
  name: 'Legacy Review Event',
  ownerUserId: 'user-1',
  ownerIgn: 'Host',
  eventDate: '2026-05-20',
  startLocal: '2026-05-20T10:00',
  endLocal: '2026-05-20T11:00',
  timezone: 'America/Los_Angeles',
  region: 'Hoenn',
  route: 'Route 119',
  winnerCount: 4,
  targets: ['Feebas'],
  speciesBonuses: [],
  speciesPenalties: [],
  natureBonuses: [],
  naturePenalties: [],
  useLowestScoreFinalPlace: true,
  isLeaderboardPublished: false,
  isPrivate: true,
  submissionsClosed: false,
  autoCheckEnabled: false,
  createdAt: '2026-05-20T17:00:00.000Z',
};

const legacySubmission: CatchEventSubmission = {
  id: 'submission-1',
  eventId: 'event-1',
  playerIgn: 'Trainer',
  species: 'Feebas',
  nature: 'Docile',
  totalIv: 141,
  catchLocal: '2026-05-20T10:30',
  timezone: 'America/Los_Angeles',
  region: 'Hoenn',
  route: 'Route 119',
  screenshotNames: [],
  catchUtc: '2026-05-20T17:30:00.000Z',
  score: 141,
  flags: [],
  status: 'needs-review',
  createdAt: '2026-05-20T17:31:00.000Z',
};

function renderHostManageView() {
  return render(
    <HostManageView
      isAuthLoading={false}
      isLoading={false}
      authUser={{ id: 'user-1', email: 'host@example.com', ign: 'Host' }}
      activeEvent={eventFixture}
      manageableEvents={[eventFixture]}
      activeSubmissions={[legacySubmission]}
      createdEventId=""
      collaboratorIdentifier=""
      collaboratorMessage=""
      statusLabels={statusLabels}
      timezoneOptions={[{ value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-7)' }]}
      locale="en"
      tr={(text) => text}
      translateSpeciesDisplay={(species) => species}
      translateNatureDisplay={(nature) => nature}
      translateRegion={(region) => region}
      translateLocation={(location) => location}
      setActiveEventId={jest.fn()}
      setSelectedProof={jest.fn()}
      updateSubmissionStatus={jest.fn()}
      updateSubmission={jest.fn()}
      updateLeaderboardPublished={jest.fn()}
      updateSubmissionsClosed={jest.fn()}
      updateAutoCheckEnabled={jest.fn()}
      setCollaboratorIdentifier={jest.fn()}
      addCollaborator={jest.fn()}
      removeCollaborator={jest.fn()}
      loadEventIntoForm={jest.fn()}
      deleteEvent={jest.fn()}
    />
  );
}

describe('HostManageView', () => {
  it('displays legacy needs-review submissions without allowing new needs-review selection', () => {
    renderHostManageView();

    const statusSelect = screen.getByDisplayValue('Needs Review') as HTMLSelectElement;
    const needsReviewOptions = Array.from(statusSelect.options).filter(
      (option) => option.value === 'needs-review'
    );

    expect(needsReviewOptions).toHaveLength(1);
    expect(needsReviewOptions[0]).toBeDisabled();
    expect(Array.from(statusSelect.options).filter((option) => (
      option.value === 'needs-review' && !option.disabled
    ))).toHaveLength(0);
  });
});
