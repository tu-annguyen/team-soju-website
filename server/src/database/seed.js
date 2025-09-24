const pool = require('./connection');

async function seedDatabase() {
  try {
    console.log('Seeding database with initial data...');
    
    // Insert some Pokemon species data
    const pokemonData = [
      { pokedex_number: 1, name: 'Bulbasaur', generation: 1, type1: 'Grass', type2: 'Poison' },
      { pokedex_number: 4, name: 'Charmander', generation: 1, type1: 'Fire', type2: null },
      { pokedex_number: 7, name: 'Squirtle', generation: 1, type1: 'Water', type2: null },
      { pokedex_number: 25, name: 'Pikachu', generation: 1, type1: 'Electric', type2: null },
      { pokedex_number: 129, name: 'Magikarp', generation: 1, type1: 'Water', type2: null },
      { pokedex_number: 130, name: 'Gyarados', generation: 1, type1: 'Water', type2: 'Flying' },
      { pokedex_number: 280, name: 'Ralts', generation: 3, type1: 'Psychic', type2: 'Fairy' },
      { pokedex_number: 371, name: 'Bagon', generation: 3, type1: 'Dragon', type2: null },
      { pokedex_number: 443, name: 'Gible', generation: 4, type1: 'Dragon', type2: 'Ground' },
      { pokedex_number: 147, name: 'Dratini', generation: 1, type1: 'Dragon', type2: null },
      { pokedex_number: 246, name: 'Larvitar', generation: 2, type1: 'Rock', type2: 'Ground' }
    ];
    
    for (const pokemon of pokemonData) {
      await pool.query(`
        INSERT INTO pokemon_species (pokedex_number, name, generation, type1, type2)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (pokedex_number) DO NOTHING
      `, [pokemon.pokedex_number, pokemon.name, pokemon.generation, pokemon.type1, pokemon.type2]);
    }
    
    // Insert sample team members (you can modify these)
    const sampleMembers = [
      { ign: 'Buddhalicious', rank: 'Co-Leader', discord_id: '189168387824418816' },
      { ign: 'Aisuhoki', rank: 'Co-Leader', discord_id: '558122397971120133' },
      { ign: 'tunacore', rank: 'Website & Content Lead', discord_id: '272201126068092928' },
      { ign: 'hefferson', rank: 'Team Recruiter', discord_id: '234164830779604994' },
      { ign: 'ReefBarrierGreat', rank: 'Event Coordinator', discord_id: '164470609101717504' }
    ];
    
    for (const member of sampleMembers) {
      await pool.query(`
        INSERT INTO team_members (ign, rank, discord_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (ign) DO NOTHING
      `, [member.ign, member.rank, member.discord_id]);
    }
    
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();