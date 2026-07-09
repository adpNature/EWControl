import { expect, test } from '@playwright/test';

test('el shell de la app arranca correctamente', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Frontend');
  await expect(page.locator('router-outlet')).toBeAttached();
});
