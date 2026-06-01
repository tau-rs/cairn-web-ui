import { test, expect } from "@playwright/test";

test("create, edit, autosave, search, backlink, commit", async ({ page }) => {
  await page.goto("/");

  // Fixture notes are listed.
  await expect(page.getByText("index.md")).toBeVisible();
  await expect(page.getByText("ideas.md")).toBeVisible();

  // Open a note; its backlinks show (index.md links to ideas).
  await page.getByRole("button", { name: "ideas.md" }).click();
  await expect(page.getByText("Backlinks")).toBeVisible();
  await expect(
    page.locator("aside").last().getByRole("button", { name: "index.md" }),
  ).toBeVisible();

  // Create a new note that links to ideas.
  page.once("dialog", (d) => d.accept("fresh.md"));
  await page.getByRole("button", { name: /new note/i }).click();
  // New note opens in the rendered view; toggle to source (CodeMirror) to type.
  await page.getByRole("button", { name: /edit source/i }).click();
  const cm = page.locator(".cm-content");
  await cm.click();
  await cm.fill("a new note pointing at [[ideas]]");
  // Back to the rendered view; the wikilink renders as a clickable link.
  await page.getByRole("button", { name: /^done$/i }).click();
  await expect(page.getByRole("link", { name: "ideas" })).toBeVisible();

  // Autosave fires after the debounce; status returns to Saved.
  await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

  // Search finds the new note by body text.
  await page.getByPlaceholder("Search…").fill("pointing");
  await page.getByPlaceholder("Search…").press("Enter");
  const results = page.getByTestId("search-results");
  await expect(results.getByText(/Results/)).toBeVisible();
  // Scope to the overlay: "fresh.md" also exists in the note list.
  await results.getByRole("button", { name: "fresh.md" }).click();

  // ideas.md now has fresh.md as a backlink.
  await page.getByRole("button", { name: "ideas.md" }).click();
  await expect(
    page.locator("aside").last().getByRole("button", { name: "fresh.md" }),
  ).toBeVisible();

  // Manual commit records a commit id.
  page.once("dialog", (d) => d.accept("e2e snapshot"));
  await page.getByRole("button", { name: /^commit$/i }).click();
  await expect(page.getByText(/@c\d{4}/)).toBeVisible();
});

test("graph view: toggle, see nodes, click to open a note", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ideas.md")).toBeVisible(); // app loaded (mock fixture)

  await page.getByRole("button", { name: /^graph$/i }).click();

  // React Flow renders node labels (stems) inside .react-flow.
  const flow = page.locator(".react-flow");
  await expect(flow.getByText("ideas", { exact: true }).first()).toBeVisible();

  // Clicking the "index" node opens index.md and returns to the editor (rendered).
  await flow.getByText("index", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Index" })).toBeVisible();
});
