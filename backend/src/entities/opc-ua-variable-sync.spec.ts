import { describe, expect, it } from 'vitest';
import type { OpcUaNodeMapping } from './connection-config.vo';
import {
  classifyOpcUaVariable,
  diffSyncedVariables,
  findMissingNodeIds,
  type LiveOpcUaVariable,
  mergeSyncedVariables,
  type SkippedOpcUaVariable,
  summarizeSync,
} from './opc-ua-variable-sync';

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';

function live(name: string, dataType: string, plcWritable = true): LiveOpcUaVariable {
  return { nodeId: `${ROOT}.${name}`, path: ['GVL_HMI', name], dataType, plcWritable };
}

function mapped(name: string, extra: Partial<OpcUaNodeMapping> = {}): OpcUaNodeMapping {
  return { nodeId: `${ROOT}.${name}`, signalVariableName: `GVL_HMI_${name}`, ...extra };
}

describe('classifyOpcUaVariable (spec 21, "Qué variables se pueden mapear")', () => {
  it('acepta escalares de un tipo soportado', () => {
    expect(classifyOpcUaVariable('Float', -1)).toBeNull();
    expect(classifyOpcUaVariable('String', -1)).toBeNull();
  });

  it('marca como nonScalar los arrays y cualquier ValueRank distinto de -1', () => {
    expect(classifyOpcUaVariable('UInt16', 1)).toBe('nonScalar');
    expect(classifyOpcUaVariable('Boolean', 0)).toBe('nonScalar');
    expect(classifyOpcUaVariable('Boolean', -2)).toBe('nonScalar');
  });

  it('marca como unsupportedType los escalares de otro tipo', () => {
    expect(classifyOpcUaVariable('DateTime', -1)).toBe('unsupportedType');
    expect(classifyOpcUaVariable('', -1)).toBe('unsupportedType');
  });
});

describe('findMissingNodeIds', () => {
  it('devuelve los nodeId guardados que no aparecen en la carpeta', () => {
    const mapping = [
      mapped('a'),
      mapped('b'),
      { nodeId: 'ns=2;s=Otro', signalVariableName: 'Otro' },
    ];

    expect(findMissingNodeIds([live('a', 'Float')], mapping)).toEqual([`${ROOT}.b`, 'ns=2;s=Otro']);
  });
});

describe('diffSyncedVariables (spec 21, criterio backend 4)', () => {
  it('clasifica new, unchanged y typeChanged por nodeId', () => {
    const mapping = [
      mapped('same', { dataType: 'Float', label: 'Igual' }),
      mapped('changed', { dataType: 'UInt16' }),
    ];
    const result = diffSyncedVariables(
      [live('same', 'Float'), live('changed', 'Int16'), live('fresh', 'Boolean')],
      mapping,
      new Map(),
    );

    expect(result.variables.map((variable) => [variable.path[1], variable.status])).toEqual([
      ['changed', 'typeChanged'],
      ['fresh', 'new'],
      ['same', 'unchanged'],
    ]);
    expect(result.variables.find((variable) => variable.status === 'new')?.saved).toBeNull();
    expect(result.variables.find((variable) => variable.status === 'unchanged')?.saved).toEqual({
      signalVariableName: 'GVL_HMI_same',
      label: 'Igual',
      dataType: 'Float',
    });
    expect(result.variables.find((variable) => variable.status === 'typeChanged')?.saved).toEqual({
      signalVariableName: 'GVL_HMI_changed',
      label: null,
      dataType: 'UInt16',
    });
  });

  it('una entrada guardada sin dataType (anterior a la spec 21) cuenta como unchanged', () => {
    const result = diffSyncedVariables([live('a', 'Float')], [mapped('a')], new Map());

    expect(result.variables[0].status).toBe('unchanged');
  });

  it('solo marca como removed las que el servidor confirma inexistentes; ignora las que existen fuera de la carpeta', () => {
    const mapping = [
      mapped('gone', { dataType: 'Boolean', label: 'Antigua' }),
      { nodeId: 'ns=2;s=Manual', signalVariableName: 'Manual' },
      mapped('unknown'),
    ];
    const existence = new Map([
      [`${ROOT}.gone`, false],
      ['ns=2;s=Manual', true],
    ]);

    const result = diffSyncedVariables([], mapping, existence);

    expect(result.removed).toEqual([
      {
        nodeId: `${ROOT}.gone`,
        signalVariableName: 'GVL_HMI_gone',
        label: 'Antigua',
        dataType: 'Boolean',
      },
    ]);
  });

  it('ordena las variables por ruta', () => {
    const result = diffSyncedVariables(
      [
        { ...live('b', 'Float'), path: ['GVL_HMI', 'b'] },
        { ...live('a0', 'Float'), path: ['GVL_HMI', 'a', 'a[0]'] },
      ],
      [],
      new Map(),
    );

    expect(result.variables.map((variable) => variable.path.join('.'))).toEqual([
      'GVL_HMI.a.a[0]',
      'GVL_HMI.b',
    ]);
  });
});

describe('summarizeSync (spec 21, criterio backend 5)', () => {
  it('cuenta estados, omitidas y tipos', () => {
    const { variables, removed } = diffSyncedVariables(
      [live('a', 'Boolean'), live('b', 'Boolean'), live('c', 'Float')],
      [mapped('a', { dataType: 'Boolean' }), mapped('c', { dataType: 'Int16' }), mapped('x')],
      new Map([[`${ROOT}.x`, false]]),
    );
    const skipped: SkippedOpcUaVariable[] = [
      {
        nodeId: `${ROOT}.arr`,
        path: ['GVL_HMI', 'arr'],
        dataType: 'UInt16',
        valueRank: 1,
        arrayDimensions: [4],
        reason: 'nonScalar',
      },
    ];

    expect(summarizeSync(variables, removed, skipped)).toEqual({
      total: 3,
      new: 1,
      unchanged: 1,
      typeChanged: 1,
      removed: 1,
      skipped: 1,
      byDataType: Object.fromEntries([
        ['Boolean', 2],
        ['Float', 1],
      ]),
    });
  });
});

describe('mergeSyncedVariables (spec 21, criterio backend 8)', () => {
  it('actualiza las existentes conservando writable/min/max, añade las nuevas y no toca el resto', () => {
    const manual = { nodeId: 'ns=2;s=Manual', signalVariableName: 'Manual', writable: false };
    const existing = mapped('speed', { writable: true, dataType: 'Float', min: 0, max: 100 });

    const result = mergeSyncedVariables(
      [manual, existing],
      [
        {
          nodeId: `${ROOT}.speed`,
          signalVariableName: 'Velocidad',
          label: 'Velocidad',
          dataType: 'Float',
        },
        {
          nodeId: `${ROOT}.fresh`,
          signalVariableName: 'GVL_HMI_fresh',
          label: '',
          dataType: 'Boolean',
        },
      ],
      [],
    );

    expect(result.mapping).toEqual([
      manual,
      {
        nodeId: `${ROOT}.speed`,
        signalVariableName: 'Velocidad',
        label: 'Velocidad',
        writable: true,
        dataType: 'Float',
        min: 0,
        max: 100,
      },
      { nodeId: `${ROOT}.fresh`, signalVariableName: 'GVL_HMI_fresh', dataType: 'Boolean' },
    ]);
    expect(result.renamedFrom).toEqual(['GVL_HMI_speed']);
    expect(result.removedNames).toEqual([]);
  });

  it('si cambia el tipo de una escribible, le quita writable/min/max', () => {
    const result = mergeSyncedVariables(
      [mapped('speed', { writable: true, dataType: 'Float', min: 0, max: 100, label: 'Vel' })],
      [{ nodeId: `${ROOT}.speed`, signalVariableName: 'GVL_HMI_speed', dataType: 'Int16' }],
      [],
    );

    expect(result.mapping).toEqual([
      { nodeId: `${ROOT}.speed`, signalVariableName: 'GVL_HMI_speed', dataType: 'Int16' },
    ]);
    expect(result.renamedFrom).toEqual([]);
  });

  it('quita las de remove, ignora las que no existen y devuelve sus nombres', () => {
    const result = mergeSyncedVariables(
      [mapped('a'), mapped('b')],
      [],
      [`${ROOT}.b`, `${ROOT}.noExiste`],
    );

    expect(result.mapping).toEqual([mapped('a')]);
    expect(result.removedNames).toEqual(['GVL_HMI_b']);
  });

  it('una variable que también está en remove se quita', () => {
    const result = mergeSyncedVariables(
      [mapped('a')],
      [{ nodeId: `${ROOT}.a`, signalVariableName: 'GVL_HMI_a', dataType: 'Float' }],
      [`${ROOT}.a`],
    );

    expect(result.mapping).toEqual([]);
    expect(result.removedNames).toEqual(['GVL_HMI_a']);
  });
});
