const SHINY_WAR_2026 = Object.freeze({
  id: '2026',
  name: 'PokeMMO Shiny Wars 2026',
  startsAt: '2026-08-01T00:00:00.000Z',
  endsAt: '2026-08-29T00:00:00.000Z',
  seasons: Object.freeze(['Summer', 'Autumn', 'Winter', 'Spring']),
  seasonDays: 7,
});

const TIER_POINTS = Object.freeze({
  'Tier 0': 50,
  'Tier 1': 45,
  'Tier 2': 40,
  'Tier 3': 30,
  'Tier 4': 15,
  'Tier 5': 10,
  'Tier 6': 5,
  'Tier 7': 3,
});

function getShinyWarSeason(at = new Date(), event = SHINY_WAR_2026) {
  const timestamp = at instanceof Date ? at.getTime() : new Date(at).getTime();
  const start = new Date(event.startsAt).getTime();
  const end = new Date(event.endsAt).getTime();
  if (!Number.isFinite(timestamp) || timestamp < start || timestamp >= end) return null;
  const seasonLength = event.seasonDays * 24 * 60 * 60 * 1000;
  return event.seasons[Math.floor((timestamp - start) / seasonLength)] || null;
}

function effectiveShinyDenominator({
  eventBoost = true,
  donator = false,
  personalCharm = false,
  linkCharm = false,
} = {}) {
  const charmBoost = personalCharm ? 0.10 : (linkCharm ? 0.05 : 0);
  const totalBoost = (eventBoost ? 0.10 : 0) + (donator ? 0.10 : 0) + charmBoost;
  return Math.round(30000 * (1 - totalBoost));
}

function calculateHordeMetrics(species, {
  hordesPerHour = 240,
  denominator = 30000,
  hordeSize = 5,
} = {}) {
  const totalRate = species.reduce((sum, entry) => sum + Number(entry.rate || 0), 0);
  const composition = species.map((entry) => ({
    ...entry,
    split: totalRate > 0 ? Number(entry.rate || 0) / totalRate : 0,
  }));
  const averagePoints = composition.reduce(
    (sum, entry) => sum + (Number(entry.points || 0) * entry.split),
    0
  );
  const encountersPerHour = Number(hordesPerHour) * Number(hordeSize);
  const pointsPerHour = denominator > 0
    ? (averagePoints * encountersPerHour) / Number(denominator)
    : 0;

  return { composition, averagePoints, encountersPerHour, pointsPerHour };
}

function getCatchBasePoints(catchEntry) {
  const tierPoints = TIER_POINTS[catchEntry.tier] || Number(catchEntry.tier_points || 0);
  if (catchEntry.is_alpha) return 75;
  if (catchEntry.tier === 'Legendary/Mythical') return 200;
  if (catchEntry.encounter_type === 'egg') return Math.max(35, tierPoints);
  return tierPoints;
}

function isEligibleCatch(catchEntry, event = SHINY_WAR_2026) {
  const caughtAt = new Date(catchEntry.caught_at_utc).getTime();
  const insideWindow = Number.isFinite(caughtAt)
    && caughtAt >= new Date(event.startsAt).getTime()
    && caughtAt < new Date(event.endsAt).getTime();
  if (!insideWindow) return false;
  if (catchEntry.war_eligibility_override === 0 || catchEntry.war_eligibility_override === false) {
    return false;
  }
  if (catchEntry.war_eligibility_override === 1 || catchEntry.war_eligibility_override === true) {
    return true;
  }
  if (['Fled', 'Died'].includes(catchEntry.status)) return false;
  return catchEntry.encounter_type !== 'gift';
}

function compareCatches(left, right) {
  return String(left.caught_at_utc || '').localeCompare(String(right.caught_at_utc || ''))
    || String(left.created_at || '').localeCompare(String(right.created_at || ''))
    || String(left.id || '').localeCompare(String(right.id || ''));
}

function scoreShinyWarCatches(catches, participantIds, event = SHINY_WAR_2026) {
  const participants = new Set(participantIds.map(String));
  const teamFamilies = new Set();
  const playerFamilies = new Map();
  const totalsByParticipant = new Map();

  const scoredCatches = [...catches]
    .filter((entry) => participants.has(String(entry.original_trainer)))
    .filter((entry) => isEligibleCatch(entry, event))
    .sort(compareCatches)
    .map((entry) => {
      const participantId = String(entry.original_trainer);
      const familyKey = entry.family_key || String(entry.pokemon || '').toLowerCase();
      const caughtFamilies = playerFamilies.get(participantId) || new Set();
      const isPlayerDuplicate = caughtFamilies.has(familyKey);
      const isTeamFirst = !teamFamilies.has(familyKey);
      const normalBase = getCatchBasePoints(entry);
      const basePoints = isPlayerDuplicate ? (entry.is_alpha ? 35 : 1) : normalBase;
      const secretBonus = entry.is_secret ? 20 : 0;
      const safariBonus = entry.encounter_type === 'safari' ? 10 : 0;
      const uniqueBonus = isTeamFirst ? 8 : 0;
      const totalPoints = basePoints + secretBonus + safariBonus + uniqueBonus;

      caughtFamilies.add(familyKey);
      playerFamilies.set(participantId, caughtFamilies);
      teamFamilies.add(familyKey);
      totalsByParticipant.set(
        participantId,
        (totalsByParticipant.get(participantId) || 0) + totalPoints
      );

      return {
        ...entry,
        family_key: familyKey,
        is_player_duplicate: isPlayerDuplicate,
        is_team_first: isTeamFirst,
        score: {
          base: basePoints,
          secretBonus,
          safariBonus,
          uniqueBonus,
          total: totalPoints,
        },
      };
    });

  return {
    teamTotal: scoredCatches.reduce((sum, entry) => sum + entry.score.total, 0),
    uniqueFamilies: [...teamFamilies],
    participantTotals: Object.fromEntries(totalsByParticipant),
    catches: scoredCatches,
  };
}

module.exports = {
  SHINY_WAR_2026,
  TIER_POINTS,
  calculateHordeMetrics,
  effectiveShinyDenominator,
  getCatchBasePoints,
  getShinyWarSeason,
  isEligibleCatch,
  scoreShinyWarCatches,
};
