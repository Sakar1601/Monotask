import { test, expect } from '@playwright/test';

// Single end-to-end smoke test covering the golden path: landing -> guest
// auth -> app shell -> create a task -> complete it. Uses real anonymous
// Supabase auth (a throwaway guest user per run) rather than mocking the
// backend, so it catches real breakage in the auth/DB wiring, not just the
// UI layer.
test('landing -> guest sign-in -> create and complete a task', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /inbox and calendars/i })).toBeVisible();

  await page.getByRole('button', { name: 'Sign In' }).first().click();
  await page.waitForURL('**/auth');

  await page.getByText('Continue as Guest').click();
  await page.waitForURL('**/app', { timeout: 20_000 });
  await expect(page.getByText('Dashboard').first()).toBeVisible();

  await page.locator('aside').getByText('Tasks', { exact: true }).click();
  await page.getByRole('button', { name: 'Add Task' }).click();

  const titleInput = page.locator('[role="dialog"] input').first();
  await titleInput.fill('Smoke test task');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Create Task')).not.toBeVisible({ timeout: 10_000 });

  // The task has no due date, so it only shows up under "All", not the
  // default "Today" tab.
  await page.getByRole('tab', { name: /All \(\d+\)/ }).click();

  const heading = page.getByRole('heading', { name: 'Smoke test task', level: 3 });
  await expect(heading).toBeVisible();

  // Toggle it complete - the checkbox button is the first button inside the
  // task card (the "p-4 border rounded-lg" wrapper in TaskManager's TaskCard).
  const card = heading.locator('xpath=ancestor::div[contains(@class,"p-4")][1]');
  await card.locator('button').first().click();
  await expect(heading).toHaveClass(/line-through/, { timeout: 5_000 });
});

// Phones get a bottom tab bar instead of the sidebar; the sections that
// don't fit in it live behind "More".
test.describe('phone navigation', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('bottom tab bar and More sheet navigate between sections', async ({ page }) => {
    await page.goto('/auth');
    await page.getByText('Continue as Guest').click();
    await page.waitForURL('**/app', { timeout: 20_000 });

    const tabBar = page.getByRole('navigation', { name: 'Primary' });
    await expect(tabBar).toBeVisible();
    await expect(page.locator('aside')).toBeHidden();

    await tabBar.getByRole('button', { name: 'Tasks' }).click();
    await expect(page.getByRole('heading', { name: 'Task Manager' })).toBeVisible();

    await tabBar.getByRole('button', { name: 'More' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^Settings/ }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(tabBar.getByRole('button', { name: 'More' })).toHaveAttribute('aria-current', 'page');
  });
});
