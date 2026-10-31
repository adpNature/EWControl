import { Logger } from '@nestjs/common';
import { createServer } from 'net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { OpcUaConnectionConfig } from '../src/entities/connection-config.vo';
import { DataQuality } from '../src/interface-adapters/data-providers/data-quality.enum';
import { createNodeOpcUaDriver } from '../src/interface-adapters/data-providers/opc-ua/node-opcua.driver';
import { NodeOpcUaExplorer } from '../src/interface-adapters/data-providers/opc-ua/node-opcua.explorer';
import { OpcUaProvider } from '../src/interface-adapters/data-providers/opc-ua/opc-ua-provider';
import { VariableType } from '../src/interface-adapters/data-providers/variable-type.enum';
import type { Variable } from '../src/interface-adapters/data-providers/variable.vo';
import { OpcUaInvalidNodeIdError } from '../src/use-cases/machine-management/errors/opc-ua-invalid-node-id.error';
import { type PlcLikeOpcUaServer, startPlcLikeOpcUaServer } from './support/plc-like-opcua-server';

/**
 * docs/specs/18-integracion-opc-ua.md: flujo OPC UA completo contra un servidor
 * real en proceso que imita al PLC piloto (criterios backend 5-10). No usa
 * Postgres ni InfluxDB: ejercita el driver de node-opcua y el explorador.
 */

const REAL_NODE = 'ns=3;s="Lectura"."REAL_1"';
const BOOL_NODE = 'ns=3;s="Lectura"."BOOL_1"';
const MISSING_NODE = 'ns=3;s="Lectura"."NO_EXISTE"';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const address = probe.address();
      probe.close(() => resolve(typeof address === 'object' && address ? address.port : 0));
    });
  });
}

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error(`Condición no cumplida en ${timeoutMs} ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function configFor(endpointUrl: string): OpcUaConnectionConfig {
  return {
    endpointUrl,
    securityMode: 'None',
    securityPolicy: 'None',
    authMode: 'Anonymous',
    timeoutMs: 5000,
    samplingIntervalMs: 200,
    nodeMapping: [
      { nodeId: REAL_NODE, signalVariableName: 'Lectura_REAL_1' },
      { nodeId: BOOL_NODE, signalVariableName: 'Lectura_BOOL_1' },
      { nodeId: MISSING_NODE, signalVariableName: 'Lectura_NO_EXISTE' },
    ],
  };
}

describe('OPC UA (integración, servidor PLC-like en proceso)', () => {
  let port: number;
  let server: PlcLikeOpcUaServer;
  let endpointUrl: string;
  const explorer = new NodeOpcUaExplorer();

  beforeAll(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    port = await freePort();
    server = await startPlcLikeOpcUaServer(port);
    endpointUrl = server.endpointUrl;
  }, 60000);

  afterAll(async () => {
    await server?.stop();
    vi.restoreAllMocks();
  });

  describe('NodeOpcUaExplorer', () => {
    it('testConnection devuelve reachable: true contra un servidor activo (criterio 5)', async () => {
      await expect(explorer.testConnection(endpointUrl, 10000)).resolves.toEqual({
        reachable: true,
      });
    }, 30000);

    it('testConnection devuelve reachable: false con un motivo genérico si no hay servidor', async () => {
      const closedPort = await freePort();

      const result = await explorer.testConnection(`opc.tcp://localhost:${closedPort}`, 5000);

      expect(result.reachable).toBe(false);
      expect(result).toHaveProperty('reason');
    }, 30000);

    it('browse sin nodeId devuelve los hijos de ObjectsFolder (criterio 6)', async () => {
      const nodes = await explorer.browse(endpointUrl, undefined, 10000);

      expect(nodes).toContainEqual(
        expect.objectContaining({
          nodeId: 'ns=2;i=5001',
          browseName: 'DeviceSet',
          nodeClass: 'Object',
          hasChildren: true,
        }),
      );
    }, 30000);

    it('browse de un DB devuelve sus variables con dataType y hasChildren', async () => {
      const nodes = await explorer.browse(endpointUrl, 'ns=3;s="Lectura"', 10000);

      expect(nodes).toContainEqual({
        nodeId: REAL_NODE,
        browseName: 'REAL_1',
        displayName: 'REAL_1',
        nodeClass: 'Variable',
        dataType: 'Float',
        hasChildren: false,
      });
      expect(nodes).toContainEqual(
        expect.objectContaining({
          nodeId: 'ns=3;s="Lectura"."ARRAY_1"',
          nodeClass: 'Variable',
          dataType: 'ExtensionObject',
          hasChildren: true,
        }),
      );
    }, 30000);

    it('browse con un NodeId inexistente o mal formado lanza OpcUaInvalidNodeIdError', async () => {
      await expect(explorer.browse(endpointUrl, MISSING_NODE, 10000)).rejects.toBeInstanceOf(
        OpcUaInvalidNodeIdError,
      );
      await expect(explorer.browse(endpointUrl, 'no es un nodeid', 10000)).rejects.toBeInstanceOf(
        OpcUaInvalidNodeIdError,
      );
    }, 30000);
  });

  describe('OpcUaProvider + NodeOpcUaDriver', () => {
    let provider: OpcUaProvider | undefined;

    afterEach(async () => {
      await provider?.disconnect();
      provider = undefined;
    });

    it('se suscribe y publica Variables tipadas; un nodo rechazado no afecta al resto (criterios 7 y 10)', async () => {
      const config = configFor(endpointUrl);
      provider = new OpcUaProvider('machine-1', config, createNodeOpcUaDriver(config));
      const variables: Variable[] = [];
      provider.subscribe((variable) => variables.push(variable));

      await provider.connect();
      await waitFor(
        () =>
          variables.some((v) => v.name === 'Lectura_REAL_1') &&
          variables.some((v) => v.name === 'Lectura_BOOL_1'),
        20000,
      );

      expect(provider.isConnected()).toBe(true);
      expect(variables.find((v) => v.name === 'Lectura_REAL_1')).toMatchObject({
        type: VariableType.Float,
        quality: DataQuality.Good,
      });
      expect(variables.find((v) => v.name === 'Lectura_BOOL_1')).toMatchObject({
        type: VariableType.Boolean,
      });
      expect(variables.some((v) => v.name === 'Lectura_NO_EXISTE')).toBe(false);
    }, 40000);

    it('escribe valores en el DB Escritura y la Subscription los relee (spec 20, criterio 9)', async () => {
      const config: OpcUaConnectionConfig = {
        ...configFor(endpointUrl),
        nodeMapping: [
          { nodeId: 'ns=3;s="Escritura"."REAL"', signalVariableName: 'Escritura_REAL' },
          { nodeId: 'ns=3;s="Escritura"."BOOL"', signalVariableName: 'Escritura_BOOL' },
        ],
      };
      provider = new OpcUaProvider('machine-1', config, createNodeOpcUaDriver(config));
      const variables: Variable[] = [];
      provider.subscribe((variable) => variables.push(variable));
      await provider.connect();
      await waitFor(() => provider!.isConnected(), 20000);

      const results = await provider.write([
        { nodeId: 'ns=3;s="Escritura"."REAL"', dataType: 'Float', value: 120.5 },
        { nodeId: 'ns=3;s="Escritura"."BOOL"', dataType: 'Boolean', value: true },
        // Tipo declarado distinto del real (Float): no se envía.
        { nodeId: 'ns=3;s="Escritura"."REAL"', dataType: 'Int16', value: 1 },
        { nodeId: 'ns=3;s="Escritura"."NO_EXISTE"', dataType: 'Float', value: 1 },
      ]);

      expect(results.map((result) => result.statusCode)).toEqual([
        'Good',
        'Good',
        'BadTypeMismatch',
        'BadNodeIdUnknown',
      ]);
      await waitFor(
        () =>
          variables.some((v) => v.name === 'Escritura_REAL' && v.value === 120.5) &&
          variables.some((v) => v.name === 'Escritura_BOOL' && v.value === true),
        10000,
      );
    }, 40000);

    it('detecta la caída del servidor y se reconecta solo cuando vuelve (criterio 8)', async () => {
      const config = configFor(endpointUrl);
      provider = new OpcUaProvider('machine-1', config, createNodeOpcUaDriver(config));
      const connectionChanges: boolean[] = [];
      const variables: Variable[] = [];
      provider.onConnectionChange((connected) => connectionChanges.push(connected));
      provider.subscribe((variable) => variables.push(variable));
      await provider.connect();
      await waitFor(() => provider!.isConnected(), 20000);

      await server.stop();
      await waitFor(() => connectionChanges.includes(false), 20000);
      expect(provider.isConnected()).toBe(false);

      server = await startPlcLikeOpcUaServer(port);
      variables.length = 0;
      await waitFor(
        () => provider!.isConnected() && variables.some((v) => v.name === 'Lectura_REAL_1'),
        60000,
      );

      expect(connectionChanges).toEqual([true, false, true]);
    }, 90000);
  });
});
