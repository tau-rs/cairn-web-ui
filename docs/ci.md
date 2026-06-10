# CI

cairn-web-ui runs a **two-tier** pipeline: a lean per-PR gate (fast feedback,
the only required check) and scheduled deep checks (comprehensive, never
gating). Features flow as PRs through the merge queue — there is no
time-based release train.

## Tier 1 — per-PR gate (`ci.yml`)
Runs on every push to `main`, every PR, and `merge_group`. Jobs:
- **web** — ESLint, Prettier check, `tsc --noEmit`, Vitest, `vite build`.
- **e2e** — Playwright (Chromium), report artifact on failure.
- **tauri** — `cargo fmt --check`, `clippy -D warnings`, `cargo test` (Linux).
- **ci-summary** — aggregates the above; green only when every job
  succeeded or skipped. **This is the single check to require on `main`.**

Concurrency cancels superseded runs except on `main` (so the cache write
that warms PR builds is never cancelled mid-write).

## The self-maintaining flywheel
- **`dependabot.yml`** — weekly bumps for GitHub Actions, npm (`web/`), and
  Cargo (`src-tauri/`), grouped by lockstep family.
- **`claude-review.yml`** — AI review of every PR, including Dependabot's
  (`allowed_bots: dependabot`).
- **`auto-update-prs.yml`** — updates every behind, non-draft PR (merges `main`
  in via GitHub's "Update branch") when `main` advances, so strict branch
  protection never strands a PR.
- **`auto-rerun-flaky.yml`** — reruns a CI run only when *every* failed job
  matches the flaky allowlist (`e2e`, `review PR`); a real failure stays red.

## Tier 2 — scheduled deep checks (never required)
- **`nightly.yml`** (`0 3 * * *`) — cross-platform Tauri compile
  (Linux/macOS/Windows), full-browser Playwright (Chromium/Firefox/WebKit),
  and `pnpm audit` + `cargo audit`.
- **`mutation-weekly.yml`** (`0 4 * * 1`) — Stryker mutation testing of `web/`.

A red nightly/weekly is a signal to investigate, not a merge blocker.

## Make the gate required on `main`
Require **only** `ci-summary` (the scheduled workflows must stay off the PR
path). In the UI: Settings → Branches → rule for `main` → require status check
`ci-summary`. Or via `gh` (run after at least one CI run exists so the context
is known):

```bash
gh api -X PUT repos/tau-rs/cairn-web-ui/branches/main/protection \
  -f 'required_status_checks[strict]=true' \
  -f 'required_status_checks[checks][][context]=ci-summary' \
  -F 'enforce_admins=true' \
  -F 'required_pull_request_reviews=' \
  -F 'restrictions='
```
