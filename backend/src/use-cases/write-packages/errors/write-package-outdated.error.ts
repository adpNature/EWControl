/** spec 20, criterio backend 5: la config de la Machine ha cambiado desde que se creó el paquete. */
export class WritePackageOutdatedError extends Error {
  constructor(readonly reason: string) {
    super(`El paquete ya no es válido con la configuración actual de la Machine: ${reason}.`);
    this.name = 'WritePackageOutdatedError';
  }
}
