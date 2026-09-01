const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getPokemonTier, TIER_POINTS } = require('@team-soju/utils');

const EXPECTED_2026_COUNTS = Object.freeze({
  species: 720,
  locations: 629,
  encounters: 33405,
  hordeEncounters: 4982,
});

const KNOWN_METHODS = [
  'Super Rod', 'Good Rod', 'Old Rod', 'Sweet Scent', 'Dark Grass',
  'Honey Tree', 'Headbutt', 'Dust Cloud', 'Rock Smash', 'Fishing',
  'Grass', 'Cave', 'Water', 'Inside', 'Shadow', 'Rocks',
];

function stripInvalidJsonControlCharacters(input) {
  let quoted = false;
  let escaped = false;
  let output = '';
  for (const character of input) {
    if (quoted && character.charCodeAt(0) < 0x20) {
      output += ' ';
      continue;
    }
    output += character;
    if (escaped) {
      escaped = false;
    } else if (character === '\\' && quoted) {
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
    }
  }
  return output;
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanRegion(value) {
  return cleanText(value).replace(/[[\]▁]/g, '').trim();
}

function cleanMethod(value) {
  const cleaned = cleanText(value);
  return KNOWN_METHODS.find((method) => cleaned.endsWith(method)) || cleaned;
}

function isLureEncounter(rawLocation) {
  return Boolean(
    rawLocation.is_lure
    || rawLocation.lure_only
    || rawLocation.requires_lure
    || /\blure\b/i.test(cleanText(rawLocation.type))
    || ['rarity_morning', 'rarity_day', 'rarity_night'].some(
      (field) => /^lure(?: only)?$/i.test(cleanText(rawLocation[field]))
    )
  );
}

function isSpecialEncounter(rawLocation) {
  return Boolean(
    rawLocation.is_special
    || rawLocation.special
    || ['rarity_morning', 'rarity_day', 'rarity_night'].some(
      (field) => /^special$/i.test(cleanText(rawLocation[field]))
    )
  );
}

function speciesSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .replace(/\bmr\.\s*/g, 'mr-')
    .replace(/\bmime\s+jr\.\b/g, 'mime-jr')
    .replace(/farfetch['’]d/g, 'farfetchd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveTier(slug) {
  const direct = getPokemonTier(slug);
  if (direct !== 'Unknown') return direct;
  const formAliases = {
    basculin: ['basculin-red-striped', 'basculin-blue-striped'],
    gastrodon: ['gastrodon-east', 'gastrodon-west'],
  };
  for (const alias of formAliases[slug] || []) {
    const tier = getPokemonTier(alias);
    if (tier !== 'Unknown') return tier;
  }
  return direct;
}

function parseRate(value) {
  const cleaned = cleanText(value);
  if (/^lure(?: only)?$/i.test(cleaned)) return 5;
  const match = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)%$/);
  return match ? Number(match[1]) : null;
}

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSpeciesSlugs(monsters) {
  const baseCounts = new Map();
  const formNamesById = new Map();
  monsters.forEach((monster) => {
    const base = speciesSlug(monster.name);
    baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
    (monster.forms || []).forEach((form) => {
      formNamesById.set(Number(form.id), cleanText(form.name));
    });
  });

  const firstIdByBase = new Map();
  const usedSlugs = new Set();
  return new Map(monsters.map((monster) => {
    const id = Number(monster.id);
    const base = speciesSlug(monster.name);
    if (!firstIdByBase.has(base)) firstIdByBase.set(base, id);
    const formSlug = speciesSlug(formNamesById.get(id));
    let slug = baseCounts.get(base) === 1 || firstIdByBase.get(base) === id
      ? base
      : (formSlug && formSlug !== base ? formSlug : `${base}-form-${id}`);
    if (usedSlugs.has(slug)) slug = `${slug}-form-${id}`;
    usedSlugs.add(slug);
    return [id, slug];
  }));
}

function buildFamilyKeys(monsters, speciesSlugs) {
  const parents = new Map(monsters.map((monster) => [Number(monster.id), Number(monster.id)]));
  const byName = new Map(monsters.map((monster) => [cleanText(monster.name).toLowerCase(), Number(monster.id)]));
  const find = (id) => {
    const parent = parents.get(id);
    if (parent === id) return id;
    const root = find(parent);
    parents.set(id, root);
    return root;
  };
  const union = (left, right) => {
    if (!parents.has(left) || !parents.has(right)) return;
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents.set(Math.max(leftRoot, rightRoot), Math.min(leftRoot, rightRoot));
  };

  monsters.forEach((monster) => {
    (monster.forms || []).forEach((form) => union(Number(monster.id), Number(form.id)));
    (monster.evolutions || []).forEach((evolution) => {
      const targetId = Number(evolution.id) || byName.get(cleanText(evolution.name).toLowerCase());
      if (targetId) union(Number(monster.id), targetId);
    });
  });

  const namesById = new Map(monsters.map((monster) => [
    Number(monster.id),
    speciesSlugs.get(Number(monster.id)) || speciesSlug(monster.name),
  ]));
  return new Map(monsters.map((monster) => {
    const rootId = find(Number(monster.id));
    return [Number(monster.id), namesById.get(rootId) || speciesSlug(monster.name)];
  }));
}

function deterministicId(parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex');
}

function normalizePokedex(monsters) {
  const speciesSlugs = buildSpeciesSlugs(monsters);
  const familyKeys = buildFamilyKeys(monsters, speciesSlugs);
  const species = [];
  const locations = new Map();
  const encounters = new Map();
  const unknownHordeTiers = new Set();

  monsters.forEach((monster) => {
    const slug = speciesSlugs.get(Number(monster.id)) || speciesSlug(monster.name);
    const tier = resolveTier(speciesSlug(monster.name));
    const points = TIER_POINTS[tier] || (tier === 'Legendary/Mythical' ? 200 : 0);
    species.push({
      id: Number(monster.id),
      name: cleanText(monster.name),
      slug,
      familyKey: familyKeys.get(Number(monster.id)) || slug,
      tier,
      points,
      catchRate: Number.isFinite(Number(monster.catch_rate)) ? Number(monster.catch_rate) : null,
      baseExp: Math.max(0, Number(monster.yields?.exp) || 0),
      evHp: Math.max(0, Number(monster.yields?.ev_hp) || 0),
      evAttack: Math.max(0, Number(monster.yields?.ev_attack) || 0),
      evDefense: Math.max(0, Number(monster.yields?.ev_defense) || 0),
      evSpAttack: Math.max(0, Number(monster.yields?.ev_sp_attack) || 0),
      evSpDefense: Math.max(0, Number(monster.yields?.ev_sp_defense) || 0),
      evSpeed: Math.max(0, Number(monster.yields?.ev_speed) || 0),
    });

    (monster.locations || []).forEach((rawLocation) => {
      const regionId = Number(rawLocation.region_id);
      const sourceLocationId = Number(rawLocation.location_id);
      const locationId = `${regionId}:${sourceLocationId}`;
      const hordeSize = rawLocation.is_horde_5x ? 5 : (rawLocation.is_horde_3x ? 3 : 0);
      locations.set(locationId, {
        id: locationId,
        regionId,
        region: cleanRegion(rawLocation.region_name),
        sourceLocationId,
        name: cleanText(rawLocation.location_name_full || rawLocation.location_name),
      });

      if (hordeSize && tier === 'Unknown') unknownHordeTiers.add(slug);
      const hasUnknownIllusionRate = hordeSize > 0
        && slug === 'zorua'
        && isLureEncounter(rawLocation);
      const isSpecial = hordeSize === 0 && isSpecialEncounter(rawLocation);
      const encounter = {
        speciesId: Number(monster.id),
        form: cleanText(rawLocation.form),
        locationId,
        method: cleanMethod(rawLocation.type),
        season: cleanText(rawLocation.season || 'Any'),
        minLevel: Number(rawLocation.min_level) || 0,
        maxLevel: Number(rawLocation.max_level) || 0,
        hordeSize,
        // Lures only modify single encounters. Some source rows (notably Zorua,
        // whose Illusion ability makes it appear as another horde member) are
        // labeled "Lure only" even though they belong to Sweet Scent hordes.
        isLure: !isSpecial && hordeSize === 0 && isLureEncounter(rawLocation),
        isSpecial,
        morningRate: hasUnknownIllusionRate ? null : parseRate(rawLocation.rarity_morning),
        dayRate: hasUnknownIllusionRate ? null : parseRate(rawLocation.rarity_day),
        nightRate: hasUnknownIllusionRate ? null : parseRate(rawLocation.rarity_night),
      };
      const keyParts = [
        encounter.speciesId, encounter.form, encounter.locationId, encounter.method,
        encounter.season, encounter.minLevel, encounter.maxLevel, encounter.hordeSize,
        encounter.isLure, encounter.isSpecial,
      ];
      const id = deterministicId(keyParts);
      const existing = encounters.get(id);
      if (existing) {
        ['morningRate', 'dayRate', 'nightRate'].forEach((field) => {
          const values = [existing[field], encounter[field]].filter((value) => value !== null);
          existing[field] = values.length ? Math.max(...values) : null;
        });
      } else {
        encounters.set(id, { id, ...encounter });
      }
    });
  });

  if (unknownHordeTiers.size) {
    throw new Error(`Horde species missing a 2026 tier: ${[...unknownHordeTiers].sort().join(', ')}`);
  }

  return { species, locations: [...locations.values()], encounters: [...encounters.values()] };
}

function toSql(data) {
  const lines = [
    'PRAGMA foreign_keys = ON;',
    'DELETE FROM pokedex_encounters;',
    'DELETE FROM pokedex_locations;',
    'DELETE FROM pokedex_species;',
  ];

  data.species.forEach((row) => lines.push(
    `INSERT INTO pokedex_species (id,name,slug,family_key,tier,points,catch_rate,base_exp,ev_hp,ev_attack,ev_defense,ev_sp_attack,ev_sp_defense,ev_speed) VALUES (${[
      row.id, row.name, row.slug, row.familyKey, row.tier, row.points, row.catchRate,
      row.baseExp, row.evHp, row.evAttack, row.evDefense,
      row.evSpAttack, row.evSpDefense, row.evSpeed,
    ].map(sqlValue).join(',')});`
  ));
  data.locations.forEach((row) => lines.push(
    `INSERT INTO pokedex_locations (id,region_id,region,location_id,name) VALUES (${[
      row.id, row.regionId, row.region, row.sourceLocationId, row.name,
    ].map(sqlValue).join(',')});`
  ));
  data.encounters.forEach((row) => lines.push(
    `INSERT INTO pokedex_encounters (id,species_id,form,location_id,method,season,min_level,max_level,horde_size,is_lure,is_special,morning_rate,day_rate,night_rate) VALUES (${[
      row.id, row.speciesId, row.form, row.locationId, row.method, row.season,
      row.minLevel, row.maxLevel, row.hordeSize, row.isLure ? 1 : 0,
      row.isSpecial ? 1 : 0,
      row.morningRate, row.dayRate, row.nightRate,
    ].map(sqlValue).join(',')});`
  ));
  return `${lines.join('\n')}\n`;
}

function validateExpectedCounts(data, expected = EXPECTED_2026_COUNTS) {
  const actual = {
    species: data.species.length,
    locations: data.locations.length,
    encounters: data.encounters.length,
    hordeEncounters: data.encounters.filter((entry) => entry.hordeSize > 0).length,
  };
  const mismatches = Object.entries(expected)
    .filter(([key, value]) => actual[key] !== value)
    .map(([key, value]) => `${key}: expected ${value}, received ${actual[key]}`);
  if (mismatches.length) throw new Error(`Unexpected Pokédex counts (${mismatches.join('; ')})`);
  const encounteredSpeciesIds = new Set(data.encounters.map((entry) => entry.speciesId));
  const missingExperience = data.species
    .filter((entry) => encounteredSpeciesIds.has(entry.id) && entry.baseExp <= 0)
    .map((entry) => entry.name);
  if (missingExperience.length) {
    throw new Error(`Encountered species missing base EXP: ${missingExperience.join(', ')}`);
  }
  return actual;
}

function run(argv = process.argv.slice(2)) {
  const inputPath = argv[0];
  const outputPath = argv[1] || path.resolve(process.cwd(), 'shiny-war-pokedex.sql');
  if (!inputPath) {
    throw new Error('Usage: node import-shiny-war-dex.js <pokemmo_data.json> [output.sql]');
  }
  const raw = fs.readFileSync(path.resolve(inputPath), 'utf8');
  const monsters = JSON.parse(stripInvalidJsonControlCharacters(raw));
  const normalized = normalizePokedex(monsters);
  const counts = validateExpectedCounts(normalized);
  fs.writeFileSync(outputPath, toSql(normalized));
  console.log(JSON.stringify({
    outputPath,
    ...counts,
  }));
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  cleanMethod,
  isLureEncounter,
  isSpecialEncounter,
  normalizePokedex,
  parseRate,
  speciesSlug,
  stripInvalidJsonControlCharacters,
  toSql,
  validateExpectedCounts,
};
