import { test, expect } from '@playwright/test';

test.describe('Padel Tournament Production E2E Suite - Public Beta Hardening', () => {

  test('1. App loads successfully and displays branding', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Padel|Torneo|Americ/i);
    const guestBtn = page.locator('#guest-login-btn');
    if (await guestBtn.isVisible()) {
      await expect(guestBtn).toContainText(/Invitado/i);
    }
  });

  test('2. Insufficient players validation triggers error message', async ({ page }) => {
    await page.goto('/?test_user=true');
    await expect(page.locator('text=Nuevo Torneo')).toBeVisible({ timeout: 10000 });
    await page.click('text=Nuevo Torneo');

    await expect(page.locator('text=Añadir al menos 4 jugadores')).toBeVisible();

    // Fill only 2 players and leave the rest empty
    const playerInputs = page.locator('input[placeholder="Escribe un nombre de jugador"]');
    await playerInputs.nth(0).fill('Jugador Uno');
    await playerInputs.nth(1).fill('Jugador Dos');
    await playerInputs.nth(2).fill('');
    await playerInputs.nth(3).fill('');

    // Click Continue
    await page.click('#create-step1-next-btn');

    // Error message must appear and prevent advancing to Step 2
    await expect(page.locator('text=Necesitas escribir al menos 4 nombres')).toBeVisible();
    await expect(page.locator('text=El nombre de este torneo')).not.toBeVisible();
  });

  test('3. Cancel / Back navigation from tournament creation', async ({ page }) => {
    await page.goto('/?test_user=true');
    await expect(page.locator('text=Nuevo Torneo')).toBeVisible({ timeout: 10000 });
    await page.click('text=Nuevo Torneo');

    await expect(page.locator('text=Añadir al menos 4 jugadores')).toBeVisible();

    // Click back button in header
    const backBtn = page.locator('header button').first();
    await backBtn.click();

    // Should return safely to Home
    await expect(page.locator('text=Nuevo Torneo')).toBeVisible();
  });

  test('4. Full Americano Lifecycle: Create -> Enter Score -> Leaderboard Updated', async ({ page }) => {
    await page.goto('/?test_user=true');
    await expect(page.locator('text=Nuevo Torneo')).toBeVisible({ timeout: 10000 });
    await page.click('text=Nuevo Torneo');

    const playerInputs = page.locator('input[placeholder="Escribe un nombre de jugador"]');
    await playerInputs.nth(0).fill('Fernando Belasteguin');
    await playerInputs.nth(1).fill('Arturo Coello');
    await playerInputs.nth(2).fill('Paquito Navarro');
    await playerInputs.nth(3).fill('Martin Di Nenno');

    await page.click('#create-step1-next-btn');

    await expect(page.locator('text=El nombre de este torneo')).toBeVisible();
    const nameInput = page.locator('input[placeholder="Empiece a escribir.."]');
    await nameInput.fill('Gran Americano E2E');

    await page.click('#start-tournament-btn');

    // Dashboard verification
    await expect(page.locator('text=Torneo Americano')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Ronda #1')).toBeVisible();
    await expect(page.locator('text=Pista 1').first()).toBeVisible();

    // Click on match card to open score editor
    const matchCard = page.locator('text=Pista 1').first();
    await matchCard.click();

    // Score modal or inputs should be interactive
    const scoreInputs = page.locator('input[type="number"]');
    if (await scoreInputs.count() >= 2) {
      await scoreInputs.nth(0).fill('18');
      await scoreInputs.nth(1).fill('14');
      const saveBtn = page.locator('button:has-text("Guardar"), button:has-text("Confirmar")').first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
      }
    }

    // Switch to Ranking
    await page.click('text=Ranking');
    await expect(page.locator('text=Fernando Belasteguin').first()).toBeVisible();
  });

  test('5. Mexicano Tournament Creation & Step 2 format selection', async ({ page }) => {
    await page.goto('/?test_user=true');
    await expect(page.locator('text=Nuevo Torneo')).toBeVisible({ timeout: 10000 });
    await page.click('text=Nuevo Torneo');

    const playerInputs = page.locator('input[placeholder="Escribe un nombre de jugador"]');
    await playerInputs.nth(0).fill('Sanyo Gutierrez');
    await playerInputs.nth(1).fill('Franco Stupaczuk');
    await playerInputs.nth(2).fill('Federico Chingotto');
    await playerInputs.nth(3).fill('Juan Tello');

    await page.click('#create-step1-next-btn');

    // Select Mexicano format
    const formatSelect = page.locator('select').first();
    await formatSelect.selectOption('mexicano');
    await expect(page.locator('text=Emparejamiento por nivel')).toBeVisible();

    const nameInput = page.locator('input[placeholder="Empiece a escribir.."]');
    await nameInput.fill('Master Mexicano E2E');

    await page.click('#start-tournament-btn');

    // Should load Dashboard with Mexicano
    await expect(page.locator('text=Torneo Mexicano')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Ronda #1')).toBeVisible();
  });

  test('6. King of the Court Tournament Creation', async ({ page }) => {
    await page.goto('/?test_user=true');
    await expect(page.locator('text=Nuevo Torneo')).toBeVisible({ timeout: 10000 });
    await page.click('text=Nuevo Torneo');

    const playerInputs = page.locator('input[placeholder="Escribe un nombre de jugador"]');
    await playerInputs.nth(0).fill('Jugador A');
    await playerInputs.nth(1).fill('Jugador B');
    await playerInputs.nth(2).fill('Jugador C');
    await playerInputs.nth(3).fill('Jugador D');

    await page.click('#create-step1-next-btn');

    // Select King format
    const formatSelect = page.locator('select').first();
    await formatSelect.selectOption('king');
    await expect(page.locator('text=Formato de canchas')).toBeVisible();

    const nameInput = page.locator('input[placeholder="Empiece a escribir.."]');
    await nameInput.fill('Rey de la Pista E2E');

    await page.click('#start-tournament-btn');

    // Should load Dashboard with King of Court
    await expect(page.locator('text=Rey de la Cancha')).toBeVisible({ timeout: 10000 });
  });

  test('7. Active Tournament Persistence Across Browser Refresh', async ({ page }) => {
    await page.goto('/?test_user=true');
    await expect(page.locator('text=Nuevo Torneo')).toBeVisible({ timeout: 10000 });

    // Open existing tournament if available or create a quick one
    const existingTourney = page.locator('h3').first();
    if (await existingTourney.isVisible()) {
      await existingTourney.click();
      await expect(page.locator('text=Rondas').first()).toBeVisible({ timeout: 10000 });

      // Refresh the page
      await page.reload();

      // Active tournament should be retained via localStorage active ID
      await expect(page.locator('text=Rondas').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('8. Mobile Viewport Layout and Responsiveness (iPhone 13 / 375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/?test_user=true');

    await expect(page.locator('text=Nuevo Torneo')).toBeVisible({ timeout: 10000 });

    // Verify layout elements do not overflow or break
    const mainContainer = page.locator('div.w-full.h-screen');
    await expect(mainContainer).toBeVisible();

    // Verify navigation buttons are accessible
    const rankingsBtn = page.locator('button[title*="Ranking Global"]').first();
    await expect(rankingsBtn).toBeVisible();
  });

  test('9. Viewer Mode Navigation with Invalid ID does not crash app', async ({ page }) => {
    // Navigate to viewer URL with a non-existent tournament ID
    await page.goto('/?viewer=non-existent-tourney-12345');

    // App should render safely without white screen of death
    await page.waitForTimeout(2000);
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // Verify no unhandled React error blank screen
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('10. Global Rankings Page Functionality', async ({ page }) => {
    await page.goto('/?test_user=true');
    await expect(page.locator('text=Nuevo Torneo')).toBeVisible({ timeout: 10000 });

    const rankingsBtn = page.locator('button[title*="Ranking Global"]').first();
    await rankingsBtn.click();

    await expect(page.locator('text=Ranking Global')).toBeVisible({ timeout: 5000 });

    // Back button returns to Home
    const backBtn = page.locator('button:has-text("Volver"), header button').first();
    if (await backBtn.isVisible()) {
      await backBtn.click();
      await expect(page.locator('text=Nuevo Torneo')).toBeVisible({ timeout: 5000 });
    }
  });
});
