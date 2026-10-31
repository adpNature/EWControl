/** docs/specs/20-paquetes-escritura-opc-ua.md: 422 WRITE_PACKAGE_NOT_FOUND para un widget `PACKAGE`. */
export class WritePackageNotFoundForWidgetError extends Error {
  constructor(public readonly writePackageId: string) {
    super(
      `El paquete de escritura ${writePackageId} no existe, no está activo o es de otra Company.`,
    );
    this.name = 'WritePackageNotFoundForWidgetError';
  }
}
