/** Documento 3, apartado 3.2.1. Interfaz TS pura, sin imports de Angular. */
export interface Company {
  id: string;
  name: string;
  isActive: boolean;
}

export interface CreateCompanyRequest {
  name: string;
}

export interface UpdateCompanyRequest {
  name: string;
}
