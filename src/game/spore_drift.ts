// Bioluminescent spore login-screen backdrop candidate (PHAA-406). Similar DOM-
// particle mechanic to the .ember background in main.ts (a handful of
// CSS-animated dots), but each spore hovers and drifts gently in place near
// where it spawns, rather than sweeping the full viewport height, so it stays
// visible instead of fading out while still crossing into frame. Takes only a
// container element so it can be mounted anywhere and previewed standalone via
// ?bg=spore-drift.

export function mountSporeDrift(backdrop: HTMLElement, count = 28): void {
  const container = document.createElement('div');
  container.className = 'spore-drift-container';
  backdrop.appendChild(container);

  for (let i = 0; i < count; i++) {
    const spore = document.createElement('div');
    spore.className = 'spore';
    spore.style.left = `${Math.random() * 100}%`;
    spore.style.top = `${Math.random() * 80 + 5}%`;

    const size = Math.random() * 6 + 4;
    spore.style.width = `${size}px`;
    spore.style.height = `${size}px`;

    spore.style.setProperty('--spore-rise', `${Math.random() * 40 + 30}px`);
    spore.style.setProperty('--spore-drift', `${Math.random() * 60 - 30}px`);
    spore.style.setProperty('--spore-opacity', `${Math.random() * 0.35 + 0.55}`);

    spore.style.animationDelay = `${Math.random() * 8}s`;
    spore.style.animationDuration = `${Math.random() * 8 + 12}s`;

    container.appendChild(spore);
  }
}
