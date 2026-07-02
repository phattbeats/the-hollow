# FORK-NOTES

The fork-discipline log mandated by the constitution (`docs/plan-the-hollow.md`, §6).
Every modification to this fork gets a dated entry below. Upstream is a
**one-time donor**: no tracking, no routine merges, ever. A specific upstream
fix may be cherry-picked by hand, with an entry here.

## Sync point

- **Upstream:** `levy-street/world-of-claudecraft`
- **Pinned commit:** `b00fb6a5d6d0e1ffab9327ddcbfeb730267ab05e` (upstream tag `v0.17.0`, 2,703 commits)
- **Local tag:** `upstream-sync-2026-06-30`
- **Inherited test suite verified green, unmodified** (2026-07-01): 569 test
  files, 5,997 tests passed, 0 real failures. Eight tests hit the 5-second
  default timeout on slow container hardware and all pass unmodified with
  `--testTimeout` raised; they are environment flakes, not failures.

## Staged content (applied at fork time, per the §6 mandate; not a gameplay modification)

- `src/sim/content/hollow.ts`: the Hollow zone module from the packet
  (Greenpaw, the first-run quests, the Under-Shrine skeleton). **Not yet
  registered** in `sim/data.ts`; registration is Phase 1 work.
- `docs/plan-the-hollow.md`: the constitution (v3.1), the game's governing document.
- `docs/sim/hollow-build-sim-v2.py`, `docs/sim/hollow-build-sim-v2-results.txt`:
  the section 8 build-depth simulation and its corrected first results.

## Modifications

### 2026-07-01: Wallet strip (constitution, section 6)

Removed the $WOC token / Reown / WalletConnect stack in full:

- **Server:** `server/wallet.ts`, `server/wallet_link.ts`, `server/woc_balance.ts`,
  plus their wiring in `server/main.ts`, `server/game.ts`, `server/db.ts`,
  `server/internal.ts`, `server/ratelimit.ts`, `server/discord.ts`, `server/discord_db.ts`.
- **Sim:** `src/sim/holder_tier.ts`, `src/sim/discord_tier.ts` (holdings- and
  boost-gated tier logic).
- **Client / UI:** `src/net/wallet.ts`, `src/ui/wallet_balance.ts`,
  `src/ui/holder_tier.ts`, `src/ui/discord_tier.ts`, plus references across the
  HUD, options, player card, bags window, account portal, settings, and the
  entry HTML.
- **Docs / assets:** the whitepaper PDF (and its landing-page footer link), the
  wallet PRDs (`docs/prd/woc/wallet-link.md`,
  `docs/prd/woc/holder-cosmetic-flair.md`), `scripts/wallet_e2e.mjs`, and the
  Reown / WalletConnect third-party licenses.
- **Landing page:** the $WOC contract-address block (`#token-ca` in
  `index.html`), its click-to-copy wiring in `src/main.ts`, and its CSS across
  `shell.css` / `hud.css` / `hud.mobile.css`.
- **Nameplates:** the holder-tier badge (painter, renderer DOM plumbing,
  `np-tier` CSS) and the dead `holderTier` / `holderBalance` entity fields,
  their wire mappings, and their parity-exclude entries.
- **Tests:** every wallet / holder-tier / discord-tier suite removed with its
  feature; surviving suites (security rate limits, settings, options, account
  portal, companion API gates, client shell, discord bot / server / widget)
  trimmed to the post-strip surface.

Keeps, per the mandate: the Discord bridge (`bot/`, `server/discord_oauth.ts`,
the relay, PFP / nickname / member-since / staff-role flair) stays; the old
`statusTier` / `dt` wire field now carries only a 0/1 linked flag. The bot no
longer requests the GUILD_MESSAGES intent (it existed for the removed points
ladder). Arena code stays dormant, its UI unbuilt, since it shares a file with
duels.

Known-inert leftovers (strings only, no live code path): the `wallet.*` i18n
catalog block and its locale overlays, and the admin `usage.metric.wallet*`
label keys. No `t('wallet...')` callers remain; deleting them is a
locale-hygiene chore across 20 overlay files, deferred out of the strip commit.

Verification: `tsc --noEmit` clean and the full Vitest suite green after the
strip (recorded in the commit for this entry). Note for future verifiers: run
the suite with NODE_ENV unset. This container exports NODE_ENV=production,
which makes Vitest report `import.meta.env.PROD = true` and flips the i18n
runtime into release semantics, failing five i18n / OG tests that are green
under a normal test environment.

## 2026-07-02: realm picker stat corrected to live online count (PR #9)

Upstream's landing-page realm picker shows lifetime accounts created labeled
just "Players" beneath the green Online dot, which reads as a live player
count (reported by the Board with 2 accounts and 0 players online). The
picker now binds to `players_online` from the same `/api/project-stats`
payload and uses the existing `stats.playersOnline` label. Files:
`index.html`, `play.html`, `src/main.ts` (`loadProjectStats`). Redeployed to
PHATT-RAID (image `eastbrook-game:phase0` rebuilt, container recreated with
`PUBLIC_ORIGIN=https://thehollow.phatt.vip`, previously theplant.phatt.vip).

### 2026-07-02: Branding pass, donate / upstream Discord and GitHub chrome stripped

- **Stripped upstream donate chrome:** removed the three donate anchors in
  `index.html` (community-link donate, header donate-cta, footer social-link
  donate), all pointing at `github.com/sponsors/levy-street`.
- **Stripped upstream Discord and GitHub community links:** removed the
  `discord.gg/GjhnUsBtw` and `github.com/levy-street/world-of-claudecraft`
  anchors from the title-screen community tray and the footer social row, and
  the matching `sameAs` entries from both JSON-LD blocks in `index.html` and
  the equivalent block `updateSeoMetadata` regenerates in `src/main.ts`. The
  YouTube, X, Instagram, TikTok, and Reddit `sameAs` entries are untouched
  (out of scope for this pass; they carry the old worldofclaudecraft.com
  handles pending a real rebrand of those accounts).
- **Discord in-game surfaces gated off, not deleted:** added
  `src/ui/discord_flags.ts` with a single `DISCORD_SURFACES_ENABLED = false`
  kill switch, ANDed into `main.ts`'s existing `DISCORD_BUILD_ENABLED` gate
  (which already fences the OAuth login button, the first-time login chooser,
  the link/unlink CTA banner, the in-game Discord panel and its U keybind,
  and the keep-account-before-unlink modal), plus an explicit early return in
  `Hud.updateTargetDiscordLine` (`src/ui/hud.ts`) so the target frame's
  `#tf-discord` line never renders a nickname or staff tag. The DOM containers
  (`#tf-discord`, `#discord-window`, `#discord-cta-banner`,
  `#discord-keep-modal`) stay in `index.html`, unmounted. The subsystem itself
  (`discord_widget.ts`, `discord_widget_view.ts`, `discord_status.ts`,
  `discord_deeplink.ts`, the server-side OAuth in `server/discord_oauth.ts`
  and the bot relay) is untouched and retained for a future PHATT Discord
  integration; flip `DISCORD_SURFACES_ENABLED` back to `true` when that lands.
- **Player-visible rename to The Hollow:** `index.html` title, meta
  description, OG / Twitter tags, `apple-mobile-web-app-title`, the hero
  `<h1>`, the main logo alt text, the JSON-LD `name` / `alternateName` fields
  (here and in `main.ts`), and `public/manifest.webmanifest` (`name`,
  `short_name`, `description`). English-only i18n catalog values in
  `src/ui/i18n.catalog/shell.ts` (the `en` block only; the legacy
  non-English blocks in that file are dead code the build does not read,
  left alone) and `src/ui/i18n.catalog/hud_chrome.ts`
  (`discord.panelTitle`), including `serverUnavailable.logoAlt`.
- **Intentionally left ClaudeCraft-branded strings**, out of the stated scope
  for this pass: `src/ui/i18n.catalog/index.ts` (`footer.copyright`,
  `nav.playAria`, `card.defaultRealm`, `card.shareText`,
  `card.nativeShareTitle`), `src/ui/i18n.catalog/game.ts` (`footer.*`,
  `nav.*`), and `src/ui/i18n.catalog/guide.ts` (`brand`, `brandShort`,
  `rights`, wiki prose). These are real player-visible ClaudeCraft strings
  the task did not name; flag for a follow-up branding pass.
- **Logo art landed (Brandon's pick on PHAA-395: weathered old-print wordmark,
  dark-portal mark):** the favicon set, `icon-192.png`, `icon-512.png`,
  `apple-touch-icon.png`, and `favicon.ico` are replaced in place with the
  portal mark; the title / loading / server-unavailable wordmark is the new
  `public/the-hollow-logo.png`; the OG / JSON-LD share image is
  `public/the-hollow-square.webp` (plus a PNG copy); the guide header uses
  `public/the-hollow-guide.webp`. References updated in `index.html`,
  `guide.html`, `src/main.ts`, `src/guide/head.ts`, `src/guide/chrome.ts`,
  `scripts/seo_audit.mjs`, and `tests/server_unavailable.test.ts`. The old
  `woc*` art files are kept on disk because `play.html` (the untouched
  upstream promo entry) still references them. Generator (SVG sources +
  render script) lives outside the repo in the studio workspace. The
  `worldofclaudecraft.com` origin in canonical / OG URLs is unchanged:
  domain migration is a separate pass once The Hollow has a public domain.

Verification: `tsc --noEmit` clean; `tests/client_shell.test.ts`,
`tests/architecture.test.ts`, `tests/localization_fixes.test.ts`,
`tests/discord_server.test.ts`, `tests/discord_deeplink.test.ts`, and
`tests/i18n_completeness.test.ts` green with NODE_ENV unset.

## 2026-07-02: branding deployed to PHATT-RAID (PHAA-397)

Rebuilt `eastbrook-game:phase0` from main at c7923808 (the branding merge) and
recreated the `eastbrook-game` container with the same config (network
phattvip, port 8787, media-cache bind, `PUBLIC_ORIGIN=https://thehollow.phatt.vip`,
restart unless-stopped). Verified live at thehollow.phatt.vip: title and OG
read "The Hollow: Classic-Style Web MMO", `/the-hollow-logo.png` wordmark
serves (200, 91 KB), `favicon.ico` matches the repo's portal-mark hash, zero
donate strings, no `discord.gg` invite links (the remaining Discord markup is
the retained OAuth login flow), no buildkit orphan containers left behind.
