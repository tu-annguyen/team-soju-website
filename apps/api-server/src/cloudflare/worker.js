const {
  buildShinyFilters,
  enrichShinyPayloadWithVariants,
  memberSchema,
  shinySchema,
  updateMemberSchema,
  updateShinySchema,
} = require('./contracts');
const { authenticateBotRequest, generateBotToken } = require('./auth');
const { createRepositories } = require('./repositories');
const { buildCorsHeaders, empty, json, readJson, withStandardHeaders } = require('./http');

function createWorkerApp(options = {}) {
  const createRepos = options.createRepositories || createRepositories;
  const fetchImpl = options.fetch || fetch;

  async function maybeProxyLegacyRequest(request, env) {
    const url = new URL(request.url);
    const legacyBase = env.LEGACY_API_BASE_URL;
    if (!legacyBase) {
      return json({
        success: false,
        message: 'This endpoint is still served by the legacy Node API. Configure LEGACY_API_BASE_URL to proxy it during migration.',
      }, { status: 501 });
    }

    const proxyUrl = new URL(url.pathname + url.search, legacyBase);
    const response = await fetchImpl(proxyUrl, {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.clone().arrayBuffer(),
    });
    return response;
  }

  function isLegacyProxyPath(pathname) {
    return pathname === '/api/shinies/from-screenshot'
      || pathname === '/api/shinies/from-screenshot/async'
      || pathname.startsWith('/api/shinies/sprites/');
  }

  async function requireBotAuth(request, env) {
    const auth = await authenticateBotRequest(request, env);
    if (!auth.ok) {
      return json(auth.response.body, { status: auth.response.status });
    }
    return null;
  }

  async function routeRequest(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const repositories = options.repositories || createRepos(env);

    if (request.method === 'OPTIONS') {
      return empty(204, { headers: buildCorsHeaders(request, env) });
    }

    if (isLegacyProxyPath(pathname)) {
      return maybeProxyLegacyRequest(request, env, ctx);
    }

    if (request.method === 'GET' && pathname === '/health') {
      return json({
        success: true,
        message: 'Team Soju API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      });
    }

    if (request.method === 'GET' && pathname === '/generate-bot-token') {
      if (env.NODE_ENV === 'production') {
        return json({
          success: false,
          message: 'Token generation not available in production',
        }, { status: 403 });
      }

      const token = await generateBotToken(env.JWT_SECRET);
      return json({
        success: true,
        token,
        message: 'Bot token generated successfully',
      });
    }

    if (request.method === 'GET' && pathname === '/api/members') {
      try {
        const data = await repositories.members.findAll();
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching members:', error);
        return json({ success: false, message: 'Failed to fetch team members' }, { status: 500 });
      }
    }

    let match = pathname.match(/^\/api\/members\/ign\/inactive\/(.+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await repositories.members.findByIgnIncludingInactive(decodeURIComponent(match[1]));
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        if (member.is_active) {
          return json({ success: false, message: 'Team member is already active' }, { status: 400 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/ign\/(.+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await repositories.members.findByIgn(decodeURIComponent(match[1]));
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/discord\/(.+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await repositories.members.findByDiscordId(decodeURIComponent(match[1]));
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    if (request.method === 'POST' && pathname === '/api/members') {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = memberSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const member = await repositories.members.create(value);
        return json({
          success: true,
          data: member,
          message: 'Team member created successfully',
        }, { status: 201 });
      } catch (error) {
        console.error('Error creating member:', error);
        if (error.code === '23505' || /UNIQUE constraint failed/i.test(error.message || '')) {
          return json({
            success: false,
            message: 'A member with this IGN or Discord ID already exists',
          }, { status: 409 });
        }
        return json({ success: false, message: 'Failed to create team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/reactivate\/([^/]+)$/);
    if (request.method === 'PUT' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const member = await repositories.members.reactivate(match[1]);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: member,
          message: 'Team member reactivated successfully',
        });
      } catch (error) {
        console.error('Error reactivating member:', error);
        return json({ success: false, message: 'Failed to reactivate team member' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/([^/]+)\/stats$/);
    if (request.method === 'GET' && match) {
      try {
        const stats = await repositories.members.getShinyStats(match[1]);
        return json({ success: true, data: stats });
      } catch (error) {
        console.error('Error fetching member stats:', error);
        return json({ success: false, message: 'Failed to fetch member statistics' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await repositories.members.findById(match[1]);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({ success: true, data: member });
      } catch (error) {
        console.error('Error fetching member:', error);
        return json({ success: false, message: 'Failed to fetch team member' }, { status: 500 });
      }
    }

    if (request.method === 'PUT' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const body = await readJson(request);
        const { error, value } = updateMemberSchema.validate(body);
        if (error) {
          return json({ success: false, message: 'Validation error', details: error.details }, { status: 400 });
        }

        const member = await repositories.members.update(match[1], value);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({
          success: true,
          data: member,
          message: 'Team member updated successfully',
        });
      } catch (error) {
        console.error('Error updating member:', error);
        return json({ success: false, message: 'Failed to update team member' }, { status: 500 });
      }
    }

    if (request.method === 'DELETE' && match) {
      const unauthorized = await requireBotAuth(request, env);
      if (unauthorized) return unauthorized;

      try {
        const member = await repositories.members.delete(match[1]);
        if (!member) {
          return json({ success: false, message: 'Team member not found' }, { status: 404 });
        }
        return json({
          success: true,
          message: 'Team member deactivated successfully',
        });
      } catch (error) {
        console.error('Error deleting member:', error);
        return json({ success: false, message: 'Failed to delete team member' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/shinies') {
      try {
        const data = await repositories.shinies.findAll(buildShinyFilters(url));
        return json({ success: true, data, count: data.length });
      } catch (error) {
        console.error('Error fetching shinies:', error);
        return json({ success: false, message: 'Failed to fetch team shinies' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/shinies/stats') {
      try {
        const data = await repositories.shinies.getStats();
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching shiny stats:', error);
        return json({ success: false, message: 'Failed to fetch shiny statistics' }, { status: 500 });
      }
    }

    if (request.method === 'GET' && pathname === '/api/shinies/leaderboard') {
      try {
        const limit = parseInt(url.searchParams.get('limit') || '10', 10);
        const data = await repositories.shinies.getTopTrainers(limit);
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        return json({ success: false, message: 'Failed to fetch leaderboard' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/shinies\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const shiny = await repositories.shinies.findById(match[1]);
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

        const shiny = await repositories.shinies.create(await enrichShinyPayloadWithVariants(value));
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

        const shiny = await repositories.shinies.update(match[1], await enrichShinyPayloadWithVariants(value));
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
        const shiny = await repositories.shinies.delete(match[1]);
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

    return json({
      success: false,
      message: 'Endpoint not found',
    }, { status: 404 });
  }

  return {
    async fetch(request, env = {}, ctx = {}) {
      console.log(`${new Date().toISOString()} - ${request.method} ${new URL(request.url).pathname}`);

      try {
        const response = await routeRequest(request, env, ctx);
        return withStandardHeaders(response, request, env);
      } catch (error) {
        console.error('Global error handler:', error);
        return withStandardHeaders(json({
          success: false,
          message: 'Internal server error',
          ...(env.NODE_ENV === 'development' && { error: error.message }),
        }, { status: 500 }), request, env);
      }
    },
  };
}

module.exports = {
  createWorkerApp,
  fetch: (...args) => createWorkerApp().fetch(...args),
};
