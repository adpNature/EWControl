import { type OpcUaNodeMapping, WRITABLE_DATA_TYPES } from './connection-config.vo';

/**
 * Sincronización de variables OPC UA (docs/specs/21-sincronizacion-variables-opc-ua.md):
 * reglas puras para clasificar lo que expone el PLC, compararlo con el
 * `nodeMapping` guardado y fusionar lo que el usuario decide guardar.
 */

/** `ValueRank` de un escalar (OPC UA Part 3, 5.6.2). */
export const SCALAR_VALUE_RANK = -1;

/** Variable mapeable encontrada bajo la carpeta raíz. */
export type LiveOpcUaVariable = {
  nodeId: string;
  /** `BrowseName` desde la carpeta raíz, incluida. */
  path: string[];
  dataType: string;
  /** Bit `CurrentWrite` del `AccessLevel`: informativo, no marca la variable como escribible en EWControl. */
  plcWritable: boolean;
};

export type SkipReason = 'nonScalar' | 'unsupportedType';

/** Variable de la carpeta que no se puede mapear, con el motivo. */
export type SkippedOpcUaVariable = {
  nodeId: string;
  path: string[];
  dataType: string;
  valueRank: number;
  arrayDimensions: number[] | null;
  reason: SkipReason;
};

export type SyncedVariableStatus = 'new' | 'unchanged' | 'typeChanged';

export type SavedVariable = {
  signalVariableName: string;
  label: string | null;
  dataType: string | null;
};

export type SyncedVariable = LiveOpcUaVariable & {
  status: SyncedVariableStatus;
  /** `null` en las variables `new`. */
  saved: SavedVariable | null;
};

export type RemovedVariable = SavedVariable & { nodeId: string };

export type SyncSummary = {
  total: number;
  new: number;
  unchanged: number;
  typeChanged: number;
  removed: number;
  skipped: number;
  byDataType: Record<string, number>;
};

/** Variable que el usuario guarda desde la pantalla de sincronización. */
export type VariableToSave = {
  nodeId: string;
  signalVariableName: string;
  label?: string | null;
  dataType: string;
};

export type MergeResult = {
  mapping: OpcUaNodeMapping[];
  /** `signalVariableName` anteriores de las entradas renombradas. */
  renamedFrom: string[];
  /** `signalVariableName` de las entradas quitadas. */
  removedNames: string[];
};

/**
 * `null` si la variable se puede mapear (escalar de un tipo soportado por la
 * spec 18); si no, el motivo por el que se omite.
 */
export function classifyOpcUaVariable(dataType: string, valueRank: number): SkipReason | null {
  if (valueRank !== SCALAR_VALUE_RANK) {
    return 'nonScalar';
  }
  return WRITABLE_DATA_TYPES.includes(dataType) ? null : 'unsupportedType';
}

/** `nodeId` guardados que no han aparecido bajo la carpeta: hay que preguntar al servidor si siguen existiendo. */
export function findMissingNodeIds(
  live: readonly LiveOpcUaVariable[],
  mapping: readonly OpcUaNodeMapping[],
): string[] {
  const liveIds = new Set(live.map((variable) => variable.nodeId));
  return mapping.filter((entry) => !liveIds.has(entry.nodeId)).map((entry) => entry.nodeId);
}

/**
 * Compara lo que expone el PLC con el `nodeMapping` guardado (spec 21,
 * criterio backend 4). `existence` dice, para los `nodeId` de
 * `findMissingNodeIds`, si el servidor los conoce: solo los que responden
 * `false` (`BadNodeIdUnknown`) son `removed`; los que existen fuera de la
 * carpeta son mapeos manuales y se ignoran.
 */
export function diffSyncedVariables(
  live: readonly LiveOpcUaVariable[],
  mapping: readonly OpcUaNodeMapping[],
  existence: ReadonlyMap<string, boolean>,
): { variables: SyncedVariable[]; removed: RemovedVariable[] } {
  const savedByNodeId = new Map(mapping.map((entry) => [entry.nodeId, entry]));
  const variables = live
    .map((variable): SyncedVariable => {
      const entry = savedByNodeId.get(variable.nodeId);
      if (!entry) {
        return { ...variable, status: 'new', saved: null };
      }
      const typeChanged = entry.dataType !== undefined && entry.dataType !== variable.dataType;
      return {
        ...variable,
        status: typeChanged ? 'typeChanged' : 'unchanged',
        saved: toSaved(entry),
      };
    })
    .sort((a, b) => comparePaths(a.path, b.path));

  const removed = mapping
    .filter((entry) => existence.get(entry.nodeId) === false)
    .map((entry) => ({ nodeId: entry.nodeId, ...toSaved(entry) }));

  return { variables, removed };
}

/** Resumen de una sincronización (spec 21, criterio backend 5). */
export function summarizeSync(
  variables: readonly SyncedVariable[],
  removed: readonly RemovedVariable[],
  skipped: readonly SkippedOpcUaVariable[],
): SyncSummary {
  const byDataType: Record<string, number> = {};
  const counts = { new: 0, unchanged: 0, typeChanged: 0 };
  for (const variable of variables) {
    counts[variable.status] += 1;
    byDataType[variable.dataType] = (byDataType[variable.dataType] ?? 0) + 1;
  }
  return {
    total: variables.length,
    ...counts,
    removed: removed.length,
    skipped: skipped.length,
    byDataType,
  };
}

/**
 * Fusiona por `nodeId` lo guardado desde la pantalla con el `nodeMapping`
 * actual (spec 21, criterio backend 8):
 * - las existentes actualizan `signalVariableName`, `label` y `dataType`, y
 *   conservan `writable`/`min`/`max` salvo si cambia el tipo;
 * - las nuevas se añaden al final;
 * - las de `remove` se quitan (las que no existen se ignoran);
 * - el resto no se toca.
 * No valida: el resultado pasa después por `parseOpcUaConnectionConfig`.
 */
export function mergeSyncedVariables(
  mapping: readonly OpcUaNodeMapping[],
  variables: readonly VariableToSave[],
  remove: readonly string[],
): MergeResult {
  const toRemove = new Set(remove);
  const incoming = new Map(variables.map((variable) => [variable.nodeId, variable]));
  const renamedFrom: string[] = [];
  const removedNames: string[] = [];
  const merged: OpcUaNodeMapping[] = [];

  for (const entry of mapping) {
    if (toRemove.has(entry.nodeId)) {
      removedNames.push(entry.signalVariableName);
      continue;
    }
    const update = incoming.get(entry.nodeId);
    if (!update) {
      merged.push(entry);
      continue;
    }
    incoming.delete(entry.nodeId);
    if (update.signalVariableName !== entry.signalVariableName) {
      renamedFrom.push(entry.signalVariableName);
    }
    const typeChanged = entry.dataType !== undefined && entry.dataType !== update.dataType;
    const keepsWriteSettings = !typeChanged;
    merged.push(
      toMappingEntry(update, {
        writable: keepsWriteSettings ? entry.writable : undefined,
        min: keepsWriteSettings ? entry.min : undefined,
        max: keepsWriteSettings ? entry.max : undefined,
      }),
    );
  }

  for (const variable of incoming.values()) {
    if (!toRemove.has(variable.nodeId)) {
      merged.push(toMappingEntry(variable, {}));
    }
  }

  return { mapping: merged, renamedFrom, removedNames };
}

function toMappingEntry(
  variable: VariableToSave,
  writeSettings: Pick<OpcUaNodeMapping, 'writable' | 'min' | 'max'>,
): OpcUaNodeMapping {
  const entry: OpcUaNodeMapping = {
    nodeId: variable.nodeId,
    signalVariableName: variable.signalVariableName,
  };
  const label = variable.label?.trim();
  if (label) entry.label = label;
  if (writeSettings.writable !== undefined) entry.writable = writeSettings.writable;
  entry.dataType = variable.dataType;
  if (writeSettings.min !== undefined) entry.min = writeSettings.min;
  if (writeSettings.max !== undefined) entry.max = writeSettings.max;
  return entry;
}

function toSaved(entry: OpcUaNodeMapping): SavedVariable {
  return {
    signalVariableName: entry.signalVariableName,
    label: entry.label ?? null,
    dataType: entry.dataType ?? null,
  };
}

function comparePaths(a: readonly string[], b: readonly string[]): number {
  return a.join('.').localeCompare(b.join('.'), 'en');
}
