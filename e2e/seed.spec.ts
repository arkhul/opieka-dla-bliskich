import { expect, test } from "@playwright/test";

// Proves build -> preview -> browser works on both projects (desktop, mobile), before any flow logic lands.
// Does not depend on data in the database: the heading and the filter form render regardless of search results.
test("caregiver list renders the results heading and the filter form", async ({ page }) => {
  await page.goto("/opiekunowie");

  await expect(page.getByRole("heading", { name: /^Wyniki: \d+$/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pokaż wyniki" })).toBeVisible();
});
