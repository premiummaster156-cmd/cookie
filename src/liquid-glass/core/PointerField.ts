/**
 * Global pointer-light field for web Liquid Glass.
 *
 * Desktop:
 *   A single shared pointer field updates a soft edge light on nearby glass.
 *
 * Touch:
 *   We do not run the desktop field. A single active surface gets a small,
 *   localized "flex" pulse at the exact finger position and follows the finger
 *   while held. It is deliberately CSS-only (no backdrop-filter, no clip-path,
 *   no generated image) so Safari stays responsive.
 */

const elements = new Set<HTMLElement>();
const visible = new Set<HTMLElement>();
const lastGlow = new WeakMap<HTMLElement, number>();
const rectCache = new WeakMap<HTMLElement, DOMRect>();

let rafId = 0;
let pointerX = -1e6;
let pointerY = -1e6;
let listening = false;
let rectsDirty = true;

const FALLOFF = 220;
const TOUCH_ONLY =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: none) and (pointer: coarse)').matches;

const SPREAD = 280;

let pressX = 0;
let pressY = 0;
let pressTarget = 0;
let pressEnergy = 0;
let pressPointerId: number | null = null;
let pressWaveStartedAt = 0;
let pressReleasedAt = 0;
let pressWaveRadius = 18;
let pressRaf = 0;
let pressTouchElement: HTMLElement | null = null;

let observer: IntersectionObserver | null = null;

function ensureObserver(): IntersectionObserver | null {
  if (observer || typeof IntersectionObserver === 'undefined') return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) {
          visible.add(el);
          markRectsDirty(true);
        } else {
          visible.delete(el);
          rectCache.delete(el);
          if ((lastGlow.get(el) ?? 0) !== 0) {
            lastGlow.set(el, 0);
            el.style.setProperty('--lg-glow', '0');
          }
        }
      }
    },
    { rootMargin: `${FALLOFF}px` }
  );
  return observer;
}

function markRectsDirty(shouldSchedule = false): void {
  rectsDirty = true;
  if (shouldSchedule && !TOUCH_ONLY) schedule();
}

function forgetElement(el: HTMLElement): void {
  visible.delete(el);
  elements.delete(el);
  rectCache.delete(el);
  if (pressTouchElement === el) {
    clearTouchStyles(el);
    pressTouchElement = null;
    pressTarget = 0;
    pressEnergy = 0;
  }
}

function refreshRectCache(): void {
  rectsDirty = false;
  for (const el of Array.from(visible)) {
    if (!el.isConnected) {
      forgetElement(el);
      continue;
    }
    rectCache.set(el, el.getBoundingClientRect());
  }
}

function schedule(): void {
  if (rafId || typeof requestAnimationFrame !== 'function') return;
  rafId = requestAnimationFrame(flush);
}

function flush(): void {
  rafId = 0;
  if (TOUCH_ONLY) return;
  if (rectsDirty) refreshRectCache();

  for (const el of Array.from(visible)) {
    if (!el.isConnected) {
      forgetElement(el);
      continue;
    }
    const r = rectCache.get(el);
    if (!r || r.width === 0 || r.height === 0) continue;

    const dx = Math.max(r.left - pointerX, 0, pointerX - r.right);
    const dy = Math.max(r.top - pointerY, 0, pointerY - r.bottom);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const glow = Math.max(0, Math.min(1, 1 - dist / FALLOFF));

    if (glow === 0 && (lastGlow.get(el) ?? 0) === 0) continue;
    lastGlow.set(el, glow);

    const cx = Math.max(0, Math.min(1, (pointerX - r.left) / r.width));
    const cy = Math.max(0, Math.min(1, (pointerY - r.top) / r.height));

    el.style.setProperty('--lg-pointer-x', cx.toFixed(4));
    el.style.setProperty('--lg-pointer-y', cy.toFixed(4));
    el.style.setProperty('--lg-glow', glow.toFixed(4));
  }
}

function findTouchElement(x: number, y: number): HTMLElement | null {
  if (rectsDirty) refreshRectCache();

  let picked: HTMLElement | null = null;
  let pickedArea = Number.POSITIVE_INFINITY;

  const candidates = visible.size > 0 ? visible : elements;
  for (const el of Array.from(candidates)) {
    if (!el.isConnected) {
      forgetElement(el);
      continue;
    }

    let rect = rectCache.get(el);
    if (!rect) {
      rect = el.getBoundingClientRect();
      rectCache.set(el, rect);
    }

    if (rect.width <= 0 || rect.height <= 0) continue;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;

    const area = rect.width * rect.height;
    if (area < pickedArea) {
      picked = el;
      pickedArea = area;
    }
  }

  return picked;
}

function onPointerMove(e: PointerEvent): void {
  if (TOUCH_ONLY) {
    if (pressTarget && (pressPointerId === null || e.pointerId === pressPointerId)) {
      pressX = e.clientX;
      pressY = e.clientY;
      if (!pressRaf) pressRaf = requestAnimationFrame(pressTick);
    }
    return;
  }

  pointerX = e.clientX;
  pointerY = e.clientY;

  if (pressTarget && (pressPointerId === null || e.pointerId === pressPointerId)) {
    pressX = e.clientX;
    pressY = e.clientY;
  }

  schedule();
}

function onPointerGone(): void {
  pointerX = -1e6;
  pointerY = -1e6;
  schedule();
}

function onViewportChange(): void {
  markRectsDirty(!TOUCH_ONLY);
}

function clearTouchStyles(el: HTMLElement): void {
  el.style.removeProperty('--lg-touch-x');
  el.style.removeProperty('--lg-touch-y');
  el.style.removeProperty('--lg-touch-radius');
  el.style.removeProperty('--lg-touch-energy');
}

function stopListeningIfIdle(): void {
  if (!listening || elements.size > 0) return;

  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('blur', onPointerGone);
  document.removeEventListener('pointerleave', onPointerGone);
  window.removeEventListener('pointerdown', onPressDown);
  window.removeEventListener('pointerup', onPressUp);
  window.removeEventListener('pointercancel', onPressUp);
  window.removeEventListener('resize', onViewportChange);
  window.removeEventListener('scroll', onViewportChange, { capture: true } as EventListenerOptions);

  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (pressRaf) {
    cancelAnimationFrame(pressRaf);
    pressRaf = 0;
  }

  pressTouchElement = null;
  pressPointerId = null;
  pressTarget = 0;
  pressEnergy = 0;
  listening = false;
  rectsDirty = true;
}

function onPressDown(e: PointerEvent): void {
  if (TOUCH_ONLY) {
    if (e.pointerType === 'mouse') return;

    const target = findTouchElement(e.clientX, e.clientY);
    if (!target) return;

    pressTouchElement = target;
    pressX = e.clientX;
    pressY = e.clientY;
    pressPointerId = e.pointerId;
    pressTarget = 1;
    pressEnergy = 0;
    pressWaveStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    pressReleasedAt = pressWaveStartedAt;
    pressWaveRadius = 18;

    if (!pressRaf) pressRaf = requestAnimationFrame(pressTick);
    return;
  }

  pressX = e.clientX;
  pressY = e.clientY;
  pressPointerId = e.pointerId;
  pressTarget = 1;
  pressWaveStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  pressWaveRadius = 22;
  if (!pressRaf) pressRaf = requestAnimationFrame(pressTick);
}

function onPressUp(e?: PointerEvent): void {
  if (e && pressPointerId !== null && e.pointerId !== pressPointerId) return;

  pressTarget = 0;
  pressReleasedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  pressPointerId = null;

  if (!pressRaf) pressRaf = requestAnimationFrame(pressTick);
}

function pressTick(): void {
  pressRaf = 0;

  const rising = pressTarget > pressEnergy;
  pressEnergy += (pressTarget - pressEnergy) * (rising ? 0.4 : 0.12);
  if (pressEnergy < 0.004 && pressTarget === 0) pressEnergy = 0;

  if (TOUCH_ONLY) {
    const el = pressTouchElement;

    if (el && el.isConnected) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const ix = Math.max(0, Math.min(1, (pressX - rect.left) / rect.width));
        const iy = Math.max(0, Math.min(1, (pressY - rect.top) / rect.height));

        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (pressTarget) {
          const elapsed = Math.max(0, now - pressWaveStartedAt);
          const breath = 0.5 - 0.5 * Math.cos((elapsed / 620) * Math.PI * 2);
          pressWaveRadius = 17 + breath * 11;
          const energy = Math.min(0.72, pressEnergy * (0.65 + breath * 0.25));

          el.style.setProperty('--lg-touch-x', ix.toFixed(4));
          el.style.setProperty('--lg-touch-y', iy.toFixed(4));
          el.style.setProperty('--lg-touch-radius', `${Math.round(pressWaveRadius)}px`);
          el.style.setProperty('--lg-touch-energy', energy.toFixed(4));
        } else {
          const releaseT = Math.min(1, Math.max(0, (now - pressReleasedAt) / 420));
          pressWaveRadius = 19 + releaseT * 54;
          const energy = pressEnergy * (1 - releaseT) * (1 - releaseT);

          el.style.setProperty('--lg-touch-x', ix.toFixed(4));
          el.style.setProperty('--lg-touch-y', iy.toFixed(4));
          el.style.setProperty('--lg-touch-radius', `${Math.round(pressWaveRadius)}px`);
          el.style.setProperty('--lg-touch-energy', energy.toFixed(4));

          if (releaseT >= 1 || pressEnergy === 0) {
            clearTouchStyles(el);
            pressTouchElement = null;
            pressEnergy = 0;
            pressTarget = 0;
            pressRaf = 0;
            return;
          }
        }
      }
    } else {
      pressTouchElement = null;
    }

    if (pressTarget || pressTouchElement) {
      pressRaf = requestAnimationFrame(pressTick);
    }
    return;
  }

  if (rectsDirty) refreshRectCache();

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const elapsed = Math.max(0, now - pressWaveStartedAt);
  const cycle = pressTarget ? (elapsed % 720) / 720 : Math.min(1, elapsed / 520);
  const wavePulse = pressTarget ? 0.5 - 0.5 * Math.cos(cycle * Math.PI * 2) : 1;
  pressWaveRadius = pressTarget ? 22 + wavePulse * 58 : pressWaveRadius + 3.2;
  const waveEnergy =
    pressEnergy * (pressTarget ? 0.42 + wavePulse * 0.32 : Math.max(0, 1 - cycle));

  for (const el of Array.from(visible)) {
    if (!el.isConnected) {
      forgetElement(el);
      continue;
    }
    const r = rectCache.get(el);
    if (!r || r.width === 0 || r.height === 0) continue;

    const dx = Math.max(r.left - pressX, 0, pressX - r.right);
    const dy = Math.max(r.top - pressY, 0, pressY - r.bottom);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const prox = Math.max(0, 1 - dist / SPREAD);
    const illum = pressEnergy * prox * prox;

    if (illum === 0 && (lastGlow.get(el) ?? 0) === 0) continue;

    const ix = Math.max(0, Math.min(1, (pressX - r.left) / r.width));
    const iy = Math.max(0, Math.min(1, (pressY - r.top) / r.height));

    el.style.setProperty('--lg-illum', illum.toFixed(4));
    el.style.setProperty('--lg-illum-x', ix.toFixed(4));
    el.style.setProperty('--lg-illum-y', iy.toFixed(4));
    el.style.setProperty('--lg-wave-x', ix.toFixed(4));
    el.style.setProperty('--lg-wave-y', iy.toFixed(4));
    el.style.setProperty('--lg-wave-radius', Math.round(pressWaveRadius) + 'px');
    el.style.setProperty('--lg-wave-energy', waveEnergy.toFixed(4));
  }

  if (pressEnergy > 0 || pressTarget > 0 || waveEnergy > 0.004) {
    pressRaf = requestAnimationFrame(pressTick);
  }
}

export function registerPointerLight(el: HTMLElement): void {
  if (typeof window === 'undefined') return;

  elements.add(el);
  markRectsDirty();

  const io = ensureObserver();
  if (io) {
    io.observe(el);
  } else {
    visible.add(el);
    markRectsDirty(!TOUCH_ONLY);
  }

  if (!listening) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPressDown, { passive: true });
    window.addEventListener('pointerup', onPressUp, { passive: true });
    window.addEventListener('pointercancel', onPressUp, { passive: true });
    window.addEventListener('resize', onViewportChange, { passive: true });

    if (!TOUCH_ONLY) {
      window.addEventListener('blur', onPointerGone);
      document.addEventListener('pointerleave', onPointerGone);
      window.addEventListener(
        'scroll',
        onViewportChange,
        { passive: true, capture: true }
      );
    }

    listening = true;
  }

  if (!TOUCH_ONLY) schedule();
}

export function unregisterPointerLight(el: HTMLElement): void {
  elements.delete(el);
  visible.delete(el);
  rectCache.delete(el);
  observer?.unobserve(el);

  el.style.removeProperty('--lg-glow');
  el.style.removeProperty('--lg-pointer-x');
  el.style.removeProperty('--lg-pointer-y');
  el.style.removeProperty('--lg-illum');
  el.style.removeProperty('--lg-illum-x');
  el.style.removeProperty('--lg-illum-y');
  el.style.removeProperty('--lg-wave-x');
  el.style.removeProperty('--lg-wave-y');
  el.style.removeProperty('--lg-wave-radius');
  el.style.removeProperty('--lg-wave-energy');
  clearTouchStyles(el);

  if (pressTouchElement === el) {
    pressTouchElement = null;
    pressPointerId = null;
    pressTarget = 0;
    pressEnergy = 0;
  }

  stopListeningIfIdle();
}
