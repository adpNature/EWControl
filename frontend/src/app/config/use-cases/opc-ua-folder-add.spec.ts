import {
  OpcUaVariableSyncResult,
  SkippedOpcUaVariable,
  SyncedOpcUaVariable,
} from '../entities/machine-connection.model';
import { folderAddToast, MAX_NODE_MAPPING_ENTRIES, planFolderAdd } from './opc-ua-folder-add';

const ROOT = 'ns=4;s=|var|EWControl-Dev.Application.GVL_HMI';

function variable(name: string, dataType = 'Boolean'): SyncedOpcUaVariable {
  return {
    nodeId: `${ROOT}.${name}`,
    path: ['GVL_HMI', name],
    dataType,
    plcWritable: true,
    status: 'new',
    saved: null,
  };
}

function skipped(name: string): SkippedOpcUaVariable {
  return {
    nodeId: `${ROOT}.${name}`,
    path: ['GVL_HMI', name],
    dataType: 'UInt16',
    valueRank: 1,
    arrayDimensions: [4],
    reason: 'nonScalar',
  };
}

function result(
  variables: SyncedOpcUaVariable[],
  skippedVariables: SkippedOpcUaVariable[] = [],
): OpcUaVariableSyncResult {
  return {
    rootNodeId: ROOT,
    syncedAt: '2026-11-12T16:00:00.000Z',
    summary: {
      total: variables.length,
      new: variables.length,
      unchanged: 0,
      typeChanged: 0,
      removed: 0,
      skipped: skippedVariables.length,
      byDataType: {},
    },
    variables,
    removed: [],
    skipped: skippedVariables,
  };
}

describe('planFolderAdd (spec 22)', () => {
  it('añade las variables que no estaban, con el identificador derivado de la ruta y su tipo', () => {
    const plan = planFolderAdd(
      result(
        [variable('xMarcha'), variable('rVelocidad', 'Float'), variable('axAvance[0]')],
        [skipped('awIp')],
      ),
      new Set([`${ROOT}.xMarcha`]),
      1,
    );

    expect(plan).toEqual({
      kind: 'added',
      rows: [
        {
          nodeId: `${ROOT}.rVelocidad`,
          signalVariableName: 'GVL_HMI_rVelocidad',
          dataType: 'Float',
        },
        {
          nodeId: `${ROOT}.axAvance[0]`,
          signalVariableName: 'GVL_HMI_axAvance_0',
          dataType: 'Boolean',
        },
      ],
      alreadyMapped: 1,
      skipped: 1,
    });
  });

  it('no añade nada si todas las variables ya estaban en el mapeo', () => {
    const plan = planFolderAdd(result([variable('xMarcha')]), new Set([`${ROOT}.xMarcha`]), 1);

    expect(plan).toEqual({ kind: 'allMapped' });
  });

  it('no añade nada si la carpeta no tiene variables mapeables', () => {
    expect(planFolderAdd(result([], [skipped('awIp')]), new Set(), 0)).toEqual({
      kind: 'nothingMappable',
    });
  });

  it(`no añade ninguna si el mapeo superaría ${MAX_NODE_MAPPING_ENTRIES} entradas`, () => {
    const variables = Array.from({ length: 3 }, (item, index) => variable(`x${index}`));

    expect(planFolderAdd(result(variables), new Set(), MAX_NODE_MAPPING_ENTRIES - 2)).toEqual({
      kind: 'overLimit',
      adding: 3,
      existing: MAX_NODE_MAPPING_ENTRIES - 2,
      max: MAX_NODE_MAPPING_ENTRIES,
    });
    expect(planFolderAdd(result(variables), new Set(), MAX_NODE_MAPPING_ENTRIES - 3).kind).toBe(
      'added',
    );
  });
});

describe('folderAddToast (spec 22)', () => {
  const rowsOf = (count: number) =>
    Array.from({ length: count }, (item, index) => ({
      nodeId: `${ROOT}.x${index}`,
      signalVariableName: `GVL_HMI_x${index}`,
      dataType: 'Boolean',
    }));

  it('resume lo añadido, lo que ya estaba y lo omitido, y recuerda guardar', () => {
    expect(
      folderAddToast(
        { kind: 'added', rows: rowsOf(450), alreadyMapped: 12, skipped: 10 },
        'GVL_HMI',
      ),
    ).toEqual({
      type: 'success',
      message:
        'Añadidas 450 variables de GVL_HMI. 12 ya estaban en el mapeo. ' +
        '10 omitidas (arrays o tipos no soportados). Pulsa Guardar para aplicar los cambios.',
    });
  });

  it('usa el singular y omite las cifras a cero', () => {
    expect(
      folderAddToast({ kind: 'added', rows: rowsOf(1), alreadyMapped: 0, skipped: 0 }, 'Ajustes'),
    ).toEqual({
      type: 'success',
      message: 'Añadida 1 variable de Ajustes. Pulsa Guardar para aplicar los cambios.',
    });
  });

  it('informa si no había nada que añadir', () => {
    expect(folderAddToast({ kind: 'allMapped' }, 'GVL_HMI')).toEqual({
      type: 'info',
      message: 'Todas las variables de GVL_HMI ya estaban en el mapeo.',
    });
    expect(folderAddToast({ kind: 'nothingMappable' }, 'GVL_HMI')).toEqual({
      type: 'info',
      message: 'GVL_HMI no tiene variables escalares que se puedan mapear.',
    });
  });

  it('explica el límite con las cifras', () => {
    expect(
      folderAddToast({ kind: 'overLimit', adding: 450, existing: 120, max: 500 }, 'GVL_HMI'),
    ).toEqual({
      type: 'danger',
      message: 'Añadir 450 variables superaría el máximo de 500 del mapeo (ya hay 120).',
    });
  });
});
