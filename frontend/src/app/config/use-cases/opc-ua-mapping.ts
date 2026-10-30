import { OpcUaBrowseNode, OpcUaNodeMapping } from '../entities/machine-connection.model';

/**
 * Patrón de identificador del motor de fórmulas del backend
 * (docs/specs/18-integracion-opc-ua.md): el backend rechaza con 400 cualquier
 * `signalVariableName` que no lo cumpla, así que la UI lo valida antes de enviar.
 */
export const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** spec 18, criterio frontend 4: tipos escalares que el `OpcUaProvider` sabe publicar. */
const MAPPABLE_DATA_TYPES = new Set([
  'Boolean',
  'SByte',
  'Byte',
  'Int16',
  'UInt16',
  'Int32',
  'UInt32',
  'Float',
  'Double',
  'String',
]);

export const OPCUA_ENDPOINT_PATTERN = /^opc\.tcp:\/\/[^\s/:]+(:\d{1,5})?(\/\S*)?$/;

/** Solo las `Variable` escalares se pueden mapear; arrays/structs se expanden pero no se añaden. */
export function isMappableNode(node: OpcUaBrowseNode): boolean {
  return node.nodeClass === 'Variable' && MAPPABLE_DATA_TYPES.has(node.dataType ?? '');
}

/**
 * Nombre de Variable por defecto a partir del NodeId (spec 18): la ruta desde
 * el DB saneada como identificador, porque el `browseName` solo se repite
 * (`Ancho` aparece once veces en el PLC piloto).
 * `ns=3;s="Lectura"."ARRAY_1"[0]."Ancho"` → `Lectura_ARRAY_1_0_Ancho`.
 */
export function deriveVariableName(node: OpcUaBrowseNode): string {
  const identifier = node.nodeId.replace(/^(ns=\d+;)?[isgb]=/, '');
  const sanitized = identifier
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const candidate = sanitized.length > 0 ? sanitized : node.browseName.replace(/\W+/g, '_');
  return /^[0-9]/.test(candidate) ? `_${candidate}` : candidate;
}

export type MappingRowError = 'empty' | 'invalid' | 'duplicated';

/** Errores por fila del mapeo (spec 18, criterio frontend 5), indexados como `mapping`. */
export function validateMapping(mapping: OpcUaNodeMapping[]): (MappingRowError | null)[] {
  const counts = new Map<string, number>();
  for (const entry of mapping) {
    counts.set(entry.signalVariableName, (counts.get(entry.signalVariableName) ?? 0) + 1);
  }
  return mapping.map(({ signalVariableName }) => {
    if (signalVariableName.trim().length === 0) {
      return 'empty';
    }
    if (!VARIABLE_NAME_PATTERN.test(signalVariableName)) {
      return 'invalid';
    }
    return (counts.get(signalVariableName) ?? 0) > 1 ? 'duplicated' : null;
  });
}
