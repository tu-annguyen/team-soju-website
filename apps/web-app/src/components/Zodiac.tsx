import React from "react";
import Leaderboard from './Leaderboard';
import zodiacData from "../data/zodiac.json";

const Zodiac = () => {
  return (
    <section className="py-16">
      <div className="container">
        <div className="mb-12">
          <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            SOJU Zodiac War
          </h2>
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

      <Leaderboard teams={zodiacData.teams} />
    </section>
  );
};

export default Zodiac;
