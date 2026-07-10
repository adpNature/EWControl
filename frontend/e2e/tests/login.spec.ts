import { expect, test } from '@playwright/test';

const DEMO_EMAIL = 'demo@ewcontrol.local';
const DEMO_PASSWORD = 'Demo1234!';

// docs/specs/05-auth-login.md. Los escenarios de login correcto, recarga y
// logout requieren el Backend real corriendo junto al proxy de Angular CLI,
// con el usuario demo ya seedeado (`pnpm run seed` en /backend).
test.describe('Login', () => {
  test('una ruta protegida sin sesión redirige a /login', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login/);
  });

  test('login correcto navega al Dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByLabel('Contraseña').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(DEMO_EMAIL)).toBeVisible();
  });

  test('credenciales incorrectas y email inexistente muestran el mismo mensaje genérico', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByLabel('Contraseña').fill('incorrecta');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.');

    await page.getByLabel('Email').fill('ghost@ewcontrol.local');
    await page.getByLabel('Contraseña').fill('lo-que-sea');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.');
  });

  test('un 429 del backend muestra el mensaje de espera', async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos.' }),
      }),
    );

    await page.goto('/login');
    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByLabel('Contraseña').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert')).toContainText('Demasiados intentos');
  });

  test('la sesión persiste al recargar la página, y logout la cierra realmente', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByLabel('Contraseña').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(DEMO_EMAIL)).toBeVisible();

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
