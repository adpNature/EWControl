/** Documento 3, apartado 3.2.3. Interfaz TS pura, sin imports de Angular. */
export interface Machine {
  id: string;
  companyId: string;
  name: string;
}

export interface CreateMachineRequest {
  name: string;
}

export interface UpdateMachineRequest {
  name: string;
}
