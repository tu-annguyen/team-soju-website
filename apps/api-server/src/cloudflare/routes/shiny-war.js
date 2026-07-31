const { json, readJson } = require('../services/worker-support');

const EVENT_ID = '2026';

function cleanQueue(value) {
  if (!Array.isArray(value) || value.length > 20) return null;
  const queue = value.map((item) => ({
    spot_key: String(item?.spot_key || '').trim(),
    target_family_key: item?.target_family_key ? String(item.target_family_key).trim() : null,
    label: String(item?.label || '').trim(),
    details: item?.details && typeof item.details === 'object' ? item.details : {},
  }));
  return queue.every((item) => item.spot_key && item.label) ? queue : null;
}

async function managerAuth(context) {
  return context.requirePermission(
    context.request,
    context.env,
    context.getRepositories(),
    'shiny_war:manage'
  );
}

async function memberAuth(context) {
  return context.requireTeamMember(
    context.request,
    context.env,
    context.getRepositories()
  );
}

async function handleShinyWarRoutes(context) {
  const { request, url, pathname, getRepositories } = context;
  if (!pathname.startsWith('/api/shiny-war')) return null;
  const repositories = getRepositories();
  let match;

  try {
    if (request.method === 'GET' && pathname === '/api/shiny-war/event') {
      const auth = await memberAuth(context);
      if (auth.response) return auth.response;
      return json({ success: true, data: await repositories.shinyWar.getEvent(EVENT_ID) });
    }

    if (request.method === 'GET' && pathname === '/api/shiny-war/dashboard') {
      const auth = await memberAuth(context);
      if (auth.response) return auth.response;
      return json({ success: true, data: await repositories.shinyWar.getDashboard(EVENT_ID) });
    }

    if (request.method === 'GET' && pathname === '/api/shiny-war/participants') {
      const auth = await memberAuth(context);
      if (auth.response) return auth.response;
      const [event, participants] = await Promise.all([
        repositories.shinyWar.getEvent(EVENT_ID),
        repositories.shinyWar.listParticipants(EVENT_ID),
      ]);
      return json({ success: true, data: { event, participants } });
    }

    if (request.method === 'GET' && pathname === '/api/shiny-war/hunts') {
      const auth = await memberAuth(context);
      if (auth.response) return auth.response;
      return json({ success: true, data: await repositories.shinyWar.listHunts(EVENT_ID) });
    }

    if (request.method === 'GET' && pathname === '/api/shiny-war/hordes') {
      const auth = await memberAuth(context);
      if (auth.response) return auth.response;
      const bool = (name, fallback = false) => {
        const value = url.searchParams.get(name);
        return value === null ? fallback : value === 'true';
      };
      const data = await repositories.shinyWar.listHordeSpots({
        season: url.searchParams.get('season') || undefined,
        region: url.searchParams.get('region') || undefined,
        location: url.searchParams.get('location') || undefined,
        method: url.searchParams.get('method') || undefined,
        hordeSize: url.searchParams.get('hordeSize') || undefined,
        tier: url.searchParams.get('tier') || undefined,
        species: url.searchParams.get('species') || undefined,
        time: url.searchParams.get('time') || undefined,
        fullSplitOnly: bool('fullSplitOnly'),
        sort: url.searchParams.get('sort') || undefined,
        page: url.searchParams.get('page') || undefined,
        pageSize: url.searchParams.get('pageSize') || undefined,
        hordesPerHour: Number(url.searchParams.get('hordesPerHour')) || 240,
        profile: {
          eventBoost: bool('eventBoost', true),
          donator: bool('donator'),
          personalCharm: bool('personalCharm'),
          linkCharm: bool('linkCharm'),
        },
      });
      return json({ success: true, data });
    }

    if (request.method === 'GET' && pathname === '/api/shiny-war/encounters') {
      const auth = await memberAuth(context);
      if (auth.response) return auth.response;
      return json({ success: true, data: await repositories.shinyWar.listEncounters({
        season: url.searchParams.get('season') || undefined,
        region: url.searchParams.get('region') || undefined,
        method: url.searchParams.get('method') || undefined,
        hordeSize: url.searchParams.get('hordeSize') || undefined,
        species: url.searchParams.get('species') || undefined,
        page: url.searchParams.get('page') || undefined,
        pageSize: url.searchParams.get('pageSize') || undefined,
      }) });
    }

    if (request.method === 'PUT' && pathname === '/api/shiny-war/queue') {
      const auth = await memberAuth(context);
      if (auth.response) return auth.response;
      const participant = (await repositories.shinyWar.listParticipants(EVENT_ID))
        .find((entry) => entry.member_id === auth.membership.id);
      if (!participant) return json({ success: false, message: 'Only roster participants can edit a queue.' }, { status: 403 });
      const body = await readJson(request);
      const queue = cleanQueue(body.queue);
      if (!queue) return json({ success: false, message: 'Queue must contain at most 20 valid hunts.' }, { status: 400 });
      return json({ success: true, data: await repositories.shinyWar.replaceQueue(EVENT_ID, auth.membership.id, queue) });
    }

    match = pathname.match(/^\/api\/shiny-war\/participants\/([^/]+)\/queue$/);
    if (request.method === 'PUT' && match) {
      const auth = await managerAuth(context);
      if (auth.response) return auth.response;
      const body = await readJson(request);
      const queue = cleanQueue(body.queue);
      if (!queue) return json({ success: false, message: 'Queue must contain at most 20 valid hunts.' }, { status: 400 });
      return json({ success: true, data: await repositories.shinyWar.replaceQueue(EVENT_ID, match[1], queue) });
    }

    if (request.method === 'POST' && pathname === '/api/shiny-war/participants') {
      const auth = await managerAuth(context);
      if (auth.response) return auth.response;
      const event = await repositories.shinyWar.getEvent(EVENT_ID);
      if (event?.roster_locked) return json({ success: false, message: 'The roster is locked.' }, { status: 409 });
      const body = await readJson(request);
      if (!body.member_id) return json({ success: false, message: 'member_id is required.' }, { status: 400 });
      const participants = await repositories.shinyWar.listParticipants(EVENT_ID);
      if (participants.length >= 30) {
        return json({ success: false, message: 'The official roster is limited to 30 participants.' }, { status: 409 });
      }
      return json({ success: true, data: await repositories.shinyWar.addParticipant(EVENT_ID, body.member_id, auth.user.id) }, { status: 201 });
    }

    match = pathname.match(/^\/api\/shiny-war\/participants\/([^/]+)$/);
    if (request.method === 'DELETE' && match) {
      const auth = await managerAuth(context);
      if (auth.response) return auth.response;
      const event = await repositories.shinyWar.getEvent(EVENT_ID);
      if (event?.roster_locked) return json({ success: false, message: 'The roster is locked.' }, { status: 409 });
      return json({ success: true, data: await repositories.shinyWar.removeParticipant(EVENT_ID, match[1]) });
    }

    if (request.method === 'PUT' && pathname === '/api/shiny-war/roster-lock') {
      const auth = await managerAuth(context);
      if (auth.response) return auth.response;
      const body = await readJson(request);
      if (typeof body.locked !== 'boolean') return json({ success: false, message: 'locked must be a boolean.' }, { status: 400 });
      return json({ success: true, data: await repositories.shinyWar.setRosterLocked(EVENT_ID, body.locked) });
    }

    match = pathname.match(/^\/api\/shiny-war\/shinies\/([^/]+)\/eligibility$/);
    if (request.method === 'PUT' && match) {
      const auth = await managerAuth(context);
      if (auth.response) return auth.response;
      const body = await readJson(request);
      if (![true, false, null].includes(body.eligible)) {
        return json({ success: false, message: 'eligible must be true, false, or null.' }, { status: 400 });
      }
      return json({ success: true, data: await repositories.shinyWar.setEligibility(match[1], body.eligible === null ? null : (body.eligible ? 1 : 0)) });
    }
  } catch (error) {
    console.error('Error handling Shiny Wars route:', error);
    return json({ success: false, message: 'Failed to handle Shiny Wars request.' }, { status: 500 });
  }

  return null;
}

module.exports = { cleanQueue, handleShinyWarRoutes };
