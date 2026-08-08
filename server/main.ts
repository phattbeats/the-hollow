import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { type WebSocket, WebSocketServer } from 'ws';
import {
  LEADERBOARD_MAX,
  LEADERBOARD_PAGE_SIZE,
  paginateGuildLeaderboard,
  paginateLeaderboard,
} from '../src/sim/leaderboard_page';
import { Sim } from '../src/sim/sim';
import type { PlayerClass, Sex } from '../src/sim/types';
import { virtualLevel } from '../src/sim/types';
import type { GuildLeaderboardEntry, LeaderboardEntry } from '../src/world_api';
import { createAccessLogSink } from './access_log';
import {
  handleAccount2faDisable,
  handleAccount2faEnable,
  handleAccount2faSetup,
  handleAccountChangePassword,
  handleAccountDeactivate,
  handleAccountEmailChange,
  handleAccountEmailVerify,
  handleAccountExport,
  handleAccountLogout,
  handleAccountMarketing,
  handleAccountPasswordForgot,
  handleAccountPasswordReset,
  handleAccountSetEmail,
  handleAccountSetInitialEmail,
  handleAccountWhoami,
  handleEmailUnsubscribe,
  verifyLoginTwoFactor,
} from './account';
import { handleAdminApi, parsePageParams } from './admin';
import { currentSitePresenceUsers, recordSitePresenceSample } from './admin_db';
import { permissionsForRoles } from './admin_permissions';
import { loadAntibotConfig } from './antibot_config_db';
import { attackSignalSink, setAttackSignalSink } from './attack_signals';
import {
  hashPassword,
  newToken,
  normalizeCharName,
  normalizeEmail,
  offensiveName,
  validPassword,
  validUsernameShape,
  verifyPassword,
} from './auth';
import { BUG_DESCRIPTION_MAX, BugReportRateLimitError, createBugReport } from './bug_report_db';
import { registerBusinessMetrics } from './business_metrics';
import { characterSheet, type SheetRank } from './character_sheet';
import { registerClientPerfMetrics } from './client_perf_metrics';
import {
  accountForToken,
  type CharacterRow,
  characterCountsByRealm,
  chatMuteStatusForAccount,
  closeOrphanSessions,
  createAccount,
  createCharacterCapped,
  createCompanionToken,
  deleteCharacter,
  ensureSchema,
  findAccount,
  findCharacterReportTargetByName,
  getAccountsCount,
  getCharacter,
  getCharacterById,
  guildNameForCharacter,
  isAdminAccount,
  lifetimeXpRankForCharacter,
  lifetimeXpStanding,
  listCharacters,
  listCompanionTokens,
  loadAccountCosmetics,
  loadAccountDailyRewardsInfo,
  moderationStatusForAccount,
  pool,
  primarySlugForAccount,
  pruneChatLogs,
  pruneClientPerfReports,
  reclaimDeactivatedName,
  referralCountForAccount,
  renameCharacter,
  revokeCompanionToken,
  saveToken,
  searchCharacters,
  setAccountEmail,
  topArenaRatings,
  topGuilds,
  topLifetimeXp,
  touchLogin,
} from './db';
import {
  handleDiscordCallback,
  handleDiscordLoginLink,
  handleDiscordLoginNew,
  handleDiscordStart,
  handleDiscordStatus,
  handleDiscordUnlink,
} from './discord';
import { pruneDiscordOAuthStates, pruneDiscordPendingLogins } from './discord_db';
import { emailAccountCreated } from './email';
import { GameServer } from './game';
import { type GameStateSource, registerGameStateMetrics } from './game_metrics';
import { gameMetricsCounters, setGameMetricsCounters } from './game_signals';
import { sendProblem } from './http_errors';
import {
  contentLengthExceeds,
  isUniqueViolation,
  json,
  readBinaryBody,
  readBody,
} from './http_util';
import { handleInternalApi } from './internal';
import { isConnectionRefused } from './ip_block';
import { pruneExpiredBlockedIps } from './ip_block_db';
import { logger } from './logger';
import {
  MAX_MAP_SAVE_BYTES,
  MapsService,
  mapFullJson,
  mapSummaryJson,
  mapsErrorStatus,
} from './maps';
import { PgMapsDb } from './maps_db';
import { instrumentRequest, teeMetricSink } from './metric_sink';
import { createHttpMetrics, handleMetricsRequest } from './metrics';
import {
  cleanReportReason,
  createPlayerReport,
  createSuspiciousRegistrationReport,
} from './moderation_db';
import { createNativeAttestationChallenge, verifyNativeAttestation } from './native_attestation';
import { handleOAuth, seedOAuthClients } from './oauth';
import { pruneExpiredOAuthGrants } from './oauth_db';
import {
  bearerAccount,
  bearerActiveAccount,
  bearerReadAccount,
  bearerToken,
  requireOwnedCharacter,
} from './ownership';
import { handlePerfReport } from './perf_report';
import {
  captureReferral,
  cardUploadContentLengthTooLarge,
  handleCardRoutes,
  handleCardUpload,
} from './player_card';
import { handleAvatar, handleCharacterSitemap, handleProfilePage } from './profile_page';
import { recordUsageCacheEvent, recordUsageMetric, setUsageCacheSize } from './provider_usage';
import {
  assetUploadRateLimited,
  authThrottled,
  cardUploadRateLimited,
  clearAuthFailures,
  discordRateLimited,
  mapMutationRateLimited,
  publicReadRateLimited,
  rateLimited,
  recordAuthFailure,
  requestIp,
} from './ratelimit';
import {
  isPublicCorsPath,
  publicOriginFromRequest,
  REALM,
  REALM_DIRECTORY,
  REALM_ORIGINS,
} from './realm';
import { resolveReportTarget } from './report_target';
import { applySecurityHeaders } from './security_headers';
import { handleSitePresenceHeartbeat } from './site_presence';
import { adminRolesForAccount } from './staff_db';
import { cacheControlFor, etagFor, isNotModified } from './static_cache';
import { verifyTurnstile } from './turnstile';
import {
  MAX_ASSET_BYTES,
  UserAssetsService,
  userAssetJson,
  userAssetsErrorStatus,
} from './user_assets';
import { PgUserAssetsDb } from './user_assets_db';
import {
  isCrossSiteApiRequest,
  isNativeAppRequest,
  isWebClientRequest,
  NATIVE_APP_ORIGINS,
  webLoginEnforced,
} from './web_login_guard';
import { bufferHandshakeMessages } from './ws_buffer';

const PORT = Number(process.env.PORT ?? 8787);
const STATIC_DIR = path.join(__dirname, '..', 'dist');
// Pretty URLs that serve standalone static HTML pages.
const STATIC_PAGE_ALIASES = new Map([
  ['/links', '/links.html'],
  ['/links/', '/links.html'],
  ['/social', '/links.html'],
  ['/social/', '/links.html'],
  ['/social-media-links', '/links.html'],
  ['/social-media-links/', '/links.html'],
  ['/play', '/play.html'],
  ['/play/', '/play.html'],
  ['/privacy', '/privacy.html'],
  ['/privacy/', '/privacy.html'],
  ['/terms', '/terms.html'],
  ['/terms/', '/terms.html'],
  ['/merch', '/merch.html'],
  ['/merch/', '/merch.html'],
  ['/press', '/press.html'],
  ['/press/', '/press.html'],
  ['/data-deletion', '/data-deletion.html'],
  ['/data-deletion/', '/data-deletion.html'],
  ['/support', '/support.html'],
  ['/support/', '/support.html'],
  ['/wiki', '/guide.html'],
  ['/wiki/', '/guide.html'],
  ['/editor', '/editor.html'],
  ['/editor/', '/editor.html'],
]);
// How long chat logs are kept (0 = forever); pruned at boot and daily.
const CHAT_LOG_RETENTION_DAYS = Number(process.env.CHAT_LOG_RETENTION_DAYS ?? 90);
// Client performance reports are operational telemetry, not permanent records.
// Keep enough history for tuning runs while bounding table growth.
const PERF_REPORT_RETENTION_DAYS = Number(process.env.PERF_REPORT_RETENTION_DAYS ?? 14);
const ADMIN_ONLINE_SAMPLE_MS = 60_000;
// Cloudflare Turnstile secret. When unset (local dev / tests) registration and
// login skip human verification entirely — see requireTurnstile below.
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET ?? '';
// Hard WS connection limit per IP. Soft threshold (adds bot evidence) is in game.ts.
const MAX_WS_PER_IP_HARD = Number(process.env.MAX_WS_PER_IP_HARD ?? '20');
// Each realm re-reads the blocklist on this interval so edits on another realm
// process propagate and expired blocks fall out.
const BLOCKED_IP_REFRESH_MS = 60_000;

const game = new GameServer();

// Map editor persistence: the shared business rules (maps.ts / user_assets.ts)
// wired to their Postgres backends, mirroring the SocialService/SocialDb split.
const customMaps = new MapsService(new PgMapsDb(pool));
const userAssets = new UserAssetsService(new PgUserAssetsDb(pool));

function initialCharacterState(
  cls: PlayerClass,
  name: string,
  skin: number,
  sex: Sex = 'm',
): import('../src/sim/sim').CharacterState {
  const sim = new Sim({ seed: 20061, playerClass: cls, playerName: name });
  sim.setPlayerSkin(sim.playerId, skin);
  // PHAA-501: set the chosen sex on the offline Sim before serialising, so the
  // initial CharacterState carries it through to the database row and the live
  // online entity mirror. Falls back to 'm' on the type default.
  sim.setPlayerSex(sim.playerId, sex);
  const character = sim.serializeCharacter(sim.playerId);
  if (!character) throw new Error('failed to serialize initial character');
  return character;
}

// ---------------------------------------------------------------------------
// Lifetime-XP leaderboard cache (Max-Level XP Overflow, FR-4.2 / PR-3).
// Same shape as the chat-censor memoization: compute once, serve from memory,
// refresh on an interval. The query is never run per request under load — at
// most once per LEADERBOARD_TTL_MS, plus the boot warm-up below.
// ---------------------------------------------------------------------------
const LEADERBOARD_TTL_MS = 30_000;
// Cache the full exposed depth (LEADERBOARD_MAX) once per scope; the REST handler
// pages through it as an in-memory slice, so no extra query per page click.
const LEADERBOARD_SIZE = LEADERBOARD_MAX;
// One cache per scope: 'realm' for the in-game panel, 'global' for the
// cross-realm home-page board.
const leaderboardCache: Record<
  'realm' | 'global',
  { at: number; entries: LeaderboardEntry[] } | null
> = {
  realm: null,
  global: null,
};

async function refreshLeaderboard(scope: 'realm' | 'global'): Promise<LeaderboardEntry[]> {
  const rows = await topLifetimeXp(LEADERBOARD_SIZE, { global: scope === 'global' });
  const entries: LeaderboardEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    cls: r.class,
    level: r.level,
    virtualLevel: virtualLevel(r.lifetimeXp),
    lifetimeXp: r.lifetimeXp,
    prestigeRank: r.prestigeRank,
    ...(scope === 'global' ? { realm: r.realm } : {}),
  }));
  leaderboardCache[scope] = { at: Date.now(), entries };
  return entries;
}

async function getLeaderboard(scope: 'realm' | 'global'): Promise<LeaderboardEntry[]> {
  const cached = leaderboardCache[scope];
  if (cached && Date.now() - cached.at < LEADERBOARD_TTL_MS) return cached.entries;
  try {
    return await refreshLeaderboard(scope);
  } catch (err) {
    logger.error({ err, scope }, 'leaderboard refresh failed');
    return cached?.entries ?? [];
  }
}

// Guild high-score board cache. Same compute-once/serve-from-memory shape as the
// player board above, one cache per scope. Guilds are ranked by summed member
// lifetime XP (topGuilds); the REST handler pages through the cached window.
const guildLeaderboardCache: Record<
  'realm' | 'global',
  { at: number; entries: GuildLeaderboardEntry[] } | null
> = {
  realm: null,
  global: null,
};

async function refreshGuildLeaderboard(
  scope: 'realm' | 'global',
): Promise<GuildLeaderboardEntry[]> {
  const rows = await topGuilds(LEADERBOARD_SIZE, { global: scope === 'global' });
  const entries: GuildLeaderboardEntry[] = rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    memberCount: r.memberCount,
    totalLifetimeXp: r.totalLifetimeXp,
    topLevel: r.topLevel,
    ...(scope === 'global' ? { realm: r.realm } : {}),
  }));
  guildLeaderboardCache[scope] = { at: Date.now(), entries };
  return entries;
}

async function getGuildLeaderboard(scope: 'realm' | 'global'): Promise<GuildLeaderboardEntry[]> {
  const cached = guildLeaderboardCache[scope];
  if (cached && Date.now() - cached.at < LEADERBOARD_TTL_MS) return cached.entries;
  try {
    return await refreshGuildLeaderboard(scope);
  } catch (err) {
    logger.error({ err, scope }, 'guild leaderboard refresh failed');
    return cached?.entries ?? [];
  }
}

// ---------------------------------------------------------------------------
// News & Updates: GitHub Releases proxy (read-only, public).
// The home-page "News & Updates" view pulls published releases from the public
// GitHub repo. We proxy + cache server-side rather than letting the browser hit
// api.github.com directly so that: (1) the unauthenticated GitHub rate limit (60
// req/IP/hr) is shared across all players as one server IP, not burned per
// visitor; (2) an optional GITHUB_TOKEN raises that ceiling without shipping a
// secret to the client; (3) we return only the small, sanitised subset the UI
// needs. Same compute-once/serve-from-memory pattern as the leaderboard cache.
// ---------------------------------------------------------------------------
const GITHUB_REPO = process.env.GITHUB_REPO ?? 'levy-street/world-of-claudecraft';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? '';
const RELEASES_TTL_MS = 15 * 60_000; // 15 min — releases change rarely
const RELEASES_SIZE = 20;
const RELEASE_BODY_MAX = 8_000; // guard against a pathologically long body

export interface ReleaseEntry {
  id: number;
  tag: string;
  name: string;
  body: string;
  url: string;
  prerelease: boolean;
  publishedAt: string; // ISO 8601
}

let releasesCache: { at: number; entries: ReleaseEntry[] } | null = null;
setUsageCacheSize('github.releases', 0, RELEASES_SIZE);

async function refreshReleases(): Promise<ReleaseEntry[]> {
  recordUsageMetric('github.releases.fetch');
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=${RELEASES_SIZE}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'world-of-claudecraft-server',
          ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) throw new Error(`github releases ${res.status}`);
    const raw = await res.json();
    const entries: ReleaseEntry[] = (Array.isArray(raw) ? raw : [])
      .filter((r) => r && !r.draft) // skip unpublished drafts
      .map((r) => ({
        id: Number(r.id),
        tag: String(r.tag_name ?? ''),
        name: String(r.name || r.tag_name || ''),
        body: String(r.body ?? '').slice(0, RELEASE_BODY_MAX),
        url: String(r.html_url ?? ''),
        prerelease: Boolean(r.prerelease),
        publishedAt: String(r.published_at ?? r.created_at ?? ''),
      }));
    releasesCache = { at: Date.now(), entries };
    recordUsageCacheEvent('github.releases', 'store');
    setUsageCacheSize('github.releases', entries.length, RELEASES_SIZE);
    return entries;
  } catch (err) {
    recordUsageMetric('github.releases.fetch.failure');
    throw err;
  }
}

async function getReleases(): Promise<ReleaseEntry[]> {
  if (releasesCache && Date.now() - releasesCache.at < RELEASES_TTL_MS) {
    recordUsageCacheEvent('github.releases', 'hit');
    return releasesCache.entries;
  }
  recordUsageCacheEvent('github.releases', releasesCache ? 'stale' : 'miss');
  try {
    return await refreshReleases();
  } catch (err) {
    recordUsageCacheEvent('github.releases', 'failure');
    logger.error({ err }, 'github releases refresh failed');
    return releasesCache?.entries ?? [];
  }
}

function normalizeDeleteConfirmation(name: unknown): string {
  return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

// Shape a realm rank lookup into the character-sheet's rank field.
function toSheetRank(rank: { rank: number; total: number } | null): SheetRank | null {
  return rank ? { scope: 'realm', rank: rank.rank, total: rank.total } : null;
}

// The character-list response shared by the full-session GET /api/characters and
// the read-scoped GET /api/me/characters, so both stay byte-identical.
function characterListPayload(chars: CharacterRow[]): {
  realm: string;
  characters: {
    id: number;
    name: string;
    class: PlayerClass;
    level: number;
    skin: number;
    online: boolean;
    forceRename: boolean;
    lastPlayed: string | null;
    playtimeSeconds: number;
    secondaryCls: PlayerClass | null;
  }[];
} {
  return {
    realm: REALM,
    characters: chars.map((c) => ({
      id: c.id,
      name: c.name,
      class: c.class,
      level: c.level,
      skin: c.state?.skin ?? 0,
      online: [...game.clients.values()].some((s) => s.characterId === c.id),
      forceRename: c.force_rename,
      lastPlayed: c.last_played ? new Date(c.last_played).toISOString() : null,
      playtimeSeconds: Number(c.playtime_seconds ?? 0),
      secondaryCls: c.state?.secondaryCls ?? null,
    })),
  };
}

function requestMetadata(req: http.IncomingMessage): { ip: string; userAgent: string } {
  return {
    ip: requestIp(req),
    userAgent: String(req.headers['user-agent'] ?? ''),
  };
}

// Gate account creation / login behind Cloudflare Turnstile. Returns true when
// the request may proceed: trivially true when no secret is configured, else the
// client-supplied token must verify. The English error is matched to a t() key
// by userFacingApiError() in src/main.ts — keep the two strings in sync.
async function passesTurnstile(
  req: http.IncomingMessage,
  body: Record<string, unknown>,
): Promise<boolean> {
  if (isNativeAppRequest(req)) return verifyNativeAttestation(req, body.nativeAttestation);
  if (!TURNSTILE_SECRET) return true;
  return verifyTurnstile(String(body.turnstileToken ?? ''), TURNSTILE_SECRET, requestIp(req));
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.hdr': 'application/octet-stream',
  '.ktx2': 'image/ktx2',
  '.wasm': 'application/wasm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

// The admin dashboard is reached via the admin.* subdomain (Caddy proxies it
// to this same port) or /admin for local dev. The hostname only picks which
// HTML shell is served — the admin API itself is gated by admin tokens.
function isAdminRequest(req: http.IncomingMessage): boolean {
  const host = String(req.headers.host ?? '').toLowerCase();
  const urlPath = (req.url ?? '/').split('?')[0];
  return host.startsWith('admin.') || urlPath === '/admin' || urlPath === '/admin/';
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): void {
  let urlPath = (req.url ?? '/').split('?')[0];
  // The curated Guide is the site wiki: a client-routed SPA served at /wiki with its
  // own shell, so deep paths (/wiki/classes/...) fall back to guide.html rather than the
  // game's index.html. (It previously 302'd to a standalone MediaWiki; that is retired.)
  const isGuide = urlPath === '/wiki' || urlPath.startsWith('/wiki/');
  const shell = isGuide ? 'guide.html' : isAdminRequest(req) ? 'admin.html' : 'index.html';
  // Pretty-URL aliases for standalone static pages.
  urlPath = STATIC_PAGE_ALIASES.get(urlPath) ?? urlPath;
  if (urlPath === '/' || urlPath === '/admin' || urlPath === '/admin/') urlPath = `/${shell}`;
  // normalize once and reuse for BOTH file resolution and cache policy —
  // otherwise /assets/../x would serve a mutable file with immutable caching
  urlPath = path.posix.normalize(urlPath).replace(/^([.][.][/\\])+/, '');
  const file = path.join(STATIC_DIR, urlPath);
  const stats = file.startsWith(STATIC_DIR) && fs.existsSync(file) ? fs.statSync(file) : null;
  if (!stats?.isFile()) {
    // Asset paths must 404, not SPA-fall-back: a missing .glb served as index.html
    // surfaces as a cryptic GLTFLoader parse error instead of a clear 404.
    if (path.extname(urlPath) && path.extname(urlPath) !== '.html') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    // SPA fallback
    const index = path.join(STATIC_DIR, shell);
    if (fs.existsSync(index)) {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
      fs.createReadStream(index).pipe(res);
    } else {
      res.writeHead(404);
      res.end('not found (run `npm run build` to serve the client from the game server)');
    }
    return;
  }
  const isReadMethod = req.method === 'GET' || req.method === 'HEAD';
  const etag = etagFor(stats);
  const validators = {
    'Cache-Control': cacheControlFor(urlPath),
    ETag: etag,
    'Last-Modified': stats.mtime.toUTCString(),
  };
  if (isReadMethod && isNotModified(req.headers, etag, stats.mtime)) {
    res.writeHead(304, validators);
    res.end();
    return;
  }
  res.writeHead(200, {
    ...validators,
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'Content-Length': stats.size,
  });
  if (req.method === 'HEAD') {
    // don't read a multi-MB asset from disk just to discard the bytes
    res.end();
    return;
  }
  fs.createReadStream(file).pipe(res);
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

// Cross-realm CORS: a client served by one realm may call another realm's API
// after switching realms in the picker. Native Capacitor builds also call the
// production origin from localhost-style WebView origins. Auth is via bearer
// token (no cookies), so reflecting these specific origins is safe.
function maybeCors(req: http.IncomingMessage, res: http.ServerResponse): void {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && (REALM_ORIGINS.has(origin) || NATIVE_APP_ORIGINS.has(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}

// Absolute public origin for building self-URLs (avatar/profile links) in JSON
// and SSR pages. Prefer the configured/realm origin; fall back to the request's
// own scheme+host so links work in local dev too. Mirrors player_card.ts.
function publicOrigin(req: http.IncomingMessage): string {
  return publicOriginFromRequest(req);
}

// Wide-open CORS for the public, unauthenticated read surfaces. These carry no
// credentials and return only the public subset, so reflecting any origin (`*`)
// is safe and lets browser-origin apps fetch them client-side.
function publicCors(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}

// Anti-bot: when enabled, /api/login + /api/register require a same-origin browser
// request (a recognised Origin header), so only the web client can obtain a token.
const REQUIRE_WEB_LOGIN = webLoginEnforced();

async function handleApi(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = (req.url ?? '').split('?')[0];
  try {
    if (req.method === 'POST' && url === '/api/native-attestation/challenge') {
      const body = await readBody(req);
      const action = typeof body.action === 'string' ? body.action : 'auth';
      return json(res, 200, createNativeAttestationChallenge(req, action));
    }
    if (url === '/api/site-presence') {
      return await handleSitePresenceHeartbeat(req, res);
    }
    if (
      REQUIRE_WEB_LOGIN &&
      req.method === 'POST' &&
      (url === '/api/register' ||
        url === '/api/login' ||
        url === '/api/account/password/forgot' ||
        url === '/api/account/password/reset') &&
      !isWebClientRequest(req)
    ) {
      return json(res, 403, { error: 'logins are only allowed from the game client' });
    }
    if (
      req.method === 'POST' &&
      (url === '/api/register' || url === '/api/login') &&
      rateLimited(req)
    ) {
      return json(res, 429, { error: 'too many attempts — wait a minute and try again' });
    }
    // Reuse the rate-limit message so a blocked client gets no signal that the
    // block exists. Login is gated separately below, after the account is known,
    // so admins can bypass; registration has no account to check.
    if (req.method === 'POST' && url === '/api/register' && game.isIpBlocked(requestIp(req))) {
      return json(res, 429, { error: 'too many attempts — wait a minute and try again' });
    }
    if (req.method === 'POST' && url === '/api/register') {
      const body = await readBody(req);
      if (!(await passesTurnstile(req, body)))
        return json(res, 403, { error: 'verification failed, please try again' });
      if (!validUsernameShape(body.username))
        return json(res, 400, { error: 'username must be 3-24 chars (letters, digits, _)' });
      if (offensiveName(body.username)) return json(res, 400, { error: 'username is not allowed' });
      if (!validPassword(body.password))
        return json(res, 400, { error: 'password must be at least 6 chars' });
      const existing = await findAccount(body.username);
      if (existing) return json(res, 409, { error: 'username already taken' });
      let account: Awaited<ReturnType<typeof createAccount>>;
      try {
        account = await createAccount(
          body.username,
          await hashPassword(body.password),
          requestMetadata(req),
        );
      } catch (err: any) {
        // a concurrent registration can win the insert after our findAccount
        // check; the username UNIQUE index is the real guard. Surface it as a
        // 409 like the duplicate path above, not a generic 500.
        if (isUniqueViolation(err)) return json(res, 409, { error: 'username already taken' });
        throw err;
      }
      const token = newToken();
      await saveToken(token, account.id);
      // Optional email at signup: if a valid address is supplied, store it and
      // send the welcome mail. Kept optional (the client has no signup email field
      // yet, so a hard requirement here would break every registration); this is
      // the same capture point the account portal and Discord login also feed.
      const signupEmail = normalizeEmail(body.email);
      if (signupEmail) {
        await setAccountEmail(account.id, signupEmail);
        emailAccountCreated({
          id: account.id,
          username: account.username,
          email: signupEmail,
          locale: null,
          marketing_opt_in: false,
        });
      }
      void createSuspiciousRegistrationReport({
        accountId: account.id,
        username: account.username,
        ...requestMetadata(req),
      }).catch((err) => logger.error({ err }, 'suspicious registration report failed'));
      // Capture the referral when this account signed up via a card link
      // (?ref=<slug>). Best-effort: never block or fail registration on it.
      void captureReferral(account.id, body.ref).catch((err) =>
        logger.error({ err }, 'referral capture failed'),
      );
      return json(res, 200, { token, username: account.username, emailMissing: !signupEmail });
    }
    if (req.method === 'POST' && url === '/api/login') {
      const body = await readBody(req);
      if (!(await passesTurnstile(req, body)))
        return json(res, 403, { error: 'verification failed, please try again' });
      const username = typeof body.username === 'string' ? body.username : '';
      // Per-account brute-force throttle (#93). The message is identical to a
      // bad-password response so it never reveals whether the account exists.
      if (username && authThrottled(username)) {
        attackSignalSink().authFailure('throttled');
        return json(res, 429, {
          error: 'too many failed attempts — wait a few minutes and try again',
        });
      }
      const account = username ? await findAccount(username) : null;
      if (!account || !(await verifyPassword(String(body.password ?? ''), account.password_hash))) {
        if (username) recordAuthFailure(username);
        return json(res, 401, { error: 'invalid username or password' });
      }
      const status = await moderationStatusForAccount(account.id);
      if (status.locked) return json(res, 403, { error: status.message });
      // Checked only now that the account is known, so admins (verified after the
      // password) are never locked out. This does mean a blocked IP gets 429 on a
      // correct password vs 401 on a wrong one — a small credential-validity tell
      // we accept, since moving the check before the password would lock admins out.
      if (game.isIpBlocked(requestIp(req)) && !(await isAdminAccount(account.id))) {
        return json(res, 429, { error: 'too many attempts — wait a minute and try again' });
      }
      // Second factor: if 2FA is enabled, the password alone is not enough. With
      // no code supplied we return a challenge (not a token) so the client shows
      // the code step; with a code (or recovery code) we verify it before issuing.
      if (account.totp_enabled_at) {
        const code = typeof body.code === 'string' ? body.code : '';
        const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode : '';
        if (!code && !recoveryCode) {
          return json(res, 200, { twoFactorRequired: true });
        }
        if (!(await verifyLoginTwoFactor(account, code, recoveryCode))) {
          recordAuthFailure(username);
          return json(res, 401, { error: 'invalid authentication code', twoFactorRequired: true });
        }
      }
      clearAuthFailures(username); // correct password: forgive earlier typos
      await touchLogin(account.id, requestMetadata(req));
      const token = newToken();
      await saveToken(token, account.id);
      // Tell the client whether this (possibly pre-email) account still needs a
      // recovery address, so it can force the mandatory-email prompt on sign-in.
      const emailMissing = !(account.email && account.email.trim());
      return json(res, 200, { token, username: account.username, emailMissing });
    }
    // Read-scoped "my characters" list: lets a companion holding a character:read
    // token (OAuth or a pasted companion token) discover its character ids so it
    // can then call /sheet. Same body as GET /api/characters, but gated by
    // bearerReadAccount so a read token is accepted (the full-session list below
    // still uses bearerActiveAccount and stays mutation-only). Placed before the
    // generic /api routes.
    if (req.method === 'GET' && url === '/api/me/characters') {
      const accountId = await bearerReadAccount(req, res);
      if (accountId === null) return;
      return json(res, 200, characterListPayload(await listCharacters(accountId)));
    }
    if (url === '/api/characters') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (req.method === 'GET') {
        return json(res, 200, characterListPayload(await listCharacters(accountId)));
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const name = normalizeCharName(body.name);
        if (name === null)
          return json(res, 400, { error: 'invalid character name (2-16 letters)' });
        if (offensiveName(name)) return json(res, 400, { error: 'character name is not allowed' });
        const validClasses = [
          'warrior',
          'paladin',
          'hunter',
          'rogue',
          'priest',
          'shaman',
          'mage',
          'warlock',
          'druid',
        ];
        if (!validClasses.includes(body.class)) return json(res, 400, { error: 'invalid class' });
        const skin = Math.max(
          0,
          Math.min(7, Math.floor(typeof body.skin === 'number' ? body.skin : 0)),
        );
        // PHAA-501: sex defaults to 'm'; 'f' is the only accepted alternative.
        // Anything else (including missing) becomes 'm' so an older client keeps
        // creating male characters and a tampered body cannot escape the union.
        const sex: Sex = body.sex === 'f' ? 'f' : 'm';
        const create = () =>
          createCharacterCapped(
            accountId,
            name,
            body.class,
            10,
            initialCharacterState(body.class, name, skin, sex),
          );
        const created = (c: NonNullable<Awaited<ReturnType<typeof createCharacterCapped>>>) => {
          // One character successfully created (woc_characters_created_total). Only
          // the success responder counts, so a rejected create never increments.
          gameMetricsCounters().characterCreated();
          return json(res, 200, {
            id: c.id,
            name: c.name,
            class: c.class,
            level: c.level,
            skin: c.state?.skin ?? skin,
            sex: c.state?.sex ?? sex,
            forceRename: c.force_rename,
          });
        };
        try {
          const c = await create();
          if (!c) return json(res, 400, { error: 'character limit reached' });
          return created(c);
        } catch (err: any) {
          if (!isUniqueViolation(err)) throw err;
          // The name collided. If it is held only by a deactivated ("invalid")
          // account, free it (the orphaned character is archived) and retry once;
          // otherwise it is genuinely taken. This is the self-service path that
          // replaces the hidden admin-only reactivate/force-rename recovery.
          if (!(await reclaimDeactivatedName(name)))
            return json(res, 409, { error: 'that name is taken' });
          try {
            const c = await create();
            if (!c) return json(res, 400, { error: 'character limit reached' });
            return created(c);
          } catch (err2: any) {
            if (isUniqueViolation(err2)) return json(res, 409, { error: 'that name is taken' });
            throw err2;
          }
        }
      }
    }
    // Public, unauthenticated character sheet (read-only safe subset). Resolved
    // by name, rate-limited to deter scraping, CORS-open to any origin. MUST
    // come before generic /api routes; it never touches a bearer token.
    const publicSheetMatch = /^\/api\/public\/characters\/(.+)\/sheet$/.exec(url);
    if (req.method === 'GET' && publicSheetMatch) {
      if (publicReadRateLimited(req))
        return sendProblem(res, 429, 'RATE_LIMITED', 'rate limited', { policy: 'public_read' });
      const rawName = decodeURIComponent(publicSheetMatch[1]);
      const target = await findCharacterReportTargetByName(rawName);
      if (!target) return json(res, 404, { error: 'character not found' });
      const row = await getCharacterById(target.characterId);
      if (!row) return json(res, 404, { error: 'character not found' });
      const [guild, rank] = await Promise.all([
        guildNameForCharacter(row.id),
        lifetimeXpRankForCharacter(row.id),
      ]);
      return json(
        res,
        200,
        characterSheet({
          row,
          visibility: 'public',
          realm: REALM,
          origin: publicOrigin(req),
          guild,
          rank: toSheetRank(rank),
        }),
      );
    }
    const ownerSheetMatch = /^\/api\/characters\/(\d+)\/sheet$/.exec(url);
    if (req.method === 'GET' && ownerSheetMatch) {
      const accountId = await bearerReadAccount(req, res);
      if (accountId === null) return;
      const row = await requireOwnedCharacter(
        res,
        accountId,
        Number(ownerSheetMatch[1]),
        'character not found',
        '/api/characters/:id/sheet',
      );
      if (!row) return;
      const [guild, rank] = await Promise.all([
        guildNameForCharacter(row.id),
        lifetimeXpRankForCharacter(row.id),
      ]);
      return json(
        res,
        200,
        characterSheet({
          row,
          visibility: 'owner',
          realm: REALM,
          origin: publicOrigin(req),
          guild,
          rank: toSheetRank(rank),
        }),
      );
    }
    const delMatch = /^\/api\/characters\/(\d+)$/.exec(url);
    const renameMatch = /^\/api\/characters\/(\d+)\/rename$/.exec(url);
    const takeoverMatch = /^\/api\/characters\/(\d+)\/takeover$/.exec(url);
    const standingMatch = /^\/api\/characters\/(\d+)\/standing$/.exec(url);
    if (req.method === 'GET' && standingMatch) {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      const standing = await lifetimeXpStanding(accountId, Number(standingMatch[1]));
      if (!standing) return json(res, 404, { error: 'character not found' });
      return json(res, 200, standing);
    }
    if (req.method === 'POST' && renameMatch) {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      const body = await readBody(req);
      const name = normalizeCharName(body.name);
      if (name === null) return json(res, 400, { error: 'invalid character name (2-16 letters)' });
      if (offensiveName(name)) return json(res, 400, { error: 'character name is not allowed' });
      const characterId = Number(renameMatch[1]);
      const character = await requireOwnedCharacter(
        res,
        accountId,
        characterId,
        'character not found',
        '/api/characters/:id/rename',
      );
      if (!character) return;
      // A rename is a moderator-sanctioned action: the character-select UI only
      // shows the rename control when a moderator has set force_rename. The UI is
      // not a security boundary, so gate here too: a normal owner hitting this
      // route directly must not be able to rename an un-flagged character. (The
      // UPDATE in renameCharacter re-checks the flag race-free; this returns a
      // clear 403 instead of a misleading 404.)
      if (!character.force_rename) {
        return json(res, 403, { error: 'character rename is not permitted' });
      }
      // A rename mutates the DB name and clears force_rename, but a live
      // ClientSession keeps its own copy of the name (used by reports, chat and
      // /api/status). Renaming an online character desyncs that copy and — worse
      // — lets a force-renamed player already in the world clear the moderation
      // flag without ever leaving. Mirror the DELETE guard and require offline.
      if ([...game.clients.values()].some((s) => s.characterId === characterId)) {
        return json(res, 400, { error: 'character is currently online' });
      }
      try {
        const c = await renameCharacter(accountId, characterId, name);
        if (!c) {
          // The force_rename-gated UPDATE matched no row even though the pre-check
          // passed: a concurrent rename cleared the flag, or the character was just
          // deleted. Re-resolve so the status stays consistent with the pre-check
          // (403 if it still exists but is no longer flagged, 404 if truly gone)
          // instead of always answering a misleading 404.
          const still = await getCharacter(accountId, characterId);
          if (still && !still.force_rename) {
            return json(res, 403, { error: 'character rename is not permitted' });
          }
          return json(res, 404, { error: 'character not found' });
        }
        if (game.rekeyMarketSeller(characterId, character.name, c.name)) {
          await game.saveMarket();
        }
        if (game.rekeyMailRecipient(characterId, character.name, c.name)) {
          await game.saveMail();
        }
        return json(res, 200, {
          id: c.id,
          name: c.name,
          class: c.class,
          level: c.level,
          forceRename: c.force_rename,
        });
      } catch (err: any) {
        if (isUniqueViolation(err)) return json(res, 409, { error: 'that name is taken' });
        throw err;
      }
    }
    if (req.method === 'POST' && takeoverMatch) {
      // Free a character's live session so this account can re-enter on it,
      // e.g. after a crash/closed tab left a stale session, or to hand a
      // character off from another device. Ownership-gated and idempotent.
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      const characterId = Number(takeoverMatch[1]);
      const character = await requireOwnedCharacter(
        res,
        accountId,
        characterId,
        'not found',
        '/api/characters/:id/takeover',
      );
      if (!character) return;
      const result = await game.takeOverCharacter(accountId, characterId);
      return json(res, 200, { ok: true, takenOver: result === 'taken-over' });
    }
    if (req.method === 'DELETE' && delMatch) {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      const characterId = Number(delMatch[1]);
      const body = await readBody(req);
      const character = await requireOwnedCharacter(
        res,
        accountId,
        characterId,
        'not found',
        '/api/characters/:id',
      );
      if (!character) return;
      if ([...game.clients.values()].some((s) => s.characterId === characterId)) {
        return json(res, 400, { error: 'character is currently online' });
      }
      if (normalizeDeleteConfirmation(body.name) !== normalizeDeleteConfirmation(character.name)) {
        return json(res, 400, { error: 'type the character name to confirm deletion' });
      }
      const ok = await deleteCharacter(accountId, characterId);
      return json(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'not found' });
    }
    if (req.method === 'GET' && url === '/api/realms') {
      // optionally authenticated: with a token we also return how many
      // characters the account has on each realm (for the realm-list screen)
      const accountId = await bearerAccount(req);
      const characters = accountId !== null ? await characterCountsByRealm(accountId) : {};
      return json(res, 200, { current: REALM, realms: REALM_DIRECTORY, characters });
    }
    if (req.method === 'GET' && url === '/api/search') {
      const accountId = await bearerAccount(req);
      if (accountId === null) return json(res, 401, { error: 'not authenticated' });
      const q = new URL(req.url ?? '/', 'http://localhost').searchParams.get('q') ?? '';
      const results = q.trim().length >= 1 ? await searchCharacters(q, 8) : [];
      return json(res, 200, { results });
    }
    if (req.method === 'POST' && url === '/api/reports') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      const body = await readBody(req);
      const reason = cleanReportReason(body.reason);
      if (!reason) return json(res, 400, { error: 'choose a report reason' });
      const reporterCharacterId = Number(body.reporterCharacterId);
      if (!Number.isFinite(reporterCharacterId)) {
        return json(res, 400, { error: 'invalid report target' });
      }
      const reporter = await requireOwnedCharacter(
        res,
        accountId,
        reporterCharacterId,
        'reporting character not found',
        '/api/reports',
      );
      if (!reporter) return;
      const resolved = await resolveReportTarget(body, {
        reportTargetForPid: (pid) => game.reportTargetForPid(pid),
        findCharacterReportTargetByName,
      });
      if (!resolved.ok) return json(res, resolved.status, { error: resolved.error });
      try {
        const report = await createPlayerReport({
          reporterAccountId: accountId,
          reporterCharacterId: reporter.id,
          reporterCharacterName: reporter.name,
          target: resolved.target,
          reason,
          details: body.details,
        });
        return json(res, 200, { ok: true, reportId: report.id });
      } catch (err) {
        return json(res, 400, {
          error: err instanceof Error ? err.message : 'could not submit report',
        });
      }
    }
    if (req.method === 'POST' && url === '/api/bug-reports') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      // A downscaled screenshot data URL dominates the payload; allow ~1 MB
      // (well above the 64 KB JSON default) and surface an oversize body as 413.
      let body: any;
      try {
        body = await readBody(req, 1024 * 1024);
      } catch (err) {
        if (err instanceof Error && err.message === 'body too large') {
          return json(res, 413, { error: 'bug report too large' });
        }
        return json(res, 400, { error: 'bad request' });
      }
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      if (!description) return json(res, 400, { error: 'describe the bug' });
      const characterId = Number.isFinite(Number(body.characterId))
        ? Number(body.characterId)
        : null;
      // Only trust a character name the server can verify the account owns. A
      // missing or unowned characterId resolves to no name (never the client value).
      let characterName = '';
      let resolvedCharacterId: number | null = null;
      if (characterId !== null) {
        const character = await getCharacter(accountId, characterId);
        if (character) {
          resolvedCharacterId = character.id;
          characterName = character.name;
        }
      }
      const pos = body.pos && typeof body.pos === 'object' ? body.pos : {};
      try {
        // The screenshot allowlist and meta clamp live in createBugReport so they
        // apply to every insert path, not just this route.
        const report = await createBugReport({
          accountId,
          characterId: resolvedCharacterId,
          characterName,
          realm: REALM,
          pos: { x: Number(pos.x), y: Number(pos.y), z: Number(pos.z) },
          description: description.slice(0, BUG_DESCRIPTION_MAX),
          screenshot: typeof body.screenshot === 'string' ? body.screenshot : null,
          meta: body.meta,
        });
        return json(res, 200, {
          ok: true,
          reportId: report.id,
          screenshotStored: report.screenshotStored,
        });
      } catch (err) {
        if (err instanceof BugReportRateLimitError) return json(res, 429, { error: err.message });
        throw err;
      }
    }
    if (req.method === 'POST' && url === '/api/perf-report') {
      return await handlePerfReport(req, res);
    }
    if (req.method === 'GET' && url === '/api/project-stats') {
      const accountsCount = await getAccountsCount();
      return json(res, 200, {
        accounts_created: accountsCount,
        players_online: game.clients.size,
        realm: REALM,
      });
    }
    if (req.method === 'GET' && url === '/api/status') {
      return json(res, 200, {
        ok: true,
        realm: REALM,
        players_online: game.clients.size,
        names: [...game.clients.values()].map((s) => s.name),
      });
    }
    // Dev-only world-loop perf profile (per-phase tick p95/max), for the load
    // harness. Gated by ALLOW_DEV_COMMANDS so it is never exposed in production.
    if (req.method === 'GET' && url === '/api/perf' && process.env.ALLOW_DEV_COMMANDS === '1') {
      return json(res, 200, game.perfProfile());
    }
    if (req.method === 'GET' && url === '/api/arena/leaderboard') {
      // public all-time Ashen Coliseum ladder (top rated characters)
      const params = new URLSearchParams((req.url ?? '').split('?')[1] ?? '');
      const format = params.get('format') === '2v2' ? '2v2' : '1v1';
      return json(res, 200, { format, leaders: await topArenaRatings(20, format) });
    }
    if (req.method === 'GET' && url === '/api/leaderboard') {
      // lifetime-XP leaderboard (Max-Level XP Overflow), served from the
      // in-memory cache. metric is fixed to lifetimeXp. ?scope=global ranks
      // across every realm (home page); default is this process's realm (the
      // in-game panel). `url` is the path only, so the query string is parsed
      // from req.url.
      const params = new URLSearchParams((req.url ?? '').split('?')[1] ?? '');
      const scope: 'realm' | 'global' = params.get('scope') === 'global' ? 'global' : 'realm';
      // ?board=guilds ranks GUILDS by summed member lifetime XP (default 'players'
      // is the per-character board below). Same cache + paging shape; the entry
      // shape differs, so it is its own served slice.
      if (params.get('board') === 'guilds') {
        const guildEntries = await getGuildLeaderboard(scope);
        const guildPageSize = Number(params.get('pageSize')) || LEADERBOARD_PAGE_SIZE;
        const guildPage = Number(params.get('page')) || 0;
        const guildSlice = paginateGuildLeaderboard(guildEntries, guildPage, guildPageSize);
        return json(res, 200, {
          realm: REALM,
          scope,
          board: 'guilds',
          metric: 'guildLifetimeXp',
          ...guildSlice,
        });
      }
      const entries = await getLeaderboard(scope);
      // Legacy ?limit=N (home-page board): top N as a single page, no paging UI.
      const limitParam = params.get('limit');
      if (limitParam !== null) {
        const limit = Math.max(
          1,
          Math.min(LEADERBOARD_SIZE, Number(limitParam) || LEADERBOARD_SIZE),
        );
        const leaders = entries.slice(0, limit);
        return json(res, 200, {
          realm: REALM,
          scope,
          metric: 'lifetimeXp',
          leaders,
          page: 0,
          pageCount: 1,
          total: leaders.length,
          pageSize: limit,
        });
      }
      // Paged in-game board: ?page=N (0-based) & ?pageSize=M, clamped server-side.
      const pageSize = Number(params.get('pageSize')) || LEADERBOARD_PAGE_SIZE;
      const page = Number(params.get('page')) || 0;
      const slice = paginateLeaderboard(entries, page, pageSize);
      return json(res, 200, { realm: REALM, scope, metric: 'lifetimeXp', ...slice });
    }
    if (req.method === 'GET' && url === '/api/releases') {
      recordUsageMetric('github.releases.api');
      // public News & Updates feed, mirrored from GitHub Releases and served
      // from the in-memory cache (refreshed at most every RELEASES_TTL_MS).
      // Optional ?limit=N (1..RELEASES_SIZE).
      const params = new URLSearchParams((req.url ?? '').split('?')[1] ?? '');
      const limit = Math.max(
        1,
        Math.min(RELEASES_SIZE, Number(params.get('limit')) || RELEASES_SIZE),
      );
      const entries = await getReleases();
      return json(res, 200, { repo: GITHUB_REPO, releases: entries.slice(0, limit) });
    }
    // Account self-service portal — all bearer-auth, account-scoped. Each route
    // delegates to an exported, testable handler in server/account.ts (mirroring
    // main.ts only resolves the bearer account first.
    if (req.method === 'GET' && url === '/api/account') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      return handleAccountWhoami(res, accountId);
    }
    if (req.method === 'POST' && url === '/api/account/password') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      // Resolve the caller's own token once so the revoke inside the handler can
      // never accidentally fall back to null (which would nuke this session too).
      const callerToken = bearerToken(req);
      if (!callerToken) return json(res, 401, { error: 'not authenticated' });
      return handleAccountChangePassword(req, res, accountId, callerToken);
    }
    // Password reset is for users who are locked out, so both routes are
    // unauthenticated (rate-limited + web-login guarded above, and each handler is
    // written to never reveal whether an account exists).
    if (req.method === 'POST' && url === '/api/account/password/forgot') {
      return handleAccountPasswordForgot(req, res);
    }
    if (req.method === 'POST' && url === '/api/account/password/reset') {
      return handleAccountPasswordReset(req, res);
    }
    if (req.method === 'POST' && url === '/api/account/logout') {
      const callerToken = bearerToken(req);
      if (!callerToken || (await accountForToken(callerToken)) === null)
        return json(res, 401, { error: 'not authenticated' });
      return handleAccountLogout(res, callerToken);
    }
    if (req.method === 'POST' && url === '/api/account/email') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      return handleAccountSetEmail(req, res, accountId);
    }
    // Set the recovery email on an account that has none yet (the mandatory-email
    // backfill the client forces on sign-in). Bearer-scoped; rejects once an
    // address already exists (that must go through the verified change flow).
    if (req.method === 'POST' && url === '/api/account/email/set-initial') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      return handleAccountSetInitialEmail(req, res, accountId);
    }
    if (req.method === 'POST' && url === '/api/account/deactivate') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      return handleAccountDeactivate(req, res, accountId, {
        anyCharacterOnline: (characterIds) =>
          [...game.clients.values()].some(
            (s) => s.characterId != null && characterIds.includes(s.characterId),
          ),
        disconnectAccount: (id, reason) => game.disconnectAccount(id, reason),
      });
    }
    // Companion read-only tokens: a 90-day scope='read' token a user can paste
    // into a companion app instead of running OAuth. Managed from a full web
    // session only (bearerActiveAccount rejects read tokens, so a read token can
    // never mint or list more — no privilege escalation).
    if (url === '/api/account/companion-token') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (req.method === 'POST') {
        const body = await readBody(req);
        const rawLabel = typeof body.label === 'string' ? body.label.trim().slice(0, 64) : '';
        const label = rawLabel || null;
        const token = newToken();
        const COMPANION_TOKEN_TTL_HOURS = 24 * 90;
        await createCompanionToken(token, accountId, label, COMPANION_TOKEN_TTL_HOURS);
        // The full secret is returned ONCE, on creation; it is never listed again.
        return json(res, 200, { token, label, scope: 'read', expiresInDays: 90 });
      }
      if (req.method === 'GET') {
        return json(res, 200, { tokens: await listCompanionTokens(accountId) });
      }
      if (req.method === 'DELETE') {
        const body = await readBody(req);
        const prefix = typeof body.prefix === 'string' ? body.prefix.trim().toLowerCase() : '';
        const ok = await revokeCompanionToken(accountId, prefix);
        return json(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'token not found' });
      }
    }
    if (req.method === 'POST' && url === '/api/account/email/change') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      return handleAccountEmailChange(req, res, accountId);
    }
    // Email-change verification is a link click from the inbox: unauthenticated,
    // the token is the authorization. Parse the token off the query string.
    if (req.method === 'GET' && url === '/api/account/email/verify') {
      const token = new URL(req.url ?? '', 'http://localhost').searchParams.get('token') ?? '';
      return handleAccountEmailVerify(res, token);
    }
    if (req.method === 'POST' && url === '/api/account/export') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      return handleAccountExport(req, res, accountId);
    }
    if (req.method === 'POST' && url === '/api/account/marketing') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      return handleAccountMarketing(req, res, accountId);
    }
    if (req.method === 'POST' && url === '/api/account/2fa/setup') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      return handleAccount2faSetup(req, res, accountId);
    }
    if (req.method === 'POST' && url === '/api/account/2fa/enable') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      return handleAccount2faEnable(req, res, accountId);
    }
    if (req.method === 'POST' && url === '/api/account/2fa/disable') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      return handleAccount2faDisable(req, res, accountId);
    }
    // Public one-click marketing unsubscribe (link from a marketing email).
    if (req.method === 'GET' && url === '/api/email/unsubscribe') {
      const token = new URL(req.url ?? '', 'http://localhost').searchParams.get('token') ?? '';
      return handleEmailUnsubscribe(res, token);
    }
    // Discord integration: OAuth login/link, link status, unlink. `start` returns
    // the authorize URL (the browser then navigates to Discord); `callback` is the
    // discord.com -> us redirect (no auth/Origin, so it is NOT gated by the
    // web-login guard, which is login/register-only). Mutations go through
    // bearerActiveAccount; the dedicated Discord rate-limit bucket guards them.
    if (req.method === 'POST' && url === '/api/auth/discord/start') {
      const mode =
        new URL(req.url ?? '/', 'http://localhost').searchParams.get('mode') === 'link'
          ? 'link'
          : 'login';
      let accountId: number | null = null;
      if (mode === 'link') {
        accountId = await bearerActiveAccount(req, res);
        if (accountId === null) return;
      }
      if (discordRateLimited(req, accountId ?? 0))
        return sendProblem(res, 429, 'RATE_LIMITED', 'rate limited', { policy: 'discord' });
      return handleDiscordStart(req, res, { mode, accountId });
    }
    if (req.method === 'GET' && url === '/api/auth/discord/callback') {
      return handleDiscordCallback(req, res);
    }
    // First-time-login chooser endpoints. Unauthenticated like /callback: the
    // authorization is the single-use pending-login token (minted only after a
    // verified Discord OAuth), and the handlers carry their own Discord rate-limit
    // bucket + (for the link path) the same password/2FA/moderation checks as login.
    if (req.method === 'POST' && url === '/api/auth/discord/login/new') {
      return handleDiscordLoginNew(req, res, (ip) => game.isIpBlocked(ip));
    }
    if (req.method === 'POST' && url === '/api/auth/discord/login/link') {
      return handleDiscordLoginLink(req, res, (ip) => game.isIpBlocked(ip));
    }
    if (req.method === 'GET' && url === '/api/discord') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (discordRateLimited(req, accountId))
        return sendProblem(res, 429, 'RATE_LIMITED', 'rate limited', { policy: 'discord' });
      return handleDiscordStatus(req, res, accountId);
    }
    if (req.method === 'DELETE' && url === '/api/discord') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (discordRateLimited(req, accountId))
        return sendProblem(res, 429, 'RATE_LIMITED', 'rate limited', { policy: 'discord' });
      return handleDiscordUnlink(req, res, accountId);
    }
    // Shareable player card: publish (PNG body) + referral stats for the card.
    if (req.method === 'POST' && url === '/api/card') {
      recordUsageMetric('card.publish.request');
      if (cardUploadContentLengthTooLarge(req)) {
        recordUsageMetric('card.publish.rejected');
        res.shouldKeepAlive = false;
        res.setHeader('Connection', 'close');
        return json(res, 413, { error: 'image too large' });
      }
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (cardUploadRateLimited(req, accountId)) {
        recordUsageMetric('card.publish.rate_limited');
        return sendProblem(res, 429, 'RATE_LIMITED', 'rate limited', { policy: 'card_upload' });
      }
      return handleCardUpload(req, res, accountId, (characterId) =>
        game.liveLevelForCharacter(characterId),
      );
    }
    if (req.method === 'GET' && url === '/api/referrals') {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      const [count, slug] = await Promise.all([
        referralCountForAccount(accountId),
        primarySlugForAccount(accountId),
      ]);
      return json(res, 200, { count, slug });
    }
    // -----------------------------------------------------------------------
    // Map editor: saved custom maps. Every stored document is the output of
    // sanitizeMapDoc (applied inside MapsService), all error bodies are stable
    // snake_case codes the client maps to its own t() keys, and every mutation
    // goes through bearerActiveAccount. Save bodies get the /api/card lane
    // treatment: Content-Length precheck BEFORE auth, 413 + Connection: close.
    // -----------------------------------------------------------------------
    if (url === '/api/maps' && (req.method === 'GET' || req.method === 'POST')) {
      if (req.method === 'GET') {
        const accountId = await bearerReadAccount(req, res);
        if (accountId === null) return;
        const mine = await customMaps.listMine(accountId);
        return json(res, 200, { maps: mine.map(mapSummaryJson) });
      }
      if (contentLengthExceeds(req, MAX_MAP_SAVE_BYTES)) {
        res.shouldKeepAlive = false;
        res.setHeader('Connection', 'close');
        return json(res, 413, { error: 'map_too_large' });
      }
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (mapMutationRateLimited(req, accountId)) return json(res, 429, { error: 'rate_limited' });
      let body: any;
      try {
        body = await readBody(req, MAX_MAP_SAVE_BYTES);
      } catch (err) {
        const tooLarge = err instanceof Error && err.message === 'body too large';
        if (tooLarge) {
          res.shouldKeepAlive = false;
          res.setHeader('Connection', 'close');
        }
        return json(res, tooLarge ? 413 : 400, { error: tooLarge ? 'map_too_large' : 'bad_json' });
      }
      const result = await customMaps.createMap(accountId, body.name, body.doc);
      if (!result.ok) return json(res, mapsErrorStatus(result.error), { error: result.error });
      return json(res, 200, { map: mapSummaryJson(result.map) });
    }
    if (req.method === 'GET' && url === '/api/maps/public') {
      if (publicReadRateLimited(req)) return json(res, 429, { error: 'rate_limited' });
      const { page, limit } = parsePageParams(
        new URL(req.url ?? '/', 'http://localhost').searchParams,
      );
      const { rows, total } = await customMaps.listPublic(page, limit);
      return json(res, 200, { rows: rows.map(mapSummaryJson), total, page, limit });
    }
    const mapIdMatch = /^\/api\/maps\/(\d+)$/.exec(url);
    if (req.method === 'GET' && mapIdMatch) {
      // Owner or public. Auth is optional; anonymous readers share the public
      // read throttle like the public character sheet.
      const accountId = await bearerAccount(req);
      if (accountId === null && publicReadRateLimited(req)) {
        return json(res, 429, { error: 'rate_limited' });
      }
      const map = await customMaps.getMapForViewer(accountId, Number(mapIdMatch[1]));
      if (!map) return json(res, 404, { error: 'map_not_found' });
      return json(res, 200, { map: mapFullJson(map) });
    }
    if (req.method === 'PUT' && mapIdMatch) {
      if (contentLengthExceeds(req, MAX_MAP_SAVE_BYTES)) {
        res.shouldKeepAlive = false;
        res.setHeader('Connection', 'close');
        return json(res, 413, { error: 'map_too_large' });
      }
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (mapMutationRateLimited(req, accountId)) return json(res, 429, { error: 'rate_limited' });
      let body: any;
      try {
        body = await readBody(req, MAX_MAP_SAVE_BYTES);
      } catch (err) {
        const tooLarge = err instanceof Error && err.message === 'body too large';
        if (tooLarge) {
          res.shouldKeepAlive = false;
          res.setHeader('Connection', 'close');
        }
        return json(res, tooLarge ? 413 : 400, { error: tooLarge ? 'map_too_large' : 'bad_json' });
      }
      const result = await customMaps.saveMap(
        accountId,
        Number(mapIdMatch[1]),
        body.doc,
        body.version,
        body.name,
      );
      if (!result.ok) {
        return json(res, mapsErrorStatus(result.error), {
          error: result.error,
          ...(result.currentVersion !== undefined ? { version: result.currentVersion } : {}),
        });
      }
      return json(res, 200, { map: mapSummaryJson(result.map) });
    }
    if (req.method === 'DELETE' && mapIdMatch) {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (mapMutationRateLimited(req, accountId)) return json(res, 429, { error: 'rate_limited' });
      const deleted = await customMaps.deleteMap(accountId, Number(mapIdMatch[1]));
      return json(res, deleted ? 200 : 404, deleted ? { ok: true } : { error: 'map_not_found' });
    }
    const mapForkMatch = /^\/api\/maps\/(\d+)\/fork$/.exec(url);
    if (req.method === 'POST' && mapForkMatch) {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (mapMutationRateLimited(req, accountId)) return json(res, 429, { error: 'rate_limited' });
      let body: any;
      try {
        body = await readBody(req);
      } catch {
        return json(res, 400, { error: 'bad_json' });
      }
      const result = await customMaps.forkMap(accountId, Number(mapForkMatch[1]), body.name);
      if (!result.ok) return json(res, mapsErrorStatus(result.error), { error: result.error });
      // The fork response carries the full document so the editor can open the
      // copy without a second round trip.
      return json(res, 200, { map: mapFullJson(result.map) });
    }
    const mapPublishMatch = /^\/api\/maps\/(\d+)\/(publish|unpublish)$/.exec(url);
    if (req.method === 'POST' && mapPublishMatch) {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (mapMutationRateLimited(req, accountId)) return json(res, 429, { error: 'rate_limited' });
      const publish = mapPublishMatch[2] === 'publish';
      const done = await customMaps.setPublished(accountId, Number(mapPublishMatch[1]), publish);
      return json(res, done ? 200 : 404, done ? { ok: true } : { error: 'map_not_found' });
    }
    // -----------------------------------------------------------------------
    // Map editor: uploaded GLB assets, content-addressed by sha256. The upload
    // copies the /api/card lane end to end (Content-Length precheck before
    // auth, scoped rate-limit bucket, binary body, format validation before
    // storage); the byte GET is public (read-throttled) so placed assets load
    // in any viewer's client.
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && url === '/api/assets') {
      if (contentLengthExceeds(req, MAX_ASSET_BYTES)) {
        res.shouldKeepAlive = false;
        res.setHeader('Connection', 'close');
        return json(res, 413, { error: 'asset_too_large' });
      }
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (assetUploadRateLimited(req, accountId)) {
        return json(res, 429, { error: 'rate_limited' });
      }
      let bytes: Buffer;
      try {
        bytes = await readBinaryBody(req, MAX_ASSET_BYTES);
      } catch (err) {
        const tooLarge = err instanceof Error && err.message === 'body too large';
        if (tooLarge) {
          res.shouldKeepAlive = false;
          res.setHeader('Connection', 'close');
        }
        return json(res, tooLarge ? 413 : 400, {
          error: tooLarge ? 'asset_too_large' : 'bad_request',
        });
      }
      const name = new URL(req.url ?? '/', 'http://localhost').searchParams.get('name');
      const result = await userAssets.upload(accountId, bytes, name);
      if (!result.ok) {
        return json(res, userAssetsErrorStatus(result.error), { error: result.error });
      }
      return json(res, 200, { asset: userAssetJson(result.asset), existing: result.existing });
    }
    if (req.method === 'GET' && url === '/api/assets/mine') {
      const accountId = await bearerReadAccount(req, res);
      if (accountId === null) return;
      const assets = await userAssets.listMine(accountId);
      return json(res, 200, { assets: assets.map(userAssetJson) });
    }
    const assetGlbMatch = /^\/api\/assets\/([a-f0-9]{64})\.glb$/.exec(url);
    if (req.method === 'GET' && assetGlbMatch) {
      if (publicReadRateLimited(req)) return json(res, 429, { error: 'rate_limited' });
      const bytes = await userAssets.bytesForSha(assetGlbMatch[1]);
      // Missing and moderation-blocked are the same 404 to the public.
      if (!bytes) return json(res, 404, { error: 'asset_not_found' });
      res.writeHead(200, {
        'Content-Type': 'model/gltf-binary',
        'Content-Length': bytes.length,
        // Content-addressed by sha256: the bytes behind a given URL can never
        // change, so cache like the hashed build assets (static_cache.ts).
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(bytes);
      return;
    }
    const assetIdMatch = /^\/api\/assets\/(\d+)$/.exec(url);
    if (req.method === 'DELETE' && assetIdMatch) {
      const accountId = await bearerActiveAccount(req, res);
      if (accountId === null) return;
      if (mapMutationRateLimited(req, accountId)) return json(res, 429, { error: 'rate_limited' });
      const deleted = await userAssets.deleteAsset(accountId, Number(assetIdMatch[1]));
      return json(res, deleted ? 200 : 404, deleted ? { ok: true } : { error: 'asset_not_found' });
    }
    json(res, 404, { error: 'unknown endpoint' });
  } catch (err: any) {
    logger.error({ err }, 'api error');
    json(res, 500, { error: 'internal error' });
  }
}

// The one process-wide RED metrics exporter (PHAA-527): the /metrics registry,
// the per-request sink (teed into the structured access log), and the four
// attack-signal counters, installed process-wide so the emission sites in
// ratelimit.ts / ownership.ts / the login gate all land on this registry.
// Flips true at the start of graceful shutdown so /readyz can stop new
// traffic before the process actually exits (see routeHttpRequest below).
let isDraining = false;
const httpMetrics = createHttpMetrics({ defaultMetrics: true });
const requestMetricSink = teeMetricSink(httpMetrics.sink, createAccessLogSink(logger));
setAttackSignalSink(httpMetrics.attackSignals);

// The single top-level entry point for every HTTP response the server emits
// (not the WS upgrade handshake, which server.on('upgrade') handles
// separately). Hoisted to module scope, mirroring upstream's routeHttpRequest,
// so a test can drive real request shapes through the actual routing ladder
// without booting the server or touching Postgres. applySecurityHeaders runs
// first so it lands on every branch below: CORS, the OPTIONS-204 preflight
// short-circuit, and every route including static/404.
export function routeHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = req.url ?? '';
  const path = url.split('?')[0];
  applySecurityHeaders(res, path);
  // Token-gated Prometheus exposition (PHAA-527). Fails closed as a 404, so
  // without METRICS_TOKEN (or with a wrong bearer) the endpoint is
  // indistinguishable from not existing.
  if (path === '/metrics') {
    void handleMetricsRequest(req, res, httpMetrics);
    return;
  }
  // Unauthenticated ops probes: no player data or internal detail, only a
  // boolean + a millisecond staleness figure, so exposure is low-risk even
  // though a production deploy should still keep them off the public edge
  // (DEPLOY.md's Caddy retrofit for that is a follow-up, out of this change's
  // scope). /livez reports the world loop itself (never flips just because
  // the process is draining, so a deploy's grace period doesn't get killed as
  // unhealthy); /readyz additionally flips during a graceful shutdown so a
  // load balancer stops sending new traffic before the process actually exits.
  if (path === '/livez') {
    const status = game.livenessStatus();
    res.writeHead(status.ok ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify(status));
    return;
  }
  if (path === '/readyz') {
    const status = game.livenessStatus();
    const ready = status.ok && !isDraining;
    res.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ...status, ok: ready, draining: isDraining }));
    return;
  }
  const isApi = url.startsWith('/api/') || url.startsWith('/admin/api/');
  // RED observability (PHAA-527): one MetricEvent per API-surface request
  // (Prometheus + access log via the tee), recorded when the response
  // finishes. Static assets and card/profile pages stay uninstrumented.
  if (isApi || url.startsWith('/internal/') || url.startsWith('/oauth/')) {
    instrumentRequest(req, res, requestMetricSink, requestIp(req));
  }
  // Public read surfaces (/api/public/..., /avatar/...) are CORS-open to any
  // origin so browser-origin companion apps can call them client-side; every
  // other /api route keeps the narrow realm/native allowlist.
  const publicCorsPath = isPublicCorsPath(path);
  // Cross-site Origin gate (PHAA-524): scoped to the plain /api surface, same
  // as upstream's carve-out (admin and oauth have their own auth models, and
  // public reads never mutate state). Runs BEFORE the CORS reflection headers
  // below so a rejected request never gets an Access-Control-Allow-Origin.
  // Only active when isCrossSiteApiRequest's webLoginEnforced check is on
  // (production, or REQUIRE_WEB_LOGIN forced) so dev/e2e origins never audited
  // against the allow-list are not suddenly rejected.
  if (url.startsWith('/api/') && !publicCorsPath && isCrossSiteApiRequest(req)) {
    sendProblem(res, 403, 'CROSS_SITE_ORIGIN_REJECTED', 'cross-site request rejected');
    return;
  }
  if (publicCorsPath) publicCors(res);
  else if (isApi) maybeCors(req, res);
  if (req.method === 'OPTIONS' && (isApi || publicCorsPath)) {
    res.writeHead(204);
    res.end();
    return;
  }
  if (url.startsWith('/internal/')) void handleInternalApi(req, res, game);
  else if (url.startsWith('/admin/api/')) void handleAdminApi(req, res, game);
  else if (url.startsWith('/api/')) void handleApi(req, res);
  else if (url.startsWith('/oauth/')) void handleOAuth(req, res);
  else if (req.method === 'GET' && url.startsWith('/p/')) void handleCardRoutes(req, res);
  else if (req.method === 'GET' && path.startsWith('/avatar/')) void handleAvatar(req, res);
  else if (req.method === 'GET' && path.startsWith('/c/')) void handleProfilePage(req, res);
  else if (req.method === 'GET' && path === '/sitemap-characters.xml')
    void handleCharacterSitemap(req, res);
  else serveStatic(req, res);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // wait for the database (it may still be starting in docker)
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (err) {
      if (attempt >= 30) throw err;
      logger.info({ attempt }, 'waiting for postgres');
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  await ensureSchema();
  await seedOAuthClients();
  // Bot detector: replay this realm's saved config overrides onto the fresh
  // detector. Boot applies what it can; a stale entry (schema drift after a
  // deploy) is skipped and logged, never allowed to drop the whole document.
  const storedAntibotConfig = await loadAntibotConfig();
  const antibotOverrides =
    typeof storedAntibotConfig.data === 'object' && storedAntibotConfig.data !== null
      ? (storedAntibotConfig.data as Record<string, unknown>)
      : {};
  for (const error of game.applyAntibotConfig(antibotOverrides).errors) {
    logger.warn({ error }, 'bot-detector config override skipped');
  }
  const orphans = await closeOrphanSessions();
  if (orphans > 0) logger.info({ orphans }, 'closed orphaned play sessions from a previous run');
  const pruned = await pruneChatLogs(CHAT_LOG_RETENTION_DAYS);
  if (pruned > 0)
    logger.info({ pruned, retentionDays: CHAT_LOG_RETENTION_DAYS }, 'pruned chat log rows');
  const prunedPerfReports = await pruneClientPerfReports(PERF_REPORT_RETENTION_DAYS);
  if (prunedPerfReports > 0)
    logger.info(
      { pruned: prunedPerfReports, retentionDays: PERF_REPORT_RETENTION_DAYS },
      'pruned client perf report rows',
    );
  await game.loadMarket();
  await game.loadMail();
  await game.loadHousing();
  await game.loadGreenpawHearth();
  await game.loadHomestead();
  await game.loadGreenpawCutting();
  await game.loadChatFilter();
  await game.loadBlockedIps();
  void game.recordOnlineSnapshot();
  void currentSitePresenceUsers()
    .then((count) => recordSitePresenceSample(count))
    .catch((err) => logger.error({ err }, 'site presence sample failed'));
  setInterval(
    () => {
      void pruneChatLogs(CHAT_LOG_RETENTION_DAYS).catch((err) =>
        logger.error({ err }, 'chat log prune failed'),
      );
      void pruneClientPerfReports(PERF_REPORT_RETENTION_DAYS).catch((err) =>
        logger.error({ err }, 'perf report prune failed'),
      );
      void pruneExpiredOAuthGrants(pool).catch((err) =>
        logger.error({ err }, 'oauth grant prune failed'),
      );
      void pruneDiscordOAuthStates(pool).catch((err) =>
        logger.error({ err }, 'discord oauth state prune failed'),
      );
      void pruneDiscordPendingLogins(pool).catch((err) =>
        logger.error({ err }, 'discord pending login prune failed'),
      );
    },
    24 * 3600 * 1000,
  ).unref();
  setInterval(() => {
    void game.recordOnlineSnapshot();
    void currentSitePresenceUsers()
      .then((count) => recordSitePresenceSample(count))
      .catch((err) => logger.error({ err }, 'site presence sample failed'));
  }, ADMIN_ONLINE_SAMPLE_MS).unref();
  setInterval(() => {
    void pruneExpiredBlockedIps().catch((err) => logger.error({ err }, 'blocked IP prune failed'));
    void game
      .reloadBlockedIps()
      .then(() => game.disconnectBlockedSessions('Connection to the server was lost.'))
      .catch((err) => logger.error({ err }, 'blocked IP refresh failed'));
  }, BLOCKED_IP_REFRESH_MS).unref();
  // keep both leaderboard caches warm so the first viewer never waits on the
  // query and it never recomputes per request (PR-3)
  const warmLeaderboards = () => {
    void refreshLeaderboard('realm').catch((err) =>
      logger.error({ err, scope: 'realm' }, 'leaderboard refresh failed'),
    );
    void refreshLeaderboard('global').catch((err) =>
      logger.error({ err, scope: 'global' }, 'leaderboard refresh failed'),
    );
    void refreshGuildLeaderboard('realm').catch((err) =>
      logger.error({ err, scope: 'realm' }, 'guild leaderboard refresh failed'),
    );
    void refreshGuildLeaderboard('global').catch((err) =>
      logger.error({ err, scope: 'global' }, 'guild leaderboard refresh failed'),
    );
  };
  warmLeaderboards();
  setInterval(warmLeaderboards, LEADERBOARD_TTL_MS).unref();
  logger.info('database ready');

  const server = http.createServer(routeHttpRequest);

  // cap frame size: the largest legitimate client message is a small JSON
  // command; without this the ws default (~100 MiB) lets one socket force a
  // huge allocation + parse before any field-level validation runs
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      void onConnection(ws, req);
    });
  });

  async function authenticateWebSocket(
    ws: WebSocket,
    raw: string,
    req: http.IncomingMessage,
  ): Promise<void> {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      ws.send(JSON.stringify({ t: 'error', error: 'bad auth message' }));
      ws.close();
      return;
    }
    if (msg?.t !== 'auth') {
      ws.send(JSON.stringify({ t: 'error', error: 'authentication required' }));
      ws.close();
      return;
    }

    const token = typeof msg.token === 'string' ? msg.token : '';
    const characterId = Number(msg.character ?? 'NaN');
    const clientSeed = typeof msg.clientSeed === 'string' ? msg.clientSeed : '';
    const accountId = await accountForToken(token);
    if (accountId === null || !Number.isFinite(characterId)) {
      ws.send(JSON.stringify({ t: 'error', error: 'not authenticated' }));
      ws.close();
      return;
    }
    const status = await moderationStatusForAccount(accountId);
    if (status.locked) {
      ws.send(JSON.stringify({ t: 'error', error: status.message }));
      ws.close();
      return;
    }
    const character = await getCharacter(accountId, characterId);
    if (!character) {
      ws.send(JSON.stringify({ t: 'error', error: 'no such character' }));
      ws.close();
      return;
    }
    if (character.force_rename) {
      ws.send(
        JSON.stringify({
          t: 'error',
          error: 'This character must be renamed before entering the world.',
        }),
      );
      ws.close();
      return;
    }
    const chatMute = await chatMuteStatusForAccount(accountId);
    // Hard per-IP WS connection limit. The soft threshold (composite score evidence)
    // is handled inside game.join(); this guard blocks egregious bot farms before
    // they consume a session slot.
    const ip = requestMetadata(req).ip;
    const staff = await adminRolesForAccount(accountId);
    const isAdmin = staff !== null;
    const adminPermissions = staff ? [...permissionsForRoles(staff.roles)] : [];
    if (
      isConnectionRefused({
        blocked: game.isIpBlocked(ip),
        isAdmin,
        ipSessions: game.countIpSessions(ip),
        hardLimit: MAX_WS_PER_IP_HARD,
      })
    ) {
      ws.close(1008, 'Too many connections from your network');
      return;
    }
    const accountCosmetics = await loadAccountCosmetics(accountId);
    const accountDailyRewards = await loadAccountDailyRewardsInfo(accountId);
    const result = game.join(
      ws,
      accountId,
      character.id,
      character.name,
      character.class,
      character.state,
      character.is_gm,
      {
        ...requestMetadata(req),
        mutedUntil: status.chatMutedUntil ?? chatMute.mutedUntil,
        reason: chatMute.reason,
        chatStrikes: status.chatStrikes,
        accountCosmetics,
        accountDailyRewards,
        isAdmin,
        adminPermissions,
        clientSeed,
      },
    );
    if ('error' in result) {
      ws.send(JSON.stringify({ t: 'error', error: result.error }));
      ws.close();
      return;
    }
    const session = result;
    logger.info(
      { character: character.name, class: character.class, online: game.clients.size },
      'character joined',
    );
    ws.on('message', (data) => {
      game.handleMessage(session, String(data));
    });
    // A dropped socket starts the linkdead grace instead of logging the
    // character out: the session is held in-world so the client's
    // auto-reconnect (or a fresh login on the same character) resumes it.
    // socketClosed no-ops for kicked sessions and for stale events from a
    // socket that a resume has already replaced; the grace-expiry sweep in
    // game.ts runs the eventual leave().
    ws.on('close', () => {
      if (game.socketClosed(session, ws)) {
        logger.info({ character: character.name, online: game.clients.size }, 'character linkdead');
      }
    });
    ws.on('error', () => {
      game.socketClosed(session, ws);
    });
    // Clears the keepalive liveness flag (game.ts pingLiveSessions). Guarded
    // on socket identity so a late pong from a pre-resume socket cannot mask
    // a black-holed replacement.
    ws.on('pong', () => {
      if (session.ws === ws) session.awaitingPong = false;
    });
  }

  async function onConnection(ws: WebSocket, req: http.IncomingMessage): Promise<void> {
    const authTimer = setTimeout(() => {
      ws.send(JSON.stringify({ t: 'error', error: 'authentication timed out' }));
      ws.close();
    }, 10_000);

    // Pre-auth socket errors (e.g. a first frame over maxPayload, which ws
    // surfaces as an 'error' event) would otherwise be an unhandled exception
    // and crash the process. Tear the connection down quietly instead. The
    // post-auth game.leave handler is attached separately once joined.
    ws.on('error', () => {
      clearTimeout(authTimer);
      try {
        ws.close();
      } catch {
        /* already closing */
      }
    });

    ws.once('message', (data) => {
      clearTimeout(authTimer);
      // Buffer any frames the client sends while the async auth/join handshake
      // is still in flight, then replay them once authenticateWebSocket has
      // attached the permanent message handler. Without this the frames are
      // silently dropped (see ws_buffer.ts).
      const flush = bufferHandshakeMessages(ws);
      void authenticateWebSocket(ws, String(data), req).finally(flush);
    });
  }

  // Register the game-state gauges + throughput counters on the SAME registry the
  // RED exporter built at module scope, then install the counter sink process-wide
  // (mirrors setAttackSignalSink). Wired here, after `game` and `wss` exist, so the
  // gauges read live state at scrape time; ws_connections is the raw open-socket
  // count (joined or not), distinct from players_online (joined sessions).
  const gameStateSource: GameStateSource = {
    playersOnline: () => game.clients.size,
    accountsOnline: () => game.liveAccountIds().size,
    wsConnections: () => wss.clients.size,
    simEntities: () => game.sim.entities.size,
    simTickHz: () => game.simTickHz(),
    tickPhaseMillis: () => game.tickPhaseMillis(),
  };
  setGameMetricsCounters(registerGameStateMetrics(httpMetrics.registry, gameStateSource));

  // The app-aggregate /metrics collectors (Phase 3 business, Phase 4 client-perf):
  // each registers bounded gauges on the SAME exporter registry and runs ONE cached
  // Postgres aggregate on a fixed interval, so a scrape publishes the cached snapshot
  // and never queries the DB. start() kicks off an immediate refresh plus the
  // interval (both unref()'d); shutdown stops them below.
  const businessMetrics = registerBusinessMetrics(httpMetrics.registry);
  const clientPerfMetrics = registerClientPerfMetrics(httpMetrics.registry);
  businessMetrics.start();
  clientPerfMetrics.start();

  game.start();
  server.listen(PORT, () => {
    logger.info({ port: PORT }, 'World of ClaudeCraft server listening');
    logger.info('REST: /api/register /api/login /api/characters /api/status');
    logger.info('WS: /ws, then first message {t:"auth",token,character}');
  });

  const shutdown = async () => {
    isDraining = true;
    logger.info('shutting down: saving characters');
    // Stop the app-aggregate metric collectors so no refresh query races the pool
    // close below (their intervals are unref()'d, but an in-flight tick could still
    // fire before pool.end()).
    businessMetrics.stop();
    clientPerfMetrics.stop();
    game.stop();
    await game.saveAll('shutdown');
    await game.saveMarket();
    await game.saveMail();
    await game.saveHousing();
    await game.saveHomestead();
    await game.endAllPlaySessions();
    await game.chatLog.stop();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Last-resort net: one player's request must never crash the process and
  // disconnect everyone. handleMessage already guards itself, but any future
  // uncaught throw in a timer or async path would otherwise be fatal. Log and
  // keep serving — a live world staying up beats a clean crash-loop. Genuinely
  // fatal startup errors are still handled by main().catch() below.
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'uncaughtException (kept alive)');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandledRejection (kept alive)');
  });
}

// Boot only when this module is the process entrypoint, never on a bare
// import. The server always runs as the esbuild CJS bundle (npm run server /
// npm run realms, then node dist-server/server.cjs), where require.main ===
// module marks the entry. A Vitest import() of this module does not match, so
// the bare import stays inert (no socket bound, no DB connection) and tests
// can drive routeHttpRequest directly.
if (typeof require !== 'undefined' && require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'fatal');
    process.exit(1);
  });
}
