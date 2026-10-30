import { startPlcLikeOpcUaServer } from './plc-like-opcua-server';

/**
 * `pnpm run opcua:dev-server` (docs/specs/18-integracion-opc-ua.md): servidor
 * OPC UA local que imita al PLC piloto, para desarrollar sin acceso a la máquina.
 * Puerto configurable con `OPCUA_DEV_SERVER_PORT` (por defecto 4840).
 */
async function main(): Promise<void> {
  const port = Number(process.env.OPCUA_DEV_SERVER_PORT ?? 4840);
  const server = await startPlcLikeOpcUaServer(port);
  console.log(`Servidor OPC UA de desarrollo escuchando en ${server.endpointUrl}`);
  console.log('Variables en ns=3;s="Lectura"."REAL_1", "BOOL_1", "INT_1"... (Ctrl+C para parar)');

  const shutdown = () => {
    void server.stop().then(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
