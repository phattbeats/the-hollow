// Minimal free-fly camera for the dev-only placement tool: WASD to move,
// hold right mouse to look, Q/E (or Space/Shift) down/up, wheel for speed.

import * as THREE from 'three';

export class FlyCamera {
  readonly camera: THREE.PerspectiveCamera;
  speed = 18; // units per second, wheel-adjustable
  private yaw = 0;
  private pitch = -0.35;
  private looking = false;
  private readonly keys = new Set<string>();

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1500);
  }

  attach(el: HTMLElement): void {
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('mousedown', (e) => {
      if (e.button === 2) this.looking = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2) this.looking = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (!this.looking) return;
      this.yaw -= e.movementX * 0.0032;
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - e.movementY * 0.0032));
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.speed = Math.max(2, Math.min(200, this.speed * (e.deltaY > 0 ? 0.85 : 1.18)));
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  update(dt: number): void {
    const cam = this.camera;
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const move = new THREE.Vector3();
    if (this.keys.has('KeyW')) move.add(fwd);
    if (this.keys.has('KeyS')) move.sub(fwd);
    if (this.keys.has('KeyD')) move.add(right);
    if (this.keys.has('KeyA')) move.sub(right);
    if (this.keys.has('KeyE') || this.keys.has('Space')) move.y += 1;
    if (this.keys.has('KeyQ') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))
      move.y -= 1;
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.speed * dt);
      cam.position.add(move);
    }
  }
}
