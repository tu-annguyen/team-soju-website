/**
 * Shiny command handlers
 */

const { EmbedBuilder, codeBlock, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { parseDataFromOcr, validateParsedData, generateEncountersString, validateSojuTrainerIGN } = require('../utils');
const { getNationalNumber, getSpriteUrl, greyscale } = require('@team-soju/utils');

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';
const botToken = process.env.BOT_API_TOKEN;

async function handleAddShiny(interaction) {
  await interaction.deferReply();

  const trainerIgn = interaction.options.getString('trainer');
  
  // Validate Soju role members can only add shinies for their registered IGN
  const ignValidation = await validateSojuTrainerIGN(interaction, trainerIgn);
  if (!ignValidation.valid) {
    await interaction.editReply({ content: `❌ ${ignValidation.reason}`});
    return;
  }

  const pokemon = interaction.options.getString('pokemon');
  const catchDate = interaction.options.getString('catch_date') || new Date().toISOString().split('T')[0]; // default to today if not provided
  const encounterType = interaction.options.getString('encounter_type');
  const isSecret = interaction.options.getBoolean('secret') || false;
  const isAlpha = interaction.options.getBoolean('alpha') || false;
  const isSafari = encounterType === 'Safari';
  const totalEncounters = interaction.options.getInteger('total_encounters') || 0;
  const speciesEncounters = interaction.options.getInteger('species_encounters') || 0;
  const nature = interaction.options.getString('nature');
  const ivs = interaction.options.getString('ivs');
  let ivHp, ivAttack, ivDefense, ivSpAttack, ivSpDefense, ivSpeed;

  let nationalNumber;
  try {
    nationalNumber = await getNationalNumber(pokemon.toLowerCase());
    if (!nationalNumber) {
      await interaction.editReply({ content: `Error: Could not find national number for Pokémon "${pokemon}"`});
      return;
    }
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}`});
    return;
  }

  let trainer;
  try {
    const trainerResponse = await axios.get(`${apiBaseUrl}/members/ign/${trainerIgn}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    trainer = trainerResponse.data.data;
  } catch (error) {
    await interaction.editReply({ content: `Error: Could not find trainer with IGN "${trainerIgn}"`});
    return;
  }

  try {
    const info = {};
    if (trainer) info.original_trainer = trainer.id;
    if (pokemon) info.pokemon = pokemon;
    if (nationalNumber) info.national_number = nationalNumber;
    if (catchDate) info.catch_date = catchDate;
    if (encounterType) info.encounter_type = encounterType;
    if (isSecret) info.is_secret = isSecret;
    if (isAlpha) info.is_alpha = isAlpha;
    if (totalEncounters) info.total_encounters = totalEncounters;
    if (speciesEncounters) info.species_encounters = speciesEncounters;
    if (nature) info.nature = nature;
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
    if (ivHp !== null) info.iv_hp = ivHp;
    if (ivAttack !== null) info.iv_attack = ivAttack;
    if (ivDefense !== null) info.iv_defense = ivDefense;
    if (ivSpAttack !== null) info.iv_sp_attack = ivSpAttack;
    if (ivSpDefense !== null) info.iv_sp_defense = ivSpDefense;
    if (ivSpeed !== null) info.iv_speed = ivSpeed;

    const shinyResponse = await axios.post(`${apiBaseUrl}/shinies`, info, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const shiny = shinyResponse.data.data;

    const encountersString = generateEncountersString(shiny.total_encounters, shiny.species_encounters, shiny.pokemon);
    const spriteUrl = await getSpriteUrl(shiny.national_number);

    const embed = new EmbedBuilder()
      .setColor(isSecret ? 0xFFD700 : 0x4CAF50)
      .setTitle(`${isSecret ? 'Secret ' : ''}Shiny Added!`);
    if (spriteUrl) embed.setThumbnail(spriteUrl);
    embed.addFields(
        { name: 'Pokemon', value: `${shiny.pokemon} (#${shiny.national_number})`, inline: true },
        { name: 'Trainer', value: shiny.trainer_name, inline: true },
        { name: 'Catch Date', value: shiny.catch_date, inline: true },
        ...[
          encounterType ? { name: 'Encounter Type', value: shiny.encounter_type, inline: true } : null,
          isSecret ? { name: 'Secret Shiny', value: '✅', inline: true } : null,
          encountersString ? { name: 'Encounters', value: encountersString, inline: true } : null,
          nature ? { name: 'Nature', value: shiny.nature, inline: true } : null,
          (shiny.iv_hp !== null && shiny.iv_attack !== null && shiny.iv_defense !== null && shiny.iv_sp_attack !== null && shiny.iv_sp_defense !== null && shiny.iv_speed !== null) ? { name: 'IVs (HP/Atk/Def/SpA/SpD/Spe)', value: `${shiny.iv_hp}/${shiny.iv_attack}/${shiny.iv_defense}/${shiny.iv_sp_attack}/${shiny.iv_sp_defense}/${shiny.iv_speed}`, inline: false } : null,
          (isSecret || isSafari) ? { name: 'Special', value: isSecret ? 'Secret' : (isSafari ? 'Safari' : 'None'), inline: true } : null,
        ].filter(Boolean),
      )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}`});
  }
}

async function handleAddShinyScreenshot(interaction) {
  await interaction.deferReply();

  const screenshotUrl = interaction.options.getAttachment('screenshot').url;
  const isMDY= interaction.options.getBoolean('date_is_mdy') || false;
  const encounterType = interaction.options.getString('encounter_type');
  const isSecret = interaction.options.getBoolean('secret') || false;
  const isAlpha = interaction.options.getBoolean('alpha') || false;

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
    await interaction.editReply({ content: 'Failed to perform OCR on the image.'});
    return;
  }

  console.log('OCR Result:', ocrText);
  // Parse the OCR text to extract shiny details
  data = parseDataFromOcr(ocrText, isMDY);

  // Validate the parsed data
  const validation = validateParsedData(data);
  if (!validation.isValid) {
    const ocrCodeblock = codeBlock(ocrText);
    await interaction.editReply({ content: `OCR validation failed: ${validation.error}\nOCR result:\n${ocrCodeblock}\nTry uploading a high resolution desktop screenshot with minimal particles crowding the text areas or adding the shiny manually.`});
    return;
  }

  // Validate Soju role members can only add shinies for their registered IGN
  const ignValidation = await validateSojuTrainerIGN(interaction, data.trainer);
  if (!ignValidation.valid) {
    await interaction.editReply({ content: `❌ ${ignValidation.reason}`});
    return;
  }

  let nationalNumber;
  try {
    nationalNumber = await getNationalNumber(data.name.toLowerCase());
    if (!nationalNumber) {
      await interaction.editReply({ content: `Error: Could not find national number for Pokémon "${data.name}"`});
      return;
    }

    let trainer;
    try {
      const trainerResponse = await axios.get(`${apiBaseUrl}/members/ign/${data.trainer}`, {
        headers: { Authorization: `Bearer ${botToken}` }
      });
      trainer = trainerResponse.data.data;
    } catch (error) {
      await interaction.editReply({ content: `Error: Could not find trainer with IGN "${data.trainer}"`});
      return;
    }

    console.log('Parsed Data:', data);

    const body = {
      national_number: nationalNumber,
      pokemon: data.name,
      original_trainer: trainer.id,
      catch_date: data.date,
      encounter_type: encounterType,
      is_secret: isSecret,
      is_alpha: isAlpha,
      screenshot_url: screenshotUrl,
      total_encounters: Number.isInteger(data.totalEncounters) ? data.totalEncounters : 0,
      species_encounters: Number.isInteger(data.speciesEncounters) ? data.speciesEncounters : 0,
    };

    // Only include optional fields if they are NOT null/undefined
    if (typeof data.nature === 'string' && data.nature.trim()) body.nature = data.nature;

    // IVs: include only if integer 0-31 (note: 0 is valid!)
    if (Number.isInteger(data.hp)  && data.hp  >= 0 && data.hp  <= 31) body.iv_hp = data.hp;
    if (Number.isInteger(data.atk) && data.atk >= 0 && data.atk <= 31) body.iv_attack = data.atk;
    if (Number.isInteger(data.def) && data.def >= 0 && data.def <= 31) body.iv_defense = data.def;
    if (Number.isInteger(data.spa) && data.spa >= 0 && data.spa <= 31) body.iv_sp_attack = data.spa;
    if (Number.isInteger(data.spd) && data.spd >= 0 && data.spd <= 31) body.iv_sp_defense = data.spd;
    if (Number.isInteger(data.spe) && data.spe >= 0 && data.spe <= 31) body.iv_speed = data.spe;

    const shinyResponse = await axios.post(`${apiBaseUrl}/shinies`, body, {
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
      )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}`});
  }
}

async function handleEditShiny(interaction) {
  await interaction.deferReply();

  const shinyId = interaction.options.getString('shiny_id');
  const pokemon = interaction.options.getString('pokemon');
  const originalTrainer = interaction.options.getString('original_trainer');
  const catchDate = interaction.options.getString('catch_date');
  const encounterType = interaction.options.getString('encounter_type');
  const isSecret = interaction.options.getBoolean('secret') || false;
  const isAlpha = interaction.options.getBoolean('alpha') || false;
  const totalEncounters = interaction.options.getInteger('total_encounters');
  const speciesEncounters = interaction.options.getInteger('species_encounters');
  const nature = interaction.options.getString('nature');
  const ivs = interaction.options.getString('ivs');
  let ivHp = interaction.options.getInteger('iv_hp');
  let ivAttack = interaction.options.getInteger('iv_attack');
  let ivDefense = interaction.options.getInteger('iv_defense');
  let ivSpAttack = interaction.options.getInteger('iv_sp_attack');
  let ivSpDefense = interaction.options.getInteger('iv_sp_defense');
  let ivSpeed = interaction.options.getInteger('iv_speed');

  let nationalNumber;

  try {
    // Fetch the existing shiny to validate Soju role members can only edit their own shinies
    let existingShiny;
    try {
      const shinyResponse = await axios.get(`${apiBaseUrl}/shinies/${shinyId}`, {
        headers: { Authorization: `Bearer ${botToken}` }
      });
      existingShiny = shinyResponse.data.data;
    } catch (error) {
      await interaction.editReply({ content: `Error: Could not find shiny with ID "${shinyId}"` });
      return;
    }

    // Validate Soju role members can only edit shinies for their registered IGN
    const ignValidation = await validateSojuTrainerIGN(interaction, existingShiny.trainer_name);
    if (!ignValidation.valid) {
      await interaction.editReply({ content: `❌ ${ignValidation.reason}`});
      return;
    }

    const updates = {};
    if (pokemon) {
      updates.pokemon = pokemon;
      try {
        nationalNumber = await getNationalNumber(pokemon.toLowerCase());
      } catch (error) {
        await interaction.editReply({ content: `Error: Could not find national number for Pokémon "${pokemon}"`});
        return;
      }
    }
    if (nationalNumber) updates.national_number = nationalNumber;
    if (originalTrainer) updates.original_trainer = originalTrainer;
    if (catchDate) updates.catch_date = catchDate;
    if (encounterType) updates.encounter_type = encounterType;
    if (isSecret) updates.is_secret = isSecret;
    if (isAlpha) updates.is_alpha = isAlpha;
    if (totalEncounters !== null) updates.total_encounters = totalEncounters;
    if (speciesEncounters !== null) updates.species_encounters = speciesEncounters;
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

    let spriteUrl = null;
    try {
      spriteUrl = await getSpriteUrl(shiny.national_number);
    } catch (spriteError) {
      console.error('Error fetching sprite:', spriteError.message);
    }

    let encountersString;
    if (totalEncounters !== null || speciesEncounters !== null) {
      encountersString = generateEncountersString(shiny.total_encounters, shiny.species_encounters, shiny.pokemon);
    }

    const embed = new EmbedBuilder()
      .setColor(0x2196F3)
      .setTitle('Shiny Updated Successfully');
    if (spriteUrl) embed.setThumbnail(spriteUrl);
    embed.addFields(
        { name: 'Pokemon', value: `${shiny.pokemon} (#${shiny.national_number})`, inline: true },
        { name: 'Trainer', value: shiny.trainer_name, inline: true },
        ...[
          catchDate ? { name: 'Catch Date', value: shiny.catch_date, inline: true } : null,
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
    await interaction.editReply({ content: `Error: ${error.message}`});
  }
}

async function handleFailShiny(interaction) {
  await interaction.deferReply();

  const shinyId = interaction.options.getString('shiny_id');
  try {
    // Fetch the existing shiny to validate Soju role members can only edit their own shinies
    let existingShiny;
    try {
      const shinyResponse = await axios.get(`${apiBaseUrl}/shinies/${shinyId}`, {
        headers: { Authorization: `Bearer ${botToken}` }
      });
      existingShiny = shinyResponse.data.data;
    } catch (error) {
      await interaction.editReply({ content: `Error: Could not find shiny with ID "${shinyId}"` });
      return;
    }

    // Validate Soju role members can only edit shinies for their registered IGN
    const ignValidation = await validateSojuTrainerIGN(interaction, existingShiny.trainer_name);
    if (!ignValidation.valid) {
      await interaction.editReply({ content: `❌ ${ignValidation.reason}`});
      return;
    }

    const updateResponse = await axios.put(`${apiBaseUrl}/shinies/${shinyId}`, { notes: "Failed" }, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const shiny = updateResponse.data.data;

    let spriteUrl = null;
    const attachments = [];
    try {
      spriteUrl = await getSpriteUrl(shiny.national_number);
      if (spriteUrl) {
        try {
          const greyscaled = await greyscale(spriteUrl);
          attachments.push({ attachment: greyscaled, name: 'sprite.gif' });
          spriteUrl = 'attachment://sprite.gif';
        } catch (gErr) {
          console.error('Greyscale failed for sprite in failShiny:', gErr.message);
          // fall back to original spriteUrl
        }
      }
    } catch (spriteError) {
      console.error('Error fetching sprite:', spriteError.message);
    }

    const embed = new EmbedBuilder()
      .setColor(0x2196F3)
      .setTitle('Shiny Successfully Marked as Failed');
    if (spriteUrl) embed.setThumbnail(spriteUrl);
    embed.addFields(
        { name: 'Pokemon', value: `${shiny.pokemon} (#${shiny.national_number})`, inline: true },
        { name: 'Trainer', value: shiny.trainer_name, inline: true },
        { name: 'Catch Date', value: shiny.catch_date, inline: true },
        { name: 'Status', value: 'Failed', inline: true },
      )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed], files: attachments });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}`});
  }
}

async function handleDeleteShiny(interaction) {
  await interaction.deferReply();

  const shinyId = interaction.options.getString('shiny_id');

  try {
    // Fetch the shiny first to validate Soju role members can only delete their own shinies
    let existingShiny;
    try {
      const shinyResponse = await axios.get(`${apiBaseUrl}/shinies/${shinyId}`, {
        headers: { Authorization: `Bearer ${botToken}` }
      });
      existingShiny = shinyResponse.data.data;
    } catch (error) {
      await interaction.editReply({ content: `Error: Could not find shiny with ID "${shinyId}"` });
      return;
    }

    // Validate Soju role members can only delete shinies for their registered IGN
    const ignValidation = await validateSojuTrainerIGN(interaction, existingShiny.trainer_name);
    if (!ignValidation.valid) {
      await interaction.editReply({ content: `❌ ${ignValidation.reason}`});
      return;
    }

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
    await interaction.editReply({ content: `Error: ${error.message}`});
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
    const attachments = [];
    try {
      spriteUrl = await getSpriteUrl(shiny.national_number);
    } catch (spriteError) {
      console.error('Error fetching sprite:', spriteError.message);
    }

    const encountersString = generateEncountersString(shiny.total_encounters, shiny.species_encounters, shiny.pokemon);
    
    if (shiny.notes && shiny.notes.toLowerCase() === "failed") {
      try {
        const greyscaledSprite = await greyscale(spriteUrl);
        // store the greyscaled image as an attachment so we don't exceed URL length limits
        attachments.push({ attachment: greyscaledSprite, name: 'sprite.gif' });
        spriteUrl = 'attachment://sprite.gif';
      } catch (gErr) {
        console.error('Greyscale failed for sprite:', gErr.message);
        // leave original spriteUrl intact if greyscale fails
      }
    }

    const embed = new EmbedBuilder()
      .setColor(shiny.is_secret || shiny.is_alpha ? 0xFFD700 : 0x4CAF50)
      .setTitle(`${shiny.pokemon} (#${shiny.national_number})`);
    if (spriteUrl) embed.setThumbnail(spriteUrl);
    if (shiny.screenshot_url) embed.setImage(shiny.screenshot_url);
    embed.addFields(
          { name: 'Trainer', value: shiny.trainer_name, inline: true },
        ...[
          shiny.catch_date ? { name: 'Catch Date', value: shiny.catch_date, inline: true } : null,
          shiny.encounter_type ? { name: 'Encounter Type', value: shiny.encounter_type, inline: true } : null,
          shiny.is_secret ? { name: 'Secret Shiny', value: '✅', inline: true } : null,
          shiny.is_alpha ? { name: 'Alpha Shiny', value: '✅', inline: true } : null,
          shiny.nature ? { name: 'Nature', value: shiny.nature, inline: true } : null,
          encountersString ? { name: 'Encounters', value: encountersString, inline: true } : null,
          shiny.iv_hp !== null && shiny.iv_attack !== null && shiny.iv_defense !== null && shiny.iv_sp_attack !== null && shiny.iv_sp_defense !== null && shiny.iv_speed !== null ? { name: 'IVs (HP/Atk/Def/SpA/SpD/Spe)', value: `${shiny.iv_hp}/${shiny.iv_attack}/${shiny.iv_defense}/${shiny.iv_sp_attack}/${shiny.iv_sp_defense}/${shiny.iv_speed}`, inline: false } : null,
          shiny.notes ? { name: 'Notes', value: shiny.notes, inline: false } : null,
        ].filter(Boolean),
      )
      .setFooter({ text: `Shiny ID: ${shiny.id}` })
      .setTimestamp();

    try {
      await interaction.editReply({ embeds: [embed], files: attachments });
    } catch (err) {
      console.error('Error editing reply for getShiny:', err);
      await interaction.editReply({ content: `Error: ${err.message}`});
    }
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}`});
  }
}

// Helper: build embed for a specific page of shinies
function buildShiniesEmbed(shinies, page, pageSize, trainerIgn) {
  const totalPages = Math.ceil(shinies.length / pageSize) || 1;
  const startIndex = (page - 1) * pageSize;
  const pageItems = shinies.slice(startIndex, startIndex + pageSize);

  const description = pageItems.map((shiny, idx) => {
    let special = '';
    if (shiny.is_alpha) {
      special = '(Alpha)';
      if (shiny.is_secret) {
        special = ' (Secret Alpha)';
      }
    } else if (shiny.is_secret) {
      special = ' (Secret)';
    }

    return `${startIndex + idx + 1}. **${shiny.pokemon_name.charAt(0).toUpperCase() + shiny.pokemon_name.slice(1)}** by ${shiny.trainer_name}${special} - ID: ${shiny.id}`;
  }).join('\n');

  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle(`Recent Shinies ${trainerIgn ? `by ${trainerIgn}` : ''}`)
    .setDescription(description || 'No shinies found')
    .setFooter({ text: `Page ${page} of ${totalPages}` })
    .setTimestamp();
}

// Helper: create pagination button row
function buildPaginationComponents(page, totalPages) {
  const first = new ButtonBuilder()
    .setCustomId('shinies_page_first')
    .setLabel('<<')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === 1);

  const prev = new ButtonBuilder()
    .setCustomId('shinies_page_prev')
    .setLabel('<')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === 1);

  const next = new ButtonBuilder()
    .setCustomId('shinies_page_next')
    .setLabel('>')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === totalPages);

  const last = new ButtonBuilder()
    .setCustomId('shinies_page_last')
    .setLabel('>>')
    .setStyle(ButtonStyle.Primary)
    .setDisabled(page === totalPages);

  return [new ActionRowBuilder().addComponents(first, prev, next, last)];
}

async function handleGetShinies(interaction) {
  await interaction.deferReply();

  const trainerIgn = interaction.options.getString('trainer');
  const pageSize = interaction.options.getInteger('limit') || 10;

  try {
    const params = new URLSearchParams();
    // fetch a large upper bound so we can paginate client-side
    params.append('limit', '10000');

    if (trainerIgn) {
      try {
        const trainerResponse = await axios.get(`${apiBaseUrl}/members/ign/${trainerIgn}`, {
          headers: { Authorization: `Bearer ${botToken}` }
        });
        const trainer = trainerResponse.data.data;
        params.append('trainer_id', trainer.id.toString());
      } catch (error) {
        await interaction.editReply({ content: `Error fetching trainer: ${error.message} does not exist.` });
        return;
      }
    }

    const response = await axios.get(`${apiBaseUrl}/shinies?${params}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const shinies = response.data.data || [];

    if (shinies.length === 0) {
      await interaction.editReply({ content: 'No shinies found' });
      return;
    }

    shinies.sort((a, b) => new Date(b.catch_date) - new Date(a.catch_date));

    const totalPages = Math.ceil(shinies.length / pageSize) || 1;
    let currentPage = 1;

    let embed = buildShiniesEmbed(shinies, currentPage, pageSize, trainerIgn);
    let components = buildPaginationComponents(currentPage, totalPages);

    await interaction.editReply({ embeds: [embed], components });
    const message = await interaction.fetchReply();

    const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('shinies_page_');
    const collector = message.createMessageComponentCollector({ filter, time: 600000 });

    collector.on('collect', async i => {
      const action = i.customId.split('_').pop();
      if (action === 'first') currentPage = 1;
      else if (action === 'prev') currentPage = Math.max(1, currentPage - 1);
      else if (action === 'next') currentPage = Math.min(totalPages, currentPage + 1);
      else if (action === 'last') currentPage = totalPages;

      embed = buildShiniesEmbed(shinies, currentPage, pageSize, trainerIgn);
      components = buildPaginationComponents(currentPage, totalPages);

      await i.update({ embeds: [embed], components });
    });

    collector.on('end', () => {
      // disable remaining buttons when collector expires
      const disabled = components.map(row => {
        row.components.forEach(btn => btn.setDisabled(true));
        return row;
      });
      message.edit({ components: disabled }).catch(() => {});
    });

  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}`});
  }
}

module.exports = {
  handleAddShiny,
  handleAddShinyScreenshot,
  handleEditShiny,
  handleFailShiny,
  handleDeleteShiny,
  handleGetShiny,
  handleGetShinies
};
