import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HUB_AMBIENT_TRACKS, type HubAmbientTrack } from '../src/game/hub_ambient_playlist';
import {
  dungeonMusicZoneForDungeon,
  MusicDirector,
  musicZoneForLocation,
  shouldResetMusicForDungeonEntry,
} from '../src/game/music';

class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  loop = false;
  preload = '';
  volume = 1;
  currentTime = 0;
  duration = NaN;
  paused = false;
  play = vi.fn(async () => undefined);
  pause = vi.fn(() => {
    this.paused = true;
  });
  addEventListener = vi.fn();

  constructor(src: string) {
    this.src = src;
    FakeAudio.instances.push(this);
  }
}

class FakeParam {
  value = 0;
  setTargetAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

class FakeNode {
  connect = vi.fn(() => this);
  disconnect = vi.fn();
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeBufferSource extends FakeNode {
  static instances: FakeBufferSource[] = [];
  buffer: unknown = null;
  loop = false;
  start = vi.fn();
  stop = vi.fn();

  constructor() {
    super();
    FakeBufferSource.instances.push(this);
  }
}

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  decodeAudioData = vi.fn(async () => ({ decoded: true }));
  createGain = vi.fn(() => new FakeGain());
  createDynamicsCompressor = vi.fn(() => ({
    ...new FakeNode(),
    threshold: new FakeParam(),
    knee: new FakeParam(),
    ratio: new FakeParam(),
    attack: new FakeParam(),
    release: new FakeParam(),
  }));
  createConvolver = vi.fn(() => ({ ...new FakeNode(), buffer: null }));
  createBuffer = vi.fn((_channels: number, length: number) => ({
    getChannelData: () => new Float32Array(length),
  }));
  createBufferSource = vi.fn(() => new FakeBufferSource());
  resume = vi.fn(async () => undefined);
}

describe('MusicDirector — combat / background mix', () => {
  let director: MusicDirector;

  beforeEach(() => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('window', { setInterval: vi.fn(() => 1) });
    director = new MusicDirector();
    director.init();
  });

  afterEach(() => {
    clearInterval((director as unknown as { timer: number }).timer);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeBufferSource.instances = [];
  });

  const layers = () =>
    (
      director as unknown as {
        layers: Record<string, { target: number }>;
      }
    ).layers;

  it('plays the zone theme and no combat layer when out of combat', () => {
    director.update('vale', false);
    expect(layers().vale.target).toBe(1);
    expect(layers().combat.target).toBe(0);
  });

  it('silences the zone theme so ONLY combat music plays in combat (no layering)', () => {
    director.update('vale', false);
    director.update('vale', true);
    expect(layers().vale.target).toBe(0);
    expect(layers().combat.target).toBe(1);
  });

  it('restores the background theme and drops combat when combat ends', () => {
    director.update('vale', true);
    director.update('vale', false);
    expect(layers().vale.target).toBe(1);
    expect(layers().combat.target).toBe(0);
  });

  it('never runs the zone and combat layers at non-zero gain simultaneously', () => {
    for (const inCombat of [false, true, false, true]) {
      director.update('vale', inCombat);
      const zone = layers().vale.target;
      const combat = layers().combat.target;
      expect(Math.min(zone, combat)).toBe(0);
    }
  });
});

describe('MusicDirector boss combat loop', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeBufferSource.instances = [];
  });

  it('loads and loops the boss track through the unlocked music AudioContext', async () => {
    const fetchMock = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { setInterval: vi.fn(() => 1) });

    const director = new MusicDirector();
    director.init();
    director.setBossCombat(true);
    for (let i = 0; i < 10 && FakeBufferSource.instances.length === 0; i++) {
      await Promise.resolve();
    }

    expect(fetchMock).toHaveBeenCalledWith('/audio/dungeon-boss-fight.mp3');
    const source = FakeBufferSource.instances[0];
    expect(source.loop).toBe(true);
    expect(source.start).toHaveBeenCalledTimes(1);

    director.setBossCombat(false);
    expect(source.stop).toHaveBeenCalledTimes(1);
    expect(source.disconnect).toHaveBeenCalledTimes(1);
  });
});

describe('dungeon music entry reset', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeBufferSource.instances = [];
  });

  it('resets only when entering a dungeon or changing dungeon instances', () => {
    expect(shouldResetMusicForDungeonEntry(null, 'nythraxis_boss_arena')).toBe(true);
    expect(shouldResetMusicForDungeonEntry('nythraxis_boss_arena', 'nythraxis_boss_arena')).toBe(
      false,
    );
    expect(shouldResetMusicForDungeonEntry('nythraxis_boss_arena', 'hollow_crypt')).toBe(true);
    expect(shouldResetMusicForDungeonEntry('nythraxis_boss_arena', null)).toBe(false);
  });

  it('rewinds the active dungeon layer and boss loop on dungeon entry', () => {
    const director = new MusicDirector();
    const layer = { target: 1, anchor: 100, nextIdx: 7, loopCount: 3 };
    const bossElement = { currentTime: 19 };
    (director as unknown as { ctx: { currentTime: number } }).ctx = { currentTime: 42 };
    (director as unknown as { layers: Record<string, typeof layer> }).layers = {
      dungeon_hollow_crypt: layer,
    };
    (director as unknown as { bossElement: typeof bossElement }).bossElement = bossElement;

    director.resetForDungeonEntry('nythraxis_boss_arena');

    expect(dungeonMusicZoneForDungeon('nythraxis_boss_arena')).toBe('dungeon_hollow_crypt');
    expect(layer.nextIdx).toBe(-1);
    expect(layer.loopCount).toBe(0);
    expect(layer.anchor).toBe(42);
    expect(bossElement.currentTime).toBe(0);
  });
});

describe('world music zone selection', () => {
  it('uses the original Eastbrook Vale wilderness theme in Thornpeak Heights', () => {
    expect(musicZoneForLocation('thornpeak_heights', 'peaks', false, false)).toBe('vale_legacy');
  });

  it('keeps the Thornpeak hub on the Highwatch town theme', () => {
    expect(musicZoneForLocation('thornpeak_heights', 'peaks', true, false)).toBe('town_highwatch');
  });
});

describe('hub ambient cycler zone selection (PHAA-435)', () => {
  afterEach(() => {
    HUB_AMBIENT_TRACKS.length = 0;
  });

  it('falls back to the plain vale bed while no tracks are configured (no-op today)', () => {
    expect(HUB_AMBIENT_TRACKS.length).toBe(0);
    expect(musicZoneForLocation('the_hollow_reaches', 'vale', true, false)).toBe('vale');
  });

  it('switches the hub to the ambient cycler once tracks land', () => {
    HUB_AMBIENT_TRACKS.push({ id: 'dawn', src: '/audio/hub_ambient/dawn.mp3' });
    expect(musicZoneForLocation('the_hollow_reaches', 'vale', true, false)).toBe('hollow_hub');
  });

  it('leaves wilderness (out of hub) on the vale bed even with tracks configured', () => {
    HUB_AMBIENT_TRACKS.push({ id: 'dawn', src: '/audio/hub_ambient/dawn.mp3' });
    expect(musicZoneForLocation('the_hollow_reaches', 'vale', false, false)).toBe('vale');
  });
});

describe('MusicDirector hub ambient playback (PHAA-435)', () => {
  afterEach(() => {
    HUB_AMBIENT_TRACKS.length = 0;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeAudio.instances = [];
    FakeBufferSource.instances = [];
  });

  const setup = (): MusicDirector => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('window', { setInterval: vi.fn(() => 1), clearInterval: vi.fn() });
    const director = new MusicDirector();
    director.init();
    return director;
  };

  it('is a no-op when no tracks are configured', () => {
    const director = setup();
    director.update('hollow_hub', false);
    expect((director as unknown as { hubAmbientActive: boolean }).hubAmbientActive).toBe(false);
    expect(FakeAudio.instances.length).toBe(0);
  });

  it('starts a track from the recorded playlist when the hub zone is reached', () => {
    const track: HubAmbientTrack = { id: 'dawn', src: '/audio/hub_ambient/dawn.mp3' };
    HUB_AMBIENT_TRACKS.push(track);
    const director = setup();
    director.update('hollow_hub', false);
    expect((director as unknown as { hubAmbientActive: boolean }).hubAmbientActive).toBe(true);
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe(track.src);
    expect(FakeAudio.instances[0].loop).toBe(true); // single-track list loops in place
    expect(FakeAudio.instances[0].play).toHaveBeenCalledTimes(1);
  });

  it('stops the ambient track and ducks back out when leaving the hub', () => {
    HUB_AMBIENT_TRACKS.push({ id: 'dawn', src: '/audio/hub_ambient/dawn.mp3' });
    const director = setup();
    director.update('hollow_hub', false);
    director.update('vale', false);
    expect((director as unknown as { hubAmbientActive: boolean }).hubAmbientActive).toBe(false);
    expect(FakeAudio.instances[0].pause).toHaveBeenCalled();
  });

  it('silences the ambient cycler during combat and resumes after', () => {
    HUB_AMBIENT_TRACKS.push({ id: 'dawn', src: '/audio/hub_ambient/dawn.mp3' });
    const director = setup();
    director.update('hollow_hub', false);
    director.update('hollow_hub', true);
    expect((director as unknown as { hubAmbientActive: boolean }).hubAmbientActive).toBe(false);
    director.update('hollow_hub', false);
    expect((director as unknown as { hubAmbientActive: boolean }).hubAmbientActive).toBe(true);
  });
});
