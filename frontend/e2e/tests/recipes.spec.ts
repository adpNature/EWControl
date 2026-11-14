import { APIRequestContext, expect, test } from '@playwright/test';
import {
  SEED_OPERADOR_EMAIL,
  SEED_OPERADOR_PASSWORD,
  SEED_USER_EMAIL,
  SEED_USER_PASSWORD,
} from '../../../backend/src/use-cases/seed-demo-environment/seed-demo-environment.config';

// docs/specs/25-recetas.md, "Pruebas": el test prepara por API una Machine con
// `nodeMapping` y categorías importadas (no hace falta conexión con el PLC:
// el endpoint no existe y la Machine queda OFFLINE) y un Operador crea, busca,
// duplica y activa recetas desde la UI. Requiere el Backend real con el seed.

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';
const HASH = '#'.repeat(20);
const STAR = '*'.repeat(20);
const GVL_CSV = [
  'Type,Name,Address,DataType,InitValue,Comment,Attribute',
  `VAR_GLOBAL,rEspiras,,REAL,,"${HASH}\n PAGINA PROGRAMACION RECETA \n${HASH}\n${STAR}\n PROGRAMACION PARA LA RECETA \n${STAR}",`,
  'VAR_GLOBAL,xSentidoCabezal,,BOOL,,"2 opciones: 0 - Horario / 1 - Antihorario",',
].join('\n');

async function apiLogin(request: APIRequestContext, email: string, password: string) {
  const response = await request.post('/api/v1/auth/login', { data: { email, password } });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  // Nombre de cabecera HTTP: no sigue el camelCase del código.
  return { ['Authorization']: `Bearer ${accessToken}` };
}

test.describe('Recetas', () => {
  let machineName: string;

  test.beforeAll(async ({ request }) => {
    const headers = await apiLogin(request, SEED_USER_EMAIL, SEED_USER_PASSWORD);
    machineName = `E2E recetas ${Date.now()}`;
    const created = await request.post('/api/v1/machines', {
      headers,
      data: { name: machineName },
    });
    expect(created.ok()).toBe(true);
    const { id: machineId } = (await created.json()) as { id: string };

    const connection = await request.put(`/api/v1/machines/${machineId}/connection`, {
      headers,
      data: {
        providerType: 'OpcUa',
        connectionConfig: {
          endpointUrl: 'opc.tcp://127.0.0.1:4999',
          securityMode: 'None',
          securityPolicy: 'None',
          authMode: 'Anonymous',
          timeoutMs: 1000,
          samplingIntervalMs: 1000,
          nodeMapping: [
            { nodeId: `${ROOT}.rEspiras`, signalVariableName: 'rEspiras', dataType: 'Float' },
            {
              nodeId: `${ROOT}.xSentidoCabezal`,
              signalVariableName: 'xSentidoCabezal',
              dataType: 'Boolean',
            },
          ],
        },
      },
    });
    expect(connection.ok()).toBe(true);

    const imported = await request.post(
      `/api/v1/machines/${machineId}/variable-categories/import`,
      { headers, data: { rootNodeId: ROOT, csv: GVL_CSV } },
    );
    expect(imported.ok()).toBe(true);
  });

  test('un Operador crea, busca, duplica y activa recetas', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(SEED_OPERADOR_EMAIL);
    await page.getByLabel('Contraseña').fill(SEED_OPERADOR_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('link', { name: 'Recetas' }).click();
    await page.getByLabel('Máquina').selectOption({ label: machineName });

    await page.getByRole('link', { name: 'Nueva receta' }).click();
    await page.getByLabel('Título').fill('Bobina 120');
    await page.getByRole('spinbutton', { name: 'rEspiras' }).fill('350');
    await page.getByRole('switch', { name: /xSentidoCabezal/ }).check();
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page).toHaveURL(/\/recetas$/);
    await expect(page.getByRole('cell', { name: 'Bobina 120' })).toBeVisible();

    await page.getByRole('link', { name: 'Duplicar Bobina 120' }).click();
    await expect(page.getByLabel('Título')).toHaveValue('Bobina 120 (copia)');
    await expect(page.getByRole('spinbutton', { name: 'rEspiras' })).toHaveValue('350');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('cell', { name: 'Bobina 120 (copia)' })).toBeVisible();

    await page.getByLabel('Buscar por título o descripción').fill('COPIA');
    await expect(page.getByRole('cell', { name: 'Bobina 120', exact: true })).toBeHidden();
    await expect(page.getByRole('cell', { name: 'Bobina 120 (copia)' })).toBeVisible();

    await page.getByRole('button', { name: 'Activar Bobina 120 (copia)' }).click();
    await expect(page.getByText('Por ahora no se envía nada a la máquina')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Activa', exact: true })).toBeVisible();
  });
});
