/** spec 20, criterio backend 2: valor fuera de tipo o límites, o variable no escribible. */
export class InvalidWritePackageError extends Error {
  constructor(
    readonly reason: string,
    readonly index: number,
  ) {
    super(`El paquete no es válido (elemento ${index}): ${reason}.`);
    this.name = 'InvalidWritePackageError';
  }
}
