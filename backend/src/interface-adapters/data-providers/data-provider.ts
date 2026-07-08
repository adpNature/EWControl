import type { Variable } from './variable.vo';

export type VariableListener = (variable: Variable) => void;

/**
 * Contrato común a todo Data Provider (Documento 2, apartado 2.4, "Interfaz Común").
 * Permite al resto de la plataforma trabajar con cualquier proveedor sin conocer
 * el protocolo o el Source concreto que hay detrás.
 */
export interface IDataProvider {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  subscribe(listener: VariableListener): void;
  unsubscribe(listener: VariableListener): void;
}
