const crypto = globalThis.crypto || require('crypto');

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function boolFromDb(value) {
  return value === true || value === 1 || value === '1';
}

function normalizeSubmissionStatus(status) {
  if (status === 'valid') return 'verified';
  if (status === 'invalid') return 'rejected';
  return status || 'pending-verification';
}

function normalizeEvent(row, screenshots = []) {
  if (!row) return null;
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    ownerIgn: row.owner_ign,
    name: row.name,
    slug: row.slug,
    eventDate: row.event_date,
    startLocal: row.start_local,
    endLocal: row.end_local,
    timezone: row.timezone,
    region: row.region,
    route: row.route,
    winnerCount: Number(row.winner_count) || 4,
    targets: parseJson(row.targets_json, []),
    speciesBonuses: parseJson(row.species_bonuses_json, []),
    speciesPenalties: parseJson(row.species_penalties_json, []),
    natureBonuses: parseJson(row.nature_bonuses_json, []),
    naturePenalties: parseJson(row.nature_penalties_json, []),
    useLowestScoreFinalPlace: boolFromDb(row.use_lowest_score_final_place),
    isLeaderboardPublished: boolFromDb(row.is_leaderboard_published),
    isPrivate: boolFromDb(row.is_private),
    submissionsClosed: boolFromDb(row.submissions_closed),
    autoCheckEnabled: boolFromDb(row.auto_check_enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    screenshots,
  };
}

function normalizeSubmission(row, screenshots = []) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    playerIgn: row.player_ign,
    species: row.species,
    nature: row.nature,
    totalIv: Number(row.total_iv) || 0,
    catchLocal: row.catch_local,
    timezone: row.timezone,
    region: row.region,
    route: row.route,
    catchUtc: row.catch_utc,
    score: Number(row.score) || 0,
    status: normalizeSubmissionStatus(row.status),
    flags: parseJson(row.flags_json, []),
    screenshotNames: screenshots.map((screenshot) => screenshot.fileName),
    screenshotProofs: screenshots,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeScreenshot(row) {
  if (!row) return null;
  return {
    id: row.id,
    submissionId: row.submission_id,
    fileName: row.file_name,
    contentType: row.content_type,
    storageKey: row.storage_key,
    url: row.public_url || null,
    createdAt: row.created_at,
  };
}

function normalizeCollaborator(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    email: row.email,
    ign: row.ign,
    role: row.role || 'co-host',
    createdAt: row.created_at,
  };
}

function createCatchEventsRepository({ dialect, parameter, runCommand, runOne, runSelect }) {
  const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
  let submissionLocationColumnsReady = dialect !== 'd1';
  let eventSubmissionColumnsReady = dialect !== 'd1';
  let submissionStatusConstraintReady = dialect !== 'd1';
  let collaboratorsTableReady = dialect !== 'd1';

  async function ensureEventSubmissionColumns() {
    if (eventSubmissionColumnsReady) return;

    const columns = await runSelect('PRAGMA table_info(catch_events)');
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('submissions_closed')) {
      await runCommand(`
        ALTER TABLE catch_events
        ADD COLUMN submissions_closed INTEGER NOT NULL DEFAULT 0
        CHECK (submissions_closed IN (0, 1))
      `);
    }

    if (!columnNames.has('is_private')) {
      await runCommand(`
        ALTER TABLE catch_events
        ADD COLUMN is_private INTEGER NOT NULL DEFAULT 1
        CHECK (is_private IN (0, 1))
      `);
    }

    if (!columnNames.has('auto_check_enabled')) {
      await runCommand(`
        ALTER TABLE catch_events
        ADD COLUMN auto_check_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (auto_check_enabled IN (0, 1))
      `);
    }

    eventSubmissionColumnsReady = true;
  }

  async function ensureCollaboratorsTable() {
    if (collaboratorsTableReady) return;

    await runCommand(`
      CREATE TABLE IF NOT EXISTS catch_event_collaborators (
        event_id TEXT NOT NULL REFERENCES catch_events(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'co-host' CHECK (role IN ('co-host')),
        created_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (event_id, user_id)
      ) STRICT
    `);
    await runCommand(`
      CREATE INDEX IF NOT EXISTS idx_catch_event_collaborators_user_created_at
      ON catch_event_collaborators(user_id, created_at DESC)
    `);

    collaboratorsTableReady = true;
  }

  async function ensureSubmissionLocationColumns() {
    if (submissionLocationColumnsReady) return;

    const columns = await runSelect('PRAGMA table_info(catch_event_submissions)');
    const columnNames = new Set(columns.map((column) => column.name));

    if (!columnNames.has('region')) {
      await runCommand(`
        ALTER TABLE catch_event_submissions
        ADD COLUMN region TEXT NOT NULL
        CHECK (region IN ('Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova'))
      `);
    }

    if (!columnNames.has('route')) {
      await runCommand(`
        ALTER TABLE catch_event_submissions
        ADD COLUMN route TEXT NOT NULL DEFAULT 'Unknown'
      `);
    }

    submissionLocationColumnsReady = true;
  }

  async function ensureSubmissionStatusConstraint() {
    if (submissionStatusConstraintReady) return;

    const rows = await runSelect(`
      SELECT sql
      FROM sqlite_schema
      WHERE type = 'table' AND name = 'catch_event_submissions'
    `);
    const tableSql = rows[0]?.sql || '';

    if (tableSql.includes("'valid'") || tableSql.includes("'invalid'")) {
      await runCommand('PRAGMA foreign_keys = OFF');
      await runCommand(`
        CREATE TABLE catch_event_submissions_next (
          id TEXT PRIMARY KEY,
          event_id TEXT NOT NULL REFERENCES catch_events(id) ON DELETE CASCADE,
          player_ign TEXT NOT NULL,
          species TEXT NOT NULL,
          nature TEXT NOT NULL,
          total_iv INTEGER NOT NULL CHECK (total_iv BETWEEN 0 AND 186),
          catch_local TEXT NOT NULL,
          timezone TEXT NOT NULL,
          region TEXT NOT NULL CHECK (region IN ('Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova')),
          route TEXT NOT NULL,
          catch_utc TEXT NOT NULL,
          score INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending-verification'
            CHECK (status IN ('pending-verification', 'auto-checked', 'needs-review', 'verified', 'rejected', 'disqualified')),
          flags_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          CHECK (trim(player_ign) <> ''),
          CHECK (trim(route) <> ''),
          UNIQUE(event_id, player_ign COLLATE NOCASE)
        ) STRICT
      `);
      await runCommand(`
        INSERT INTO catch_event_submissions_next (
          id, event_id, player_ign, species, nature, total_iv, catch_local,
          timezone, region, route, catch_utc, score, status, flags_json,
          created_at, updated_at
        )
        SELECT
          id, event_id, player_ign, species, nature, total_iv, catch_local,
          timezone, region, route, catch_utc, score,
          CASE status
            WHEN 'valid' THEN 'verified'
            WHEN 'invalid' THEN 'rejected'
            ELSE status
          END,
          flags_json, created_at, updated_at
        FROM catch_event_submissions
      `);
      await runCommand('DROP TABLE catch_event_submissions');
      await runCommand('ALTER TABLE catch_event_submissions_next RENAME TO catch_event_submissions');
      await runCommand(`
        CREATE INDEX IF NOT EXISTS idx_catch_event_submissions_event_score
        ON catch_event_submissions(event_id, score DESC, catch_utc ASC)
      `);
      await runCommand('PRAGMA foreign_keys = ON');
    }

    submissionStatusConstraintReady = true;
  }

  async function getScreenshotsBySubmissionIds(submissionIds) {
    if (!submissionIds.length) return new Map();
    const placeholders = submissionIds.map((_, index) => parameter(index + 1)).join(', ');
    const rows = await runSelect(`
      SELECT *
      FROM catch_event_submission_screenshots
      WHERE submission_id IN (${placeholders})
      ORDER BY created_at ASC, id ASC
    `, submissionIds);
    const map = new Map();
    rows.forEach((row) => {
      const screenshot = normalizeScreenshot(row);
      const list = map.get(row.submission_id) || [];
      list.push(screenshot);
      map.set(row.submission_id, list);
    });
    return map;
  }

  async function listSubmissions(eventId) {
    const rows = await runSelect(`
      SELECT *
      FROM catch_event_submissions
      WHERE event_id = ${parameter(1)}
      ORDER BY datetime(created_at) DESC
    `, [eventId]);
    const screenshotsBySubmission = await getScreenshotsBySubmissionIds(rows.map((row) => row.id));
    return rows.map((row) => normalizeSubmission(row, screenshotsBySubmission.get(row.id) || []));
  }

  async function listCollaborators(eventId) {
    await ensureCollaboratorsTable();
    const rows = await runSelect(`
      SELECT
        c.event_id,
        c.user_id,
        c.role,
        c.created_at,
        u.email,
        u.ign
      FROM catch_event_collaborators c
      INNER JOIN app_users u ON u.id = c.user_id
      WHERE c.event_id = ${parameter(1)}
      ORDER BY LOWER(u.ign) ASC, LOWER(u.email) ASC
    `, [eventId]);
    return rows.map(normalizeCollaborator);
  }

  async function getEventAccess(eventId, userId) {
    if (!eventId || !userId) {
      return { isOwner: false, isCollaborator: false, canManage: false };
    }

    await ensureCollaboratorsTable();
    const row = await runOne(`
      SELECT
        e.owner_user_id,
        c.user_id AS collaborator_user_id
      FROM catch_events e
      LEFT JOIN catch_event_collaborators c
        ON c.event_id = e.id AND c.user_id = ${parameter(2)}
      WHERE e.id = ${parameter(1)}
      LIMIT 1
    `, [eventId, userId]);
    const isOwner = row?.owner_user_id === userId;
    const isCollaborator = row?.collaborator_user_id === userId;
    return {
      isOwner,
      isCollaborator,
      canManage: Boolean(isOwner || isCollaborator),
    };
  }

  return {
    async createEvent(owner, event) {
      await ensureEventSubmissionColumns();
      const id = event.id || crypto.randomUUID();
      await runCommand(`
        INSERT INTO catch_events (
          id, owner_user_id, owner_ign, name, slug, event_date, start_local, end_local,
          timezone, region, route, winner_count, targets_json, species_bonuses_json,
          species_penalties_json, nature_bonuses_json, nature_penalties_json,
          use_lowest_score_final_place, is_leaderboard_published, is_private, auto_check_enabled
        )
        VALUES (
          ${parameter(1)}, ${parameter(2)}, ${parameter(3)}, ${parameter(4)}, ${parameter(5)},
          ${parameter(6)}, ${parameter(7)}, ${parameter(8)}, ${parameter(9)}, ${parameter(10)},
          ${parameter(11)}, ${parameter(12)}, ${parameter(13)}, ${parameter(14)}, ${parameter(15)},
          ${parameter(16)}, ${parameter(17)}, ${parameter(18)}, ${parameter(19)}, ${parameter(20)}, ${parameter(21)}
        )
      `, [
        id,
        owner.id,
        owner.ign,
        event.name,
        event.slug || id,
        event.eventDate,
        event.startLocal,
        event.endLocal,
        event.timezone,
        event.region,
        event.route,
        event.winnerCount,
        JSON.stringify(event.targets || []),
        JSON.stringify(event.speciesBonuses || []),
        JSON.stringify(event.speciesPenalties || []),
        JSON.stringify(event.natureBonuses || []),
        JSON.stringify(event.naturePenalties || []),
        event.useLowestScoreFinalPlace ? 1 : 0,
        event.isLeaderboardPublished ? 1 : 0,
        event.isPrivate === false ? 0 : 1,
        event.autoCheckEnabled ? 1 : 0,
      ]);
      return this.getEventById(id, { includeSubmissions: true });
    },

    async updateEvent(id, ownerUserId, event) {
      await ensureEventSubmissionColumns();
      const existing = await this.getEventById(id);
      if (!existing || existing.ownerUserId !== ownerUserId) {
        return null;
      }

      await runCommand(`
        UPDATE catch_events
        SET name = ${parameter(3)},
            slug = ${parameter(4)},
            event_date = ${parameter(5)},
            start_local = ${parameter(6)},
            end_local = ${parameter(7)},
            timezone = ${parameter(8)},
            region = ${parameter(9)},
            route = ${parameter(10)},
            winner_count = ${parameter(11)},
            targets_json = ${parameter(12)},
            species_bonuses_json = ${parameter(13)},
            species_penalties_json = ${parameter(14)},
            nature_bonuses_json = ${parameter(15)},
            nature_penalties_json = ${parameter(16)},
            use_lowest_score_final_place = ${parameter(17)},
            is_private = ${parameter(18)},
            auto_check_enabled = ${parameter(19)},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)} AND owner_user_id = ${parameter(2)}
      `, [
        id,
        ownerUserId,
        event.name,
        event.slug || id,
        event.eventDate,
        event.startLocal,
        event.endLocal,
        event.timezone,
        event.region,
        event.route,
        event.winnerCount,
        JSON.stringify(event.targets || []),
        JSON.stringify(event.speciesBonuses || []),
        JSON.stringify(event.speciesPenalties || []),
        JSON.stringify(event.natureBonuses || []),
        JSON.stringify(event.naturePenalties || []),
        event.useLowestScoreFinalPlace ? 1 : 0,
        event.isPrivate === false ? 0 : 1,
        event.autoCheckEnabled ? 1 : 0,
      ]);
      return this.getEventById(id, { includeSubmissions: true });
    },

    async deleteEvent(id, ownerUserId) {
      const event = await this.getEventById(id);
      if (!event || event.ownerUserId !== ownerUserId) {
        return null;
      }

      await runCommand(`
        DELETE FROM catch_events
        WHERE id = ${parameter(1)} AND owner_user_id = ${parameter(2)}
      `, [id, ownerUserId]);
      return event;
    },

    async listEvents({ ownerUserId, manageableByUserId, publishedOnly } = {}) {
      await ensureEventSubmissionColumns();
      const clauses = [];
      const params = [];
      if (manageableByUserId) {
        await ensureCollaboratorsTable();
        params.push(manageableByUserId);
        const ownerParameter = parameter(params.length);
        params.push(manageableByUserId);
        const collaboratorParameter = parameter(params.length);
        clauses.push(`(
          owner_user_id = ${ownerParameter}
          OR id IN (
            SELECT event_id
            FROM catch_event_collaborators
            WHERE user_id = ${collaboratorParameter}
          )
        )`);
      } else if (ownerUserId) {
        params.push(ownerUserId);
        clauses.push(`owner_user_id = ${parameter(params.length)}`);
      }
      if (publishedOnly) {
        clauses.push('is_leaderboard_published = 1');
      }
      if (!ownerUserId && !manageableByUserId) {
        clauses.push('is_private = 0');
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const rows = await runSelect(`
        SELECT *
        FROM catch_events
        ${where}
        ORDER BY datetime(created_at) DESC
      `, params);
      return rows.map((row) => normalizeEvent(row));
    },

    async getEventById(id, { includeSubmissions = false, includeCollaborators = false } = {}) {
      await ensureEventSubmissionColumns();
      const row = await runOne(`
        SELECT *
        FROM catch_events
        WHERE id = ${parameter(1)}
        LIMIT 1
      `, [id]);
      const event = normalizeEvent(row);
      if (!event) return event;
      const additions = {};
      if (includeSubmissions) {
        additions.submissions = await listSubmissions(event.id);
      }
      if (includeCollaborators) {
        additions.collaborators = await listCollaborators(event.id);
      }
      return Object.keys(additions).length ? { ...event, ...additions } : event;
    },

    async getEventAccess(id, userId) {
      return getEventAccess(id, userId);
    },

    async setLeaderboardPublished(id, managerUserId, isPublished) {
      const access = await getEventAccess(id, managerUserId);
      if (!access.canManage) {
        return null;
      }

      await runCommand(`
        UPDATE catch_events
        SET is_leaderboard_published = ${parameter(2)},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
      `, [id, isPublished ? 1 : 0]);
      return this.getEventById(id, { includeSubmissions: true });
    },

    async setSubmissionsClosed(id, managerUserId, isClosed) {
      await ensureEventSubmissionColumns();
      const access = await getEventAccess(id, managerUserId);
      if (!access.canManage) {
        return null;
      }

      await runCommand(`
        UPDATE catch_events
        SET submissions_closed = ${parameter(2)},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
      `, [id, isClosed ? 1 : 0]);
      return this.getEventById(id, { includeSubmissions: true });
    },

    async setAutoCheckEnabled(id, managerUserId, autoCheckEnabled) {
      await ensureEventSubmissionColumns();
      const access = await getEventAccess(id, managerUserId);
      if (!access.canManage) {
        return null;
      }

      await runCommand(`
        UPDATE catch_events
        SET auto_check_enabled = ${parameter(2)},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
      `, [id, autoCheckEnabled ? 1 : 0]);
      return this.getEventById(id, { includeSubmissions: true });
    },

    async upsertSubmission(eventId, submission, screenshots = []) {
      await ensureSubmissionLocationColumns();
      await ensureSubmissionStatusConstraint();

      const existing = await runOne(`
        SELECT *
        FROM catch_event_submissions
        WHERE event_id = ${parameter(1)} AND LOWER(player_ign) = LOWER(${parameter(2)})
        LIMIT 1
      `, [eventId, submission.playerIgn]);
      const id = existing?.id || crypto.randomUUID();

      if (existing) {
        await runCommand(`
          UPDATE catch_event_submissions
          SET player_ign = ${parameter(2)},
              species = ${parameter(3)},
              nature = ${parameter(4)},
              total_iv = ${parameter(5)},
              catch_local = ${parameter(6)},
              timezone = ${parameter(7)},
              region = ${parameter(8)},
              route = ${parameter(9)},
              catch_utc = ${parameter(10)},
              score = ${parameter(11)},
              status = ${parameter(12)},
              flags_json = ${parameter(13)},
              updated_at = ${nowExpression}
          WHERE id = ${parameter(1)}
        `, [
          id,
          submission.playerIgn,
          submission.species,
          submission.nature,
          submission.totalIv,
          submission.catchLocal,
          submission.timezone,
          submission.region,
          submission.route,
          submission.catchUtc,
          submission.score,
          submission.status,
          JSON.stringify(submission.flags || []),
        ]);
        await runCommand(`
          DELETE FROM catch_event_submission_screenshots
          WHERE submission_id = ${parameter(1)}
        `, [id]);
      } else {
        await runCommand(`
          INSERT INTO catch_event_submissions (
            id, event_id, player_ign, species, nature, total_iv, catch_local,
            timezone, region, route, catch_utc, score, status, flags_json
          )
          VALUES (
            ${parameter(1)}, ${parameter(2)}, ${parameter(3)}, ${parameter(4)}, ${parameter(5)},
            ${parameter(6)}, ${parameter(7)}, ${parameter(8)}, ${parameter(9)}, ${parameter(10)},
            ${parameter(11)}, ${parameter(12)}, ${parameter(13)}, ${parameter(14)}
          )
        `, [
          id,
          eventId,
          submission.playerIgn,
          submission.species,
          submission.nature,
          submission.totalIv,
          submission.catchLocal,
          submission.timezone,
          submission.region,
          submission.route,
          submission.catchUtc,
          submission.score,
          submission.status,
          JSON.stringify(submission.flags || []),
        ]);
      }

      await Promise.all(screenshots.map((screenshot) => runCommand(`
        INSERT INTO catch_event_submission_screenshots (
          id, submission_id, file_name, content_type, storage_key, public_url
        )
        VALUES (${parameter(1)}, ${parameter(2)}, ${parameter(3)}, ${parameter(4)}, ${parameter(5)}, ${parameter(6)})
      `, [
        screenshot.id || crypto.randomUUID(),
        id,
        screenshot.fileName,
        screenshot.contentType,
        screenshot.storageKey,
        screenshot.url || null,
      ])));

      const screenshotsBySubmission = await getScreenshotsBySubmissionIds([id]);
      const row = await runOne(`
        SELECT *
        FROM catch_event_submissions
        WHERE id = ${parameter(1)}
      `, [id]);

      return {
        submission: normalizeSubmission(row, screenshotsBySubmission.get(id) || []),
        replaced: Boolean(existing),
      };
    },

    async updateSubmissionStatus(eventId, managerUserId, submissionId, status) {
      await ensureSubmissionStatusConstraint();
      const access = await getEventAccess(eventId, managerUserId);
      if (!access.canManage) {
        return null;
      }
      await runCommand(`
        UPDATE catch_event_submissions
        SET status = ${parameter(3)},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
          AND event_id = ${parameter(2)}
      `, [submissionId, eventId, status]);
      return this.getEventById(eventId, { includeSubmissions: true });
    },

    async listCollaborators(eventId, ownerUserId) {
      const event = await this.getEventById(eventId);
      if (!event || event.ownerUserId !== ownerUserId) {
        return null;
      }
      return listCollaborators(eventId);
    },

    async addCollaborator(eventId, ownerUserId, user) {
      await ensureCollaboratorsTable();
      const event = await this.getEventById(eventId);
      if (!event || event.ownerUserId !== ownerUserId) {
        return null;
      }
      if (user.id === ownerUserId) {
        const error = new Error('Owners already have access to their event.');
        error.code = 'SELF_COLLABORATOR';
        throw error;
      }

      const insertConflictClause = dialect === 'd1' ? 'INSERT OR IGNORE' : 'INSERT';
      const conflictSuffix = dialect === 'd1' ? '' : ' ON CONFLICT (event_id, user_id) DO NOTHING';
      await runCommand(`
        ${insertConflictClause} INTO catch_event_collaborators (
          event_id,
          user_id,
          role,
          created_by_user_id
        )
        VALUES (${parameter(1)}, ${parameter(2)}, 'co-host', ${parameter(3)})
        ${conflictSuffix}
      `, [eventId, user.id, ownerUserId]);

      return listCollaborators(eventId);
    },

    async removeCollaborator(eventId, ownerUserId, userId) {
      await ensureCollaboratorsTable();
      const event = await this.getEventById(eventId);
      if (!event || event.ownerUserId !== ownerUserId) {
        return null;
      }

      await runCommand(`
        DELETE FROM catch_event_collaborators
        WHERE event_id = ${parameter(1)} AND user_id = ${parameter(2)}
      `, [eventId, userId]);

      return listCollaborators(eventId);
    },

    async getScreenshotById(id) {
      const row = await runOne(`
        SELECT *
        FROM catch_event_submission_screenshots
        WHERE id = ${parameter(1)}
        LIMIT 1
      `, [id]);
      return normalizeScreenshot(row);
    },

    listSubmissions,
  };
}

module.exports = {
  createCatchEventsRepository,
};
