const {
  buildShinyFilters,
  enrichShinyPayloadWithVariants,
  memberSchema,
  shinySchema,
  updateMemberSchema,
  updateShinySchema,
} = require('./contracts');
const Joi = require('joi');
const {
  authenticateBotRequest,
  clearAuthCookie,
  generateBotToken,
  getTokenFromRequest,
  verifyUserToken,
} = require('./auth');
const { createRepositories } = require('./repositories');
const { buildCorsHeaders, empty, json, readJson, withStandardHeaders } = require('./http');
const { FeebasRuleError, getLocationConfig } = require('../utils/feebas');

const updateFeebasTileSchema = Joi.object({
  status: Joi.string().valid('unchecked', 'checked', 'pending', 'confirmed').required(),
  actorFingerprint: Joi.string().trim().min(8).max(120).required(),
  actorName: Joi.string().trim().allow('', null).max(40).optional(),
});
const feebasActorFingerprintSchema = Joi.string().trim().min(8).max(120).optional();

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
      || pathname.startsWith('/api/shinies/sprites/')
      || (pathname.startsWith('/api/auth/') && pathname !== '/api/auth/me')
      || /^\/api\/feebas\/[^/]+\/stream$/.test(pathname);
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
    let repositories;
    const getRepositories = () => {
      repositories = repositories || options.repositories || createRepos(env);
      return repositories;
    };

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

    if (request.method === 'GET' && pathname === '/api/auth/me') {
      const token = getTokenFromRequest(request, env);

      if (!token) {
        return json({
          success: true,
          data: null,
        });
      }

      try {
        const decoded = await verifyUserToken(token, env);
        const user = await getRepositories().users.findById(decoded.sub);

        if (!user) {
          return json({
            success: true,
            data: null,
          }, {
            headers: {
              'set-cookie': clearAuthCookie(env),
            },
          });
        }

        return json({
          success: true,
          data: getRepositories().users.toSafeUser(user),
        });
      } catch {
        return json({
          success: false,
          message: 'Invalid or expired session.',
        }, {
          status: 401,
          headers: {
            'set-cookie': clearAuthCookie(env),
          },
        });
      }
    }

    if (request.method === 'GET' && pathname === '/api/members') {
      try {
        const data = await getRepositories().members.findAll();
        return json({ success: true, data });
      } catch (error) {
        console.error('Error fetching members:', error);
        return json({ success: false, message: 'Failed to fetch team members' }, { status: 500 });
      }
    }

    let match = pathname.match(/^\/api\/members\/ign\/inactive\/(.+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await getRepositories().members.findByIgnIncludingInactive(decodeURIComponent(match[1]));
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
        const member = await getRepositories().members.findByIgn(decodeURIComponent(match[1]));
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
        const member = await getRepositories().members.findByDiscordId(decodeURIComponent(match[1]));
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

        const member = await getRepositories().members.create(value);
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
        const member = await getRepositories().members.reactivate(match[1]);
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
        const stats = await getRepositories().members.getShinyStats(match[1]);
        return json({ success: true, data: stats });
      } catch (error) {
        console.error('Error fetching member stats:', error);
        return json({ success: false, message: 'Failed to fetch member statistics' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/members\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        const member = await getRepositories().members.findById(match[1]);
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

        const member = await getRepositories().members.update(match[1], value);
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
        const member = await getRepositories().members.delete(match[1]);
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

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/leaderboard$/);
    if (request.method === 'GET' && match) {
      try {
        getLocationConfig(match[1]);
        const leaderboardSortKeys = getRepositories().feebas.getLeaderboardSortOptions().map((option) => option.key);
        const leaderboardQuerySchema = Joi.object({
          limit: Joi.number().integer().min(1).max(50).optional(),
          sortBy: Joi.string().valid(...leaderboardSortKeys).optional(),
          sortDirection: Joi.string().valid('asc', 'desc').optional(),
        });
        const { error, value } = leaderboardQuerySchema.validate(Object.fromEntries(url.searchParams.entries()));

        if (error) {
          return json({
            success: false,
            message: 'Validation error',
            details: error.details,
          }, { status: 400 });
        }

        const leaderboard = await getRepositories().feebas.getLeaderboard(match[1], value);
        return json({
          success: true,
          data: leaderboard,
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error fetching Feebas leaderboard:', error);
        return json({ success: false, message: 'Failed to fetch Feebas leaderboard' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/tiles\/([^/]+)$/);
    if (request.method === 'POST' && match) {
      try {
        getLocationConfig(match[1]);
        const body = await readJson(request);
        const { error, value } = updateFeebasTileSchema.validate(body);

        if (error) {
          return json({
            success: false,
            message: 'Validation error',
            details: error.details,
          }, { status: 400 });
        }

        const board = await getRepositories().feebas.updateTile(match[1], match[2], value, {
          includeLeaderboard: false,
        });
        return json({
          success: true,
          data: board,
          message: 'Feebas tile updated successfully',
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error updating Feebas tile:', error);
        return json({ success: false, message: 'Failed to update Feebas tile' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)\/reset$/);
    if (request.method === 'POST' && match) {
      if (env.NODE_ENV === 'production') {
        return json({
          success: false,
          message: 'Feebas board reset is not available in production',
        }, { status: 403 });
      }

      try {
        getLocationConfig(match[1]);
        const board = await getRepositories().feebas.resetBoard(match[1]);
        return json({
          success: true,
          data: board,
          message: 'Feebas board reset successfully',
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error resetting Feebas board:', error);
        return json({ success: false, message: 'Failed to reset Feebas board' }, { status: 500 });
      }
    }

    match = pathname.match(/^\/api\/feebas\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      try {
        getLocationConfig(match[1]);
        const actorFingerprint = feebasActorFingerprintSchema.validate(url.searchParams.get('actorFingerprint') || undefined).value;
        const board = await getRepositories().feebas.getBoard(match[1], { actorFingerprint });

        return json({
          success: true,
          data: board,
        });
      } catch (error) {
        if (error instanceof FeebasRuleError) {
          return json({ success: false, message: error.message }, { status: error.statusCode });
        }

        console.error('Error fetching Feebas board:', error);
        return json({ success: false, message: 'Failed to fetch Feebas board' }, { status: 500 });
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
