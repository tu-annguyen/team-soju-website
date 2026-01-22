/**
 * Shiny command handlers
 */

const { EmbedBuilder, WebhookClient } = require('discord.js');
const axios = require('axios');
const Tesseract = require('tesseract.js');
const { parseDataFromOcr, getNationalNumber } = require('../utils');

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';
const botToken = process.env.BOT_API_TOKEN;

async function handleAddShiny(interaction) {
  await interaction.deferReply();

  const trainerIgn = interaction.options.getString('trainer');
  const pokemon = interaction.options.getString('pokemon');
  const nationalNumber = interaction.options.getInteger('pokedex_number');
  const encounterType = interaction.options.getString('encounter_type');
  const encounters = interaction.options.getInteger('encounters') || 0;
  const isSecret = interaction.options.getBoolean('secret') || false;
  const isSafari = interaction.options.getBoolean('safari') || false;

  try {
    const trainerResponse = await axios.get(`${apiBaseUrl}/members/ign/${trainerIgn}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const trainer = trainerResponse.data.data;

    const shinyResponse = await axios.post(`${apiBaseUrl}/shinies`, {
      national_number: nationalNumber,
      pokemon: pokemon.toLowerCase(),
      original_trainer: trainer.id,
      catch_date: new Date().toISOString().split('T')[0],
      total_encounters: encounters,
      species_encounters: encounters,
      encounter_type: encounterType,
      is_secret: isSecret,
      is_safari: encounterType === 'Safari' ? true : isSafari
    }, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const shiny = shinyResponse.data.data;

    const embed = new EmbedBuilder()
      .setColor(isSecret ? 0xFFD700 : 0x4CAF50)
      .setTitle(`${isSecret ? 'Secret ' : ''}Shiny Added!`)
      .addFields(
        { name: 'Trainer', value: trainerIgn, inline: true },
        { name: 'Pokemon', value: `${pokemon} (#${nationalNumber})`, inline: true },
        { name: 'Encounter Type', value: encounterType, inline: true },
        { name: 'Encounters', value: encounters.toString(), inline: true },
        { name: 'Special', value: isSecret ? 'Secret' : (isSafari ? 'Safari' : 'None'), inline: true }
      )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleAddShinyScreenshot(interaction) {
  await interaction.deferReply();

  const screenshotUrl = interaction.options.getAttachment('screenshot').url;
  const isMDY= interaction.options.getBoolean('date_is_mdy') || false;
  const encounterType = interaction.options.getString('encounter_type');
  const isSecret = interaction.options.getBoolean('secret') || false;
  const isSafari = interaction.options.getBoolean('safari') || false;

  let data = {};
  await Tesseract.recognize(
    screenshotUrl,
    'eng',
    { logger: m => console.log(m) }
  ).then(async ({ data: { text } }) => {
    console.log('OCR Result:', text);
    // Parse the OCR text to extract shiny details
    data = parseDataFromOcr(text, isMDY);
  }).catch(error => {
    console.error('OCR Error:', error);
    throw error;
  });

  let nationalNumber;
  try {
    nationalNumber = await getNationalNumber(data.name.toLowerCase());
    if (!nationalNumber) {
      await interaction.editReply({ content: `Error: Could not find national number for Pokémon "${data.name}"` });
      return;
    }

    const trainerResponse = await axios.get(`${apiBaseUrl}/members/ign/${data.trainer}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const trainer = trainerResponse.data.data;

    console.log('Parsed Data:', data);

    const shinyResponse = await axios.post(`${apiBaseUrl}/shinies`, {
      national_number: nationalNumber,
      pokemon: data.name,
      original_trainer: trainer.id,
      catch_date: data.date,
      total_encounters: data.totalEncounters,
      species_encounters: data.speciesEncounters,
      encounter_type: encounterType,
      nature: data.nature,
      iv_hp: data.hp,
      iv_attack: data.atk,
      iv_defense: data.def,
      iv_sp_attack: data.spa,
      iv_sp_defense: data.spd,
      iv_speed: data.spe,
      is_secret: isSecret,
      is_safari: encounterType === 'safari' ? true : isSafari,
      screenshot_url: screenshotUrl,
    }, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const shiny = shinyResponse.data.data;

    console.log('Shiny Created:', shiny);

    const embed = new EmbedBuilder()
      .setColor(isSecret ? 0xFFD700 : 0x4CAF50)
      .setTitle(`${isSecret ? 'Secret ' : ''}Shiny Added!`)
      .setImage(screenshotUrl)
      .addFields(
        { name: 'Trainer', value: data.trainer, inline: true },
        { name: 'Pokemon', value: `${data.name} (#${nationalNumber})`, inline: true },
        { name: 'Encounter Type', value: encounterType, inline: true },
        { name: 'Encounters', value: data.totalEncounters.toString() || '0', inline: true },
        { name: 'Special', value: isSecret ? 'Secret' : (encounterType === 'safari' ? 'Safari' : 'None'), inline: true }
      )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleEditShiny(interaction) {
  await interaction.deferReply();

  const shinyId = interaction.options.getString('shiny_id');
  const pokemon = interaction.options.getString('pokemon');
  const nationalNumber = interaction.options.getInteger('pokedex_number');
  const encounterType = interaction.options.getString('encounter_type');
  const encounters = interaction.options.getInteger('encounters');
  const isSecret = interaction.options.getBoolean('secret');
  const isSafari = interaction.options.getBoolean('safari');

  try {
    const updates = {};
    if (pokemon) updates.pokemon = pokemon.toLowerCase();
    if (nationalNumber) updates.national_number = nationalNumber;
    if (encounterType) updates.encounter_type = encounterType;
    if (encounters !== null) updates.total_encounters = encounters;
    if (isSecret !== null) updates.is_secret = isSecret;
    if (isSafari !== null) updates.is_safari = isSafari;

    if (Object.keys(updates).length === 0) {
      await interaction.editReply({ content: 'No updates provided' });
      return;
    }

    const updateResponse = await axios.put(`${apiBaseUrl}/shinies/${shinyId}`, updates, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const shiny = updateResponse.data.data;

    const embed = new EmbedBuilder()
      .setColor(0x2196F3)
      .setTitle('Shiny Updated Successfully')
      .addFields(
        { name: 'Pokemon', value: `${shiny.pokemon} (#${shiny.national_number})`, inline: true },
        { name: 'Encounter Type', value: shiny.encounter_type, inline: true },
        { name: 'Encounters', value: shiny.total_encounters?.toString() || '0', inline: true }
      )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleDeleteShiny(interaction) {
  await interaction.deferReply();

  const shinyId = interaction.options.getString('shiny_id');

  try {
    const deleteResponse = await axios.delete(`${apiBaseUrl}/shinies/${shinyId}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const shiny = deleteResponse.data.data;

    const embed = new EmbedBuilder()
      .setColor(0xFF5722)
      .setTitle('Shiny Deleted Successfully')
      .setDescription(`${shiny.pokemon} (#${shiny.national_number}) has been removed`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleGetShiny(interaction) {
  await interaction.deferReply();

  const shinyId = interaction.options.getString('id');

  try {
    const response = await axios.get(`${apiBaseUrl}/shinies/${shinyId}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const shiny = response.data.data;

    let spriteUrl;
    try {
      const pokeapiResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon/${shiny.national_number}`);
      spriteUrl = pokeapiResponse.data.sprites.versions["generation-v"]["black-white"].animated.front_shiny;
    } catch (error) {
      spriteUrl = null;
      console.error('Error fetching sprite from PokeAPI:', error);
    }

    // Format encounters string
    let encountersString;
    if (shiny.total_encounters === 0) {
      encountersString = null;
    } else if (shiny.species_encounters === 0) {
      encountersString = `${shiny.total_encounters}`;
    } else {
      encountersString = `${shiny.total_encounters} Total (${shiny.species_encounters} ${shiny.pokemon})`;
    }
    
    const embed = new EmbedBuilder()
      .setColor(shiny.is_secret ? 0xFFD700 : 0x4CAF50)
      .setTitle(`${shiny.pokemon} (#${shiny.national_number})`)
      .setThumbnail(spriteUrl || null)
      .setImage(shiny.screenshot_url)
      .addFields(
          { name: 'Trainer', value: shiny.trainer_name, inline: true },
        ...[
          shiny.catch_date ? { name: 'Catch Date', value: new Date(shiny.catch_date).toLocaleDateString(), inline: true } : null,
          shiny.encounter_type ? { name: 'Encounter Type', value: shiny.encounter_type, inline: true } : null,
          shiny.nature ? { name: 'Nature', value: shiny.nature, inline: true } : null,
          encountersString ? { name: 'Encounters', value: encountersString, inline: true } : null,
          shiny.iv_hp && shiny.iv_attack && shiny.iv_defense && shiny.iv_sp_attack && shiny.iv_sp_defense && shiny.iv_speed ? { name: 'IVs', value: `${shiny.iv_hp} HP/${shiny.iv_attack} Atk/${shiny.iv_defense} Def/${shiny.iv_sp_attack} SpA/${shiny.iv_sp_defense} SpD/${shiny.iv_speed} Spe`, inline: false } : null,
        ].filter(Boolean),
      )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    if (shiny.is_secret) {
      embed.addFields({ name: 'Secret Shiny', value: '✅', inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleGetShinies(interaction) {
  await interaction.deferReply();

  const trainerIgn = interaction.options.getString('trainer');
  const limit = interaction.options.getInteger('limit') || 10;

  try {
    const params = new URLSearchParams();
    params.append('limit', limit.toString());

    if (trainerIgn) {
      const trainerResponse = await axios.get(`${apiBaseUrl}/members/ign/${trainerIgn}`, {
        headers: { Authorization: `Bearer ${botToken}` }
      });
      const trainer = trainerResponse.data.data;
      params.append('trainer_id', trainer.id.toString());
    }

    const response = await axios.get(`${apiBaseUrl}/shinies?${params}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const shinies = response.data.data;

    if (shinies.length === 0) {
      await interaction.editReply({ content: 'No shinies found' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle(`Recent Shinies ${trainerIgn ? `by ${trainerIgn}` : ''}`)
      .setDescription(
        shinies.slice(0, limit).map((shiny, idx) => {
          const special = shiny.is_secret ? ' (Secret)' : (shiny.is_safari ? ' (Safari)' : '');
          return `${idx + 1}. **${shiny.pokemon_name}** by ${shiny.trainer_name}${special} - ID: ${shiny.id}`;
        }).join('\n')
      )
      .setFooter({ text: `Showing ${Math.min(shinies.length, limit)} shinies` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

module.exports = {
  handleAddShiny,
  handleAddShinyScreenshot,
  handleEditShiny,
  handleDeleteShiny,
  handleGetShiny,
  handleGetShinies
};
