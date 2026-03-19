import type { EventShiny } from '../components/ActivityLog';

type EligiblePokemon = Record<string, string[]>;

interface TeamDefinition {
  key: string;
  name: string;
}

interface ZodiacScoringInput {
  eligiblePokemon: EligiblePokemon;
  shinies: EventShiny[];
  teamDefinitions: TeamDefinition[];
  teamMembers: Record<string, string[]>;
}

interface TeamScoreBreakdown {
  catchPoints: number;
  bonusPoints: number;
  uniqueSpeciesBonus: number;
  horseZodiacBonus: number;
  fullZodiacBonus: number;
  uniqueEvolutionLines: number;
  trainerPoints: Record<string, number>;
  claimedBonuses: string[];
  score: number;
}

interface ZodiacScoringResult {
  teams: Record<string, TeamScoreBreakdown>;
}

const EVOLUTION_LINES: Record<string, string[]> = {
  rattata: ['rattata', 'raticate'],
  pikachu: ['pichu', 'pikachu', 'raichu'],
  marill: ['azurill', 'marill', 'azumarill'],
  pachirisu: ['pachirisu'],
  minccino: ['minccino', 'cinccino'],
  patrat: ['patrat', 'watchog'],
  drilbur: ['drilbur', 'excadrill'],
  tauros: ['tauros'],
  miltank: ['miltank'],
  bouffalant: ['bouffalant'],
  numel: ['numel', 'camerupt'],
  glameow: ['glameow', 'purugly'],
  shinx: ['shinx', 'luxio', 'luxray'],
  meowth: ['meowth', 'persian'],
  purrloin: ['purrloin', 'liepard'],
  zangoose: ['zangoose'],
  electabuzz: ['elekid', 'electabuzz', 'electivire'],
  skitty: ['skitty', 'delcatty'],
  absol: ['absol'],
  buneary: ['buneary', 'lopunny'],
  spinda: ['spinda'],
  jigglypuff: ['igglybuff', 'jigglypuff', 'wigglytuff'],
  whismur: ['whismur', 'loudred', 'exploud'],
  nidoran_m: ['nidoran-m', 'nidorino', 'nidoking'],
  nidoran_f: ['nidoran-f', 'nidorina', 'nidoqueen'],
  gyarados: ['magikarp', 'gyarados'],
  garchomp: ['gible', 'gabite', 'garchomp'],
  hydreigon: ['deino', 'zweilous', 'hydreigon'],
  haxorus: ['axew', 'fraxure', 'haxorus'],
  charizard: ['charmander', 'charmeleon', 'charizard'],
  flygon: ['trapinch', 'vibrava', 'flygon'],
  druddigon: ['druddigon'],
  dunsparce: ['dunsparce'],
  arbok: ['ekans', 'arbok'],
  seviper: ['seviper'],
  dragonite: ['dratini', 'dragonair', 'dragonite'],
  serperior: ['snivy', 'servine', 'serperior'],
  eelektross: ['tynamo', 'eelektrik', 'eelektross'],
  milotic: ['feebas', 'milotic'],
  rapidash: ['ponyta', 'rapidash'],
  kingdra: ['horsea', 'seadra', 'kingdra'],
  zebstrika: ['blitzle', 'zebstrika'],
  ampharos: ['mareep', 'flaaffy', 'ampharos'],
  primeape: ['mankey', 'primeape'],
  darmanitan: ['darumaka', 'darmanitan'],
  medicham: ['meditite', 'medicham'],
  infernape: ['chimchar', 'monferno', 'infernape'],
  ambipom: ['aipom', 'ambipom'],
  simisage: ['pansage', 'simisage'],
  simipour: ['panpour', 'simipour'],
  simisear: ['pansear', 'simisear'],
  pidgeot: ['pidgey', 'pidgeotto', 'pidgeot'],
  fearow: ['spearow', 'fearow'],
  swellow: ['taillow', 'swellow'],
  altaria: ['swablu', 'altaria'],
  braviary: ['rufflet', 'braviary'],
  mandibuzz: ['vullaby', 'mandibuzz'],
  unfezant: ['pidove', 'tranquill', 'unfezant'],
  honchkrow: ['murkrow', 'honchkrow'],
  blaziken: ['torchic', 'combusken', 'blaziken'],
  stoutland: ['lillipup', 'herdier', 'stoutland'],
  smeargle: ['smeargle'],
  arcanine: ['growlithe', 'arcanine'],
  houndoom: ['houndour', 'houndoom'],
  manectric: ['electrike', 'manectric'],
  granbull: ['snubbull', 'granbull'],
  lucario: ['riolu', 'lucario'],
  mightyena: ['poochyena', 'mightyena'],
  ninetales: ['vulpix', 'ninetales'],
  floatzel: ['buizel', 'floatzel'],
  linoone: ['zigzagoon', 'linoone'],
  grumpig: ['spoink', 'grumpig'],
  mamoswine: ['swinub', 'piloswine', 'mamoswine'],
  swoobat: ['woobat', 'swoobat'],
  emboar: ['tepig', 'pignite', 'emboar'],
};

const normalizePokemonName = (pokemonName: string) =>
  String(pokemonName || '')
    .trim()
    .toLowerCase();

const normalizeTrainerName = (trainerName: string) =>
  String(trainerName || '')
    .trim()
    .toLowerCase();

const buildPokemonToEvolutionLineMap = () => {
  const pokemonToEvolutionLine = new Map<string, string>();

  Object.entries(EVOLUTION_LINES).forEach(([lineKey, pokemonList]) => {
    pokemonList.forEach((pokemonName) => {
      pokemonToEvolutionLine.set(normalizePokemonName(pokemonName), lineKey);
    });
  });

  return pokemonToEvolutionLine;
};

const buildPokemonToZodiacMap = (eligiblePokemon: EligiblePokemon) => {
  const pokemonToZodiac = new Map<string, string>();

  Object.entries(eligiblePokemon).forEach(([zodiacKey, pokemonList]) => {
    pokemonList.forEach((pokemonName) => {
      pokemonToZodiac.set(normalizePokemonName(pokemonName), zodiacKey);
    });
  });

  return pokemonToZodiac;
};

const compareChronologically = (left: EventShiny, right: EventShiny) => {
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

export const calculateZodiacScores = ({
  eligiblePokemon,
  shinies,
  teamDefinitions,
  teamMembers,
}: ZodiacScoringInput): ZodiacScoringResult => {
  const pokemonToEvolutionLine = buildPokemonToEvolutionLineMap();
  const pokemonToZodiac = buildPokemonToZodiacMap(eligiblePokemon);
  const teamNameByMember = new Map<string, string>();

  teamDefinitions.forEach(({ key, name }) => {
    (teamMembers[key] ?? []).forEach((memberName) => {
      teamNameByMember.set(normalizeTrainerName(memberName), name);
    });
  });

  const horseEvolutionLines = new Set<string>(
    (eligiblePokemon.horse ?? []).map((pokemonName) => {
      const normalizedPokemon = normalizePokemonName(pokemonName);
      return pokemonToEvolutionLine.get(normalizedPokemon) ?? normalizedPokemon;
    })
  );

  const allZodiacAnimals = new Set(Object.keys(eligiblePokemon));

  const scoringByTeam = Object.fromEntries(
    teamDefinitions.map(({ name }) => [
      name,
      {
        catchPoints: 0,
        bonusPoints: 0,
        uniqueSpeciesBonus: 0,
        horseZodiacBonus: 0,
        fullZodiacBonus: 0,
        uniqueEvolutionLines: 0,
        trainerPoints: {},
        claimedBonuses: [],
        score: 0,
      },
    ])
  ) as Record<string, TeamScoreBreakdown>;

  const stateByTeam = Object.fromEntries(
    teamDefinitions.map(({ name }) => [
      name,
      {
        evolutionLines: new Set<string>(),
        zodiacAnimals: new Set<string>(),
        horseEvolutionLines: new Set<string>(),
      },
    ])
  ) as Record<
    string,
    {
      evolutionLines: Set<string>;
      zodiacAnimals: Set<string>;
      horseEvolutionLines: Set<string>;
    }
  >;

  let horseBonusClaimed = false;
  let fullZodiacBonusClaimed = false;

  [...shinies]
    .filter((shiny) => !shiny.isFailed)
    .sort(compareChronologically)
    .forEach((shiny) => {
      const teamName = teamNameByMember.get(normalizeTrainerName(shiny.trainerName));

      if (!teamName) {
        return;
      }

      const normalizedPokemon = normalizePokemonName(shiny.pokemonName);
      const evolutionLine =
        pokemonToEvolutionLine.get(normalizedPokemon) ?? normalizedPokemon;
      const zodiacAnimal = pokemonToZodiac.get(normalizedPokemon);
      const teamScore = scoringByTeam[teamName];
      const teamState = stateByTeam[teamName];
      const trainerName = shiny.trainerName.trim();
      const isDuplicateEvolutionLine = teamState.evolutionLines.has(evolutionLine);
      const shinyPoints = isDuplicateEvolutionLine ? 1 : shiny.points;

      teamScore.catchPoints += shinyPoints;
      teamScore.trainerPoints[trainerName] =
        (teamScore.trainerPoints[trainerName] ?? 0) + shinyPoints;

      if (!isDuplicateEvolutionLine) {
        teamState.evolutionLines.add(evolutionLine);
        teamScore.uniqueSpeciesBonus += 3;
        teamScore.uniqueEvolutionLines = teamState.evolutionLines.size;

        if (zodiacAnimal) {
          teamState.zodiacAnimals.add(zodiacAnimal);
        }

        if (zodiacAnimal === 'horse') {
          teamState.horseEvolutionLines.add(evolutionLine);
        }
      }

      if (
        !horseBonusClaimed &&
        teamState.horseEvolutionLines.size === horseEvolutionLines.size
      ) {
        horseBonusClaimed = true;
        teamScore.horseZodiacBonus += 6;
        teamScore.claimedBonuses.push('Horse Zodiacs +6');
      }

      if (
        !fullZodiacBonusClaimed &&
        teamState.zodiacAnimals.size === allZodiacAnimals.size
      ) {
        fullZodiacBonusClaimed = true;
        teamScore.fullZodiacBonus += 12;
        teamScore.claimedBonuses.push('12 Zodiacs +12');
      }
    });

  Object.values(scoringByTeam).forEach((teamScore) => {
    teamScore.bonusPoints =
      teamScore.uniqueSpeciesBonus +
      teamScore.horseZodiacBonus +
      teamScore.fullZodiacBonus;
    teamScore.score = teamScore.catchPoints + teamScore.bonusPoints;
  });

  return {
    teams: scoringByTeam,
  };
};
