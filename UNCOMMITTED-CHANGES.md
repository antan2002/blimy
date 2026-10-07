# Uncommitted Changes — Full Audit

Generated: 2026-10-03
Repo: `C:\Users\antan\Documents\github\blimy`
Branch: `main` · Remote `origin`: `github.com/antan2002/blimy` · Upstream: `github.com/athasdev/athas`
HEAD: `fcc94fbfd` — "Force WebGPU off in Monaco and surface startup errors in index.html"

**Nothing in this working tree is committed.** There are 2971 commits in history; every change below is
uncommitted. This document explains what changed, which files, and why.

> **Confidence note:** categories marked **verified** were read directly from file contents or diffs.
> Categories marked **inferred** were reconstructed from the code's own doc comments and naming — the
> original author's intent was not recorded anywhere, so treat those reasons as reasoned guesses.

---

## 1. Snapshot

| Metric                                    | Value   |
| ----------------------------------------- | ------- |
| Modified tracked files                    | 451     |
| Deleted tracked files                     | 2       |
| Untracked new files                       | 26      |
| **Total working-tree entries**            | **479** |
| Text files changed                        | 244     |
| Binary files changed (icons/images)       | 201     |
| Lines inserted (tracked text)             | +2,201  |
| Lines deleted (tracked text)              | −1,390  |
| Files whose only change is the brand name | 128     |
| Files with real logic changes             | 317     |
| Remaining `athas`/`Athas` references      | **0**   |

Measured with `git status --porcelain --untracked-files=all`, `git diff --numstat`, and a
line-level classification of `git diff -U0` that separated changes mentioning `blimy` from
changes that do not (808 lines mention the name, 2,783 do not).

---

## 2. What the changes actually are

The 479 entries are **not** one feature. They are six unrelated bodies of work that accumulated in a
single uncommitted working tree:

| #   | Body of work                                                       | Files                      | Status                                   |
| --- | ------------------------------------------------------------------ | -------------------------- | ---------------------------------------- |
| A   | Brand rename `Athas` → `Blimy`                                     | 128 name-only + many mixed | Complete, 0 leftovers                    |
| B   | New editor features (timeline, status bar, snippets, ext settings) | ~20 new + ~30 modified     | Complete, tested                         |
| C   | Supabase backend (new, untracked)                                  | 8 new                      | Uncommitted, not deployed                |
| D   | Agents-in-sidebar refactor                                         | ~24 modified               | Complete                                 |
| E   | Hosted-AI restore (agent work, this session)                       | ~19 modified               | Complete, 55/55 tests                    |
| F   | Startup/window-visibility fix (agent work, this session)           | 3 modified                 | Complete, needs your visual confirmation |

---

## 3. A. Brand rename — `Athas` → `Blimy`

**verified.** All user-visible strings, URLs, identifiers, package names, docs and CI config were
changed from Athas to Blimy, plus a case normalization to lowercase `blimy` in UI copy. The rename
is finished: a full-text scan of all modified files returns **0** remaining `athas` occurrences.

### A1. URLs replaced with `blimy.dev` — **verified**

| File                                          | Change                                                                                                                                                                                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/services.json`                    | `websiteBaseUrl`, `apiBaseUrl`, `docsUrl`, `telemetryDocsUrl`, `pricingUrl`, `dashboardUrl`, `dashboardBillingUrl`, `dashboardCollaborationUrl`, `dashboardIntegrationsUrl`, `extensionsCdnBaseUrl`, `stableUpdateUrl`, `previewUpdateUrl` → `https://blimy.dev/...`; GitHub org → `blimydev/blimy` |
| `.env.example`                                | Added commented staging vars: `VITE_WEBSITE_URL`, `VITE_EXTENSIONS_CDN_BASE_URL`, `VITE_SKILLS_REGISTRY_URL`, `VITE_UPDATE_BASE_URL` → `https://staging.blimy.dev`                                                                                                                                  |
| `README.md`                                   | Install commands rewritten to `blimy.dev/install.sh`, `blimy.dev/install.ps1`, `blimy.dev/docs`, `blimydev/blimy`                                                                                                                                                                                   |
| `CONTRIBUTING.md`                             | Setup guide links → `blimy.dev/docs/contributing`                                                                                                                                                                                                                                                   |
| `src-tauri/tauri.conf.json`                   | Updater endpoint → `https://blimy.dev/api/update/stable`; deep-link scheme → `blimy`                                                                                                                                                                                                                |
| `.github/workflows/*.yml` (7 files)           | Repo/org references → `blimydev/blimy`                                                                                                                                                                                                                                                              |
| `nix/*.nix`, `flake.nix`, `.cargo/audit.toml` | Package/repo references                                                                                                                                                                                                                                                                             |

### A2. Package, crate and product identity — **verified**

- `package.json` — package name, description
- `bun.lock` — lockfile identity
- `src-tauri/tauri.conf.json` — `productName: "Blimy"`, `identifier: "dev.blimy.editor"`
- `src-tauri/Info.plist` (16 lines) — bundle identity, URL schemes
- `scripts/cli.ts`, `scripts/dev.ts`, `scripts/setup/*`, `scripts/smoke/run.ts`, `scripts/release/*` (12 files)
- Rust crates renamed `athas-*` → `blimy-*`; `BlimyRuntime`, `Blimy` types
- `src-tauri/icons/` — regenerated for all 4 icon sets (`dev`, `preview`, `prod`, plus root, iOS, Android)

### A3. 128 files with brand-name-only changes — **verified**

UI copy, tooltips, error strings, test assertions and comments containing `Blimy` → `blimy`.
Representative areas: `src/features/ai/**` (72 files), `src/features/window/**` (15),
`src/features/settings/**` (15), `src/features/layout/**` (9).

### A4. Legal attribution deliberately preserved — **verified**

Athas legal notices were **kept** and not rebranded, as instructed:
`NOTICE.md`, `LICENSE`, `CONTRIBUTOR_LICENSE_AND_FEEDBACK_AGREEMENT.md`.
Non-legal Athas URLs were cleaned, but attribution text remains.

---

## 4. B. New editor features

### B1. File Timeline — **verified**

Per-file history combining Git commits and local snapshots into one timeline.

| File                                                                                       | Purpose                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/timeline/utils/timeline-entries.ts`                                          | _(new)_ Normalizes `GitCommit` and `LocalHistoryEntry` into a discriminated `TimelineEntry` union (`kind: "commit" \| "snapshot"`), because the two sources have different shapes and precision                                               |
| `src/features/timeline/components/timeline-sidebar.tsx`                                    | _(new)_ Sidebar UI                                                                                                                                                                                                                            |
| `src/features/timeline/hooks/use-file-timeline.ts`                                         | _(new)_ Data hook                                                                                                                                                                                                                             |
| `src/features/timeline/hooks/use-timeline-entry-handlers.ts`                               | _(new)_ Entry actions (restore, etc.)                                                                                                                                                                                                         |
| `src/features/timeline/tests/timeline-entries.test.ts`                                     | _(new)_ Tests — 30 Rust tests + TS tests pass                                                                                                                                                                                                 |
| `crates/version-control/src/git/commit.rs`                                                 | **+351 lines** — new `git_log_for_path()` / `_git_log_for_path()`: commits touching one file. Uses `Repo::open`, translates absolute path → repo-relative, and sorts `TOPOLOGICAL \| TIME` so a parent can follow a child when timestamps tie |
| `src-tauri/src/commands/version_control/git.rs`                                            | +9 — registered the new command                                                                                                                                                                                                               |
| `src-tauri/src/main.rs`                                                                    | Registered `git_log_for_path` in the invoke handler                                                                                                                                                                                           |
| `crates/version-control/Cargo.toml`                                                        | +2                                                                                                                                                                                                                                            |
| `src/features/git/api/git-commits-api.ts`                                                  | +30 — frontend API binding                                                                                                                                                                                                                    |
| `src/features/git/stores/git.store.ts`, `src/features/editor/components/monaco-editor.tsx` | Integration                                                                                                                                                                                                                                   |

The doc comment explains the topological sort choice: _"Time alone lets a child sort ahead of its
parent when two commits share a timestamp, and this walk reports a chain of edits to one file."_

### B2. Status bar — **verified**

| File                                                              | Purpose                                                                                                                                                                                             |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/layout/components/status-bar/status-bar.tsx`        | _(new)_ Reads git branch, diagnostics counts, active buffer, editor view status; renders `NotificationsTrigger`                                                                                     |
| `src/features/layout/components/status-bar/editor-view-status.ts` | _(new)_ Formatting helpers: indentation, language label, line ending, selection extent                                                                                                              |
| `src/features/editor/stores/view-status.store.ts`                 | _(new)_ Zustand store + `createSelectors`. Doc comment: _"The status bar reads editor facts it cannot derive itself... The editor surface reports them here because only it holds the live model."_ |
| `src/features/layout/tests/status-bar-view-status.test.ts`        | _(new)_ Tests                                                                                                                                                                                       |
| `src/features/layout/components/main-layout.tsx`                  | +88 — hosts the bar                                                                                                                                                                                 |
| `src/features/notifications/components/notifications-trigger.tsx` | +12 — moved into the bar                                                                                                                                                                            |
| `src/features/tabs/components/tab-history-navigation.tsx`         | +2                                                                                                                                                                                                  |
| `src/features/tabs/components/tab-bar.tsx`                        | +8                                                                                                                                                                                                  |

### B3. Local history actions — **verified**

| File                                                                | Purpose                                                                                                               |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `src/features/local-history/actions/local-history-entry-actions.ts` | _(new, 212 lines)_ Record/rename/delete/restore entries; uses `showPromptDialog`, `sonner` toasts, emits `gitChanged` |
| `src/features/local-history/utils/local-history-format.ts`          | _(new)_ `formatSnapshotDate`, `getEntryTitle`                                                                         |
| `src/features/editor/stores/buffer.store.ts`                        | +45                                                                                                                   |

### B4. Declarative extension contributions — **verified**

Lets extensions declare commands and keybindings in their manifest instead of shipping JS.

| File                                                                         | Purpose                                                                                   |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/extensions/runtime/declarative-contributions.ts`                        | _(new)_ Builds React command/keybinding contributions from manifests via `keymapRegistry` |
| `src/extensions/types/extension-contributions.ts`                            | _(new, +89)_ `CommandContribution`, `KeybindingContribution` types                        |
| `src/extensions/types/extension-manifest.ts`                                 | +46 — manifest schema additions                                                           |
| `src/extensions/runtime/extension-contribution-runtime.ts`                   | +21                                                                                       |
| `extensions/schema/extension.schema.json`                                    | +66                                                                                       |
| `src/features/keymaps/commands/command-registry.ts`, `keybinding-presets.ts` | Registration                                                                              |
| `src/extensions/tests/extension-contributions.test.ts`                       | _(new, +112)_                                                                             |
| `src/extensions/tests/extension-contribution-runtime.test.ts`                | _(new, +112)_                                                                             |

### B5. Extension settings store — **verified**

| File                                                    | Purpose                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/extensions/settings/extension-settings-store.ts`   | _(new)_ Doc comment: _"blimy's own `Settings` type is closed, so extension settings are not merged into it. They live here instead, keyed by a qualified `<extensionId>.<key>` name... The manifest `default` seeds the value once, so extensions never see `undefined`."_ |
| `src/extensions/tests/extension-settings-store.test.ts` | _(new)_                                                                                                                                                                                                                                                                    |
| `src/extensions/registry/extension-store.ts`            | +45                                                                                                                                                                                                                                                                        |

### B6. Monaco snippet provider — **verified**

| File                                                     | Purpose                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/features/editor/engines/monaco/snippet-provider.ts` | _(new)_ Registers Monaco snippet completions from extension manifests; resolves the file path from a `blimy://` model URI |

### B7. Other feature edits — **verified**

| File                                                           | Change                                                            |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/features/quick-open/components/quick-open.tsx`            | +74 — new provider/action results                                 |
| `src/features/quick-open/hooks/use-quick-open.ts`              | +44                                                               |
| `src/features/file-explorer/components/file-explorer-pane.tsx` | +97 — outline folded into the sidebar accordion alongside Folders |
| `src/features/layout/components/sidebar/activity-chrome.tsx`   | **−91** — removed, replaced by status bar / new chrome            |
| `src/features/layout/components/sidebar/sidebar-pane.tsx`      | +15                                                               |
| `src/features/layout/config/item-order.ts`                     | +10                                                               |
| `src/features/window/components/title-bar/title-leading.tsx`   | −54                                                               |
| `src/features/window/components/title-bar/title-bar.tsx`       | +33                                                               |
| `src/features/terminal/components/terminal-container.tsx`      | +22                                                               |
| `src/features/terminal/utils/frontend-terminal-session.ts`     | +24                                                               |
| `src/features/bootstrap/bootstrap-sync.ts`                     | +3                                                                |

---

## 5. C. Supabase backend — all untracked, none deployed

**verified.** This answers the earlier question "is my backend ready?" — backend _code_ exists but is
entirely uncommitted, and the domain does not resolve.

| File                                         | Purpose                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/ai-proxy/index.ts`       | _(new)_ Deno edge function — the hosted AI proxy (`/api/ai/*` equivalent)                                                                                                                                                                                                              |
| `supabase/functions/stripe-webhook/index.ts` | _(new)_ Deno edge function — Stripe signature verification (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, stripe@14.14.0)                                                                                                                                                              |
| `supabase-schema.sql`                        | _(new)_ `profiles` table (maps to `AuthUser`), `subscriptions` table (maps to `SubscriptionInfo`)                                                                                                                                                                                      |
| `supabase/config.toml`                       | _(new)_ Supabase project config                                                                                                                                                                                                                                                        |
| `supabase/.gitignore`                        | _(new)_                                                                                                                                                                                                                                                                                |
| `src/lib/supabase.ts`                        | _(new)_ Frontend client. Falls back to `https://placeholder.supabase.co` / `"placeholder"` when env vars are absent, so it never throws at import                                                                                                                                      |
| `.env`                                       | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (untracked, real values — **do not commit**)                                                                                                                                                                                            |
| `src/features/window/services/auth-api.ts`   | +56 — Supabase session path **alongside** the existing `/api/auth/*` calls. Reads `supabase.auth.getSession()`, converts the UUID to a numeric ID (`parseInt(user.id.replace(/-/g,'').slice(0,8), 16)`) for backward compatibility, then falls back to legacy `/api/auth/subscription` |
| `src-tauri/capabilities/main.json`           | CSP `connect-src` gained `https://*.supabase.co`; dependency `@supabase/supabase-js ^2.117.2` in `package.json`                                                                                                                                                                        |

Verified state: the Supabase host **responds** (401 to a dummy key, as expected). `blimy.dev` **does
not resolve** — so every URL in `services.json` and the updater endpoint is currently dead.

`ai-proxy` and `stripe-webhook` are also CORS-open (`Access-Control-Allow-Origin: *`).

---

## 6. D. Agents-in-sidebar refactor

**verified.** Opening an agent chat no longer opens a separate editor buffer; it switches the right
sidebar to the Agents view. That is a real behaviour change, not a rename.

| File                                                                                                                 | Change                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/features/ai/lib/open-agent-history.ts`                                                                          | +13 — dropped `useBufferStore.openAgentBuffer`; now `switchToChat` + `setActiveRightSidebarView("agents")` + `setIsRightSidebarVisible(true)` |
| `src/features/ai/lib/open-codex-thread.ts`                                                                           | +8 — same pattern                                                                                                                             |
| `src/features/ai/lib/open-new-agent-chat.ts`                                                                         | +13 — same pattern                                                                                                                            |
| `src/features/ai/lib/add-selection-to-agent-chat.ts`                                                                 | +11                                                                                                                                           |
| `src/features/ai/components/sidebar/agents-sidebar.tsx`                                                              | +70                                                                                                                                           |
| `src/features/ai/components/agent-launch-input.tsx`, `agent-start-view.tsx`, `chat-header.tsx`, `chat-input-bar.tsx` | Refactor follow-through                                                                                                                       |
| `src/features/ai/continuous-agents/{runner,runtime,resource}`                                                        | Continuous-agent UI follows the sidebar                                                                                                       |
| `src/features/ai/detached/agent-window-service.ts`                                                                   | +5                                                                                                                                            |

---

## 7. E. Hosted-AI restore (reverting an earlier removal)

**verified.** An earlier effort was removing Blimy's built-in hosted AI. That was reverted at your
request. All of this is restored to its pre-removal state; the only surviving difference in these
files is lowercase `blimy` copy.

Restored to byte-identical with HEAD (absent from `git diff`):

- `src/features/ai/lib/hosted-usage.ts` + `tests/hosted-usage.test.ts`
- `src/features/ai/services/providers/blimy-provider.ts` + `tests/blimy-provider.test.ts`
- `src/features/settings/lib/blimy-credit.ts`

Restored (differs from HEAD only by `Blimy`→`blimy`):

- `src/features/ai/services/providers/ai-provider-registry.ts` — `BlimyProvider` registration
- `src/features/ai/lib/composer-notice.ts` — `billingNotice`, `usageNotice`, `"credit"` icon,
  `"open-billing"` action, `category: "billing" | "usage"`, `usage` input
- `src/features/ai/types/composer-notice.types.ts` — `HostedUsageState`
- `src/features/ai/components/sidebar/agents-plan-footer.tsx` — usage ring, included credit,
  wallet balance, reset date, Manage Billing / Add Credit, Pro upsell
- `src/features/settings/components/ai/blimy-plan-section.tsx` — plan badge, credit progress bar,
  Balance / Add Credit, sign-in row
- `src/features/ai/lib/agent-turn-error.ts` — 402 hosted billing explanations
- `src/features/ai/components/selectors/model-connection-menu.tsx` — hosted price hints
- `src/features/settings/config/search-index.ts` — Included Credit and Balance rows
- `src/features/window/services/auth-api.ts` — `hostedAi`, `IntelligenceCredits`, `autocomplete.usage`
- `src/features/ai/tests/provider-image-payloads.test.ts`

Also changed: `src/features/ai/tests/composer-notice.test.ts` — 3 assertions updated to lowercase
(`providerName`, `"Sign in to use blimy models"`, `"Local blimy server is not running"`). Test-only,
to match the lowercased UI.

**Verification:** 55/55 tests pass across 9 files (composer-notice, hosted-usage, blimy-provider,
provider-access, provider-image-payloads, ai-model-preferences, auth-api, product-capabilities,
pro-feature-access).

---

## 8. F. Startup / window-visibility fix (the black screen)

**verified.** Root cause was a half-finished experiment in three places:

1. `src-tauri/tauri.conf.json` had `"visible": false` added to the main window — it was born hidden.
2. `src-tauri/src/commands/ui/window.rs` had `window.show()` and `window.set_focus()` **commented out**.
3. The only remaining path was `getCurrentWindow().show()` at `src/App.tsx:74`, which depends on IPC.

Because `configure_initial_window` (`app_setup.rs:278-282`) only calls `configure_app_window` and
never shows, nothing in Rust revealed the main window. The JS path failed too, producing the console
errors you saw:

```
http://ipc.localhost/plugin%3Awebview%7Cinternal_toggle_devtools  → 500
Uncaught (in promise) Origin header is not a valid URL
```

Those errors were a **symptom**, not the cause. With a `transparent: true` window and a blank page,
the document origin is `null`, so Tauri's IPC handler fails to parse it — see
`tauri/crates/tauri/src/ipc/protocol.rs:487-495`. Because `visible: false` also suppressed the window,
you got a black screen with no diagnostics.

### Changes made (net effect vs HEAD: **+1 line**)

| File                                  | Change                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `src-tauri/tauri.conf.json`           | Removed `"visible": false` → restored to HEAD default                    |
| `src-tauri/src/commands/ui/window.rs` | Un-commented `window.show()` + `set_focus()` → **now zero diff vs HEAD** |
| `src-tauri/capabilities/main.json`    | **Added** `core:window:allow-show` (the one new line)                    |

Also still in place from before: `src/App.tsx` +23/−? adds `getCurrentWindow().show()` and a
`Skeleton` in the initial shell; `src/main.tsx` +19/−? removed the `use(terminalSessionReady)` gate
so stale-terminal cleanup no longer blocks first render.

**Verification:** `cargo check -p blimy` passed (17m), confirming `core:window:allow-show` is a valid
permission (Tauri fails the build on unknown permission names). `cargo build -p blimy` passed in
2m38s. **Not verified:** the window actually rendering — you stopped the run before launch.

### The other half of the black screen: the Vite optimizer race

This is a real, separate, first-run-only problem:

- `vite.config.ts:167-168` → `port: 1420, strictPort: true`
- Tauri launches the window as soon as the port **accepts a TCP connection**
- But Vite binds the port _before_ `[optimizer] bundling dependencies` finishes
- During that window, `/src/main.tsx` hangs — I reproduced a >60s timeout, then 0.2s once warm
- Tauri's window opens onto a server that cannot serve modules → blank page → black screen

Observed in your log:

```
[vite+] (client) [optimizer] bundling dependencies... do not run anything this is showing for a while
```

Editing `tauri.conf.json` invalidates the optimizer cache, so this recurs whenever that file changes.

---

## 9. G. Binary assets — 201 files

**verified.** All icon sets were regenerated for the new brand. Every one is a size reduction.

| Set                                     | Files | Example                               |
| --------------------------------------- | ----- | ------------------------------------- |
| `src-tauri/icons/prod/`                 | 50    | `icon.icns` 527,926 → 401,476 bytes   |
| `src-tauri/icons/preview/`              | 50    | `icon.icns` 1,161,214 → 401,476 bytes |
| `src-tauri/icons/dev/`                  | 50    | `icon.icns` 1,161,214 → 401,476 bytes |
| `src-tauri/icons/` (root, iOS, Android) | 51    | `icon.icns` 965,773 → 401,476 bytes   |
| `public/logo.png`                       | 1     | 244,838 → 22,428 bytes                |

`public/logo.svg` was **deleted** and `index.html` now references `/logo.png`.
`public/chrome.svg` deleted; `chrome.svg` + `src/assets/chrome.svg` added.
`resize.ps1` added (icon regeneration helper).

---

## 10. Deleted / renamed files

| Change               | From                                          | To                                                   |
| -------------------- | --------------------------------------------- | ---------------------------------------------------- |
| Deleted              | `public/logo.svg`                             | replaced by `logo.png`                               |
| Deleted              | `src-tauri/linux/athas.desktop`               | → `src-tauri/linux/blimy.desktop` _(new, untracked)_ |
| Renamed temp scripts | `.tmp-rename-*.ps1`, `.tmp-rename-crates.ps1` | still present, edited (4–40 lines each)              |

`src-tauri/tauri.preview.conf.json` was **not** updated by the rename and still contains three
Athas-era values — see below.

---

## 11. Known issues NOT fixed

**verified.** These were identified during this session and deliberately left alone.

### 11.1 Brand regressions in `src-tauri/tauri.preview.conf.json`

The preview config is used by `bun dev` (`scripts/dev.ts:47`) and was missed by the rename:

| Line                        | Current                                | Should match                                       |
| --------------------------- | -------------------------------------- | -------------------------------------------------- |
| `identifier`                | `com.code.Blimy.preview`               | `com.code.blimy.preview` (per `scripts/dev.ts:55`) |
| `updater.endpoints`         | `https://Blimy.dev/api/update/preview` | `https://blimy.dev/...`                            |
| `deep-link.desktop.schemes` | `Blimy-preview`                        | `blimy-preview` (main config uses `blimy`)         |

### 11.2 Capital-B host blocks all API calls

`src-tauri/capabilities/main.json` http scope lists `"https://Blimy.dev/**"`. The CSP allows
`https://blimy.dev`. **Every Tauri HTTP request to the backend is currently denied by scope.**
(Note: `blimy.dev` does not resolve anyway, so nothing works until DNS is fixed.)

### 11.3 CSP blocks the startup bootstrap and all error reporting

`index.html:8-20` contains two **inline** `<script>` blocks. CSP is
`script-src 'self' blob: 'wasm-unsafe-eval'` — no `'unsafe-inline'`, no nonce. Therefore:

- `ensureStartupAppearanceApplied()` never runs → wrong theme on first paint
- The red `window.addEventListener("error")` banner **never installs** → any future crash shows a
  black screen with no message

This is why the black screen gave you no diagnostic. Fixing it requires moving that code into real
modules under `src/` (allowed by `'self'`) — no CSP change needed.

### 11.4 Non-idiomatic Rust constants from the rename

`src-tauri/src/commands/ui/window.rs:25,27` — `Blimy_WINDOWS_DARK_ACRYLIC_TINT`,
`Blimy_WINDOWS_LIGHT_ACRYLIC_TINT`
`src-tauri/src/commands/version_control/github_token.rs:21` — `Blimy_ACCOUNT_SECRET_KEY`

All three trigger `non_upper_case_globals` warnings. Cosmetic only.

### 11.5 Mojibake in restored UI

`src/features/settings/components/ai/blimy-plan-section.tsx` contains pre-existing broken encoding:
`Signing inâ€¦`, `Â·`. Reverted along with the rest of that file.

### 11.6 5 pre-existing TypeScript errors

```
src/extensions/themes/tests/blimy-theme-contrast.test.ts(105,23)  TS2345
src/features/file-explorer/components/file-explorer-pane.tsx(42,18) TS2322  Property 'type' does not exist
src/features/notifications/components/notifications-trigger.tsx(57,11) TS2322
src/features/tabs/components/tab-history-navigation.tsx(56,9)      TS2322
src/features/tabs/components/tab-history-navigation.tsx(70,9)      TS2322
```

The `Accordion` and `Button` props are passed but not declared on those components.

### 11.7 84 failing test assertions (branding drift)

All are `Blimy` → `blimy` mismatches in files unrelated to the hosted-AI work, e.g.
`scripts/release/tests/linux-packaging.test.ts` (`linux/Blimy.desktop`, `product_name="Blimy Preview"`),
`src/features/vim/tests/vim-commands.test.ts`, `src/features/window/tests/title-bar-controls.test.tsx`.
Plus 50 jsdom pool errors (no `jsdom`/`happy-dom` installed).

### 11.8 Leftover temp file

`tsconfig.typecheck-tmp.json` is untracked and was created for a source-only typecheck. Should be deleted.

---

## 12. How to verify

```powershell
# counts
git status --porcelain --untracked-files=all | Measure-Object -Line

# line-level diff, brand vs real
git diff -U0 | Select-String '^[+-]' | Where-Object { $_ -notmatch '^(\+\+\+|---)' }

# hosted-AI regression suite (expect 55/55)
& "C:\Program Files\nodejs\node.exe" node_modules/vitest/vitest.mjs run `
  src/features/ai/tests/composer-notice.test.ts `
  src/features/ai/tests/hosted-usage.test.ts `
  src/features/ai/tests/blimy-provider.test.ts `
  src/features/ai/tests/provider-access.test.ts `
  src/features/ai/tests/provider-image-payloads.test.ts `
  src/features/settings/tests/ai-model-preferences.test.ts `
  src/features/window/tests/auth-api.test.ts `
  src/features/window/tests/product-capabilities.test.ts `
  src/features/window/tests/pro-feature-access.test.ts

# Rust
cargo check -p blimy
& "C:\Program Files\nodejs\node.exe" node_modules/vitest/vitest.mjs --version   # vitest 4.1.11
```

Toolchain note: `bun` is **not** on PATH. `npx bun` resolves bun **1.4.2** from the npm cache.
Node is **v24.19.0** (satisfies vite-plus `>=24.11.0`). `node_modules/vite-plus/bin/vp` is a Node
script, so `node ./node_modules/vite-plus/bin/vp dev` works without Bun.

---

## 13. Suggested commit split

The 479 entries are unreviewable as one blob. Recommended order, smallest risk first:

1. `fix(window): restore window visibility on startup` — 3 files, +1 net line (§8)
2. `fix(test): update branding assertions to lowercase blimy` — clears 84 failures (§11.7)
3. `refactor(agents): open agent chats in the sidebar` — §6
4. `feat(timeline): add per-file timeline from git and local history` — §B1
5. `feat(status-bar): add editor status bar` — §B2
6. `feat(extensions): declarative contributions, settings, snippets` — §B4–B6
7. `feat(backend): add Supabase auth, ai-proxy, stripe-webhook` — §C
8. `fix(config): correct preview identifier, updater host, http scope` — §11.1, §11.2
9. `fix(csp): move startup bootstrap out of inline script` — §11.3
10. `chore(brand): rename Athas to Blimy` — §3 (128+ files, do last so it rebases cleanly)
11. `chore(icons): regenerate app icon sets` — §9

Before any commit: `.env` must stay untracked, and `NOTICE.md` / `LICENSE` /
`CONTRIBUTOR_LICENSE_AND_FEEDBACK_AGREEMENT.md` must keep their Athas attribution.
