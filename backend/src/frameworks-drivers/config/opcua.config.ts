/**
 * Allowlist anti-SSRF de endpoints OPC UA (docs/specs/18-integracion-opc-ua.md,
 * docs/06-seguridad-global.md): `OPCUA_ALLOWED_HOSTS` es una lista separada por
 * comas de hosts literales y/o rangos CIDR IPv4 (p. ej. `192.168.1.0/24,plc-1.local`).
 * Vacía o ausente = cualquier host `opc.tcp://` permitido (modalidad local de planta).
 */
export function opcuaAllowedHosts(): string[] {
  return (process.env.OPCUA_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
