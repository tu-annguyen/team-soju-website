import { applyTeamSpeciesDuplicatePenalty } from '../src/utils/teamDuplicatePenalty';

describe('applyTeamSpeciesDuplicatePenalty', () => {
  it('marks later catches of the same species within a team as duplicates', () => {
    const shinies = applyTeamSpeciesDuplicatePenalty(
      [
        {
          id: '2',
          pokemonName: 'seviper',
          trainerName: 'Misty',
          isFailed: false,
          catchDate: '2026-03-21',
          createdAt: '2026-03-21T01:00:00.000Z',
          points: 10,
        },
        {
          id: '1',
          pokemonName: 'seviper',
          trainerName: 'Ash',
          isFailed: false,
          catchDate: '2026-03-20',
          createdAt: '2026-03-20T01:00:00.000Z',
          points: 10,
        },
        {
          id: '3',
          pokemonName: 'seviper',
          trainerName: 'Brock',
          isFailed: false,
          catchDate: '2026-03-22',
          createdAt: '2026-03-22T01:00:00.000Z',
          points: 10,
        },
      ],
      {
        alpha: ['Ash', 'Misty'],
        beta: ['Brock'],
      }
    );

    expect(shinies).toEqual([
      expect.objectContaining({
        id: '2',
        isDuplicate: true,
        points: 1,
      }),
      expect.objectContaining({
        id: '1',
        isDuplicate: false,
        points: 10,
      }),
      expect.objectContaining({
        id: '3',
        isDuplicate: false,
        points: 10,
      }),
    ]);
  });

  it('does not penalize failed shinies', () => {
    const shinies = applyTeamSpeciesDuplicatePenalty(
      [
        {
          id: '1',
          pokemonName: 'seviper',
          trainerName: 'Ash',
          isFailed: true,
          catchDate: '2026-03-20',
          createdAt: '2026-03-20T01:00:00.000Z',
          points: 0,
        },
        {
          id: '2',
          pokemonName: 'seviper',
          trainerName: 'Misty',
          isFailed: false,
          catchDate: '2026-03-21',
          createdAt: '2026-03-21T01:00:00.000Z',
          points: 10,
        },
      ],
      {
        alpha: ['Ash', 'Misty'],
      }
    );

    expect(shinies).toEqual([
      expect.objectContaining({
        id: '1',
        isDuplicate: false,
        points: 0,
      }),
      expect.objectContaining({
        id: '2',
        isDuplicate: false,
        points: 10,
      }),
    ]);
  });
});
