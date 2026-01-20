/**
 * Shiny command handlers
 */

const { EmbedBuilder } = require('discord.js');
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
    console.log('Parsed Data:', data);
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

    const shinyResponse = await axios.post(`${apiBaseUrl}/shinies`, {
      national_number: nationalNumber,
      pokemon: data.name,
      original_trainer: trainer.id,
      catch_date: data.date,
      total_encounters: data.total_encounters,
      species_encounters: data.species_encounters,
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
        { name: 'Trainer', value: data.trainer, inline: true },
        { name: 'Pokemon', value: `${data.name} (#${nationalNumber})`, inline: true },
        { name: 'Encounter Type', value: encounterType, inline: true },
        { name: 'Encounters', value: data.total_encounters?.toString() || '0', inline: true },
        { name: 'Special', value: isSecret ? 'Secret' : (isSafari ? 'Safari' : 'None'), inline: true }
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

    const embed = new EmbedBuilder()
      .setColor(shiny.is_secret ? 0xFFD700 : 0x4CAF50)
      .setTitle(`${shiny.pokemon} (#${shiny.national_number})`)
      .addFields(
        { name: 'Trainer', value: shiny.trainer_name, inline: true },
        { name: 'Catch Date', value: new Date(shiny.catch_date).toLocaleDateString(), inline: true },
        { name: 'Encounter Type', value: shiny.encounter_type || 'N/A', inline: true },
        { name: 'Encounters', value: shiny.total_encounters?.toString() || 'N/A', inline: true },
        { name: 'Secret', value: shiny.is_secret ? 'Yes' : 'No', inline: true },
        { name: 'Safari', value: shiny.is_safari ? 'Yes' : 'No', inline: true }
      )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

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
