// Single kill switch for the in-game Discord surfaces (title-screen widget, in-game
// panel, link/unlink CTA banner, keep-account modal, OAuth login/choice flow).
// The Hollow fork keeps the subsystem intact for a future PHATT Discord integration,
// but it stays off by default: flip this back to true (or wire it to a build-time
// env var) once that integration lands. Server-side Discord OAuth is untouched by
// this flag; it only controls what the client mounts or shows.
export const DISCORD_SURFACES_ENABLED = false;
