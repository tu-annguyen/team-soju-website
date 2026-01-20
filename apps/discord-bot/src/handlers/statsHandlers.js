/**
 * Stats command handlers
 */

const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api';
const botToken = process.env.BOT_API_TOKEN;

async function handleLeaderboard(interaction) {
  await interaction.deferReply();

  const limit = interaction.options.getInteger('limit') || 10;

  try {
    const response = await axios.get(`${apiBaseUrl}/shinies/leaderboard?limit=${limit}`, {
      headers: { Authorization: `Bearer ${botToken}` }
    });
    const leaderboard = response.data.data;

    if (leaderboard.length === 0) {
      await interaction.editReply({ content: 'No data available for leaderboard' });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('Shiny Leaderboard')
      .setDescription(
        leaderboard.map((trainer, index) => {
          const secret = trainer.secret_count > 0 ? ` (${trainer.secret_count} secret)` : '';
          return `${index + 1}. **${trainer.ign}** - ${trainer.shiny_count} shinies${secret}`;
        }).join('\n')
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

async function handleStats(interaction) {
  await interaction.deferReply();

  try {
    const [statsResponse, membersResponse] = await Promise.all([
      axios.get(`${apiBaseUrl}/shinies/stats`, {
        headers: { Authorization: `Bearer ${botToken}` }
      }),
      axios.get(`${apiBaseUrl}/members`, {
        headers: { Authorization: `Bearer ${botToken}` }
      })
    ]);

    const stats = statsResponse.data.data;
    const members = membersResponse.data.data;

    const totalShinies = stats.reduce((sum, stat) => sum + parseInt(stat.count_by_type || 0), 0);
    const secretShinies = stats.reduce((sum, stat) => sum + parseInt(stat.secret_shinies || 0), 0);

    const embed = new EmbedBuilder()
      .setColor(0x9C27B0)
      .setTitle('Team Soju Statistics')
      .addFields(
        { name: 'Total Members', value: members.length.toString(), inline: true },
        { name: 'Total Shinies', value: totalShinies.toString(), inline: true },
        { name: 'Secret Shinies', value: secretShinies.toString(), inline: true }
      )
      .setTimestamp();

    if (stats.length > 0) {
      const encounterTypes = stats
        .filter(stat => stat.encounter_type)
        .slice(0, 5)
        .map(stat => `${stat.encounter_type}: ${stat.count_by_type}`)
        .join('\n');
      if (encounterTypes) {
        embed.addFields({ name: 'Top Encounter Types', value: encounterTypes });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply({ content: `Error: ${error.message}` });
  }
}

module.exports = {
  handleLeaderboard,
  handleStats
};
