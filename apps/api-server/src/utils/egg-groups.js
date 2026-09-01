const EGG_GROUPS = Object.freeze([
  'Monster', 'Water A', 'Bug', 'Flying', 'Field', 'Fairy', 'Grass',
  'Humanoid', 'Water C', 'Mineral', 'Amorphous', 'Water B', 'Dragon',
]);

const EGG_GROUP_ALIASES = new Map([
  ['monster', 'Monster'], ['water a', 'Water A'], ['water 1', 'Water A'],
  ['bug', 'Bug'], ['flying', 'Flying'], ['field', 'Field'], ['ground', 'Field'],
  ['fairy', 'Fairy'], ['grass', 'Grass'], ['plant', 'Grass'],
  ['humanoid', 'Humanoid'], ['human like', 'Humanoid'], ['humanshape', 'Humanoid'],
  ['water c', 'Water C'], ['water 3', 'Water C'], ['mineral', 'Mineral'],
  ['amorphous', 'Amorphous'], ['indeterminate', 'Amorphous'],
  ['water b', 'Water B'], ['water 2', 'Water B'], ['dragon', 'Dragon'],
]);

function eggGroupName(value) {
  const raw = typeof value === 'object' && value !== null
    ? (value.name ?? value.label ?? value.egg_group)
    : value;
  const key = String(raw || '').trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
  return EGG_GROUP_ALIASES.get(key) || null;
}

function normalizeEggGroups(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.map(eggGroupName).filter(Boolean))]
    .sort((left, right) => EGG_GROUPS.indexOf(left) - EGG_GROUPS.indexOf(right));
}

module.exports = { EGG_GROUPS, normalizeEggGroups };
