import React, { useMemo, useState } from 'react';
import Leaderboard from './Leaderboard';
import ActivityLog, { type EventShiny } from './ActivityLog';
import zodiacData from '../data/zodiac.json';
import { calculateZodiacScores } from '../utils/zodiacScoring';

interface LeaderboardTeam {
  name: string;
  logo: string;
  score: number;
}

interface ZodiacData {
  teams: LeaderboardTeam[];
  eligiblePokemon: Record<string, string[]>;
  teamMembers: Record<string, string[]>;
}

const typedZodiacData = zodiacData as ZodiacData;

const teamSections = [
  {
    teamKey: 'cobalion',
    teamName: "Cobalion's Commanders",
    headingClassName: 'text-secondary-500',
  },
  {
    teamKey: 'terrakion',
    teamName: "Terrakion's Titans",
    headingClassName: 'text-accent-500',
  },
  {
    teamKey: 'virizion',
    teamName: "Virizion's Vanguard",
    headingClassName: 'text-primary-500',
  },
] as const;

const Zodiac = () => {
  const [eligibleShinies, setEligibleShinies] = useState<EventShiny[]>([]);
  const scoring = useMemo(
    () =>
      calculateZodiacScores({
        eligiblePokemon: typedZodiacData.eligiblePokemon,
        shinies: eligibleShinies,
        teamDefinitions: teamSections.map(({ teamKey, teamName }) => ({
          key: teamKey,
          name: teamName,
        })),
        teamMembers: typedZodiacData.teamMembers,
      }),
    [eligibleShinies]
  );

  const teamsWithScores = useMemo(() => {
    return typedZodiacData.teams.map((team) => ({
      ...team,
      score: scoring.teams[team.name]?.score ?? team.score,
    }));
  }, [scoring]);

  const sortedTeamMembers = useMemo(
    () =>
      Object.fromEntries(
        teamSections.map(({ teamKey, teamName }) => {
          const members = [...(typedZodiacData.teamMembers[teamKey] ?? [])].sort(
            (leftMember, rightMember) => {
              const leftScore =
                scoring.teams[teamName]?.trainerPoints[leftMember] ?? 0;
              const rightScore =
                scoring.teams[teamName]?.trainerPoints[rightMember] ?? 0;

              if (rightScore !== leftScore) {
                return rightScore - leftScore;
              }

              return leftMember.localeCompare(rightMember);
            }
          );

          return [teamKey, members];
        })
      ),
    [scoring]
  );

  return (
    <section className="py-16">
      <div className="container">
        <div className="mb-12">
          <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            SOJU Zodiac War
          </h1>
          <p className="text-gray-700 dark:text-gray-300 mb-8">
            Welcome back to Team Soju's annual Zodiac Wars! Participants will be split into 3 teams and shiny hunt a list of eligible Lunar New Year themed Pokémon. Each shiny caught will be awarded points and the team with the most points by the end of the event will be crowned the winner. For more information on the rules and eligible Pokémon, check out the
            <a
              href="https://forums.pokemmo.com/index.php?/topic/196794-team-soju-zodiac-wars-2026-lny-bounty-shiny-wars/"
              className="text-primary-600 dark:text-primary-400 hover:underline ml-1"
            >
            forum post
            </a>
            .
          </p>
          <img src="/images/2026/zodiac/zodiac-wars-banner.png" alt="Zodiac Wars Banner" className="w-full rounded-lg mb-12 block" />
        </div>
      </div>

      <Leaderboard teams={teamsWithScores} />

      <ActivityLog
        eligiblePokemon={typedZodiacData.eligiblePokemon}
        onEligibleShiniesLoaded={setEligibleShinies}
      />

      <section className="py-8">
        <div className="container">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
            Teams
          </h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {teamSections.map(({ teamKey, teamName, headingClassName }) => (
              <div key={teamKey} className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
                <h3 className={`text-center text-xl font-bold mb-4 ${headingClassName}`}>
                  {teamName}
                </h3>

                <div className="mb-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
                  <p className="flex items-center justify-between gap-4">
                    <span>Total Points</span>
                    <span className="font-semibold">
                      {scoring.teams[teamName]?.score ?? 0} pts
                    </span>
                  </p>
                  <p className="mt-2 flex items-center justify-between gap-4">
                    <span>Catch Points</span>
                    <span>{scoring.teams[teamName]?.catchPoints ?? 0} pts</span>
                  </p>
                  <p className="mt-2 flex items-center justify-between gap-4">
                    <span>Bonus Points</span>
                    <span>{scoring.teams[teamName]?.bonusPoints ?? 0} pts</span>
                  </p>
                  <p className="mt-2 flex items-center justify-between gap-4">
                    <span>Unique Evolution Lines</span>
                    <span>{scoring.teams[teamName]?.uniqueEvolutionLines ?? 0}</span>
                  </p>
                  {(scoring.teams[teamName]?.claimedBonuses.length ?? 0) > 0 ? (
                    <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                      Claimed: {scoring.teams[teamName]?.claimedBonuses.join(', ')}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {(sortedTeamMembers[teamKey] ?? []).map((member) => (
                    <p
                      key={member}
                      className="flex items-center justify-between gap-4 text-gray-700 dark:text-gray-300"
                    >
                      <span>{member}</span>
                      <span className="font-semibold">
                        {scoring.teams[teamName]?.trainerPoints[member] ?? 0} pts
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
};

export default Zodiac;
