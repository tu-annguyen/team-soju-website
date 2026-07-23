import anniversary2025 from '../src/data/anniversary2025.json';
import { calculateAnniversaryTeamScores } from '../src/utils/anniversaryScoring';
import type { AnniversaryData } from '../src/types/anniversary';

describe('calculateAnniversaryTeamScores', () => {
  it('scores main events, mini events, and event shinies from winners', () => {
    const anniversaryData: AnniversaryData = {
      teams: [
        { name: 'Squirtle Squad', logo: '/squirtle.png', score: 999 },
        { name: 'Sloppy Spindas', logo: '/spinda.png', score: 999 },
        { name: 'Loco Ludicolos', logo: '/ludicolo.png', score: 999 },
      ],
      mainEvents: [
        {
          icon: '/main.png',
          name: 'Main Event',
          first: 'Squirtle Squad',
          second: 'Player Two - Sloppy Spindas',
          third: 'Player Three - Loco Ludicolos',
        },
      ],
      miniEvents: [
        {
          icon: '/mini.png',
          name: 'Mini Event',
          first: 'Mini Winner - Sloppy Spindas',
        },
      ],
      eventShinies: [
        {
          icon: '/shiny.png',
          name: 'Shiny Event',
          OT: 'Shiny Hunter - Loco Ludicolos',
          shinyScore: 2.5,
        },
      ],
    };

    expect(calculateAnniversaryTeamScores(anniversaryData)).toEqual([
      { name: 'Squirtle Squad', logo: '/squirtle.png', score: 5 },
      { name: 'Sloppy Spindas', logo: '/spinda.png', score: 5 },
      { name: 'Loco Ludicolos', logo: '/ludicolo.png', score: 3.5 },
    ]);
  });

  it('resolves team aliases and ignores missing or unmatched winners', () => {
    const anniversaryData: AnniversaryData = {
      teams: [
        { name: 'OnlyHeffs', logo: '/onlyheffs.png', score: 0 },
        { name: 'Terrific Team Tunacore (TTT)', logo: '/ttt.png', score: 0 },
      ],
      mainEvents: [
        {
          icon: '/main.png',
          name: 'Main Event',
          first: 'tunacore - TTT',
          second: 'Unknown Player - Missing Team',
        },
        {
          icon: '/main-tbd.png',
          name: 'TBD Event',
        },
      ],
      miniEvents: [
        {
          icon: '/mini.png',
          name: 'Mini Event',
          first: 'OnlyHeffs',
        },
      ],
      eventShinies: [
        {
          icon: '/shiny.png',
          name: 'Shiny Event',
          OT: 'Unknown OT',
        },
      ],
    };

    expect(calculateAnniversaryTeamScores(anniversaryData)).toEqual([
      { name: 'OnlyHeffs', logo: '/onlyheffs.png', score: 2 },
      { name: 'Terrific Team Tunacore (TTT)', logo: '/ttt.png', score: 5 },
    ]);
  });

  it('computes scores from the current 2025 anniversary winners', () => {
    const scoresByTeamName = Object.fromEntries(
      calculateAnniversaryTeamScores(anniversary2025).map((team) => [
        team.name,
        team.score,
      ])
    );

    expect(scoresByTeamName).toEqual({
      OnlyHeffs: 50.5,
      'Terrific Team Tunacore (TTT)': 41.5,
      'Reef Squad': 30.5,
      'Cub Skouts': 16,
    });
  });
});
