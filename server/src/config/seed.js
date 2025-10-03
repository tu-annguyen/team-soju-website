const pool = require('./connection');

async function seedDatabase() {
  try {
    console.log('Seeding database with initial data...');
    
    // Insert sample team members (you can modify these)
    const sampleMembers = [
      { ign: 'Buddhalicious', rank: 'Champion', discord_id: '189168387824418816' },
      { ign: 'Aisuhoki', rank: 'Champion', discord_id: '558122397971120133' },
      { ign: 'tunacore', rank: 'Elite 4', discord_id: '272201126068092928' },
      { ign: 'heff', rank: 'Elite 4', discord_id: '234164830779604994' },
      { ign: 'ReefBarrierGreat', rank: 'Elite 4', discord_id: '164470609101717504' },
      { ign: 'Cubby', rank: 'Elite 4', discord_id: '757471359835177071' },
      { ign: 'Megu', rank: 'Gym Leader', discord_id: '406270938079035393'},
      { ign: 'Immo', rank: 'Gym Leader', discord_id: '683832833705377802'},
      { ign: 'nayo', rank: 'Gym Leader', discord_id: '366804713972432896'},
      { ign: 'MumenRider', rank: 'Gym Leader', discord_id: '305047904228474880'},
      { ign: 'Misc', rank: 'Gym Leader', discord_id: '151106737062019072'},
      { ign: 'Electra', rank: 'Gym Leader', discord_id: '819273301582676038'},
      { ign: 'spook', rank: 'Gym Leader', discord_id: '1208737082856448071'},
      { ign: 'gaandusulayman', rank: 'Gym Leader', discord_id: '289027802068418561'},
      { ign: 'Pokio', rank: 'Gym Leader', discord_id: '701127393326399558'},
      { ign: 'CaliKingCorey', rank: 'Gym Leader', discord_id: '562791046606618626'},
      { ign: 'belley', rank: 'Gym Leader', discord_id: '136002810209632256'},
      { ign: 'pikachutiyaL', rank: 'Gym Leader', discord_id: '668402074295468062'},
      { ign: 'Zofina', rank: 'Gym Leader', discord_id: '460681300802535436'},
      { ign: 'thelayar', rank: 'Gym Leader', discord_id: '251016407699947520'},
      { ign: 'Colty', rank: 'Gym Leader', discord_id: '168416102370639872'},
      { ign: 'rubunny', rank: 'Gym Leader', discord_id: '246875143006060544'},
      { ign: 'HinatShoyo', rank: 'Ace Trainer', discord_id: '724734257498423386'},
      { ign: 'BlossomsDream', rank: 'Gym Leader', discord_id: '643457841486626831'},
      { ign: 'Swifty', rank: 'Gym Leader', discord_id: '578968418393260032'},
      { ign: 'iyusu', rank: 'Trainer', discord_id: '154007376234676224'},
      { ign: 'DingusDestiny', rank: 'Gym Leader', discord_id: '298160083584417802'},
      { ign: 'KxIrish', rank: 'Ace Trainer', discord_id: '114826685152624641'},
      { ign: 'fabriksgjord', rank: 'Gym Leader', discord_id: '394901401580339200'},
      { ign: 'Jaap', rank: 'Gym Leader', discord_id: '257948946565955586'},
    ];
    
    for (const member of sampleMembers) {
      await pool.query(`
        INSERT INTO team_members (ign, rank, discord_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (ign) DO NOTHING
      `, [member.ign, member.rank, member.discord_id]);
    }

    // Insert sample team shinies
    const sampleShinies = [
      { national_number: 25, pokemon: 'pikachu', original_trainer_ign: 'Buddhalicious', nature: 'Timid', iv_hp: 31, iv_attack: 0, iv_defense: 31, iv_sp_attack: 31, iv_sp_defense: 31, iv_speed: 31 },
      { national_number: 150, pokemon: 'mewtwo', original_trainer_ign: 'Aisuhoki', nature: 'Modest', iv_hp: 31, iv_attack: 0, iv_defense: 31, iv_sp_attack: 31, iv_sp_defense: 31, iv_speed: 31 },
      { national_number: 6, pokemon: 'charizard', original_trainer_ign: 'tunacore', nature: 'Jolly', iv_hp: 31, iv_attack: 31, iv_defense: 31, iv_sp_attack: 0, iv_sp_defense: 31, iv_speed: 31 },
      { national_number: 130, pokemon: 'gyrados', original_trainer_ign: 'heff', nature: 'Adamant', iv_hp: 31, iv_attack: 31, iv_defense: 31, iv_sp_attack: 0, iv_sp_defense: 31, iv_speed: 31 },
      { national_number: 143, pokemon: 'snorlax', original_trainer_ign: 'ReefBarrierGreat', nature: 'Bold', iv_hp: 31, iv_attack: 0, iv_defense: 31, iv_sp_attack: 31, iv_sp_defense: 31, iv_speed: 31 },
      { national_number: 248, pokemon: 'tyranitar', original_trainer_ign: 'Cubby', nature: 'Calm', iv_hp: 31, iv_attack: 0, iv_defense: 31, iv_sp_attack: 31, iv_sp_defense: 31, iv_speed: 31 }
    ];

    for (const shiny of sampleShinies) {
      // Get the original trainer's ID
      const res = await pool.query('SELECT id FROM team_members WHERE ign = $1', [shiny.original_trainer_ign]);
      if (res.rows.length === 0) {
        console.warn(`Original trainer ${shiny.original_trainer_ign} not found, skipping shiny ${shiny.national_number}`);
        continue;
      }
      const original_trainer = res.rows[0].id;

      await pool.query(`
        INSERT INTO team_shinies (national_number, pokemon, original_trainer, nature, iv_hp, iv_attack, iv_defense, iv_sp_attack, iv_sp_defense, iv_speed)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [shiny.national_number, shiny.pokemon, original_trainer, shiny.nature, shiny.iv_hp, shiny.iv_attack, shiny.iv_defense, shiny.iv_sp_attack, shiny.iv_sp_defense, shiny.iv_speed]);
    }
    
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();