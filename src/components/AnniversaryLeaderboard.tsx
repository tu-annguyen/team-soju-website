import React from "react";

const teams = [
  {
    name: "Cub Skouts",
    logo: "/images/2025/anniversary/cub-skouts.png", // Update with your actual path
    score: 0,
  },
  {
    name: "Terrific Team Tunacore",
    logo: "/images/2025/anniversary/terrific-team-tunacore.png",
    score: 0,
  },
  {
    name: "Reef Squad",
    logo: "/images/2025/anniversary/reef-squad.png",
    score: 0,
  },
  {
    name: "OnlyHeffs",
    logo: "/images/2025/anniversary/onlyheffs_light-mode.png",
    score: 0,
  },
];

const AnniversaryLeaderboard = () => (
  <section className="py-8">
    <div className="container">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
        Leaderboard
      </h2>
      <table className="min-w-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow">
        <thead>
          <tr>
            <th className="py-3 text-left"></th>
            <th className="px-6 py-3 text-left">Team Name</th>
            <th className="px-6 py-3 text-left">Team Score</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.name} className="border-t dark:border-gray-700">
              <td className="px-6 py-4">
                {team.name === "OnlyHeffs" ? (
                  <>
                    {/* OnlyHeffs Light mode logo */}
                    <img
                      src="/images/2025/anniversary/onlyheffs_light-mode.png"
                      alt={team.name}
                      className="h-20 w-20 object-contain block dark:hidden"
                    />
                    {/* OnlyHeffs Dark mode logo */}
                    <img
                      src="/images/2025/anniversary/onlyheffs_dark-mode.png"
                      alt={team.name}
                      className="h-20 w-20 object-contain hidden dark:block"
                    />
                  </>
                ) : (
                  <img
                    src={team.logo}
                    alt={team.name}
                    className="h-20 w-20 object-contain"
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

export default AnniversaryLeaderboard;