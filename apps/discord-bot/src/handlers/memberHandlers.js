/**
 * Member command handlers
 */

const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';
const botToken = process.env.BOT_API_TOKEN;

async function handleAddMember(interaction) {
  await interaction.deferReply();

  const ign = interaction.options.getString('ign');
  const discordUser = interaction.options.getUser('discord');
  const rank = interaction.options.getString('rank') || 'Trainer';

  try {
    const response = await axios.post(`${apiBaseUrl}/members`, {
      ign,
      discord_id: discordUser?.id,
      rank
    }, {
      headers: { Authorization: `Bearer ${botToken}` }
    });

    const member = response.data.data;

    const embed = new EmbedBuilder()
      .setColor(0x4CAF50)
      .setTitle('Member Added Successfully')
      .addFields(
        { name: 'IGN', value: ign, inline: true },
        { name: 'Rank', value: rank, inline: true },
        { name: 'Discord', value: discordUser ? `<@${discordUser.id}>` : 'Not linked', inline: true }
      )
      .setFooter({ text: `Member ID: ${member.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    await interaction.editReply({ content: `Error: ${errorMessage}` });
  }
}

async function handleEditMember(interaction) {
  await interaction.deferReply();

  const ign = interaction.options.getString('ign');
  const newIgn = interaction.options.getString('new_ign');
  const discordUser = interaction.options.getUser('discord');
  const rank = interaction.options.getString('rank');

  try {
    const memberResponse = await axios.get(`${apiBaseUrl}/members/ign/${ign}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const member = memberResponse.data.data;

    const updates = {};
    if (newIgn) updates.ign = newIgn;
    if (discordUser) updates.discord_id = discordUser.id;
    if (rank) updates.rank = rank;

    if (Object.keys(updates).length === 0) {
      await interaction.editReply({ content: 'No updates provided' });
      return;
    }

    const updateResponse = await axios.put(`${apiBaseUrl}/members/${member.id}`, updates, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const updatedMember = updateResponse.data.data;

    const embed = new EmbedBuilder()
      .setColor(0x2196F3)
      .setTitle('Member Updated Successfully')
      .addFields(
        { name: 'IGN', value: updatedMember.ign, inline: true },
        { name: 'Rank', value: updatedMember.rank, inline: true },
        { name: 'Discord', value: updatedMember.discord_id ? `<@${updatedMember.discord_id}>` : 'Not linked', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleDeleteMember(interaction) {
  await interaction.deferReply();

  const ign = interaction.options.getString('ign');

  try {
    const memberResponse = await axios.get(`${apiBaseUrl}/members/ign/${ign}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const member = memberResponse.data.data;

    await axios.delete(`${apiBaseUrl}/members/${member.id}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });

    const embed = new EmbedBuilder()
      .setColor(0xFF5722)
      .setTitle('Member Removed Successfully')
      .setDescription(`${ign} has been deactivated from the team`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleReactivateMember(interaction) {
  await interaction.deferReply();

  const ign = interaction.options.getString('ign');

  try {
    const memberResponse = await axios.get(`${apiBaseUrl}/members/ign/inactive/${ign}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const member = memberResponse.data.data;

    await axios.put(`${apiBaseUrl}/members/reactivate/${member.id}`, {}, {
      headers: { Authorization: `Bearer ${botToken}` }
    });

    const embed = new EmbedBuilder()
      .setColor(0x4CAF50)
      .setTitle('Member Reactivated Successfully')
      .addFields(
        { name: 'IGN', value: member.ign, inline: true },
        { name: 'Rank', value: member.rank, inline: true },
        { name: 'Discord', value: member.discord_id ? `<@${member.discord_id}>` : 'Not linked', inline: true }
      )
      .setFooter({ text: `Member ID: ${member.id}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    await interaction.editReply({ content: `Error: ${errorMessage}` });
  }
} 

async function handleGetMember(interaction) {
  await interaction.deferReply();

  const ign = interaction.options.getString('ign');

  try {
    const response = await axios.get(`${apiBaseUrl}/members/ign/${ign}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const member = response.data.data;

    const embed = new EmbedBuilder()
      .setColor(0x2196F3)
      .setTitle(member.ign)
      .addFields(
        { name: 'Rank', value: member.rank, inline: true },
        { name: 'Join Date', value: new Date(member.join_date).toLocaleDateString(), inline: true },
        { name: 'Shinies', value: member.shiny_count.toString(), inline: true }
      )
      .setFooter({ text: `Member ID: ${member.id}` })
      .setTimestamp();

    if (member.discord_id) {
      embed.addFields({ name: 'Discord', value: `<@${member.discord_id}>`, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      await interaction.editReply({ content: `Member with IGN "${ign}" not found.` });
      return;
    }
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

module.exports = {
  handleAddMember,
  handleEditMember,
  handleDeleteMember,
  handleReactivateMember,
  handleGetMember
};
