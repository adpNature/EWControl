export class WritePackageNotFoundError extends Error {
  constructor(packageId: string) {
    super(`El paquete de escritura ${packageId} no existe.`);
    this.name = 'WritePackageNotFoundError';
  }
}
