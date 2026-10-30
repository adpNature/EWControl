export class ProviderNotSupportedError extends Error {
  constructor(providerType: string) {
    super(
      `El proveedor "${providerType}" todavía no está soportado; solo Simulator y OpcUa están disponibles.`,
    );
    this.name = 'ProviderNotSupportedError';
  }
}
