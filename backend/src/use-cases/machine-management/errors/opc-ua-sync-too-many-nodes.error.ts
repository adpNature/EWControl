/** spec 21: la carpeta tiene más variables de las permitidas en una sincronización (OWASP A04). */
export class OpcUaSyncTooManyNodesError extends Error {
  constructor(readonly maxVariables: number) {
    super(`La carpeta tiene más de ${maxVariables} variables: elige una carpeta más concreta.`);
    this.name = 'OpcUaSyncTooManyNodesError';
  }
}
