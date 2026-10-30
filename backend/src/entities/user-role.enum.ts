export enum UserRole {
  SuperAdmin = 'SuperAdmin',
  AdminCliente = 'AdminCliente',
  /**
   * docs/specs/19-rol-operador.md: ve la planta (Dashboard, Históricos,
   * Alarmas), reconoce alarmas y ejecuta paquetes de escritura; no configura nada.
   */
  Operador = 'Operador',
}
