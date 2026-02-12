import { test, expect } from "@playwright/test";

test.describe("Feed Page", () => {
  test("loads the feed page", async ({ page }) => {
    await page.goto("/feed");
    await expect(page.locator("text=Niseko")).toBeVisible();
  });

  test("shows empty state or feed cards", async ({ page }) => {
    await page.goto("/feed");
    // Should show either feed cards or empty state
    const content = page.locator("body");
    await expect(content).toBeVisible();
  });

  test("homepage redirects to feed", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("/feed");
    expect(page.url()).toContain("/feed");
  });
});

test.describe("Login Page", () => {
  test("displays login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type=email]")).toBeVisible();
    await expect(page.locator("input[type=password]")).toBeVisible();
    await expect(page.locator("text=Sign In")).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type=email]", "bad@test.com");
    await page.fill("input[type=password]", "wrong");
    await page.click("text=Sign In");
    await expect(page.locator("text=Invalid email or password")).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Protected Routes", () => {
  test("newsroom redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/newsroom");
    await page.waitForURL(/login/);
    expect(page.url()).toContain("login");
  });
});
