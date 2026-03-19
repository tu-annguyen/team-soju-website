interface TeamScopedShiny {
  id: string;
  pokemonName: string;
  trainerName: string;
  isFailed: boolean;
  catchDate: string | null;
  createdAt: string | null;
  points: number;
  isDuplicate?: boolean;
}

type TeamMembers = Record<string, string[]>;

const normalizePokemonName = (pokemonName: string) =>
  String(pokemonName || '')
    .trim()
    .toLowerCase();

const normalizeTrainerName = (trainerName: string) =>
  String(trainerName || '')
    .trim()
    .toLowerCase();

const compareChronologically = (
  left: Pick<TeamScopedShiny, 'id' | 'catchDate' | 'createdAt'>,
  right: Pick<TeamScopedShiny, 'id' | 'catchDate' | 'createdAt'>
) => {
  const leftDate = left.catchDate ?? '';
  const rightDate = right.catchDate ?? '';

  if (leftDate !== rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  const leftCreatedAt = left.createdAt ?? '';
  const rightCreatedAt = right.createdAt ?? '';

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt.localeCompare(rightCreatedAt);
  }

  return left.id.localeCompare(right.id);
};

const buildTeamKeyByMember = (teamMembers: TeamMembers) => {
  const teamKeyByMember = new Map<string, string>();

  Object.entries(teamMembers).forEach(([teamKey, members]) => {
    members.forEach((memberName) => {
      teamKeyByMember.set(normalizeTrainerName(memberName), teamKey);
    });
  });

  return teamKeyByMember;
};

export const applyTeamSpeciesDuplicatePenalty = <T extends TeamScopedShiny>(
  shinies: T[],
  teamMembers?: TeamMembers
): Array<T & { isDuplicate: boolean }> => {
  if (!teamMembers) {
    return shinies.map((shiny) => ({
      ...shiny,
      isDuplicate: shiny.isDuplicate ?? false,
    }));
  }

  const duplicateById = new Map<string, boolean>();
  const seenSpeciesByTeam = new Map<string, Set<string>>();
  const teamKeyByMember = buildTeamKeyByMember(teamMembers);

  [...shinies]
    .filter((shiny) => !shiny.isFailed)
    .sort(compareChronologically)
    .forEach((shiny) => {
      const teamKey = teamKeyByMember.get(normalizeTrainerName(shiny.trainerName));

      if (!teamKey) {
        duplicateById.set(shiny.id, false);
        return;
      }

      const normalizedPokemon = normalizePokemonName(shiny.pokemonName);
      const seenSpecies = seenSpeciesByTeam.get(teamKey) ?? new Set<string>();
      const isDuplicate = seenSpecies.has(normalizedPokemon);

      duplicateById.set(shiny.id, isDuplicate);

      if (!isDuplicate) {
        seenSpecies.add(normalizedPokemon);
        seenSpeciesByTeam.set(teamKey, seenSpecies);
      }
    });

  return shinies.map((shiny) => {
    const isDuplicate = duplicateById.get(shiny.id) ?? false;

    return {
      ...shiny,
      isDuplicate,
      points: isDuplicate ? 1 : shiny.points,
    };
  });
};
