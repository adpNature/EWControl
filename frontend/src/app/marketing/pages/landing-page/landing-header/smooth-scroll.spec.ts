import { animateScrollTo, easeInOutQuad } from './smooth-scroll';

describe('easeInOutQuad', () => {
  it('empieza y termina exactamente en los extremos', () => {
    expect(easeInOutQuad(0)).toBe(0);
    expect(easeInOutQuad(1)).toBe(1);
  });

  it('acelera en la primera mitad (avanza menos que el tiempo transcurrido)', () => {
    expect(easeInOutQuad(0.25)).toBeLessThan(0.25);
  });

  it('frena en la segunda mitad (avanza más que el tiempo transcurrido)', () => {
    expect(easeInOutQuad(0.75)).toBeGreaterThan(0.75);
  });

  it('es simétrica respecto al punto medio', () => {
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5);
  });
});

describe('animateScrollTo', () => {
  let rafCallbacks: FrameRequestCallback[];
  let scrollToSpy: ReturnType<typeof vi.fn<(x: number, y: number) => void>>;

  beforeEach(() => {
    rafCallbacks = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    scrollToSpy = vi.fn<(x: number, y: number) => void>();
    vi.spyOn(window, 'scrollTo').mockImplementation(scrollToSpy);
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(0);
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function runFrame(time: number) {
    vi.spyOn(performance, 'now').mockReturnValue(time);
    const callback = rafCallbacks.shift();
    callback?.(time);
  }

  it('anima el scroll en varios frames con easing y se detiene al llegar al destino', () => {
    animateScrollTo(600, 600);

    runFrame(0);
    expect(scrollToSpy).toHaveBeenNthCalledWith(1, 0, 0);

    runFrame(300);
    expect(scrollToSpy).toHaveBeenNthCalledWith(2, 0, 300);

    runFrame(600);
    expect(scrollToSpy).toHaveBeenNthCalledWith(3, 0, 600);

    // Al llegar a progress = 1 deja de pedir más frames.
    expect(rafCallbacks).toHaveLength(0);
  });
});
