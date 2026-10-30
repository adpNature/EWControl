/**
 * Token de inyección para la allowlist anti-SSRF de endpoints OPC UA (spec 18):
 * el use-case nunca lee `process.env` directamente (Documento 0, capas), solo
 * recibe la lista ya resuelta por `frameworks-drivers/config/opcua.config.ts`.
 */
export const OPCUA_ALLOWED_HOSTS = Symbol('OpcUaAllowedHosts');
