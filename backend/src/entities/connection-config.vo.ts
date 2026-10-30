/**
 * Configuración de conexión de una MachineConnection (Documento 3, apartado 3.4).
 * Modela las formas de `ProviderType.Simulator` (Documento 10, apartado 10.3) y
 * `ProviderType.OpcUa` (Documento 3, apartado 3.2.4; docs/specs/18-integracion-opc-ua.md).
 * Las formas de Mqtt/ModbusTcp se añaden cuando sus specs lo requieran.
 */
export type SimulatorSignalSeed =
  | { variableName: string; min: number; max: number; stepMax: number }
  | { variableName: string; mode: 'incremental' }
  | { variableName: string; mode: 'cycle'; cycleTicks: number };

export type SimulatorConnectionConfig = {
  seedProfile: string;
  signals: SimulatorSignalSeed[];
};

/** Correspondencia entre un `NodeId` del servidor OPC UA y el nombre de Variable interno. */
export type OpcUaNodeMapping = { nodeId: string; signalVariableName: string };

/**
 * spec 18: solo `None`/`None`/`Anonymous`. La forma admite ampliar estos literales
 * (UserName, Certificate, Sign/SignAndEncrypt) en una spec posterior.
 */
export type OpcUaConnectionConfig = {
  endpointUrl: string;
  securityMode: 'None';
  securityPolicy: 'None';
  authMode: 'Anonymous';
  timeoutMs: number;
  samplingIntervalMs: number;
  nodeMapping: OpcUaNodeMapping[];
};

export type ConnectionConfig = SimulatorConnectionConfig | OpcUaConnectionConfig;

export const OPCUA_DEFAULT_TIMEOUT_MS = 5000;
export const OPCUA_DEFAULT_SAMPLING_INTERVAL_MS = 1000;

/**
 * Patrón de identificador del motor de fórmulas (`formula-evaluator.ts`,
 * `IDENTIFIER_PATTERN`): un `signalVariableName` que no lo cumpla no podría
 * referenciarse desde una Signal `FORMULA`.
 */
export const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const OPCUA_SCHEME = 'opc.tcp:';
const MAX_ENDPOINT_URL_LENGTH = 2048;
const MAX_NODE_ID_LENGTH = 1024;
const MAX_VARIABLE_NAME_LENGTH = 100;
const MAX_NODE_MAPPING_ENTRIES = 500;
const TIMEOUT_RANGE_MS = { min: 1000, max: 60000 };
const SAMPLING_INTERVAL_RANGE_MS = { min: 100, max: 60000 };
const OPCUA_CONFIG_KEYS = new Set([
  'endpointUrl',
  'securityMode',
  'securityPolicy',
  'authMode',
  'timeoutMs',
  'samplingIntervalMs',
  'nodeMapping',
]);
const NODE_MAPPING_KEYS = new Set(['nodeId', 'signalVariableName']);

export type OpcUaEndpointUrlParseResult = { ok: true; host: string } | { ok: false };
export type OpcUaConnectionConfigParseResult =
  { ok: true; config: OpcUaConnectionConfig } | { ok: false; reason: string };

export function isOpcUaConnectionConfig(config: ConnectionConfig): config is OpcUaConnectionConfig {
  return 'endpointUrl' in config;
}

/**
 * Variables que una Machine puede exponer, contra las que se validan las
 * Signals `FORMULA` (docs/specs/06-gestion-machines-signals.md, criterio 5;
 * spec 18, criterio 11): semillas del Simulador o `nodeMapping` de OPC UA.
 */
export function listKnownVariableNames(config: ConnectionConfig): string[] {
  if (isOpcUaConnectionConfig(config)) {
    return config.nodeMapping.map((entry) => entry.signalVariableName);
  }
  return config.signals.map((signal) => signal.variableName);
}

/**
 * Valida que `raw` sea un endpoint `opc.tcp://host[:puerto]` y devuelve su host,
 * que es lo que evalúa la allowlist anti-SSRF (spec 18, OWASP A10).
 */
export function parseOpcUaEndpointUrl(raw: unknown): OpcUaEndpointUrlParseResult {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_ENDPOINT_URL_LENGTH) {
    return { ok: false };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== OPCUA_SCHEME || url.hostname.length === 0) {
    return { ok: false };
  }
  return { ok: true, host: url.hostname };
}

/**
 * Valida y normaliza una `ConnectionConfig` OPC UA recibida del exterior
 * (spec 18, criterio backend 3). Rechaza cualquier campo no declarado
 * (`certificateRef` incluido) y aplica los valores por defecto de timeout y muestreo.
 */
export function parseOpcUaConnectionConfig(raw: unknown): OpcUaConnectionConfigParseResult {
  if (!isPlainObject(raw)) {
    return { ok: false, reason: 'connectionConfig debe ser un objeto' };
  }
  const unknownKey = Object.keys(raw).find((key) => !OPCUA_CONFIG_KEYS.has(key));
  if (unknownKey) {
    return { ok: false, reason: `connectionConfig.${unknownKey} no está permitido` };
  }
  if (!parseOpcUaEndpointUrl(raw.endpointUrl).ok) {
    return { ok: false, reason: 'endpointUrl debe tener la forma opc.tcp://host[:puerto]' };
  }
  for (const [field, expected] of [
    ['securityMode', 'None'],
    ['securityPolicy', 'None'],
    ['authMode', 'Anonymous'],
  ] as const) {
    if (raw[field] !== undefined && raw[field] !== expected) {
      return { ok: false, reason: `${field} solo admite "${expected}"` };
    }
  }
  const timeoutMs = raw.timeoutMs ?? OPCUA_DEFAULT_TIMEOUT_MS;
  if (!isIntegerInRange(timeoutMs, TIMEOUT_RANGE_MS)) {
    return { ok: false, reason: rangeReason('timeoutMs', TIMEOUT_RANGE_MS) };
  }
  const samplingIntervalMs = raw.samplingIntervalMs ?? OPCUA_DEFAULT_SAMPLING_INTERVAL_MS;
  if (!isIntegerInRange(samplingIntervalMs, SAMPLING_INTERVAL_RANGE_MS)) {
    return { ok: false, reason: rangeReason('samplingIntervalMs', SAMPLING_INTERVAL_RANGE_MS) };
  }
  const nodeMapping = parseNodeMapping(raw.nodeMapping);
  if (!nodeMapping.ok) {
    return nodeMapping;
  }

  return {
    ok: true,
    config: {
      endpointUrl: raw.endpointUrl as string,
      securityMode: 'None',
      securityPolicy: 'None',
      authMode: 'Anonymous',
      timeoutMs,
      samplingIntervalMs,
      nodeMapping: nodeMapping.entries,
    },
  };
}

function parseNodeMapping(
  raw: unknown,
): { ok: true; entries: OpcUaNodeMapping[] } | { ok: false; reason: string } {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_NODE_MAPPING_ENTRIES) {
    return {
      ok: false,
      reason: `nodeMapping debe tener entre 1 y ${MAX_NODE_MAPPING_ENTRIES} entradas`,
    };
  }
  const nodeIds = new Set<string>();
  const variableNames = new Set<string>();
  const entries: OpcUaNodeMapping[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!isPlainObject(entry) || Object.keys(entry).some((key) => !NODE_MAPPING_KEYS.has(key))) {
      return {
        ok: false,
        reason: `nodeMapping[${index}] solo admite nodeId y signalVariableName`,
      };
    }
    const { nodeId, signalVariableName } = entry;
    if (typeof nodeId !== 'string' || nodeId.length === 0 || nodeId.length > MAX_NODE_ID_LENGTH) {
      return { ok: false, reason: `nodeMapping[${index}].nodeId no es válido` };
    }
    if (
      typeof signalVariableName !== 'string' ||
      signalVariableName.length > MAX_VARIABLE_NAME_LENGTH ||
      !VARIABLE_NAME_PATTERN.test(signalVariableName)
    ) {
      return {
        ok: false,
        reason: `nodeMapping[${index}].signalVariableName debe cumplir ${VARIABLE_NAME_PATTERN.source}`,
      };
    }
    if (nodeIds.has(nodeId)) {
      return { ok: false, reason: `nodeMapping[${index}].nodeId está repetido` };
    }
    if (variableNames.has(signalVariableName)) {
      return { ok: false, reason: `nodeMapping[${index}].signalVariableName está repetido` };
    }
    nodeIds.add(nodeId);
    variableNames.add(signalVariableName);
    entries.push({ nodeId, signalVariableName });
  }
  return { ok: true, entries };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntegerInRange(value: unknown, range: { min: number; max: number }): value is number {
  return (
    Number.isInteger(value) && (value as number) >= range.min && (value as number) <= range.max
  );
}

function rangeReason(field: string, range: { min: number; max: number }): string {
  return `${field} debe ser un entero entre ${range.min} y ${range.max}`;
}
