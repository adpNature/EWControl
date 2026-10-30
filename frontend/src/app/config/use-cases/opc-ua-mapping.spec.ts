import { OpcUaBrowseNode } from '../entities/machine-connection.model';
import {
  OPCUA_ENDPOINT_PATTERN,
  deriveVariableName,
  isMappableNode,
  validateMapping,
} from './opc-ua-mapping';

function node(overrides: Partial<OpcUaBrowseNode> = {}): OpcUaBrowseNode {
  return {
    nodeId: 'ns=3;s="Lectura"."REAL_1"',
    browseName: 'REAL_1',
    displayName: 'REAL_1',
    nodeClass: 'Variable',
    dataType: 'Float',
    hasChildren: false,
    ...overrides,
  };
}

describe('isMappableNode', () => {
  it.each(['Boolean', 'Int16', 'Int32', 'UInt32', 'Float', 'Double', 'String'])(
    'permite mapear una Variable %s',
    (dataType) => {
      expect(isMappableNode(node({ dataType }))).toBe(true);
    },
  );

  it('no permite mapear structs/arrays ni tipos propios del PLC', () => {
    expect(isMappableNode(node({ dataType: 'ExtensionObject', hasChildren: true }))).toBe(false);
    expect(isMappableNode(node({ dataType: 'DT_"Lectura"."ARRAY_1"' }))).toBe(false);
  });

  it('no permite mapear nodos que no son Variable', () => {
    expect(isMappableNode(node({ nodeClass: 'Object', dataType: undefined }))).toBe(false);
  });
});

describe('deriveVariableName', () => {
  it.each([
    ['ns=3;s="Lectura"."REAL_1"', 'Lectura_REAL_1'],
    ['ns=3;s="Lectura"."ARRAY_1"[0]."Ancho"', 'Lectura_ARRAY_1_0_Ancho'],
    ['ns=3;s="RTG1SysInfo".F_SYSINFO.TCYC_CURR', 'RTG1SysInfo_F_SYSINFO_TCYC_CURR'],
    ['ns=2;i=6001', '_6001'],
    ['i=2258', '_2258'],
  ])('%s → %s', (nodeId, expected) => {
    expect(deriveVariableName(node({ nodeId }))).toBe(expected);
  });

  it('recurre al browseName si el identificador no deja nada utilizable', () => {
    expect(deriveVariableName(node({ nodeId: 'ns=3;s="·"', browseName: 'Speed' }))).toBe('Speed');
  });
});

describe('validateMapping', () => {
  it('marca vacíos, nombres no válidos y duplicados', () => {
    expect(
      validateMapping([
        { nodeId: 'a', signalVariableName: 'speed' },
        { nodeId: 'b', signalVariableName: ' ' },
        { nodeId: 'c', signalVariableName: '1speed' },
        { nodeId: 'd', signalVariableName: 'dup' },
        { nodeId: 'e', signalVariableName: 'dup' },
      ]),
    ).toEqual([null, 'empty', 'invalid', 'duplicated', 'duplicated']);
  });
});

describe('OPCUA_ENDPOINT_PATTERN', () => {
  it.each(['opc.tcp://192.168.1.1:4840', 'opc.tcp://plc-1.local', 'opc.tcp://localhost:4840/UA'])(
    'acepta %s',
    (url) => {
      expect(OPCUA_ENDPOINT_PATTERN.test(url)).toBe(true);
    },
  );

  it.each(['http://192.168.1.1', '192.168.1.1:4840', 'opc.tcp://', 'opc.tcp://a b'])(
    'rechaza %s',
    (url) => {
      expect(OPCUA_ENDPOINT_PATTERN.test(url)).toBe(false);
    },
  );
});
