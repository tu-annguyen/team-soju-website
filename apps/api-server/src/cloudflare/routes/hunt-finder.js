const { json } = require('../services/worker-support');
const { huntFinderFilters } = require('./hunt-finder-query');

async function handleHuntFinderRoutes(context) {
  const { request, url, pathname, getRepositories } = context;
  if (request.method !== 'GET' || pathname !== '/api/hunt-finder/spots') return null;
  const data = await getRepositories().shinyWar.listHordeSpots(huntFinderFilters(url));
  return json({ success: true, data }, {
    headers: { 'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=60' },
  });
}

module.exports = { handleHuntFinderRoutes };
