/** spec 21: el recorrido de la carpeta superó su tiempo máximo; la sesión ya se ha cerrado. */
export class OpcUaSyncTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`La máquina no ha terminado de responder en ${timeoutMs / 1000} s.`);
    this.name = 'OpcUaSyncTimeoutError';
  }
}
