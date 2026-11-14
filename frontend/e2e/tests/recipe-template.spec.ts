import { APIRequestContext, Page, expect, test } from '@playwright/test';
import {
  SEED_OPERADOR_EMAIL,
  SEED_OPERADOR_PASSWORD,
  SEED_USER_EMAIL,
  SEED_USER_PASSWORD,
} from '../../../backend/src/use-cases/seed-demo-environment/seed-demo-environment.config';

// docs/specs/26-receta-base.md, "Pruebas": un AdminCliente configura la receta
// base desde la UI (oculta una variable, fija otra visible, añade un título y
// pone dos variables al 50 %) y un Operador crea una receta con ese formulario.
// Como en recipes.spec.ts, la Machine se prepara por API sin conexión con el PLC.

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';
const HASH = '#'.repeat(20);
const STAR = '*'.repeat(20);
const GVL_CSV = [
  'Type,Name,Address,DataType,InitValue,Comment,Attribute',
  `VAR_GLOBAL,rEspiras,,REAL,,"${HASH}\n PAGINA PROGRAMACION RECETA \n${HASH}\n${STAR}\n PROGRAMACION PARA LA RECETA \n${STAR}",`,
  'VAR_GLOBAL,xSentidoCabezal,,BOOL,,"2 opciones: 0 - Horario / 1 - Antihorario",',
  'VAR_GLOBAL,rVelocidad,,REAL,,,',
].join('\n');

function mapping(name: string, dataType: string) {
  return { nodeId: `${ROOT}.${name}`, signalVariableName: name, dataType };
}

async function apiLogin(request: APIRequestContext, email: string, password: string) {
  const response = await request.post('/api/v1/auth/login', { data: { email, password } });
  expect(response.ok()).toBe(true);
  const { accessToken } = (await response.json()) as { accessToken: string };
  // Nombre de cabecera HTTP: no sigue el camelCase del código.
  return { ['Authorization']: `Bearer ${accessToken}` };
}

async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Receta base', () => {
  let machineName: string;

  test.beforeAll(async ({ request }) => {
    const headers = await apiLogin(request, SEED_USER_EMAIL, SEED_USER_PASSWORD);
    machineName = `E2E receta base ${Date.now()}`;
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
            mapping('rEspiras', 'Float'),
            mapping('xSentidoCabezal', 'Boolean'),
            mapping('rVelocidad', 'Float'),
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

  test('un AdminCliente configura la receta base y un Operador crea una receta con ella', async ({
    page,
    browser,
  }) => {
    await uiLogin(page, SEED_USER_EMAIL, SEED_USER_PASSWORD);
    await page.getByRole('link', { name: 'Recetas' }).click();
    await page.getByLabel('Máquina').selectOption({ label: machineName });
    await page.getByRole('link', { name: 'Receta base' }).click();
    await expect(page.getByRole('heading', { name: 'Receta base' })).toBeVisible();

    // Variables: nombre visible, una oculta y otra fija y visible.
    const espiras = page.getByRole('article', { name: 'rEspiras' });
    await espiras.getByRole('button', { name: /más ajustes/ }).click();
    await espiras.getByLabel('Nombre visible').fill('Espiras');
    await page
      .getByRole('article', { name: 'rVelocidad' })
      .getByRole('radio', { name: 'Oculta' })
      .check();
    const sentido = page.getByRole('article', { name: 'xSentidoCabezal' });
    await sentido.getByRole('radio', { name: 'Fija y visible' }).check();
    await sentido.getByRole('switch', { name: 'Valor fijo' }).check();

    // Disposición: un título arriba y las dos visibles al 50 %.
    await page.getByRole('tab', { name: 'Disposición' }).click();
    await page.getByRole('button', { name: 'Título de sección' }).click();
    await page.getByLabel('Texto del título de la fila 2').fill('Bobinado');
    await page.getByRole('button', { name: 'Subir la fila 2' }).click();
    await page.getByLabel('Ancho de Espiras').selectOption('6');
    await page.getByLabel('Ancho de xSentidoCabezal').selectOption('6');

    await page.getByRole('tab', { name: 'Vista previa' }).click();
    await expect(page.getByRole('heading', { name: 'Bobinado' })).toBeVisible();

    await page.getByRole('button', { name: 'Guardar receta base' }).click();
    await expect(page.getByText('Receta base guardada.')).toBeVisible();

    // El Operador ve el formulario según la receta base.
    const operadorContext = await browser.newContext();
    const operador = await operadorContext.newPage();
    await uiLogin(operador, SEED_OPERADOR_EMAIL, SEED_OPERADOR_PASSWORD);
    await operador.getByRole('link', { name: 'Recetas' }).click();
    await operador.getByLabel('Máquina').selectOption({ label: machineName });
    await expect(operador.getByRole('link', { name: 'Receta base' })).toBeHidden();
    await operador.getByRole('link', { name: 'Nueva receta' }).click();

    await expect(operador.getByRole('heading', { name: 'Bobinado' })).toBeVisible();
    await expect(operador.getByText('Valor fijo')).toBeVisible();
    await expect(operador.getByRole('spinbutton', { name: 'rVelocidad' })).toHaveCount(0);
    await operador.getByLabel('Título').fill('Bobina con receta base');
    await operador.getByRole('spinbutton', { name: 'Espiras' }).fill('350');
    await operador.getByRole('button', { name: 'Guardar' }).click();

    await expect(operador).toHaveURL(/\/recetas$/);
    await expect(operador.getByRole('cell', { name: 'Bobina con receta base' })).toBeVisible();
    await operadorContext.close();
  });
});
