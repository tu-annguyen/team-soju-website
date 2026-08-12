const { buildShinyFilters, enrichShinyPayloadWithVariants, shinySchema, updateShinySchema } = require('../contracts');
const { json, readJson } = require('../http');
const { enqueueShinyScreenshotJob, getShinyScreenshot } = require('../services/shiny-ocr');
const { getGreyscaleSprite } = require('../services/shiny-assets');

async function handleShiniesRoutes(context) {
  const {
    request,
    env,
    url,
    pathname,
    fetchImpl,
    getRepositories,
    requireBotAuth,
  } = context;
  let match;

    if (pathname === '/api/shinies/from-screenshot') {
      return json({ success: false, message: 'The synchronous screenshot OCR endpoint has been retired.' }, { status: 404 });
    }

    if (request.method === 'POST' && pathname === '/api/shinies/from-screenshot/async') {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;
      try {
        const job = await enqueueShinyScreenshotJob({ request, env, fetchImpl, body: await readJson(request) });
        return json({
          success: true,
          data: { job_id: job.id, status: job.status },
          message: 'Screenshot job queued successfully',
        }, { status: 202 });
      } catch (error) {
        console.error('Error queueing shiny screenshot:', error);
        return json({
          success: false,
          message: error.message || 'Failed to queue shiny screenshot',
          ...(error.details ? { details: error.details } : {}),
        }, { status: error.status || 500 });
      }
    }

    match = pathname.match(/^\/api\/shinies\/screenshots\/([^/]+)\/([a-f0-9]+)$/);
    if (request.method === 'GET' && match) {
      const object = await getShinyScreenshot(env, match[1], match[2]);
      if (!object) return json({ success: false, message: 'Screenshot not found' }, { status: 404 });
      return new Response(object.body, { headers: {
        'content-type': object.httpMetadata?.contentType || 'application/octet-stream',
        'cache-control': 'private, max-age=3600',
        'x-content-type-options': 'nosniff',
      } });
    }

    match = pathname.match(/^\/api\/shinies\/sprites\/(\d+)\/greyscale(?:\.gif)?$/);
    if (request.method === 'GET' && match) {
      const response = await getGreyscaleSprite({
        nationalNumber: Number(match[1]),
        variant: url.searchParams.get('variant'),
        fetchImpl,
      });
      return response || json({ success: false, message: 'Sprite not found' }, { status: 404 });
    }

    if (request.method === 'GET' && pathname === '/api/shinies') {
      try {
        const data = await getRepositories().shinies.findAll(buildShinyFilters(url));
        return json({ success: true, data, count: data.length });
      } catch (error) {
        console.error('Error fetching shinies:', error);
        return json({ success: false, message: 'Failed to fetch team shinies' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/shinies/stats') {
      try {
        const data = await getRepositories().shinies.getStats();
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching shiny stats:', error);
        return json({ success: false, message: 'Failed to fetch shiny statistics' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/shinies/leaderboard') {
      try {
        const limit = parseInt(url.searchParams.get('limit') || '10', 10);
        const data = await getRepositories().shinies.getTopTrainers(limit);
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return json({ success: false, message: 'Failed to fetch leaderboard' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/shinies\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const shiny = await getRepositories().shinies.findById(match[1]);
        if (!shiny) {
          return json({ success: false, message: 'Shiny not found' }, { status: 404 });
        }
        return json({ success: true, data: shiny });
      } catch (error) {
        console.error('Error fetching shiny:', error);
        return json({ success: false, message: 'Failed to fetch shiny' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/shinies') {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = shinySchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }
        const isEventDate = value.catch_date >= '2026-08-01' && value.catch_date < '2026-08-29';
        if (isEventDate && !value.caught_at_utc && getRepositories().shinyWar) {
          const participants = await getRepositories().shinyWar.listParticipants('2026');
          if (participants.some((entry) => entry.member_id === value.original_trainer)) {
            return json({
              success: false,
              message: 'An exact capture time and timezone are required for Shiny Wars participants.',
            }, { status: 400 });
          }
        }

        const shiny = await getRepositories().shinies.create(await enrichShinyPayloadWithVariants(value));
        return json({
          success: true,
          data: shiny,
          message: 'Shiny entry created successfully',
        }, { status: 201 });
      } catch (error) {
        console.error('Error creating shiny:', error);
        if (error.code === '23503' || /FOREIGN KEY constraint failed/i.test(error.message || '')) {
          return json({ success: false, message: 'Invalid trainer ID or Pokemon number' }, { status: 400 });
        }
        return json({ success: false, message: 'Failed to create shiny entry' }, { status: 500 });
      }
    }

    if (request.method === 'PUT' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = updateShinySchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const shiny = await getRepositories().shinies.update(match[1], await enrichShinyPayloadWithVariants(value));
        if (!shiny) {
          return json({ success: false, message: 'Shiny not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: shiny,
          message: 'Shiny entry updated successfully',
        });
      } catch (error) {
        console.error('Error updating shiny:', error);
        return json({ success: false, message: 'Failed to update shiny entry' }, { status: 500 });
      }
    }

    if (request.method === 'DELETE' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const shiny = await getRepositories().shinies.delete(match[1]);
        if (!shiny) {
          return json({ success: false, message: 'Shiny not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: shiny,
          message: 'Shiny entry deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting shiny:', error);
        return json({ success: false, message: 'Failed to delete shiny entry' }, { status: 500 });
      }
    }

  return null;
}

module.exports = { handleShiniesRoutes };
