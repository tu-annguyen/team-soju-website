jest.mock('@team-soju/utils', () => ({
  ...jest.requireActual('@team-soju/utils'),
  getPokemonVariants: jest.fn(),
}));

const { getPokemonVariants } = require('@team-soju/utils');
const { parseAiJson } = require('../src/cloudflare/services/worker-support');
const {
  enqueueShinyScreenshotJob,
  getShinyScreenshot,
  normalizeOcrResult,
  processShinyOcrJob,
} = require('../src/cloudflare/services/shiny-ocr');

function createD1() {
  const jobs = new Map();
  return {
    jobs,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (/interaction_id = \?/.test(sql)) return [...jobs.values()].find((job) => job.interaction_id === values[0]) || null;
              return jobs.get(values[0]) || null;
            },
            async run() {
              if (/INSERT INTO shiny_screenshot_jobs/.test(sql)) {
                jobs.set(values[0], {
                  id: values[0], interaction_id: values[1], status: 'queued', storage_key: values[2],
                  public_token: values[3], request_payload: values[4], callback_payload: null,
                  error_message: null, attempts: 0,
                });
              } else if (/UPDATE shiny_screenshot_jobs/.test(sql)) {
                const setClause = sql.split('SET')[1].split(', updated_at')[0];
                const keys = [...setClause.matchAll(/([a-z_]+) = \?/g)].map((match) => match[1]);
                const job = jobs.get(values[values.length - 1]);
                keys.forEach((key, index) => { job[key] = values[index]; });
              } else if (/DELETE FROM shiny_screenshot_jobs/.test(sql)) {
                jobs.delete(values[0]);
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
}

function createStorage() {
  const objects = new Map();
  return {
    objects,
    async put(key, bytes, options) { objects.set(key, { bytes, httpMetadata: options.httpMetadata }); },
    async get(key) {
      const value = objects.get(key);
      return value ? { arrayBuffer: async () => value.bytes, httpMetadata: value.httpMetadata } : null;
    },
    async delete(key) { objects.delete(key); },
  };
}

function validPayload() {
  return {
    screenshot_url: 'https://media.discordapp.net/attachments/1/2/shiny.png',
    encounter_type: 'x5_horde', is_secret: false, is_alpha: false,
    command_called_at: '2026-08-12T03:00:00.000Z', timezone: 'America/Los_Angeles',
    discord_user_id: 'user-1', member_roles: ['Champion'], discord_interaction_id: '123456',
    discord_application_id: 'app-1', discord_interaction_token: 'token-1',
    callback_url: 'https://bot.example.com/internal/screenshot-result',
  };
}

describe('Worker shiny screenshot OCR', () => {
  beforeEach(() => {
    getPokemonVariants.mockResolvedValue({ species: 'pikachu', national_number: 25, variants: ['pikachu'] });
  });

  it('marks malformed model output as a retryable format error', () => {
    expect(() => parseAiJson('I could not read the screenshot.')).toThrow(
      expect.objectContaining({ code: 'AI_RESPONSE_FORMAT', retryable: true })
    );
  });

  it('normalizes ambiguous and future OCR dates without guessing', () => {
    const ambiguous = normalizeOcrResult({
      pokemon: 'Pikachu', trainer: 'Trainer', catchDate: null, catchTime: '20:30', dateAmbiguous: true, ivs: [1, 2, 3, 4, 5, 6],
    }, validPayload());
    expect(ambiguous.parsed.catchDate).toBe('2026-08-11');
    expect(ambiguous.notes.join(' ')).toContain('Ambiguous date');

    const future = normalizeOcrResult({
      pokemon: 'Pikachu', trainer: 'Trainer', catchDate: '2099-01-01', catchTime: '20:30', ivs: [],
    }, validPayload());
    expect(future.parsed.catchDate).toBe('2026-08-11');
    expect(future.notes.join(' ')).toContain('future');
  });

  it('uploads once, queues a small idempotent job, creates one shiny, and delivers the callback', async () => {
    const DB = createD1();
    const SCREENSHOT_STORAGE = createStorage();
    const SHINY_OCR_QUEUE = { send: jest.fn() };
    const callbackBodies = [];
    const fetchImpl = jest.fn(async (url, options = {}) => {
      if (String(url).includes('discordapp.net')) {
        return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png', 'content-length': '3' } });
      }
      callbackBodies.push(JSON.parse(options.body));
      return new Response('{}', { status: 200 });
    });
    const env = {
      DB, SCREENSHOT_STORAGE, SHINY_OCR_QUEUE, SCREENSHOT_RESULT_CALLBACK_SECRET: 'callback-secret',
      AI: { run: jest.fn().mockResolvedValue({ response: JSON.stringify({
        pokemon: 'Pikachu', trainer: 'Trainer', catchDate: '2026-08-11', catchTime: '20:30',
        dateAmbiguous: false, nature: 'Bold', ivs: [1, 2, 3, 4, 5, 6], totalEncounters: 1000, speciesEncounters: 100,
      }) }) },
    };
    const request = new Request('https://api.example.com/api/shinies/from-screenshot/async');
    const first = await enqueueShinyScreenshotJob({ request, env, fetchImpl, body: validPayload() });
    const second = await enqueueShinyScreenshotJob({ request, env, fetchImpl, body: validPayload() });
    expect(first.id).toBe('ss-123456');
    expect(second.id).toBe(first.id);
    expect(SHINY_OCR_QUEUE.send).toHaveBeenCalledTimes(1);
    expect(SCREENSHOT_STORAGE.objects.size).toBe(1);

    const repositories = {
      members: {
        findByDiscordId: jest.fn().mockResolvedValue({ id: 'member-1', ign: 'Trainer' }),
        findByIgn: jest.fn().mockResolvedValue({ id: 'member-1', ign: 'Trainer' }),
        findAll: jest.fn(),
      },
      shinies: {
        create: jest.fn(async (value) => ({ ...value, trainer_name: 'Trainer' })),
      },
    };
    await processShinyOcrJob(env, first.id, repositories, fetchImpl);
    await processShinyOcrJob(env, first.id, repositories, fetchImpl);
    expect(env.AI.run).toHaveBeenCalledWith(
      '@cf/google/gemma-4-26b-a4b-it',
      expect.objectContaining({
        max_completion_tokens: 4096,
        chat_template_kwargs: { enable_thinking: false },
        response_format: { type: 'json_object' },
      })
    );
    expect(repositories.shinies.create).toHaveBeenCalledTimes(1);
    expect(repositories.shinies.create).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ss-123456', caught_at_utc: '2026-08-12T03:30:00.000Z', screenshot_url: expect.stringContaining('/api/shinies/screenshots/'),
    }));
    expect(callbackBodies).toHaveLength(1);
    expect(DB.jobs.get(first.id).status).toBe('completed');
  });

  it('logs safe model metadata when Workers AI returns no OCR text', async () => {
    const DB = createD1();
    const SCREENSHOT_STORAGE = createStorage();
    const result = {
      choices: [{ finish_reason: 'length', message: { content: null } }],
      usage: { prompt_tokens: 100, completion_tokens: 4096, total_tokens: 4196 },
    };
    const env = {
      DB,
      SCREENSHOT_STORAGE,
      SHINY_OCR_QUEUE: { send: jest.fn() },
      AI: { run: jest.fn().mockResolvedValue(result) },
    };
    const fetchImpl = jest.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'image/png', 'content-length': '3' },
    }));
    const job = await enqueueShinyScreenshotJob({
      request: new Request('https://api.example.com/api/shinies/from-screenshot/async'),
      env,
      fetchImpl,
      body: validPayload(),
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await expect(processShinyOcrJob(env, job.id, {}, fetchImpl)).rejects.toThrow(
        'Workers AI returned an empty OCR response.'
      );
      expect(warnSpy).toHaveBeenCalledWith('Empty shiny OCR response:', {
        model: '@cf/google/gemma-4-26b-a4b-it',
        finishReason: 'length',
        usage: result.usage,
        responseType: 'undefined',
        responseKeys: ['choices', 'usage'],
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('rejects non-Discord and oversized screenshot sources before queueing', async () => {
    const env = { DB: createD1(), SCREENSHOT_STORAGE: createStorage(), SHINY_OCR_QUEUE: { send: jest.fn() } };
    await expect(enqueueShinyScreenshotJob({
      request: new Request('https://api.example.com'), env, fetchImpl: jest.fn(),
      body: { ...validPayload(), screenshot_url: 'https://example.com/image.png' },
    })).rejects.toMatchObject({ status: 400 });

    const fetchImpl = jest.fn().mockResolvedValue(new Response('', {
      headers: { 'content-type': 'image/png', 'content-length': String((10 * 1024 * 1024) + 1) },
    }));
    await expect(enqueueShinyScreenshotJob({
      request: new Request('https://api.example.com'), env, fetchImpl, body: validPayload(),
    })).rejects.toMatchObject({ status: 413 });
  });

  it('serves a successful screenshot while its Discord callback is pending', async () => {
    const DB = createD1();
    const SCREENSHOT_STORAGE = createStorage();
    DB.jobs.set('ss-pending', {
      id: 'ss-pending', status: 'callback_pending', storage_key: 'shiny-ocr/ss-pending.png',
      public_token: 'unguessable-token', request_payload: '{}', callback_payload: '{}', attempts: 1,
    });
    await SCREENSHOT_STORAGE.put('shiny-ocr/ss-pending.png', new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: 'image/png' },
    });

    const object = await getShinyScreenshot(
      { DB, SCREENSHOT_STORAGE }, 'ss-pending', 'unguessable-token'
    );
    expect(object).not.toBeNull();
    expect(new Uint8Array(await object.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });
});
