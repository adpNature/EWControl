// Objetivo configurable por env var: en `docker compose` (flujo de dev documentado)
// el Backend se resuelve por el nombre de servicio `backend` en la red interna;
// en CI (e2e.yml corre ambos procesos nativos en el mismo runner, sin red docker)
// no existe ese hostname, así que el workflow exporta BACKEND_PROXY_TARGET=http://localhost:3000.
export default {
  '/api': {
    target: process.env.BACKEND_PROXY_TARGET ?? 'http://backend:3000',
    changeOrigin: true,
  },
};
