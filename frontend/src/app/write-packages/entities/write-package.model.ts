/**
 * docs/specs/20-paquetes-escritura-opc-ua.md. Interfaces TS puras, sin imports de Angular.
 */
import { ProviderType } from '../../config/entities/machine-connection.model';

export type WriteValue = number | boolean | string;

export interface WritePackageItem {
  signalVariableName: string;
  value: WriteValue;
}

export interface WritePackage {
  id: string;
  machineId: string;
  name: string;
  description: string | null;
  items: WritePackageItem[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** `GET .../write-packages`: los paquetes y si la Machine admite ejecutarlos ahora. */
export interface WritePackageList {
  providerType: ProviderType | null;
  connected: boolean;
  packages: WritePackage[];
}

export interface WritePackageRequest {
  name: string;
  description?: string;
  items: WritePackageItem[];
}

export type WritePackageExecutionStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';

export interface WritePackageExecutionItem {
  signalVariableName: string;
  nodeId: string | null;
  value: WriteValue;
  statusCode: string;
}

export interface WritePackageExecution {
  id: string;
  packageId: string;
  machineId: string;
  userEmail: string;
  executedAt: string;
  status: WritePackageExecutionStatus;
  reason: string | null;
  items: WritePackageExecutionItem[];
}
