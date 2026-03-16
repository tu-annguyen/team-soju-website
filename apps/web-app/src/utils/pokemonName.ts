const capitalize = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;

export const formatPokemonCardName = (pokemonName: string) => {
  const [baseName] = pokemonName.split('-');
  return capitalize(baseName);
};

export const formatPokemonDetailsName = (pokemonName: string) => {
  const [baseName, ...formParts] = pokemonName.split('-');
  const formattedBaseName = capitalize(baseName);

  if (formParts.length === 0) {
    return formattedBaseName;
  }

  return `${formattedBaseName} (${formParts.join(' ').toLowerCase()})`;
};
