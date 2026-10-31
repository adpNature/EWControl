/**
 * Resultado global de ejecutar un paquete de escritura
 * (docs/specs/20-paquetes-escritura-opc-ua.md): todos los valores aceptados,
 * algunos, o ninguno (incluidas las ejecuciones rechazadas antes de escribir).
 */
export enum WritePackageExecutionStatus {
  Success = 'SUCCESS',
  Partial = 'PARTIAL',
  Failed = 'FAILED',
}
