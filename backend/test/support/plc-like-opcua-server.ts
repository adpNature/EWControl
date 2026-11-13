import { DataType, Variant, VariantArrayType } from 'node-opcua-client';
import { type Namespace, OPCUAServer, type UAObject, type UAVariable } from 'node-opcua-server';

/**
 * Servidor OPC UA que imita el espacio de direcciones del PLC piloto (Siemens
 * S7-1500, volcado del 2026-10-30; docs/specs/18-integracion-opc-ua.md,
 * "Desarrollo sin acceso a la máquina"): mismos namespace URIs con el índice
 * `ns=3` para las variables del programa, misma ruta
 * `Objects/DeviceSet/PLC_1/DataBlocksGlobal/<DB>` y mismos NodeIds con comillas
 * de TIA Portal. Un mapeo hecho contra este servidor sirve tal cual contra la máquina.
 *
 * docs/specs/21-sincronizacion-variables-opc-ua.md añade, en `ns=4`, una
 * carpeta `GVL_HMI` con la forma de la máquina actual (runtime CODESYS, lectura
 * del 2026-11-06): NodeIds `|var|<dispositivo>.Application.GVL_HMI.<var>`,
 * escalares de varios tipos, un array cuyos elementos cuelgan de él y una
 * variable de tipo no soportado. `gvlHmi` permite cambiarla en caliente para
 * probar la detección de cambios.
 *
 * Lo usan `pnpm run opcua:dev-server` y los tests de integración OPC UA.
 */
export type PlcLikeOpcUaServer = {
  endpointUrl: string;
  gvlHmi: GvlHmiHandle;
  /** Sesiones abiertas ahora mismo (docs/specs/24-conexion-opc-ua-estable.md). */
  sessionCount(): number;
  /** MonitoredItems de todas las Subscriptions abiertas (spec 24). */
  monitoredItemCount(): number;
  stop(): Promise<void>;
};

/** Manipula la carpeta `GVL_HMI` del servidor de desarrollo (spec 21). */
export type GvlHmiHandle = {
  /** NodeId de la carpeta, para usarlo como `rootNodeId`. */
  rootNodeId: string;
  /** NodeId de una variable de la carpeta. */
  nodeIdOf(name: string): string;
  addScalar(name: string, dataType: DataType): void;
  remove(name: string): void;
  /** Sustituye la variable por otra con el mismo NodeId y otro tipo. */
  retype(name: string, dataType: DataType): void;
};

const SIEMENS_NAMESPACE = 'http://www.siemens.com/simatic-s7-opcua';
const CODESYS_NAMESPACE = 'CODESYSSPV3/3S/IecVarAccess';
const CODESYS_DEVICE = 'EWControl-Dev';
const GVL_HMI_PREFIX = `|var|${CODESYS_DEVICE}.Application.GVL_HMI`;
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

type GvlHmiScalar = { name: string; dataType: DataType; initial: unknown; readOnly?: boolean };

/** Muestra de la `GVL_HMI` real: un escalar de cada tipo que aparece en la máquina. */
const GVL_HMI_SCALARS: GvlHmiScalar[] = [
  { name: 'xMarcha', dataType: DataType.Boolean, initial: false },
  { name: 'iEstadoMaquina', dataType: DataType.Int16, initial: 1 },
  { name: 'uiNumBobinados', dataType: DataType.UInt16, initial: 4 },
  { name: 'udiContadorEspiras', dataType: DataType.UInt32, initial: 0, readOnly: true },
  { name: 'rVelocidad', dataType: DataType.Float, initial: 0, readOnly: true },
  { name: 'sNombreReceta', dataType: DataType.String, initial: 'Receta 1' },
  { name: 'dtUltimoCambio', dataType: DataType.DateTime, initial: new Date(0) },
];
const GVL_HMI_ARRAY = { name: 'axManualAvance', length: 2 };

function addGvlHmiScalar(namespace: Namespace, parent: UAObject, spec: GvlHmiScalar): UAVariable {
  return namespace.addVariable({
    componentOf: parent,
    browseName: spec.name,
    nodeId: `s=${GVL_HMI_PREFIX}.${spec.name}`,
    dataType: DataType[spec.dataType],
    accessLevel: spec.readOnly ? 'CurrentRead' : 'CurrentRead | CurrentWrite',
    userAccessLevel: spec.readOnly ? 'CurrentRead' : 'CurrentRead | CurrentWrite',
    minimumSamplingInterval: 100,
    value: new Variant({ dataType: spec.dataType, value: spec.initial }),
  });
}

/**
 * `Objects/DeviceSet/EWControl-Dev/GlobalVars/GVL_HMI` en `ns=4`, como un
 * runtime CODESYS: el array es una Variable con `ValueRank = 1` y sus
 * elementos (`axManualAvance[0]`...) cuelgan de ella como Variables escalares.
 */
function addGvlHmi(
  addressSpace: NonNullable<OPCUAServer['engine']['addressSpace']>,
  deviceSet: UAObject,
): { gvlHmi: GvlHmiHandle; velocidad: UAVariable } {
  const codesys = addressSpace.registerNamespace(CODESYS_NAMESPACE);
  const device = codesys.addObject({
    componentOf: deviceSet,
    browseName: CODESYS_DEVICE,
    nodeId: `s=|plc|${CODESYS_DEVICE}`,
  });
  const globalVars = codesys.addObject({
    componentOf: device,
    browseName: 'GlobalVars',
    nodeId: `s=|appo|${CODESYS_DEVICE}.Application.GlobalVars`,
  });
  const folder = codesys.addObject({
    componentOf: globalVars,
    browseName: 'GVL_HMI',
    nodeId: `s=${GVL_HMI_PREFIX}`,
  });

  const nodes = new Map<string, UAVariable>();
  for (const spec of GVL_HMI_SCALARS) {
    nodes.set(spec.name, addGvlHmiScalar(codesys, folder, spec));
  }
  const array = codesys.addVariable({
    componentOf: folder,
    browseName: GVL_HMI_ARRAY.name,
    nodeId: `s=${GVL_HMI_PREFIX}.${GVL_HMI_ARRAY.name}`,
    dataType: 'Boolean',
    valueRank: 1,
    arrayDimensions: [GVL_HMI_ARRAY.length],
    value: new Variant({
      dataType: DataType.Boolean,
      arrayType: VariantArrayType.Array,
      value: Array.from({ length: GVL_HMI_ARRAY.length }, () => false),
    }),
  });
  for (let index = 0; index < GVL_HMI_ARRAY.length; index++) {
    const elementName = `${GVL_HMI_ARRAY.name}[${index}]`;
    codesys.addVariable({
      componentOf: array,
      browseName: elementName,
      nodeId: `s=${GVL_HMI_PREFIX}.${elementName}`,
      dataType: 'Boolean',
      value: new Variant({ dataType: DataType.Boolean, value: false }),
    });
  }

  const nodeIdOf = (name: string) => `ns=${codesys.index};s=${GVL_HMI_PREFIX}.${name}`;
  const remove = (name: string) => {
    const node = nodes.get(name) ?? addressSpace.findNode(nodeIdOf(name));
    if (node) {
      addressSpace.deleteNode(node);
      nodes.delete(name);
    }
  };
  const addScalar = (name: string, dataType: DataType) => {
    const initial = dataType === DataType.Boolean ? false : dataType === DataType.String ? '' : 0;
    nodes.set(name, addGvlHmiScalar(codesys, folder, { name, dataType, initial }));
  };
  return {
    gvlHmi: {
      rootNodeId: `ns=${codesys.index};s=${GVL_HMI_PREFIX}`,
      nodeIdOf,
      addScalar,
      remove,
      retype(name, dataType) {
        remove(name);
        addScalar(name, dataType);
      },
    },
    velocidad: nodes.get('rVelocidad')!,
  };
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
  const { gvlHmi, velocidad } = addGvlHmi(addressSpace, deviceSet);

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
    velocidad.setValueFromSource(
      new Variant({ dataType: DataType.Float, value: 120 + 5 * Math.sin(tick / 8) }),
    );
  }, UPDATE_INTERVAL_MS);

  await server.start();
  const endpointUrl = `opc.tcp://localhost:${port}`;
  return {
    endpointUrl,
    gvlHmi,
    sessionCount: () => server.engine.currentSessionCount,
    monitoredItemCount: () =>
      server.engine
        .getSessions()
        .flatMap((session) => session.publishEngine?.subscriptions ?? [])
        .reduce((total, subscription) => total + subscription.monitoredItemCount, 0),
    async stop() {
      clearInterval(timer);
      await server.shutdown(0);
    },
  };
}
