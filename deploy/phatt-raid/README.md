# PHATT-RAID deployment

This directory used to hold a `deploy.sh` + `compose.phatt-raid.yml` pair added
2026-07-01 during the initial fork setup. They were never exercised and had
drifted from reality: they targeted container names `the-hollow-game`/
`the-hollow-db` and the domain `theplant.phatt.vip`, while the actual live
stack runs as `eastbrook-game`/`eastbrook-db` on `thehollow.phatt.vip`.
Running the old script would have built and started a second, parallel stack
next to the real one. They have been removed rather than patched, because the
real deploy does not use compose at all (see below), so a "fixed" compose
file would just be more unexercised code.

## Why not compose

The phatt-claw socket proxy (`http://phatt-claw:2375`) that agents talk to
allows image build/pull and `containers/create|start|stop|rm|logs|inspect`,
but returns 403 on every `/networks*` and `/volumes*` endpoint, including
GET. `docker compose` needs those endpoints to resolve the network and
volumes sections of the compose file, so it cannot run at all through this
proxy. Deploys are therefore plain `docker run`-equivalent calls against the
proxy's HTTP API.

## The real, currently-live stack

- `eastbrook-db`: `postgres:16-alpine`, network `phattvip`, pgdata bind
  `/mnt/user/appdata/the-hollow/pgdata`, no published port.
- `eastbrook-game`: built from this repo, network `phattvip`, published
  `-p 8787:8787` (LAN only), media bind
  `/mnt/user/appdata/the-hollow/media-cache` (must be `chown 1000:1000` or
  the container crash-loops). `ALLOW_DEV_COMMANDS` unset. Public URL
  `https://thehollow.phatt.vip` via an existing SWAG reverse proxy on the
  `phattvip` network (SWAG is managed by Brandon directly; agents cannot
  touch it, since phatt-claw blocks both `/networks*` and container `exec`).

Both containers carry the `phattclaw.managed=true` label. The image tag and
`PUBLIC_ORIGIN` actually running are tracked in `the-hollow-deploy/.env`
(POSTGRES_PASSWORD, PUBLIC_ORIGIN, PUBLIC_GAME_URL, EASTBROOK_IMAGE_TAG) on
the host, next to this repo checkout; keep that file in sync with whatever
tag is live, it is not derived from anything checked in here.

## Build + redeploy recipe

No local Docker CLI is required; talk to the proxy over plain HTTP.

1. Tar the build context by hand (package.json, package-lock.json,
   `.browserslistrc`, tsconfig.json, vite.config.ts, the four HTML entries,
   `src/ server/ bot/ headless/ public/ private/ scripts/ Dockerfile`, i.e.
   whatever `.dockerignore` leaves in; skip `node_modules/ .git/ tests/ docs/
   deploy/*.md`).
2. `curl -X POST "http://phatt-claw:2375/build?t=eastbrook-game:<tag>&rm=1" -H "Content-Type: application/x-tar" --data-binary @ctx.tar.gz`
   (a raw HTTP build; it does not spawn a buildx sidecar, so there is no
   orphan container to clean up afterward).
3. `POST /containers/eastbrook-game/stop`, `DELETE /containers/eastbrook-game`.
4. `POST /containers/create?name=eastbrook-game` with the same Env/Labels/
   HostConfig as the outgoing container (inspect it first to copy exactly),
   then `POST /containers/{id}/start`.
5. Verify with `curl -s https://thehollow.phatt.vip/api/status` and grep the
   served bundle for a marker string unique to the new feature.
6. Update `the-hollow-deploy/.env`'s `EASTBROOK_IMAGE_TAG` to the new tag.

For the generic, non-RAID self-host path (a single cloud instance you fully
control, where compose works fine) see `DEPLOY.md` at the repo root.
