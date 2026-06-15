import type { Input, TouchMoveInput } from './input';

export const PHONE_TOUCH_QUERY = '(pointer: coarse) and (max-width: 940px), (pointer: coarse) and (max-height: 760px)';
const DEADZONE = 0.22;
const CAMERA_SENSITIVITY = 0.8;

// Haptic feedback: short Vibration-API buzzes so touch actions feel physical.
// On by default (own localStorage key, like music's ev_music_on); try/catch +
// feature-detect guarded so it no-ops on desktop and under Vitest/jsdom.
export const HAPTICS_STORE_KEY = 'woc_haptics_on';
export const HAPTIC_TAP = 10;        // a button press
export const HAPTIC_JOYSTICK = 6;    // grabbing a joystick
export const HAPTIC_CONFIRM = [12, 40, 12]; // haptics toggled back on

type VibrationNavigator = { vibrate?: (pattern: number | number[]) => boolean };

export function loadHapticsEnabled(storage: Pick<Storage, 'getItem'> | null = safeLocalStorage()): boolean {
  if (!storage) return true;
  try {
    return storage.getItem(HAPTICS_STORE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveHapticsEnabled(on: boolean, storage: Pick<Storage, 'setItem'> | null = safeLocalStorage()): void {
  try { storage?.setItem(HAPTICS_STORE_KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
}

/** Fire a haptic pulse when enabled and the Vibration API exists. Returns whether it fired. */
export function triggerHaptic(
  pattern: number | number[],
  enabled: boolean,
  nav: VibrationNavigator | null = typeof navigator !== 'undefined' ? navigator : null,
): boolean {
  if (!enabled || !nav || typeof nav.vibrate !== 'function') return false;
  try {
    return nav.vibrate(pattern);
  } catch {
    return false;
  }
}

function safeLocalStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export interface MobileControlCallbacks {
  onAttackNearest(): void;
  onTarget(): void;
  onInteract(): void;
  onChat(): void;
  onMenu(): void;
  onSocial(): void;
  onArena(): void;
  onQuestLog(): void;
  onSpellbook(): void;
  onTalents(): void;
  onMeters(): void;
  onMap(): void;
}

export function isPhoneTouchDevice(win: Pick<Window, 'matchMedia'> = window): boolean {
  return win.matchMedia(PHONE_TOUCH_QUERY).matches;
}

export function mapJoystickVector(x: number, y: number, deadzone = DEADZONE): TouchMoveInput {
  const mag = Math.hypot(x, y);
  if (mag < deadzone) return { forward: false, back: false, strafeLeft: false, strafeRight: false };
  const axis = deadzone * 0.85;
  return {
    forward: y < -axis,
    back: y > axis,
    strafeLeft: x < -axis,
    strafeRight: x > axis,
  };
}

export class MobileControls {
  private active = false;
  private hapticsOn = loadHapticsEnabled();
  private joyPointer: number | null = null;
  private lookPointer: number | null = null;
  private mq: MediaQueryList | null = null;

  private root = document.getElementById('mobile-controls') as HTMLElement | null;
  private moveJoystick = document.getElementById('mobile-move-joystick') as HTMLElement | null;
  private moveStick = document.getElementById('mobile-move-stick') as HTMLElement | null;
  private cameraJoystick = document.getElementById('mobile-camera-joystick') as HTMLElement | null;
  private cameraStick = document.getElementById('mobile-camera-stick') as HTMLElement | null;

  constructor(private input: Input, private callbacks: MobileControlCallbacks) {}

  start(): void {
    if (!this.root || !this.moveJoystick || !this.moveStick || !this.cameraJoystick || !this.cameraStick) return;
    this.mq = window.matchMedia(PHONE_TOUCH_QUERY);
    this.setActive(this.mq.matches);
    this.mq.addEventListener?.('change', (e) => this.setActive(e.matches));

    this.moveJoystick.addEventListener('pointerdown', (e) => this.onMoveDown(e));
    this.moveJoystick.addEventListener('pointermove', (e) => this.onMoveMove(e));
    this.moveJoystick.addEventListener('pointerup', (e) => this.onMoveEnd(e));
    this.moveJoystick.addEventListener('pointercancel', (e) => this.onMoveEnd(e));

    this.cameraJoystick.addEventListener('pointerdown', (e) => this.onCameraDown(e));
    this.cameraJoystick.addEventListener('pointermove', (e) => this.onCameraMove(e));
    this.cameraJoystick.addEventListener('pointerup', (e) => this.onCameraEnd(e));
    this.cameraJoystick.addEventListener('pointercancel', (e) => this.onCameraEnd(e));

    this.bindButton('mobile-attack-nearest', () => this.callbacks.onAttackNearest());
    this.bindButton('mobile-target', () => this.callbacks.onTarget());
    this.bindButton('mobile-interact', () => this.callbacks.onInteract());
    this.bindButton('mobile-chat', () => this.toggleChat());
    this.bindButton('mobile-menu', () => this.callbacks.onMenu());
    this.bindButton('mobile-social', () => this.callbacks.onSocial());
    this.bindButton('mobile-arena', () => this.callbacks.onArena());
    this.bindButton('mobile-quest', () => this.callbacks.onQuestLog());
    this.bindButton('mobile-spellbook', () => this.callbacks.onSpellbook());
    this.bindButton('mobile-talents', () => this.callbacks.onTalents());
    this.bindButton('mobile-meters', () => this.callbacks.onMeters());
    this.bindButton('mobile-map', () => this.callbacks.onMap());
    this.bindHapticsToggle('mobile-haptics');
    this.bindButton('mobile-more', () => {
      this.root?.classList.toggle('expanded');
      document.body.classList.toggle('mobile-more-open', this.root?.classList.contains('expanded') ?? false);
    });
  }

  private setActive(active: boolean): void {
    this.active = active;
    document.body.classList.toggle('mobile-touch', active);
    if (!active) {
      this.root?.classList.remove('expanded');
      document.body.classList.remove('mobile-more-open', 'mobile-chat-open');
      this.releaseMove();
      this.releaseCamera();
    } else {
      document.body.classList.remove('mobile-chat-open');
    }
  }

  private bindButton(id: string, cb: () => void): void {
    const button = document.getElementById(id);
    button?.addEventListener('click', (e) => {
      if (!this.active) return;
      e.preventDefault();
      triggerHaptic(HAPTIC_TAP, this.hapticsOn);
      cb();
      if (button.closest('#mobile-extra-controls')) {
        this.root?.classList.remove('expanded');
        document.body.classList.remove('mobile-more-open');
      }
    });
  }

  /** The haptics button is a stateful toggle, so it bypasses bindButton (no tray
   *  auto-close, no buzz on the press that turns buzzing off) and reflects state
   *  via aria-pressed + an .is-on class. */
  private bindHapticsToggle(id: string): void {
    const button = document.getElementById(id);
    if (!button) return;
    this.syncHapticsButton(button);
    button.addEventListener('click', (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.hapticsOn = !this.hapticsOn;
      saveHapticsEnabled(this.hapticsOn);
      this.syncHapticsButton(button);
      // confirm with a pulse only when enabling, so the player feels what they turned on
      if (this.hapticsOn) triggerHaptic(HAPTIC_CONFIRM, true);
    });
  }

  private syncHapticsButton(button: HTMLElement): void {
    button.classList.toggle('is-on', this.hapticsOn);
    button.setAttribute('aria-pressed', this.hapticsOn ? 'true' : 'false');
    const label = button.querySelector('.mobile-label');
    if (label) label.textContent = this.hapticsOn ? 'Haptics' : 'Haptics Off';
  }

  private toggleChat(): void {
    document.body.classList.toggle('mobile-chat-open');
    if (document.body.classList.contains('mobile-chat-open')) {
      this.callbacks.onChat();
    } else {
      const input = document.getElementById('chat-input') as HTMLInputElement | null;
      if (input) {
        input.value = '';
        input.style.display = 'none';
        input.blur();
      }
    }
  }

  private onMoveDown(e: PointerEvent): void {
    if (!this.active || this.joyPointer !== null) return;
    e.preventDefault();
    this.joyPointer = e.pointerId;
    triggerHaptic(HAPTIC_JOYSTICK, this.hapticsOn);
    try { this.moveJoystick?.setPointerCapture(e.pointerId); } catch { /* synthetic test event */ }
    this.onMoveMove(e);
  }

  private onMoveMove(e: PointerEvent): void {
    if (!this.active || e.pointerId !== this.joyPointer || !this.moveJoystick || !this.moveStick) return;
    e.preventDefault();
    const r = this.moveJoystick.getBoundingClientRect();
    const radius = Math.max(1, r.width / 2);
    const rawX = (e.clientX - (r.left + radius)) / radius;
    const rawY = (e.clientY - (r.top + radius)) / radius;
    const mag = Math.max(1, Math.hypot(rawX, rawY));
    const x = rawX / mag;
    const y = rawY / mag;
    this.moveStick.style.transform = `translate(${(x * radius * 0.46).toFixed(1)}px, ${(y * radius * 0.46).toFixed(1)}px)`;
    this.input.setTouchMove(mapJoystickVector(x, y));
  }

  private onMoveEnd(e: PointerEvent): void {
    if (e.pointerId !== this.joyPointer) return;
    e.preventDefault();
    this.releaseMove();
  }

  private releaseMove(): void {
    this.joyPointer = null;
    this.input.clearTouchMove();
    if (this.moveStick) this.moveStick.style.transform = '';
  }

  private onCameraDown(e: PointerEvent): void {
    if (!this.active || this.lookPointer !== null) return;
    e.preventDefault();
    this.lookPointer = e.pointerId;
    this.input.setTouchLook(true);
    triggerHaptic(HAPTIC_JOYSTICK, this.hapticsOn);
    try { this.cameraJoystick?.setPointerCapture(e.pointerId); } catch { /* synthetic test event */ }
    this.onCameraMove(e);
  }

  private onCameraMove(e: PointerEvent): void {
    if (!this.active || e.pointerId !== this.lookPointer || !this.cameraJoystick || !this.cameraStick) return;
    e.preventDefault();
    const r = this.cameraJoystick.getBoundingClientRect();
    const radius = Math.max(1, r.width / 2);
    const rawX = (e.clientX - (r.left + radius)) / radius;
    const rawY = (e.clientY - (r.top + radius)) / radius;
    const mag = Math.max(1, Math.hypot(rawX, rawY));
    const x = rawX / mag;
    const y = rawY / mag;
    this.cameraStick.style.transform = `translate(${(x * radius * 0.42).toFixed(1)}px, ${(y * radius * 0.42).toFixed(1)}px)`;
    this.input.setTouchLookVector(mapLookVector(x, y));
  }

  private onCameraEnd(e: PointerEvent): void {
    if (e.pointerId !== this.lookPointer) return;
    e.preventDefault();
    this.releaseCamera();
  }

  private releaseCamera(): void {
    this.lookPointer = null;
    this.input.setTouchLook(false);
    this.input.setTouchLookVector({ x: 0, y: 0 });
    if (this.cameraStick) this.cameraStick.style.transform = '';
  }
}

export function mapLookVector(x: number, y: number, deadzone = DEADZONE): { x: number; y: number } {
  if (Math.hypot(x, y) < deadzone) return { x: 0, y: 0 };
  return { x: x * CAMERA_SENSITIVITY, y: y * CAMERA_SENSITIVITY };
}
