/**
 * Ease-in-out cuadrático: acelera en la primera mitad del recorrido y frena en
 * la segunda, en vez del salto instantáneo del navegador o la curva fija (no
 * configurable) de `scroll-behavior: smooth` (docs/specs/17-landing-page.md).
 */
export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Anima el scroll vertical de la página hasta `targetY` usando `easeInOutQuad`. */
export function animateScrollTo(targetY: number, duration = 600): void {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const startTime = performance.now();

  function step(now: number): void {
    const progress = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, startY + distance * easeInOutQuad(progress));

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}
