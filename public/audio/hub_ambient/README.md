# hub_ambient/

Drop the ambient mixes here to wire up the Hollow Reaches hub music cycler
(PHAA-435). The cycler is already implemented and gated behind an empty
`HUB_AMBIENT_TRACKS` list, so the moment you land the files this directory
becomes the active bed for the hub (the shrine-gate clearing) and rotates
through them with anti-repeat selection and a short crossfade.

## Naming

Use lowercase, hyphenated filenames that read as a label, not a number:

  dawn.mp3
  dusk.mp3
  rain-on-the-vale.mp3
  wind-through-the-reaches.mp3

Anything in `public/audio/hub_ambient/` is served at the same path under
`/audio/hub_ambient/...`, matching how the boss loop loads
`/audio/dungeon-boss-fight.mp3`. The cycler picks entries off
`HUB_AMBIENT_TRACKS` in `src/game/hub_ambient_playlist.ts`; once populated
the hub is live, no further code change required.

## Format

  container:   MP3 (matches the existing recorded assets in public/audio/)
  bit depth:   16-bit
  sample rate: 44.1 kHz
  channels:    stereo preferred, mono accepted
  length:      90 to 240 seconds (longer loops waste idle bandwidth, shorter
               loops crossfade too often to settle)
  loudness:    target -16 LUFS integrated, true peak under -1 dBTP (matches
               the rest of the BGM bed; the cycler applies its own gain)

OGG or WAV are not supported by the cycler today. If you only have OGG/WAV,
drop them here anyway and flag it on PHAA-435 and I will add the format.

## Volume

The cycler ducks the procedural score to ~50 percent while a hub mix is
playing (matches the boss-fight duck in `MusicDirector`). Mix accordingly:
leave ~3 dB of headroom against the procedural bed so the swap back to the
biome theme (when you leave the hub) feels even, not jumpy.

## What to wire next

After dropping the files:

1. Add one `HubAmbientTrack` entry per file to `HUB_AMBIENT_TRACKS` in
   `src/game/hub_ambient_playlist.ts`:

   ```ts
   export const HUB_AMBIENT_TRACKS: HubAmbientTrack[] = [
     { id: 'dawn',  src: '/audio/hub_ambient/dawn.mp3' },
     { id: 'dusk',  src: '/audio/hub_ambient/dusk.mp3' },
     // ...
   ];
   ```

2. Run `npm run i18n:gen` if any new strings were introduced (none expected
   for this change), then `npm test` and `npm run check:ts`.

3. Open a PR against `main`. The cycler activates the moment the list is
   non-empty, so a single PR (no flag, no env var) is enough.

## Where this lives in the design

Per `docs/plan-the-hollow-v3.md`, the hub is a hangout, not a combat zone,
and the soundtrack should reward staying: low-key, slowly evolving, and
distinct from the wilderness beds the players will pass through on the way
in and out. The cycler exists to make that distinction audible without
adding a second composer slot to the live audio budget.