/**
 * Stats command handlers
 */

const { EmbedBuilder } = require('../discord/api');
const fetchClient = require('../fetchClient');

function getApiBaseUrl() {
  return (process.env.API_BASE_URL || 'http://localhost:3001/api').replace(/\/+$/, '');
}

function getAuthHeaders() {
  return { headers: { Authorization: `Bearer ${process.env.BOT_API_TOKEN}` } };
}

function formatEncounterType(value) {
  return ({
    x5_horde: '5x Horde',
    x3_horde: '3x Horde',
    horde: 'Horde',
    raid_den: 'Raid Den',
    mysterious_ball: 'Mysterious Ball',
    honey_tree: 'Honey Tree',
    rock_smash: 'Rock Smash',
  }[value] || String(value || '').replace(/_/g, ' '));
}

async function handleLeaderboard(interaction) {
  await interaction.deferReply();

  const limit = interaction.options.getInteger('limit') || 10;

  try {
    const response = await fetchClient.get(`${getApiBaseUrl()}/shinies/leaderboard?limit=${limit}`, getAuthHeaders());
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
      fetchClient.get(`${getApiBaseUrl()}/shinies/stats`, getAuthHeaders()),
      fetchClient.get(`${getApiBaseUrl()}/members`, getAuthHeaders())
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
        .map(stat => `${formatEncounterType(stat.encounter_type)}: ${stat.count_by_type}`)
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
