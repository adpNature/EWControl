/** spec 21: tras guardar, el `nodeMapping` superaría su máximo de entradas. */
export class OpcUaMappingLimitError extends Error {
  constructor(
    readonly resultingEntries: number,
    readonly maxEntries: number,
  ) {
    super(`El mapeo superaría el máximo de ${maxEntries} variables (${resultingEntries}).`);
    this.name = 'OpcUaMappingLimitError';
  }
}
