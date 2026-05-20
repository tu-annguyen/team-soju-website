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
    status: row.status,
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

function createCatchEventsRepository({ dialect, parameter, runCommand, runOne, runSelect }) {
  const nowExpression = dialect === 'd1' ? "datetime('now')" : 'now()';
  let submissionLocationColumnsReady = dialect !== 'd1';
  let eventSubmissionColumnsReady = dialect !== 'd1';

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

    eventSubmissionColumnsReady = true;
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

  return {
    async createEvent(owner, event) {
      await ensureEventSubmissionColumns();
      const id = event.id || crypto.randomUUID();
      await runCommand(`
        INSERT INTO catch_events (
          id, owner_user_id, owner_ign, name, slug, event_date, start_local, end_local,
          timezone, region, route, winner_count, targets_json, species_bonuses_json,
          species_penalties_json, nature_bonuses_json, nature_penalties_json,
          use_lowest_score_final_place, is_leaderboard_published, is_private
        )
        VALUES (
          ${parameter(1)}, ${parameter(2)}, ${parameter(3)}, ${parameter(4)}, ${parameter(5)},
          ${parameter(6)}, ${parameter(7)}, ${parameter(8)}, ${parameter(9)}, ${parameter(10)},
          ${parameter(11)}, ${parameter(12)}, ${parameter(13)}, ${parameter(14)}, ${parameter(15)},
          ${parameter(16)}, ${parameter(17)}, ${parameter(18)}, ${parameter(19)}, ${parameter(20)}
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

    async listEvents({ ownerUserId, publishedOnly } = {}) {
      await ensureEventSubmissionColumns();
      const clauses = [];
      const params = [];
      if (ownerUserId) {
        params.push(ownerUserId);
        clauses.push(`owner_user_id = ${parameter(params.length)}`);
      }
      if (publishedOnly) {
        clauses.push('is_leaderboard_published = 1');
      }
      if (!ownerUserId) {
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

    async getEventById(id, { includeSubmissions = false } = {}) {
      await ensureEventSubmissionColumns();
      const row = await runOne(`
        SELECT *
        FROM catch_events
        WHERE id = ${parameter(1)}
        LIMIT 1
      `, [id]);
      const event = normalizeEvent(row);
      if (!event || !includeSubmissions) return event;
      return {
        ...event,
        submissions: await listSubmissions(event.id),
      };
    },

    async setLeaderboardPublished(id, ownerUserId, isPublished) {
      const existing = await this.getEventById(id);
      if (!existing || existing.ownerUserId !== ownerUserId) {
        return null;
      }

      await runCommand(`
        UPDATE catch_events
        SET is_leaderboard_published = ${parameter(3)},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)} AND owner_user_id = ${parameter(2)}
      `, [id, ownerUserId, isPublished ? 1 : 0]);
      return this.getEventById(id, { includeSubmissions: true });
    },

    async setSubmissionsClosed(id, ownerUserId, isClosed) {
      await ensureEventSubmissionColumns();
      const existing = await this.getEventById(id);
      if (!existing || existing.ownerUserId !== ownerUserId) {
        return null;
      }

      await runCommand(`
        UPDATE catch_events
        SET submissions_closed = ${parameter(3)},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)} AND owner_user_id = ${parameter(2)}
      `, [id, ownerUserId, isClosed ? 1 : 0]);
      return this.getEventById(id, { includeSubmissions: true });
    },

    async upsertSubmission(eventId, submission, screenshots = []) {
      await ensureSubmissionLocationColumns();

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

    async updateSubmissionStatus(eventId, ownerUserId, submissionId, status) {
      await runCommand(`
        UPDATE catch_event_submissions
        SET status = ${parameter(4)},
            updated_at = ${nowExpression}
        WHERE id = ${parameter(1)}
          AND event_id = ${parameter(2)}
          AND event_id IN (
            SELECT id FROM catch_events WHERE owner_user_id = ${parameter(3)}
          )
      `, [submissionId, eventId, ownerUserId, status]);
      return this.getEventById(eventId, { includeSubmissions: true });
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
