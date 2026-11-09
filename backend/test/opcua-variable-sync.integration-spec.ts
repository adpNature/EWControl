import { createServer } from 'net';
import { DataType } from 'node-opcua-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { OpcUaNodeMapping } from '../src/entities/connection-config.vo';
import { diffSyncedVariables, summarizeSync } from '../src/entities/opc-ua-variable-sync';
import { NodeOpcUaExplorer } from '../src/interface-adapters/data-providers/opc-ua/node-opcua.explorer';
import { OpcUaInvalidNodeIdError } from '../src/use-cases/machine-management/errors/opc-ua-invalid-node-id.error';
import { OpcUaSyncTooManyNodesError } from '../src/use-cases/machine-management/errors/opc-ua-sync-too-many-nodes.error';
import { OPCUA_SYNC_LIMITS } from '../src/use-cases/machine-management/sync-opc-ua-variables.use-case';
import { type PlcLikeOpcUaServer, startPlcLikeOpcUaServer } from './support/plc-like-opcua-server';

/**
 * docs/specs/21-sincronizacion-variables-opc-ua.md, criterio backend 11:
 * sincroniza la carpeta `GVL_HMI` (tipo CODESYS) del servidor OPC UA de
 * desarrollo, la cambia en caliente y vuelve a sincronizar. No usa Postgres:
 * ejercita el explorador real y la comparación de Entities.
 */

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

describe('Sincronización de variables OPC UA (integración, spec 21)', () => {
  let server: PlcLikeOpcUaServer;
  const explorer = new NodeOpcUaExplorer();

  beforeAll(async () => {
    server = await startPlcLikeOpcUaServer(await freePort());
  }, 30000);

  afterAll(async () => {
    await server?.stop();
  });

  const scan = (savedNodeIds: string[] = [], limits = OPCUA_SYNC_LIMITS) =>
    explorer.scanVariables(server.endpointUrl, server.gvlHmi.rootNodeId, savedNodeIds, limits);

  it('lista los escalares con ruta, tipo y escritura, y omite el array y el tipo no soportado (criterios 2 y 3)', async () => {
    const result = await scan();

    const byName = new Map(result.variables.map((variable) => [variable.path.at(-1), variable]));
    expect([...byName.keys()].sort()).toEqual([
      'axManualAvance[0]',
      'axManualAvance[1]',
      'iEstadoMaquina',
      'rVelocidad',
      'sNombreReceta',
      'udiContadorEspiras',
      'uiNumBobinados',
      'xMarcha',
    ]);
    expect(byName.get('rVelocidad')).toEqual({
      nodeId: server.gvlHmi.nodeIdOf('rVelocidad'),
      path: ['GVL_HMI', 'rVelocidad'],
      dataType: 'Float',
      plcWritable: false,
    });
    expect(byName.get('xMarcha')?.plcWritable).toBe(true);
    expect(byName.get('axManualAvance[0]')?.path).toEqual([
      'GVL_HMI',
      'axManualAvance',
      'axManualAvance[0]',
    ]);
    expect(
      result.skipped.map(({ path, dataType, valueRank, arrayDimensions, reason }) => ({
        name: path.at(-1),
        dataType,
        valueRank,
        arrayDimensions,
        reason,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          name: 'axManualAvance',
          dataType: 'Boolean',
          valueRank: 1,
          arrayDimensions: [2],
          reason: 'nonScalar',
        },
        {
          name: 'dtUltimoCambio',
          dataType: 'DateTime',
          valueRank: -1,
          arrayDimensions: null,
          reason: 'unsupportedType',
        },
      ]),
    );
  }, 30000);

  it('detecta nuevas, eliminadas y cambios de tipo al volver a sincronizar (criterio 11)', async () => {
    const first = await scan();
    const mapping: OpcUaNodeMapping[] = first.variables.map((variable) => ({
      nodeId: variable.nodeId,
      signalVariableName: variable.path.join('_').replace(/\W/g, '_'),
      dataType: variable.dataType,
    }));
    // Un mapeo manual fuera de la carpeta (spec 18) que no debe salir como eliminado.
    mapping.push({ nodeId: 'ns=3;s="Lectura"."REAL_1"', signalVariableName: 'Lectura_REAL_1' });

    server.gvlHmi.addScalar('xNueva', DataType.Boolean);
    server.gvlHmi.remove('sNombreReceta');
    server.gvlHmi.retype('uiNumBobinados', DataType.Int32);

    const second = await scan(mapping.map((entry) => entry.nodeId));
    const { variables, removed } = diffSyncedVariables(second.variables, mapping, second.existence);
    const summary = summarizeSync(variables, removed, second.skipped);

    const statusOf = (name: string) =>
      variables.find((variable) => variable.path.at(-1) === name)?.status;
    expect(statusOf('xNueva')).toBe('new');
    expect(statusOf('uiNumBobinados')).toBe('typeChanged');
    expect(statusOf('xMarcha')).toBe('unchanged');
    expect(removed.map((variable) => variable.nodeId)).toEqual([
      server.gvlHmi.nodeIdOf('sNombreReceta'),
    ]);
    expect(summary).toMatchObject({ new: 1, typeChanged: 1, removed: 1, skipped: 2 });
  }, 30000);

  it('rechaza una carpeta inexistente con OpcUaInvalidNodeIdError', async () => {
    await expect(
      explorer.scanVariables(server.endpointUrl, 'ns=4;s=|var|NoExiste', [], OPCUA_SYNC_LIMITS),
    ).rejects.toBeInstanceOf(OpcUaInvalidNodeIdError);
  }, 30000);

  it('corta con OpcUaSyncTooManyNodesError al superar el límite de variables', async () => {
    await expect(scan([], { ...OPCUA_SYNC_LIMITS, maxVariables: 3 })).rejects.toBeInstanceOf(
      OpcUaSyncTooManyNodesError,
    );
  }, 30000);
});
