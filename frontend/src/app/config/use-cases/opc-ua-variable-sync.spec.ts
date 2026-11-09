import { describe, expect, it } from 'vitest';
import type {
  OpcUaVariableSyncResult,
  SkippedOpcUaVariable,
} from '../entities/machine-connection.model';
import {
  buildSaveRequest,
  deriveIdentifierFromPath,
  displayPath,
  filterRows,
  markRowsSaved,
  parseVariablesInUse,
  plcTypeLabel,
  saveErrorMessage,
  skippedReasonText,
  summaryChangesText,
  summaryCountsText,
  summaryTypesText,
  syncErrorMessage,
  toVariableRows,
  typeFilterOptions,
  usageText,
  validateRows,
  type VariableRow,
} from './opc-ua-variable-sync';

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';

const RESULT: OpcUaVariableSyncResult = {
  rootNodeId: ROOT,
  syncedAt: '2026-11-07T10:00:00.000Z',
  summary: {
    total: 3,
    new: 1,
    unchanged: 1,
    typeChanged: 1,
    removed: 1,
    skipped: 2,
    byDataType: Object.fromEntries([
      ['Boolean', 1],
      ['Int16', 1],
      ['Float', 1],
    ]),
  },
  variables: [
    {
      nodeId: `${ROOT}.iEstado`,
      path: ['GVL_HMI', 'iEstado'],
      dataType: 'Int16',
      plcWritable: true,
      status: 'typeChanged',
      saved: { signalVariableName: 'Estado', label: 'Estado máquina', dataType: 'UInt16' },
    },
    {
      nodeId: `${ROOT}.ax[0]`,
      path: ['GVL_HMI', 'ax', 'ax[0]'],
      dataType: 'Boolean',
      plcWritable: true,
      status: 'new',
      saved: null,
    },
    {
      nodeId: `${ROOT}.rVel`,
      path: ['GVL_HMI', 'rVel'],
      dataType: 'Float',
      plcWritable: false,
      status: 'unchanged',
      saved: { signalVariableName: 'GVL_HMI_rVel', label: null, dataType: 'Float' },
    },
  ],
  removed: [
    { nodeId: `${ROOT}.old`, signalVariableName: 'GVL_HMI_old', label: null, dataType: 'Boolean' },
  ],
  skipped: [],
};

function rows(): VariableRow[] {
  return toVariableRows(RESULT);
}

describe('plcTypeLabel (spec 21, tabla de tipos)', () => {
  it.each([
    ['Boolean', 'BOOL'],
    ['SByte', 'SINT'],
    ['Byte', 'USINT'],
    ['Int16', 'INT'],
    ['UInt16', 'UINT'],
    ['Int32', 'DINT'],
    ['UInt32', 'UDINT'],
    ['Float', 'REAL'],
    ['Double', 'LREAL'],
    ['String', 'STRING'],
    ['DateTime', 'DateTime'],
  ])('%s → %s', (dataType, label) => {
    expect(plcTypeLabel(dataType)).toBe(label);
  });

  it('devuelve un guion si no hay tipo', () => {
    expect(plcTypeLabel(null)).toBe('—');
  });
});

describe('deriveIdentifierFromPath / displayPath', () => {
  it('une la ruta desde la carpeta raíz como identificador', () => {
    expect(deriveIdentifierFromPath(['GVL_HMI', 'iBobinadoActual'])).toBe(
      'GVL_HMI_iBobinadoActual',
    );
  });

  it('no repite el nombre del array en sus elementos (CODESYS)', () => {
    const path = ['GVL_HMI', 'asCtrl', 'asCtrl[0]'];
    expect(deriveIdentifierFromPath(path)).toBe('GVL_HMI_asCtrl_0');
    expect(displayPath(path)).toBe('asCtrl[0]');
  });

  it('sanea comillas e índices de TIA Portal y no empieza por número', () => {
    expect(deriveIdentifierFromPath(['Lectura', 'ARRAY_1', '0', 'Ancho'])).toBe(
      'Lectura_ARRAY_1_0_Ancho',
    );
    expect(deriveIdentifierFromPath(['1DB', 'x'])).toBe('_1DB_x');
  });
});

describe('toVariableRows', () => {
  it('usa lo guardado o deriva el identificador, y recuerda el tipo anterior', () => {
    const [changed, fresh, unchanged] = rows();

    expect(changed).toMatchObject({
      savedName: 'Estado',
      signalVariableName: 'Estado',
      label: 'Estado máquina',
      previousDataType: 'UInt16',
      displayPath: 'iEstado',
    });
    expect(fresh).toMatchObject({
      savedName: null,
      signalVariableName: 'GVL_HMI_ax_0',
      label: '',
      previousDataType: null,
    });
    expect(unchanged.previousDataType).toBeNull();
  });
});

describe('filterRows', () => {
  it('combina estado, tipo y texto (ruta, identificador o etiqueta)', () => {
    expect(filterRows(rows(), { status: 'new', dataType: '', text: '' })).toHaveLength(1);
    expect(filterRows(rows(), { status: 'all', dataType: 'Float', text: '' })).toHaveLength(1);
    expect(filterRows(rows(), { status: 'all', dataType: '', text: 'máquina' })).toHaveLength(1);
    expect(filterRows(rows(), { status: 'all', dataType: '', text: 'AX[0]' })).toHaveLength(1);
    expect(filterRows(rows(), { status: 'typeChanged', dataType: 'Float', text: '' })).toHaveLength(
      0,
    );
  });

  it('el filtro Eliminadas no muestra filas del listado', () => {
    expect(filterRows(rows(), { status: 'removed', dataType: '', text: '' })).toEqual([]);
  });
});

describe('typeFilterOptions', () => {
  it('ordena por recuento y etiqueta con el tipo PLC', () => {
    expect(
      typeFilterOptions(
        Object.fromEntries([
          ['Float', 91],
          ['Boolean', 264],
        ]),
      ),
    ).toEqual([
      { value: 'Boolean', label: 'BOOL (264)' },
      { value: 'Float', label: 'REAL (91)' },
    ]);
  });
});

describe('validateRows', () => {
  it('marca vacíos, inválidos, demasiado largos y repetidos (entre filas o con otros mapeos)', () => {
    const [a, b, c] = rows();
    const errors = validateRows(
      [
        { ...a, signalVariableName: ' ' },
        { ...b, signalVariableName: 'Manual' },
        { ...c, signalVariableName: '9x' },
      ],
      ['Manual'],
    );

    expect([...errors.entries()]).toEqual([
      [a.nodeId, 'empty'],
      [b.nodeId, 'duplicated'],
      [c.nodeId, 'invalid'],
    ]);
    expect(validateRows([{ ...a, signalVariableName: 'x'.repeat(101) }], []).get(a.nodeId)).toBe(
      'invalid',
    );
  });

  it('no devuelve errores si todo es válido', () => {
    expect(validateRows(rows(), []).size).toBe(0);
  });
});

describe('textos del resumen', () => {
  it('cuenta los cambios con singular y plural', () => {
    expect(summaryChangesText(RESULT.summary)).toBe('1 nueva · 1 eliminada · 1 con tipo cambiado');
    expect(summaryChangesText({ ...RESULT.summary, new: 3, removed: 2, typeChanged: 0 })).toBe(
      '3 nuevas · 2 eliminadas',
    );
  });

  it('dice «Sin cambios» si no hay nuevas, eliminadas ni cambios de tipo', () => {
    expect(summaryChangesText({ ...RESULT.summary, new: 0, removed: 0, typeChanged: 0 })).toBe(
      'Sin cambios respecto a lo guardado',
    );
  });

  it('resume el total, las omitidas y los tipos', () => {
    expect(summaryCountsText(RESULT.summary)).toBe('3 variables · 2 omitidas');
    expect(summaryTypesText(RESULT.summary.byDataType)).toBe('BOOL 1 · INT 1 · REAL 1');
  });
});

describe('skippedReasonText', () => {
  const base: SkippedOpcUaVariable = {
    nodeId: 'x',
    path: ['GVL_HMI', 'x'],
    dataType: 'UInt16',
    valueRank: 1,
    arrayDimensions: [4],
    reason: 'nonScalar',
  };

  it('describe arrays, otros no escalares y tipos no soportados', () => {
    expect(skippedReasonText(base)).toBe('Array de UINT [4]');
    expect(skippedReasonText({ ...base, valueRank: 0, arrayDimensions: null })).toBe(
      'No escalar (UINT)',
    );
    expect(
      skippedReasonText({
        ...base,
        dataType: 'DateTime',
        valueRank: -1,
        reason: 'unsupportedType',
      }),
    ).toBe('Tipo no soportado: DateTime');
  });
});

describe('buildSaveRequest / markRowsSaved', () => {
  it('envía todas las filas recortando la etiqueta y las eliminadas marcadas', () => {
    const [a, b] = rows();
    const request = buildSaveRequest(ROOT, [{ ...a, label: '  Estado  ' }, b], [`${ROOT}.old`]);

    expect(request).toEqual({
      rootNodeId: ROOT,
      variables: [
        { nodeId: a.nodeId, signalVariableName: 'Estado', label: 'Estado', dataType: 'Int16' },
        { nodeId: b.nodeId, signalVariableName: 'GVL_HMI_ax_0', label: null, dataType: 'Boolean' },
      ],
      remove: [`${ROOT}.old`],
    });
  });

  it('tras guardar, todas las filas pasan a unchanged sin tipo anterior', () => {
    expect(
      markRowsSaved(rows()).every((row) => row.status === 'unchanged' && !row.previousDataType),
    ).toBe(true);
  });
});

describe('errores de la API', () => {
  it.each([
    ['OPCUA_ENDPOINT_UNREACHABLE', 'No se ha podido conectar con la máquina.'],
    ['OPCUA_SYNC_TIMEOUT', 'La máquina ha tardado demasiado en responder.'],
    ['OPCUA_INVALID_NODE_ID', 'La carpeta no existe en el servidor OPC UA.'],
    [
      'OPCUA_SYNC_TOO_MANY_NODES',
      'La carpeta tiene más de 2.000 variables: elige una más concreta.',
    ],
    ['MACHINE_NOT_OPCUA', 'Esta Machine no está conectada por OPC UA.'],
  ])('sincronizar: %s', (code, message) => {
    expect(syncErrorMessage({ status: 400, code, message: '' })).toBe(message);
  });

  it('guardar: límite del mapeo con el número resultante', () => {
    expect(
      saveErrorMessage({
        status: 422,
        code: 'OPCUA_MAPPING_LIMIT',
        message: '',
        details: { resultingEntries: 512, maxEntries: 500 },
      }),
    ).toBe('El mapeo superaría el máximo de 500 variables (512).');
  });

  it('un código desconocido da un mensaje genérico', () => {
    expect(saveErrorMessage({ status: 500, code: 'X', message: '' })).toMatch(/No se ha podido/);
  });

  it('lee los usos de un 409 OPCUA_VARIABLE_IN_USE y los describe', () => {
    const inUse = parseVariablesInUse({
      status: 409,
      code: 'OPCUA_VARIABLE_IN_USE',
      message: '',
      details: {
        variables: [
          {
            signalVariableName: 'Estado',
            usedBy: [
              { kind: 'Signal', id: 's-1', name: 'Velocidad' },
              { kind: 'WritePackage', id: 'p-1', name: 'Formato 120' },
            ],
          },
        ],
      },
    });

    expect(usageText(inUse[0])).toBe('Se usa en: Signal "Velocidad", Paquete "Formato 120"');
    expect(parseVariablesInUse({ status: 409, code: 'OTRO', message: '' })).toEqual([]);
  });
});
