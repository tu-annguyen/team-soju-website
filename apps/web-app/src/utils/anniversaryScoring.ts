import type { AnniversaryData, AnniversaryTeam } from '../types/anniversary';

export const MAIN_EVENT_POINTS = {
  first: 5,
  second: 3,
  third: 1,
} as const;

export const MINI_EVENT_POINTS = {
  first: 2,
} as const;

export const DEFAULT_SHINY_SCORE = 0;

const normalizeTeamKey = (value: string) => value.trim().toLowerCase();

const getTeamAlias = (teamName: string) => {
  const aliasMatch = teamName.match(/\(([^)]+)\)\s*$/);
  return aliasMatch?.[1]?.trim();
};

const buildTeamNameByKey = (teams: AnniversaryTeam[]) => {
  const teamNameByKey = new Map<string, string>();

  teams.forEach((team) => {
    teamNameByKey.set(normalizeTeamKey(team.name), team.name);

    const alias = getTeamAlias(team.name);
    if (alias) {
      teamNameByKey.set(normalizeTeamKey(alias), team.name);
    }
  });

  return teamNameByKey;
};

const getSuffixCandidate = (winner: string) => {
  const separator = ' - ';
  const separatorIndex = winner.lastIndexOf(separator);

  if (separatorIndex === -1) {
    return undefined;
  }

  return winner.slice(separatorIndex + separator.length).trim();
};

const resolveWinnerTeamName = (
  winner: string | undefined,
  teamNameByKey: Map<string, string>
) => {
  if (!winner?.trim()) {
    return undefined;
  }

  const exactMatch = teamNameByKey.get(normalizeTeamKey(winner));
  if (exactMatch) {
    return exactMatch;
  }

  const suffixCandidate = getSuffixCandidate(winner);
  if (!suffixCandidate) {
    return undefined;
  }

  return teamNameByKey.get(normalizeTeamKey(suffixCandidate));
};

export const calculateAnniversaryTeamScores = (
  anniversaryData: AnniversaryData
): AnniversaryTeam[] => {
  const teamNameByKey = buildTeamNameByKey(anniversaryData.teams);
  const scoresByTeamName = new Map(
    anniversaryData.teams.map((team) => [team.name, 0])
  );

  const addScore = (winner: string | undefined, points: number) => {
    const teamName = resolveWinnerTeamName(winner, teamNameByKey);
    if (!teamName) {
      return;
    }

    scoresByTeamName.set(teamName, (scoresByTeamName.get(teamName) ?? 0) + points);
  };

  anniversaryData.mainEvents.forEach((event) => {
    addScore(event.first, MAIN_EVENT_POINTS.first);
    addScore(event.second, MAIN_EVENT_POINTS.second);
    addScore(event.third, MAIN_EVENT_POINTS.third);
  });

  anniversaryData.miniEvents.forEach((event) => {
    addScore(event.first, MINI_EVENT_POINTS.first);
  });

  anniversaryData.eventShinies?.forEach((event) => {
    addScore(event.OT, event.shinyScore ?? DEFAULT_SHINY_SCORE);
  });

  return anniversaryData.teams.map((team) => ({
    ...team,
    score: scoresByTeamName.get(team.name) ?? 0,
  }));
};
