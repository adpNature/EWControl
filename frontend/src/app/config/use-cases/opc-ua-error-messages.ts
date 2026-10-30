import { ApiError } from '../../core/http/api-error.model';
import { OpcUaConnectionTestResult } from '../entities/machine-connection.model';

/** Códigos de error de la API (docs/11-api-rest.md, "Errores") → mensaje para el usuario. */
const API_ERROR_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['OPCUA_ENDPOINT_UNREACHABLE', 'No se ha podido conectar con el servidor OPC UA.'],
  [
    'OPCUA_ENDPOINT_NOT_ALLOWED',
    'Este endpoint no está permitido por la configuración del servidor.',
  ],
  ['INVALID_ENDPOINT_URL', 'El endpoint debe tener la forma opc.tcp://host:puerto.'],
  ['OPCUA_INVALID_NODE_ID', 'El nodo ya no existe en el servidor OPC UA.'],
  ['INVALID_CONNECTION_CONFIG', 'La configuración de conexión no es válida.'],
  ['MACHINE_INACTIVE', 'Esta Machine está desactivada; no se pueden guardar cambios.'],
]);
const GENERIC_MESSAGE = 'No se ha podido completar la operación. Inténtalo de nuevo.';

const UNREACHABLE_MESSAGE = 'No se ha podido conectar: el servidor no responde en ese endpoint.';
const TEST_FAILURE_MESSAGES: ReadonlyMap<string, string> = new Map([
  ['UNREACHABLE', UNREACHABLE_MESSAGE],
  ['TIMEOUT', 'El servidor OPC UA no ha respondido a tiempo.'],
  ['SECURITY_REJECTED', 'El servidor OPC UA ha rechazado la conexión anónima sin cifrado.'],
]);

/** docs/specs/18-integracion-opc-ua.md, "Casos borde / errores de UI". */
export function opcUaApiErrorMessage(error: ApiError): string {
  return API_ERROR_MESSAGES.get(error.code) ?? GENERIC_MESSAGE;
}

/** spec 18, criterio frontend 2: mensaje legible del resultado de "Probar conexión". */
export function opcUaTestResultMessage(result: OpcUaConnectionTestResult): string {
  return result.reachable
    ? 'Conexión establecida con el servidor OPC UA.'
    : (TEST_FAILURE_MESSAGES.get(result.reason) ?? UNREACHABLE_MESSAGE);
}
