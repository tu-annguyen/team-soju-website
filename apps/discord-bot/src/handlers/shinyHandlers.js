/**
 * Shiny command handlers
 */

const { EmbedBuilder, codeBlock } = require('discord.js');
const axios = require('axios');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { parseDataFromOcr, validateParsedData, getNationalNumber, getSpriteUrl, generateEncountersString } = require('../utils');

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';
const botToken = process.env.BOT_API_TOKEN;

async function handleAddShiny(interaction) {
  await interaction.deferReply();

  const trainerIgn = interaction.options.getString('trainer');
  const pokemon = interaction.options.getString('pokemon');
  const nationalNumber = interaction.options.getInteger('pokedex_number');
  const encounterType = interaction.options.getString('encounter_type');
  const isSecret = interaction.options.getBoolean('secret') || false;
  const isSafari = encounterType === 'Safari';
  const totalEncounters = interaction.options.getInteger('total_encounters') || 0;
  const speciesEncounters = interaction.options.getInteger('species_encounters') || 0;
  const nature = interaction.options.getString('nature');
  const ivHp = interaction.options.getInteger('iv_hp');
  const ivAttack = interaction.options.getInteger('iv_attack');
  const ivDefense = interaction.options.getInteger('iv_defense');
  const ivSpAttack = interaction.options.getInteger('iv_sp_attack');
  const ivSpDefense = interaction.options.getInteger('iv_sp_defense');
  const ivSpeed = interaction.options.getInteger('iv_speed');

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
      total_encounters: totalEncounters,
      species_encounters: speciesEncounters,
      encounter_type: encounterType,
      nature: nature,
      iv_hp: ivHp,
      iv_attack: ivAttack,
      iv_defense: ivDefense,
      iv_sp_attack: ivSpAttack,
      iv_sp_defense: ivSpDefense,
      iv_speed: ivSpeed,
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
        { name: 'Encounters', value: totalEncounters.toString(), inline: true },
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

  // Download and preprocess the image for better OCR
  const imageResponse = await axios.get(screenshotUrl, { responseType: 'arraybuffer' });
  const imageBuffer = Buffer.from(imageResponse.data);
  const processedBuffer = await sharp(imageBuffer)
    .greyscale()
    .normalise() // Enhance contrast
    .threshold(128) // Convert to binary for clearer text
    .sharpen({ sigma: 1 }) // Sharpen the image
    .toBuffer();

  let ocrText;
  await Tesseract.recognize(
    processedBuffer,
    'eng',
    { 
      logger: m => console.log(m),
      tessedit_pageseg_mode: '6',
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789/°: -_—'
    }
  ).then(async ({ data: { text } }) => {
    ocrText = text;
  }).catch(error => {
    console.error('OCR Error:', error);
    throw error;
  });

  if (!ocrText) {
    await interaction.editReply({ content: 'Failed to perform OCR on the image.' });
    return;
  }

  console.log('OCR Result:', ocrText);
  // Parse the OCR text to extract shiny details
  data = parseDataFromOcr(ocrText, isMDY);

  // Validate the parsed data
  const validation = validateParsedData(data);
  if (!validation.isValid) {
    const ocrCodeblock = codeBlock(ocrText);
    await interaction.editReply({ content: `OCR validation failed: ${validation.error}\nOCR result:\n${ocrCodeblock}\nTry uploading a desktop screenshot or adding the shiny manually.` });
    return;
  }

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
  const originalTrainer = interaction.options.getString('original_trainer');
  const catchDate = interaction.options.getString('catch_date');
  const encounterType = interaction.options.getString('encounter_type');
  const isSecret = interaction.options.getBoolean('secret') || false;
  const totalEncounters = interaction.options.getInteger('total_encounters') || 0;
  const speciesEncounters = interaction.options.getInteger('species_encounters') || 0;
  const nature = interaction.options.getString('nature');
  const ivs = interaction.options.getString('ivs');
  let ivHp = interaction.options.getInteger('iv_hp');
  let ivAttack = interaction.options.getInteger('iv_attack');
  let ivDefense = interaction.options.getInteger('iv_defense');
  let ivSpAttack = interaction.options.getInteger('iv_sp_attack');
  let ivSpDefense = interaction.options.getInteger('iv_sp_defense');
  let ivSpeed = interaction.options.getInteger('iv_speed');

  try {
    const updates = {};
    if (pokemon) updates.pokemon = pokemon;
    if (nationalNumber) updates.national_number = nationalNumber;
    if (originalTrainer) updates.original_trainer = originalTrainer;
    if (catchDate) updates.catch_date = new Date(catchDate).toISOString().split('T')[0];
    if (encounterType) updates.encounter_type = encounterType;
    if (isSecret) updates.is_secret = isSecret;
    if (totalEncounters) updates.total_encounters = totalEncounters;
    if (speciesEncounters) updates.species_encounters = speciesEncounters;
    if (nature) updates.nature = nature;
    if (ivs) {
      const ivArray = ivs.split(',').map(iv => parseInt(iv.trim(), 10));
      if (ivArray.length === 6) {
        if (ivArray.some(iv => iv < 0 || iv > 31)) {
          throw new Error('IVs must be integers in between 0 and 31.');
        }
        ivHp = ivArray[0];
        ivAttack = ivArray[1];
        ivDefense = ivArray[2];
        ivSpAttack = ivArray[3];
        ivSpDefense = ivArray[4];
        ivSpeed = ivArray[5];
      } else {
        throw new Error('IVs must be a comma-separated list of 6 integers.');
      }
    }
    if (ivHp !== null) updates.iv_hp = ivHp;
    if (ivAttack !== null) updates.iv_attack = ivAttack;
    if (ivDefense !== null) updates.iv_defense = ivDefense;
    if (ivSpAttack !== null) updates.iv_sp_attack = ivSpAttack;
    if (ivSpDefense !== null) updates.iv_sp_defense = ivSpDefense;
    if (ivSpeed !== null) updates.iv_speed = ivSpeed;

    if (Object.keys(updates).length === 0) {
      await interaction.editReply({ content: 'No updates provided' });
      return;
    }

    const updateResponse = await axios.put(`${apiBaseUrl}/shinies/${shinyId}`, updates, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const shiny = updateResponse.data.data;

    console.log('Shiny Edited:', shiny);

    let spriteUrl = null;
    try {
      spriteUrl = await getSpriteUrl(shiny.national_number);
    } catch (spriteError) {
      console.error('Error fetching sprite:', spriteError.message);
    }

    const encountersString = generateEncountersString(shiny.total_encounters, shiny.species_encounters, shiny.pokemon);

    const embed = new EmbedBuilder()
      .setColor(0x2196F3)
      .setTitle('Shiny Updated Successfully')
      .setThumbnail(spriteUrl || null)
      .addFields(
        { name: 'Pokemon', value: `${shiny.pokemon} (#${shiny.national_number})`, inline: true },
        { name: 'Trainer', value: shiny.trainer_name, inline: true },
        { name: 'Catch Date', value: new Date(shiny.catch_date).toLocaleDateString(), inline: true },
        ...[
          encounterType ? { name: 'Encounter Type', value: shiny.encounter_type, inline: true } : null,
          isSecret ? { name: 'Secret Shiny', value: '✅', inline: true } : null,
          encountersString ? { name: 'Encounters', value: encountersString, inline: true } : null,
          nature ? { name: 'Nature', value: shiny.nature, inline: true } : null,
          (shiny.iv_hp !== null && shiny.iv_attack !== null && shiny.iv_defense !== null && shiny.iv_sp_attack !== null && shiny.iv_sp_defense !== null && shiny.iv_speed !== null) ? { name: 'IVs (HP/Atk/Def/SpA/SpD/Spe)', value: `${shiny.iv_hp}/${shiny.iv_attack}/${shiny.iv_defense}/${shiny.iv_sp_attack}/${shiny.iv_sp_defense}/${shiny.iv_speed}`, inline: false } : null,
        ].filter(Boolean),
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
    const response = await axios.delete(`${apiBaseUrl}/shinies/${shinyId}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const shiny = response.data.data;

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

    let spriteUrl = null;
    try {
      spriteUrl = await getSpriteUrl(shiny.national_number);
    } catch (spriteError) {
      console.error('Error fetching sprite:', spriteError.message);
    }

    const encountersString = generateEncountersString(shiny.total_encounters, shiny.species_encounters, shiny.pokemon);
    
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
          shiny.is_secret ? { name: 'Secret Shiny', value: '✅', inline: true } : null,
          shiny.nature ? { name: 'Nature', value: shiny.nature, inline: true } : null,
          encountersString ? { name: 'Encounters', value: encountersString, inline: true } : null,
          shiny.iv_hp !== null && shiny.iv_attack !== null && shiny.iv_defense !== null && shiny.iv_sp_attack !== null && shiny.iv_sp_defense !== null && shiny.iv_speed !== null ? { name: 'IVs (HP/Atk/Def/SpA/SpD/Spe)', value: `${shiny.iv_hp}/${shiny.iv_attack}/${shiny.iv_defense}/${shiny.iv_sp_attack}/${shiny.iv_sp_defense}/${shiny.iv_speed}`, inline: false } : null,
        ].filter(Boolean),
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
