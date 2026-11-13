import { ToastRequest } from '../../shared/ui/toast/toast.model';
import { OpcUaVariableSyncResult } from '../entities/machine-connection.model';
import { deriveIdentifierFromPath } from './opc-ua-variable-sync';

/** Máximo de entradas del `nodeMapping` (spec 21, igual que `MAX_NODE_MAPPING_ENTRIES` del backend). */
export const MAX_NODE_MAPPING_ENTRIES = 500;

/** Fila nueva del mapeo de «Conexión» a partir de una variable sincronizada. */
export interface FolderAddRow {
  nodeId: string;
  signalVariableName: string;
  dataType: string;
}

/** Qué hacer con el resultado de «Añadir todas» (docs/specs/22-anadir-carpeta-opc-ua-desde-explorador.md). */
export type FolderAddPlan =
  | { kind: 'added'; rows: FolderAddRow[]; alreadyMapped: number; skipped: number }
  | { kind: 'allMapped' }
  | { kind: 'nothingMappable' }
  | { kind: 'overLimit'; adding: number; existing: number; max: number };

/**
 * spec 22, criterios frontend 3, 6 y 7: filas que hay que añadir al mapeo, sin
 * repetir los NodeIds que ya están, con el identificador derivado de la ruta
 * (como en la spec 21). Si el mapeo pasaría de `MAX_NODE_MAPPING_ENTRIES`, no
 * se añade ninguna.
 *
 * @param result respuesta de `POST .../opcua/variables/sync` para la carpeta.
 * @param mappedNodeIds NodeIds que ya están en la tabla de «Conexión».
 * @param currentEntries filas que tiene ahora la tabla.
 */
export function planFolderAdd(
  result: OpcUaVariableSyncResult,
  mappedNodeIds: ReadonlySet<string>,
  currentEntries: number,
): FolderAddPlan {
  if (result.variables.length === 0) {
    return { kind: 'nothingMappable' };
  }
  const fresh = result.variables.filter((variable) => !mappedNodeIds.has(variable.nodeId));
  if (fresh.length === 0) {
    return { kind: 'allMapped' };
  }
  if (currentEntries + fresh.length > MAX_NODE_MAPPING_ENTRIES) {
    return {
      kind: 'overLimit',
      adding: fresh.length,
      existing: currentEntries,
      max: MAX_NODE_MAPPING_ENTRIES,
    };
  }
  return {
    kind: 'added',
    rows: fresh.map((variable) => ({
      nodeId: variable.nodeId,
      signalVariableName: deriveIdentifierFromPath(variable.path),
      dataType: variable.dataType,
    })),
    alreadyMapped: result.variables.length - fresh.length,
    skipped: result.skipped.length,
  };
}

/** spec 22, criterios frontend 5-7: toast que resume el resultado de «Añadir todas». */
export function folderAddToast(plan: FolderAddPlan, folderName: string): ToastRequest {
  switch (plan.kind) {
    case 'added': {
      const count = plan.rows.length;
      const parts = [
        count === 1
          ? `Añadida 1 variable de ${folderName}.`
          : `Añadidas ${count} variables de ${folderName}.`,
      ];
      if (plan.alreadyMapped > 0) {
        parts.push(
          plan.alreadyMapped === 1
            ? '1 ya estaba en el mapeo.'
            : `${plan.alreadyMapped} ya estaban en el mapeo.`,
        );
      }
      if (plan.skipped > 0) {
        parts.push(
          plan.skipped === 1
            ? '1 omitida (array o tipo no soportado).'
            : `${plan.skipped} omitidas (arrays o tipos no soportados).`,
        );
      }
      parts.push('Pulsa Guardar para aplicar los cambios.');
      return { type: 'success', message: parts.join(' ') };
    }
    case 'allMapped':
      return {
        type: 'info',
        message: `Todas las variables de ${folderName} ya estaban en el mapeo.`,
      };
    case 'nothingMappable':
      return {
        type: 'info',
        message: `${folderName} no tiene variables escalares que se puedan mapear.`,
      };
    case 'overLimit':
      return {
        type: 'danger',
        message: `Añadir ${plan.adding} variables superaría el máximo de ${plan.max} del mapeo (ya hay ${plan.existing}).`,
      };
  }
}
