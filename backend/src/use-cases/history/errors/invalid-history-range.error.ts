export class InvalidHistoryRangeError extends Error {
  constructor(from: Date, to: Date) {
    super(
      `El rango de histórico es inválido: from (${from.toISOString()}) >= to (${to.toISOString()}).`,
    );
    this.name = 'InvalidHistoryRangeError';
  }
}
