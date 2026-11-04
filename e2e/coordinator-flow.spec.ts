import { expect, PASSWORD, test } from "./fixtures";

// Full coordinator path: filter by gmina + two services -> card shows the missing one -> public profile has
// no contact in the DOM -> anonymous contact click redirects to sign-in -> sign-up keeps `next` and preselects
// the coordinator role -> landing on /kontakt/<id> shows the caregiver's phone and e-mail.
// Mutating next (signup.ts), /kontakt protection (middleware.ts) or the gmina island's hidden input
// (GminaSelect.tsx) each turn part of this red; the last one is invisible to the HTTP-only smoke test.
test("coordinator finds a caregiver, signs up with next, and sees contact", async ({ page, caregiver }, testInfo) => {
  await page.goto("/opiekunowie");

  // cmdk's own CommandInput always sets aria-labelledby (pointing at its empty visually-hidden <label>) next
  // to aria-label="Szukaj gminy": getByRole resolves the browser's accessible name (falls back to aria-label),
  // but getByLabel's own, narrower label-resolution never does, so it can never find this input by that label.
  const gminaSearchInput = page.getByRole("combobox", { name: "Szukaj gminy" });
  // The gmina button is only live once the island hydrates; a click just before that lands on plain HTML and
  // is lost, so retry the click itself until the search input actually opens (not a fixed wait).
  await expect(async () => {
    await page.getByRole("button", { name: "Wybierz gminę" }).click();
    await expect(gminaSearchInput).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await gminaSearchInput.fill("Łódź");
  await page.getByRole("option", { name: caregiver.gmina.label }).click();

  await page.getByLabel(caregiver.service.label).check();
  await page.getByLabel(caregiver.missingService.label).check();

  await page.getByRole("button", { name: "Pokaż wyniki" }).click();

  // The gmina island's hidden input must submit under the server's expected field name: a renamed
  // input silently drops the filter from the GET query, which the card-content checks below wouldn't catch.
  await expect(page).toHaveURL(new RegExp(`gmina=${caregiver.gmina.teryt}`));

  const card = page.getByRole("article").filter({ hasText: caregiver.displayName });
  await expect(card).toBeVisible();
  await expect(card.getByText(`Brakuje usług: ${caregiver.missingService.label}`)).toBeVisible();

  if (testInfo.project.name === "mobile") {
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);

    const submitButton = page.getByRole("button", { name: "Pokaż wyniki" });
    await submitButton.scrollIntoViewIfNeeded();
    await expect(submitButton).toBeInViewport();

    await card.scrollIntoViewIfNeeded();
    await expect(card).toBeInViewport();
  }

  await card.getByRole("link", { name: caregiver.displayName }).click();
  await expect(page).toHaveURL(`/opiekunowie/${caregiver.id}`);

  // No contact in any form, visible text or markup (tel:/mailto: hrefs included), for an anonymous visitor.
  const publicHtml = await page.content();
  expect(publicHtml).not.toContain(caregiver.phone);
  expect(publicHtml).not.toContain(caregiver.phoneDisplay);
  expect(publicHtml).not.toContain(caregiver.contactEmail);

  await page.getByRole("link", { name: "Pokaż dane kontaktowe" }).click();
  await expect(page).toHaveURL(`/auth/signin?next=%2Fkontakt%2F${caregiver.id}`);

  await page.getByRole("link", { name: "Załóż konto" }).click();
  await expect(page).toHaveURL(`/auth/signup?next=%2Fkontakt%2F${caregiver.id}`);
  await expect(page.getByLabel("Szukam opieki dla bliskiej osoby — koordynator")).toBeChecked();

  const coordinatorEmail = `e2e-coordinator-${Date.now()}-${testInfo.project.name}@example.com`;
  await page.getByLabel("E-mail").fill(coordinatorEmail);
  await page.getByLabel("Hasło", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Powtórz hasło").fill(PASSWORD);
  await page.getByRole("button", { name: "Załóż konto" }).click();

  await expect(page).toHaveURL(`/kontakt/${caregiver.id}`);
  await expect(page.getByRole("link", { name: caregiver.phoneDisplay })).toBeVisible();
  await expect(page.getByRole("link", { name: caregiver.contactEmail })).toBeVisible();
  await expect(page.getByText(coordinatorEmail)).toBeVisible();
});
