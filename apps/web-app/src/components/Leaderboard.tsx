import React from "react";

interface LeaderboardProps {
  teams: LeaderboardTeam[];
}

interface LeaderboardTeam {
  name: string;
  logo: string;
  score: number;
}

const Leaderboard = ({ teams }: LeaderboardProps) => {
  teams = teams.sort((a, b) => b.score - a.score); // Sort teams by score in descending order

  return (
    <section className="py-8">
      <div className="container">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
          Leaderboard
        </h2>
        <table className="min-w-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow">
          <thead>
            <tr>
              <th className="px-6 py-3 text-left w-min whitespace-nowrap"></th>
              <th className="px-6 py-3 text-left">Team Name</th>
              <th className="px-6 py-3 text-left">Team Score</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <tr key={team.name} className="border-t dark:border-gray-700">
                <td className="px-6 py-6 w-min whitespace-nowrap text-centerx-3 p">
                  {team.name === "OnlyHeffs" ? (
                    <>
                      {/* OnlyHeffs Light mode logo */}
                      <img
                        src="/images/2025/anniversary/onlyheffs_light-mode.png"
                        alt={team.name}
                        className="m-auto h-12 md:h-32 min-w-12 md:min-w-32 object-contain block dark:hidden"
                      />
                      {/* OnlyHeffs Dark mode logo */}
                      <img
                        src="/images/2025/anniversary/onlyheffs_dark-mode.png"
                        alt={team.name}
                        className="m-auto h-12 md:h-32 min-w-12 md:min-w-32 object-contain hidden dark:block"
                      />
                    </>
                  ) : (
                    <img
                      src={team.logo}
                      alt={team.name}
                      className="m-auto h-12 md:h-32 min-w-12 md:min-w-32 object-contain"
                    />
                  )}
                </td>
                <td className="px-6 py-4 font-semibold">{team.name}</td>
                <td className="px-6 py-4">{team.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default Leaderboard;
