import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Fluxo de Autenticação
 * 
 * Testa:
 * - Acesso à página de login
 * - Elementos do formulário
 * - Validação de campos
 */

test.describe('Autenticação', () => {

    test('deve exibir página de login', async ({ page }) => {
        await page.goto('/');

        // Deve redirecionar para login se não autenticado
        await expect(page).toHaveURL(/login|auth/);
    });

    test('deve ter campos de email e senha', async ({ page }) => {
        await page.goto('/');

        // Verificar elementos do formulário
        const emailInput = page.locator('input[type="email"], input[name="email"]');
        const passwordInput = page.locator('input[type="password"]');
        const submitButton = page.locator('button[type="submit"]');

        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        await expect(submitButton).toBeVisible();
    });

    test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
        await page.goto('/');

        // Preencher formulário com dados inválidos
        await page.fill('input[type="email"], input[name="email"]', 'teste@invalido.com');
        await page.fill('input[type="password"]', 'senhaerrada123');

        // Submeter
        await page.click('button[type="submit"]');

        // Aguardar resposta e verificar erro
        await page.waitForTimeout(2000);

        // Deve permanecer na página de login ou mostrar erro
        const currentUrl = page.url();
        const hasError = await page.locator('[class*="error"], [class*="toast"], [role="alert"]').count();

        expect(currentUrl.includes('login') || hasError > 0).toBeTruthy();
    });

});
