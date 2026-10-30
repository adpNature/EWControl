import { Inject, Injectable } from '@nestjs/common';
import { parseOpcUaEndpointUrl } from '../../entities/connection-config.vo';
import { InvalidOpcUaEndpointUrlError } from './errors/invalid-opc-ua-endpoint-url.error';
import { OpcUaEndpointNotAllowedError } from './errors/opc-ua-endpoint-not-allowed.error';
import { OPCUA_ALLOWED_HOSTS } from './ports/opc-ua-allowed-hosts.token';

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function ipv4ToNumber(host: string): number | null {
  const match = IPV4_PATTERN.exec(host);
  if (!match) {
    return null;
  }
  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) {
    return null;
  }
  return octets.reduce((acc, octet) => acc * 256 + octet, 0);
}

function matchesCidr(host: string, cidr: string): boolean {
  const [network, prefixRaw] = cidr.split('/');
  const prefix = Number(prefixRaw);
  const hostNumber = ipv4ToNumber(host);
  const networkNumber = ipv4ToNumber(network);
  if (hostNumber === null || networkNumber === null || !Number.isInteger(prefix)) {
    return false;
  }
  if (prefix < 0 || prefix > 32) {
    return false;
  }
  const blockSize = 2 ** (32 - prefix);
  return Math.floor(hostNumber / blockSize) === Math.floor(networkNumber / blockSize);
}

/**
 * Allowlist anti-SSRF de spec 18 (OWASP A10). Una entrada es un host literal
 * (comparado sin distinguir mayúsculas) o un rango CIDR IPv4. Un CIDR solo casa
 * con endpoints que ya son una IPv4 literal: nunca se resuelve DNS aquí, para no
 * abrir la puerta a DNS rebinding. Allowlist vacía = cualquier host permitido.
 */
export function isHostAllowed(host: string, allowedHosts: readonly string[]): boolean {
  if (allowedHosts.length === 0) {
    return true;
  }
  const normalizedHost = host.toLowerCase();
  return allowedHosts.some((entry) =>
    entry.includes('/')
      ? matchesCidr(normalizedHost, entry)
      : entry.toLowerCase() === normalizedHost,
  );
}

/**
 * Punto único donde se decide si el Backend puede abrir una conexión OPC UA
 * hacia un `endpointUrl` elegido por un usuario (spec 18, criterio backend 4):
 * lo usan el `PUT /connection`, la prueba de conexión y la exploración de nodos.
 */
@Injectable()
export class OpcUaEndpointPolicy {
  constructor(@Inject(OPCUA_ALLOWED_HOSTS) private readonly allowedHosts: readonly string[]) {}

  /**
   * @throws InvalidOpcUaEndpointUrlError si no es `opc.tcp://host[:puerto]`.
   * @throws OpcUaEndpointNotAllowedError si el host está fuera de `OPCUA_ALLOWED_HOSTS`.
   */
  assertAllowed(endpointUrl: unknown): void {
    const parsed = parseOpcUaEndpointUrl(endpointUrl);
    if (!parsed.ok) {
      throw new InvalidOpcUaEndpointUrlError();
    }
    if (!isHostAllowed(parsed.host, this.allowedHosts)) {
      throw new OpcUaEndpointNotAllowedError(parsed.host);
    }
  }
}
