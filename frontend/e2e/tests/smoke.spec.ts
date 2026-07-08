import { expect, test } from '@playwright/test';

// Placeholder hasta implementar docs/specs/05-auth-login.md: cuando exista
// la pagina de login, este archivo se reemplaza/amplia con ese flujo real.
test('el shell de la app arranca correctamente', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Frontend');
  await expect(page.locator('router-outlet')).toBeAttached();
});
