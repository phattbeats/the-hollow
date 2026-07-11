import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';

// server/internal imports server/db, which throws at import time when DATABASE_URL
// is unset (the PR-tier CI suite runs with no Postgres). This test only exercises
// the restart-countdown endpoint and never issues a query, so set a dummy URL
// before the module graph loads (the pg Pool stays lazy and never connects).
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgres://localhost:5432/woc_test';
});

import { handleInternalApi } from '../server/internal';

function fakeReq(
  opts: { method?: string; url?: string; secret?: string; discordSecret?: string } = {},
) {
  const req: any = new EventEmitter();
  req.method = opts.method ?? 'POST';
  req.url = opts.url ?? '/internal/restart-countdown';
  req.headers = {
    ...(opts.secret ? { 'x-woc-deploy-secret': opts.secret } : {}),
    ...(opts.discordSecret ? { 'x-woc-discord-secret': opts.discordSecret } : {}),
  };
  return req;
}

function fakeRes() {
  const res: any = {
    statusCode: 0,
    body: null as any,
    writeHead(status: number) {
      this.statusCode = status;
    },
    end(data?: string) {
      this.body = data ? JSON.parse(data) : null;
    },
  };
  return res;
}

describe('internal api', () => {
  const previousSecret = process.env.RESTART_COUNTDOWN_SECRET;
  const previousDiscordSecret = process.env.DISCORD_BOT_SECRET;

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.RESTART_COUNTDOWN_SECRET;
    else process.env.RESTART_COUNTDOWN_SECRET = previousSecret;
    if (previousDiscordSecret === undefined) delete process.env.DISCORD_BOT_SECRET;
    else process.env.DISCORD_BOT_SECRET = previousDiscordSecret;
    vi.clearAllMocks();
  });

  it('rejects restart countdown requests when the server secret is not configured', async () => {
    delete process.env.RESTART_COUNTDOWN_SECRET;
    const res = fakeRes();

    await handleInternalApi(fakeReq({ secret: 'deploy-secret' }), res, {
      startRestartCountdown: vi.fn(),
    } as any);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('unknown endpoint');
  });

  it('rejects a deploy secret of a different length from the configured secret', async () => {
    process.env.RESTART_COUNTDOWN_SECRET = 'deploy-secret';
    const res = fakeRes();

    await handleInternalApi(fakeReq({ secret: 'wrong' }), res, {
      startRestartCountdown: vi.fn(),
    } as any);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('not authenticated');
    // The stable NOT_AUTHENTICATED code (PHAA-528), consistent with every other
    // "not authenticated" denial (server/ownership.ts).
    expect(res.body.code).toBe('NOT_AUTHENTICATED');
  });

  it('rejects a deploy secret of the same length as the configured secret', async () => {
    process.env.RESTART_COUNTDOWN_SECRET = 'deploy-secret';
    const res = fakeRes();

    // Same length as 'deploy-secret' so the mismatch is caught by timingSafeEqual
    // itself, not the length short-circuit.
    await handleInternalApi(fakeReq({ secret: 'deploy-secreT' }), res, {
      startRestartCountdown: vi.fn(),
    } as any);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('not authenticated');
    // The stable NOT_AUTHENTICATED code (PHAA-528), consistent with every other
    // "not authenticated" denial (server/ownership.ts).
    expect(res.body.code).toBe('NOT_AUTHENTICATED');
  });

  it('starts the restart countdown with a valid deploy secret', async () => {
    process.env.RESTART_COUNTDOWN_SECRET = 'deploy-secret';
    const game = {
      startRestartCountdown: vi.fn(() => ({
        started: true,
        active: true,
        totalSeconds: 600,
        remainingSeconds: 600,
      })),
    };
    const res = fakeRes();

    await handleInternalApi(fakeReq({ secret: 'deploy-secret' }), res, game as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.totalSeconds).toBe(600);
    expect(game.startRestartCountdown).toHaveBeenCalledTimes(1);
  });

  it('returns conflict when a restart countdown is already active', async () => {
    process.env.RESTART_COUNTDOWN_SECRET = 'deploy-secret';
    const game = {
      startRestartCountdown: vi.fn(() => ({
        started: false,
        active: true,
        totalSeconds: 600,
        remainingSeconds: 540,
      })),
    };
    const res = fakeRes();

    await handleInternalApi(fakeReq({ secret: 'deploy-secret' }), res, game as any);

    expect(res.statusCode).toBe(409);
    expect(res.body.data.remainingSeconds).toBe(540);
  });

  it('rejects discord internal requests when the bot secret is not configured', async () => {
    delete process.env.DISCORD_BOT_SECRET;
    const res = fakeRes();

    await handleInternalApi(
      fakeReq({ method: 'GET', url: '/internal/discord/flex', discordSecret: 'bot-secret' }),
      res,
      {} as any,
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('unknown endpoint');
  });

  it('rejects a discord bot secret of a different length from the configured secret', async () => {
    process.env.DISCORD_BOT_SECRET = 'bot-secret';
    const res = fakeRes();

    await handleInternalApi(
      fakeReq({ method: 'GET', url: '/internal/discord/flex', discordSecret: 'wrong' }),
      res,
      {} as any,
    );

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('not authenticated');
    // The stable NOT_AUTHENTICATED code (PHAA-528), consistent with every other
    // "not authenticated" denial (server/ownership.ts).
    expect(res.body.code).toBe('NOT_AUTHENTICATED');
  });

  it('rejects a discord bot secret of the same length as the configured secret', async () => {
    process.env.DISCORD_BOT_SECRET = 'bot-secret';
    const res = fakeRes();

    // Same length as 'bot-secret' so the mismatch is caught by timingSafeEqual
    // itself, not the length short-circuit.
    await handleInternalApi(
      fakeReq({ method: 'GET', url: '/internal/discord/flex', discordSecret: 'bot-secreT' }),
      res,
      {} as any,
    );

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('not authenticated');
    // The stable NOT_AUTHENTICATED code (PHAA-528), consistent with every other
    // "not authenticated" denial (server/ownership.ts).
    expect(res.body.code).toBe('NOT_AUTHENTICATED');
  });

  it('rejects a discord internal request with no secret header at all', async () => {
    process.env.DISCORD_BOT_SECRET = 'bot-secret';
    const res = fakeRes();

    await handleInternalApi(
      fakeReq({ method: 'GET', url: '/internal/discord/flex' }),
      res,
      {} as any,
    );

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('not authenticated');
    // The stable NOT_AUTHENTICATED code (PHAA-528), consistent with every other
    // "not authenticated" denial (server/ownership.ts).
    expect(res.body.code).toBe('NOT_AUTHENTICATED');
  });
});
