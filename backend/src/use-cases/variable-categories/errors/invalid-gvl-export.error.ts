/**
 * docs/specs/23-categorias-variables-plc.md: la exportación CSV de la GVL o la
 * carpeta indicada no son válidas, o superan los límites. No se modifica nada.
 */
export class InvalidGvlExportError extends Error {
  constructor(readonly reason: string) {
    super(`La exportación de la GVL no es válida: ${reason}`);
    this.name = 'InvalidGvlExportError';
  }
}
