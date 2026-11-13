export type ReconnectionPolicyOptions = {
  /** Cortes dentro de `windowMs` que provocan una pausa. */
  maxDisconnections: number;
  windowMs: number;
  initialPauseMs: number;
  maxPauseMs: number;
  /** Tiempo conectado sin cortes tras el que la pausa vuelve a `initialPauseMs`. */
  stableMs: number;
};

/** Valores de docs/specs/24-conexion-opc-ua-estable.md. */
export const RECONNECTION_POLICY_DEFAULTS: ReconnectionPolicyOptions = {
  maxDisconnections: 3,
  windowMs: 5 * 60_000,
  initialPauseMs: 60_000,
  maxPauseMs: 15 * 60_000,
  stableMs: 10 * 60_000,
};

export type ReconnectionDecision = { pause: false } | { pause: true; delayMs: number };

/**
 * Freno de reconexiones (docs/specs/24-conexion-opc-ua-estable.md, criterio 4):
 * si la conexión con un servidor OPC UA se pierde demasiadas veces seguidas,
 * el driver deja de reconectar y espera una pausa creciente. Pura: el reloj se
 * inyecta y no programa temporizadores.
 */
export class ReconnectionPolicy {
  private disconnections: number[] = [];
  private pauseLevel = 0;
  private connectedAt: number | null = null;

  constructor(
    private readonly now: () => number,
    private readonly options: ReconnectionPolicyOptions = RECONNECTION_POLICY_DEFAULTS,
  ) {}

  /** La sesión y la Subscription vuelven a estar operativas. */
  recordConnected(): void {
    this.connectedAt = this.now();
  }

  /** Se ha perdido la conexión: decide si hay que pausar y cuánto. */
  recordDisconnection(): ReconnectionDecision {
    const now = this.now();
    if (this.connectedAt !== null && now - this.connectedAt >= this.options.stableMs) {
      this.pauseLevel = 0;
      this.disconnections = [];
    }
    this.connectedAt = null;
    this.disconnections = [
      ...this.disconnections.filter((at) => now - at < this.options.windowMs),
      now,
    ];
    if (this.disconnections.length < this.options.maxDisconnections) {
      return { pause: false };
    }
    const delayMs = Math.min(
      this.options.initialPauseMs * 2 ** this.pauseLevel,
      this.options.maxPauseMs,
    );
    this.pauseLevel += 1;
    this.disconnections = [];
    return { pause: true, delayMs };
  }
}
