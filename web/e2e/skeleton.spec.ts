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

  // Create a new note that links to ideas (via the styled modal).
  await page.getByRole("button", { name: /new note/i }).click();
  const newNoteDialog = page.getByRole("dialog");
  await newNoteDialog.getByPlaceholder("notes/idea.md").fill("fresh.md");
  await newNoteDialog.getByRole("button", { name: /^create$/i }).click();
  // New note opens editable in live preview — type directly into CodeMirror.
  const cm = page.locator(".cm-content");
  await cm.click();
  await page.keyboard.type("a new note pointing at [[ideas]]");
  // Move cursor to start of line so the cursor no longer touches the wikilink;
  // live preview then renders the [[ideas]] as a widget.
  await page.keyboard.press("Home");
  // In live preview the wikilink renders as a clickable widget (not raw [[…]]).
  await expect(
    page.locator(".cm-lp-wikilink", { hasText: "ideas" }).first(),
  ).toBeVisible();

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

  // Manual commit via the styled modal records a commit id.
  await page.getByRole("button", { name: /^commit$/i }).click();
  const commitDialog = page.getByRole("dialog");
  await commitDialog
    .getByPlaceholder("Describe this change")
    .fill("e2e snapshot");
  await commitDialog.getByRole("button", { name: /^commit$/i }).click();
  await expect(page.getByText(/@c\d{4}/)).toBeVisible();
});

test("graph view: toggle, see nodes, click to open a note", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("ideas.md")).toBeVisible(); // app loaded (mock fixture)

  await page.getByRole("button", { name: /^graph$/i }).click();

  // React Flow renders node labels (stems) inside .react-flow.
  const flow = page.locator(".react-flow");
  await expect(flow.getByText("ideas", { exact: true }).first()).toBeVisible();

  // Clicking the "index" node opens index.md and returns to the editor (live preview).
  await flow.getByText("index", { exact: true }).first().click();
  await expect(page.locator(".cm-lp-h1")).toBeVisible();
});

test("live preview: heading styled, wikilink opens note, source toggle shows raw", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "index.md" }).click();

  // Heading is styled in live preview (the "# " marker is hidden).
  await expect(page.locator(".cm-lp-h1")).toBeVisible();

  // [[ideas]] is a clickable widget; clicking opens ideas.md.
  await page.locator(".cm-lp-wikilink", { hasText: "ideas" }).first().click();
  await expect(page.locator(".cm-content")).toContainText("Ideas");

  // Toggle to Source → raw markdown ("# Ideas") visible.
  await page.getByRole("button", { name: /^source$/i }).click();
  await expect(page.locator(".cm-content")).toContainText("# Ideas");
});

test("document live-preview: blocks render, checkbox toggles, code reveals raw", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "kitchensink.md" }).click();

  // Block elements render in live preview (load-bearing: the StateField-based
  // block table widget must render in a real browser without throwing).
  await expect(page.locator(".cm-lp-table")).toBeVisible();
  await expect(page.locator("img.cm-lp-img")).toBeVisible();
  await expect(page.locator(".cm-lp-hr")).toBeVisible();
  await expect(page.locator(".cm-lp-codeblock").first()).toBeVisible();
  await expect(page.locator(".cm-lp-bullet").first()).toBeVisible();
  // The rendered table is a real <table> with the fixture's cells.
  await expect(
    page.locator(".cm-lp-table").getByRole("columnheader", { name: "A" }),
  ).toBeVisible();
  await expect(
    page.locator(".cm-lp-table").getByRole("cell", { name: "1" }),
  ).toBeVisible();

  // The open task renders an unchecked checkbox; clicking it checks the source.
  const openTask = page.locator(".cm-lp-task.unchecked").first();
  await expect(openTask).toBeVisible();
  await openTask.click();
  // After toggle the source has one more checked task than before (now two).
  await expect(page.locator(".cm-lp-task.checked")).toHaveCount(2);

  // Reveal-on-cursor: clicking into the fenced code block places the caret on
  // its line and swaps the rendered block back to its raw markdown source.
  await page.locator(".cm-lp-codeblock").first().click();
  await expect(page.getByText("```js").first()).toBeVisible();
  await expect(page.getByText("const x = 1;").first()).toBeVisible();
});
