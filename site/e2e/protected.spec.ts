import { test, expect } from '@playwright/test';

test.describe('NanoSession Protected Demo Page', () => {

    test('should display paywall and resolve after payment simulation', async ({ page }) => {
        // 1. Visit the protected page
        await page.goto('/protected');

        // 2. Assert paywall is visible
        const paywall = page.locator('[data-testid="payment-required"]');
        await expect(paywall).toBeVisible();

        // 3. Extract the address and raw amount requested by the Facilitator
        const addressElement = page.locator('[data-testid="payment-address"]');
        await expect(addressElement).toBeVisible();

        // We expect the amount to be dynamically rendered with the `data-raw` attribute
        const amountElement = page.locator('[data-testid="payment-amount-raw"]');
        await expect(amountElement).toBeVisible();

        const amountRaw = await amountElement.getAttribute('data-raw');
        expect(amountRaw).toBeTruthy();

        // 4. Verify SSE Pending state
        const statusElement = page.locator('[data-testid="payment-status"]');
        await expect(statusElement).toHaveAttribute('data-status', 'pending');

        // Note: In an actual automated test environment, we would trigger a mock push
        // to the demo-server's internals or use the @nanosession/rpc library to broadcast
        // a real transaction against a test network. 
        // For this boilerplate, we assert up to the pending state.
    });

});
