import { DataType, Variant } from 'node-opcua-client';
import { type Namespace, OPCUAServer, type UAObject, type UAVariable } from 'node-opcua-server';

/**
 * Servidor OPC UA que imita el espacio de direcciones del PLC piloto (Siemens
 * S7-1500, volcado del 2026-10-30; docs/specs/18-integracion-opc-ua.md,
 * "Desarrollo sin acceso a la máquina"): mismos namespace URIs con el índice
 * `ns=3` para las variables del programa, misma ruta
 * `Objects/DeviceSet/PLC_1/DataBlocksGlobal/<DB>` y mismos NodeIds con comillas
 * de TIA Portal. Un mapeo hecho contra este servidor sirve tal cual contra la máquina.
 * Lo usan `pnpm run opcua:dev-server` y `opcua-provider.integration-spec.ts`.
 */
export type PlcLikeOpcUaServer = {
  endpointUrl: string;
  stop(): Promise<void>;
};

const SIEMENS_NAMESPACE = 'http://www.siemens.com/simatic-s7-opcua';
const DI_NAMESPACE = 'http://opcfoundation.org/UA/DI/';
const ARRAY_LENGTH = 11;
const UPDATE_INTERVAL_MS = 500;

type ScalarSpec = { name: string; dataType: DataType; initial: number | boolean };

const LECTURA_SCALARS: ScalarSpec[] = [
  { name: 'BOOL_1', dataType: DataType.Boolean, initial: false },
  { name: 'INT_1', dataType: DataType.Int16, initial: 0 },
  { name: 'DINT_1', dataType: DataType.Int32, initial: 0 },
  { name: 'REAL_1', dataType: DataType.Float, initial: 50 },
  { name: 'LREAL_1', dataType: DataType.Double, initial: 0 },
];
const ESCRITURA_SCALARS: ScalarSpec[] = [
  { name: 'BOOL', dataType: DataType.Boolean, initial: false },
  { name: 'INT', dataType: DataType.Int16, initial: 0 },
  { name: 'DINT', dataType: DataType.Int32, initial: 0 },
  { name: 'REAL', dataType: DataType.Float, initial: 0 },
  { name: 'LREAL', dataType: DataType.Double, initial: 0 },
];

function addScalar(
  namespace: Namespace,
  parent: UAObject | UAVariable,
  nodeId: string,
  browseName: string,
  dataType: DataType,
  initial: number | boolean,
): UAVariable {
  return namespace.addVariable({
    componentOf: parent,
    browseName,
    nodeId: `s=${nodeId}`,
    dataType: DataType[dataType],
    minimumSamplingInterval: 100,
    value: new Variant({ dataType, value: initial }),
  });
}

/** Variable estructurada (struct/array de TIA Portal): no escalar, con miembros hijos. */
function addStructuredVariable(
  namespace: Namespace,
  parent: UAObject | UAVariable,
  nodeId: string,
  browseName: string,
): UAVariable {
  return namespace.addVariable({
    componentOf: parent,
    browseName,
    nodeId: `s=${nodeId}`,
    dataType: 'Structure',
    minimumSamplingInterval: 100,
  });
}

function addDataBlock(
  namespace: Namespace,
  parent: UAObject,
  dbName: string,
  scalars: ScalarSpec[],
  arrayName: string,
): Map<string, UAVariable> {
  const db = namespace.addObject({
    organizedBy: parent,
    browseName: dbName,
    nodeId: `s="${dbName}"`,
  });
  const variables = new Map<string, UAVariable>();
  for (const spec of scalars) {
    variables.set(
      spec.name,
      addScalar(
        namespace,
        db,
        `"${dbName}"."${spec.name}"`,
        spec.name,
        spec.dataType,
        spec.initial,
      ),
    );
  }
  const arrayNodeId = `"${dbName}"."${arrayName}"`;
  const array = addStructuredVariable(namespace, db, arrayNodeId, arrayName);
  for (let index = 0; index < ARRAY_LENGTH; index++) {
    const elementId = `${arrayNodeId}[${index}]`;
    const element = addStructuredVariable(namespace, array, elementId, String(index));
    for (const member of ['Ancho', 'Alto', 'Profundo']) {
      variables.set(
        `${arrayName}[${index}].${member}`,
        addScalar(namespace, element, `${elementId}."${member}"`, member, DataType.Float, 0),
      );
    }
  }
  return variables;
}

/**
 * Arranca el servidor en `port`. Los valores de `Lectura` cambian cada 500 ms
 * para que las Subscriptions reciban notificaciones; `Escritura` es estática.
 */
export async function startPlcLikeOpcUaServer(port: number): Promise<PlcLikeOpcUaServer> {
  const server = new OPCUAServer({
    port,
    resourcePath: '',
    buildInfo: { productName: 'EWControl PLC-like dev server' },
  });
  await server.initialize();

  const addressSpace = server.engine.addressSpace!;
  const diNamespace = addressSpace.registerNamespace(DI_NAMESPACE);
  const siemens = addressSpace.registerNamespace(SIEMENS_NAMESPACE);
  const deviceSet = diNamespace.addObject({
    organizedBy: addressSpace.rootFolder.objects,
    browseName: 'DeviceSet',
    nodeId: 'i=5001',
  });
  const plc = siemens.addObject({ componentOf: deviceSet, browseName: 'PLC_1', nodeId: 's=PLC' });
  const dataBlocks = siemens.addObject({
    componentOf: plc,
    browseName: 'DataBlocksGlobal',
    nodeId: 's=DataBlocksGlobal',
  });
  const lectura = addDataBlock(siemens, dataBlocks, 'Lectura', LECTURA_SCALARS, 'ARRAY_1');
  addDataBlock(siemens, dataBlocks, 'Escritura', ESCRITURA_SCALARS, 'ARRAY');

  let tick = 0;
  const timer = setInterval(() => {
    tick++;
    const set = (name: string, dataType: DataType, value: number | boolean) =>
      lectura.get(name)?.setValueFromSource(new Variant({ dataType, value }));
    set('BOOL_1', DataType.Boolean, tick % 10 < 5);
    set('INT_1', DataType.Int16, tick % 1000);
    set('DINT_1', DataType.Int32, tick);
    set('REAL_1', DataType.Float, 50 + 10 * Math.sin(tick / 10));
    set('LREAL_1', DataType.Double, Math.cos(tick / 20));
    set('ARRAY_1[0].Ancho', DataType.Float, 100 + (tick % 7));
  }, UPDATE_INTERVAL_MS);

  await server.start();
  const endpointUrl = `opc.tcp://localhost:${port}`;
  return {
    endpointUrl,
    async stop() {
      clearInterval(timer);
      await server.shutdown(0);
    },
  };
}
