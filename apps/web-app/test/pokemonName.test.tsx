import {
  formatPokemonCardName,
  formatPokemonDetailsName,
  formatVariantLabel,
} from '../src/utils/pokemonName';

describe('pokemonName utils', () => {
  it('collapses nidoran route names to the base pokemon name', () => {
    expect(formatPokemonCardName('nidoran-f')).toBe('Nidoran');
    expect(formatPokemonCardName('nidoran-m')).toBe('Nidoran');
  });

  it('does not surface nidoran route names as variants', () => {
    expect(formatVariantLabel('nidoran-f', 'nidoran')).toBeNull();
    expect(formatVariantLabel('nidoran-m', 'nidoran')).toBeNull();
    expect(formatPokemonDetailsName('nidoran-f', 'nidoran-f')).toBe('Nidoran');
  });
});
