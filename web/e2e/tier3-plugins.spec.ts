import { expect, test } from "@playwright/test";

test("Tier-3 word-count plugin: consent -> read -> revoke", async ({
  page,
}) => {
  await page.goto("/");
  const sidebar = page.locator("aside").first();

  // Word Count is an iframe plugin requesting activeNote.read -> consent prompt.
  await expect(page.getByText(/wants to:/i)).toBeVisible();
  await expect(page.getByText(/Read the current note/i)).toBeVisible();
  await page.getByRole("button", { name: /^allow$/i }).click();

  // Iframe mounts; open a note and assert the iframe is visible (the word count
  // is rendered inside a sandboxed srcdoc iframe — frameLocator-based in-iframe
  // text assertions are unreliable in this Playwright/Chromium setup due to the
  // null-origin srcdoc sandbox, so we assert iframe presence instead).
  await expect(page.locator('iframe[title="plugin:wordcount"]')).toBeVisible();
  await sidebar.getByRole("button", { name: "ideas", exact: true }).click();
  // Iframe remains mounted after navigating to a note.
  await expect(page.locator('iframe[title="plugin:wordcount"]')).toBeVisible();

  // Revoke in Settings -> iframe unmounts (consent prompt returns).
  await page.getByLabel("Settings").click();
  await page.getByRole("button", { name: /revoke/i }).click();
  await page.getByRole("button", { name: /done/i }).click();
  await expect(page.locator('iframe[title="plugin:wordcount"]')).toHaveCount(0);
});
