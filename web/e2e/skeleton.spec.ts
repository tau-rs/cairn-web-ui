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

test("graph view: toggle shows the force-graph canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ideas.md")).toBeVisible(); // app loaded (mock fixture)

  await page.getByRole("button", { name: /^graph$/i }).click();

  // The force-graph renders a <canvas>; the toggle flips to "Editor".
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^editor$/i })).toBeVisible();

  // The forces gear opens the settings panel.
  await page.getByRole("button", { name: "Graph forces" }).click();
  await expect(page.getByLabel("Center force")).toBeVisible();

  // Color groups: the Groups section is present and Add group adds a row.
  await expect(page.getByText("Groups", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /add group/i }).click();
  await expect(page.getByLabel("Group query")).toBeVisible();
});

test("graph local mode: open a note, switch to Local, canvas renders", async ({
  page,
}) => {
  await page.goto("/");
  // Open a note so the graph has a root.
  await page.getByRole("button", { name: "index.md" }).click();
  // Switch to the graph view.
  await page.getByRole("button", { name: /^graph$/i }).click();
  // Toggle to Local — the canvas (now the index.md neighborhood) still renders.
  await page.getByRole("button", { name: "Local" }).click();
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Local" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
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

test("click-to-edit: blockquote, code block, and image reveal raw on click", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "kitchensink.md" }).click();
  const content = page.locator(".cm-content");

  // Blockquote: clicking its text reveals the raw "> " marker.
  await page.getByText("a quoted line").click();
  await expect(content).toContainText("> a quoted line");

  // Code block: clicking inside reveals the ``` fences.
  await page.getByText("const x = 1;").click({ position: { x: 4, y: 8 } });
  await expect(content).toContainText("```");

  // Image: clicking the rendered <img> reveals its raw markdown and removes the img.
  await expect(page.locator("img.cm-lp-img")).toBeVisible();
  await page.locator("img.cm-lp-img").click();
  await expect(content).toContainText("![logo](img/logo.png)");
  await expect(page.locator("img.cm-lp-img")).toHaveCount(0);
});

test("table editor: click to edit a cell and commit on click-away", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "kitchensink.md" }).click();
  const content = page.locator(".cm-content");

  // Click the rendered table → it becomes editable.
  await page.locator(".cm-lp-table").first().click();
  const firstCell = page
    .locator(".cm-lp-table.editing th, .cm-lp-table.editing td")
    .first();
  await expect(firstCell).toBeVisible();

  // Edit a body cell, then click away to commit.
  const cell = page.locator(".cm-lp-table.editing td").first();
  await cell.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type("X1");
  await page.getByText("Kitchen sink").click(); // click away
  // The committed value appears in the document source / re-rendered table.
  await expect(content).toContainText("X1");
});

test("table editor: add a row and a column, commit on click-away", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "kitchensink.md" }).click();

  await page.locator(".cm-lp-table").first().click();
  const rowsBefore = await page
    .locator(".cm-lp-table.editing tbody tr")
    .count();

  await page.locator(".cm-lp-add-row").click();
  await expect(page.locator(".cm-lp-table.editing tbody tr")).toHaveCount(
    rowsBefore + 1,
  );

  const colsBefore = await page
    .locator(".cm-lp-table.editing thead th")
    .count();
  await page.locator(".cm-lp-add-col").click();
  await expect(page.locator(".cm-lp-table.editing thead th")).toHaveCount(
    colsBefore + 1,
  );

  // Click away → commit; re-render read-only, then re-open to confirm persisted.
  await page.getByText("Kitchen sink").click();
  await page.locator(".cm-lp-table").first().click();
  await expect(page.locator(".cm-lp-table.editing tbody tr")).toHaveCount(
    rowsBefore + 1,
  );
  await expect(page.locator(".cm-lp-table.editing thead th")).toHaveCount(
    colsBefore + 1,
  );
});

test("table editor: Tab moves between cells", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "kitchensink.md" }).click();
  await page.locator(".cm-lp-table").first().click();
  const cells = page.locator(
    ".cm-lp-table.editing th, .cm-lp-table.editing td",
  );
  await cells.first().click();
  await page.keyboard.press("Tab");
  // focus advanced to the second cell
  await expect(cells.nth(1)).toBeFocused();
});

test("command palette: ⌘K quick-opens a note and runs a command", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("ideas.md")).toBeVisible(); // app loaded

  // Open the palette (Control+k works on CI; the app listener accepts meta or ctrl).
  await page.keyboard.press("Control+k");
  const input = page.getByPlaceholder(/type a command/i);
  await expect(input).toBeVisible();

  // Quick-open a note.
  await input.fill("ideas");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cm-content")).toContainText("Ideas"); // ideas.md opened

  // Re-open, run the Commit command → the commit dialog appears.
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder(/type a command/i).fill("commit");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: /^commit$/i }).last(),
  ).toBeVisible(); // commit dialog's submit button
});
