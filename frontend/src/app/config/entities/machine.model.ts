import { ProviderType } from './machine-connection.model';

/** Documento 3, apartado 3.2.3. Interfaz TS pura, sin imports de Angular. */
export interface Machine {
  id: string;
  companyId: string;
  name: string;
  /** docs/specs/18-integracion-opc-ua.md, criterio backend 12; `null` si no tiene conexión. */
  providerType?: ProviderType | null;
}

export interface CreateMachineRequest {
  name: string;
}

export interface UpdateMachineRequest {
  name: string;
}
