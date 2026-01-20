/**
 * Member command handlers
 */

const { EmbedBuilder } = require('discord.js');
const TeamMember = require('../../../api-server/src/models/TeamMember');

async function handleAddMember(interaction) {
  await interaction.deferReply();

  const ign = interaction.options.getString('ign');
  const discordUser = interaction.options.getUser('discord');
  const rank = interaction.options.getString('rank') || 'Trainer';

  try {
    const member = await TeamMember.create({
      ign,
      discord_id: discordUser?.id,
      rank
    });

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
    const errorMessage = error.code === '23505'
      ? 'A member with this IGN or Discord ID already exists'
      : error.message;
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
    const member = await TeamMember.findByIgn(ign);
    if (!member) {
      await interaction.editReply({ content: `Member "${ign}" not found` });
      return;
    }

    const updates = {};
    if (newIgn) updates.ign = newIgn;
    if (discordUser) updates.discord_id = discordUser.id;
    if (rank) updates.rank = rank;

    if (Object.keys(updates).length === 0) {
      await interaction.editReply({ content: 'No updates provided' });
      return;
    }

    const updatedMember = await TeamMember.update(member.id, updates);

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
    const member = await TeamMember.findByIgn(ign);
    if (!member) {
      await interaction.editReply({ content: `Member "${ign}" not found` });
      return;
    }

    await TeamMember.delete(member.id);

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

async function handleGetMember(interaction) {
  await interaction.deferReply();

  const ign = interaction.options.getString('ign');

  try {
    const member = await TeamMember.findByIgn(ign);
    if (!member) {
      await interaction.editReply({ content: `Member "${ign}" not found` });
      return;
    }

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
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

module.exports = {
  handleAddMember,
  handleEditMember,
  handleDeleteMember,
  handleGetMember
};
