# HakuNeko Modernization Roadmap

<a id="top"></a>

## Table of Contents

- [Executive Summary](#executive-summary)
- [Task Tracker](#task-tracker)
- [Current Architecture Audit](#current-architecture-audit)
  - [Component Assessment](#component-assessment)
  - [Dependency Audit](#dependency-audit)
- [Phase 1: Stabilize & Secure](#phase-1-stabilize--secure)
  - [HAKU-0001: Pin All Dependencies](#11-haku-0001-pin-all-dependencies-to-exact-versions)
  - [HAKU-0002: Commit Lock File](#12-haku-0002-commit-lock-file)
  - [HAKU-0003: Re-enable CI](#13-haku-0003-re-enable-ci-on-master-branch)
  - [HAKU-0004: Fix nodeIntegration & webSecurity](#14-haku-0004-fix-nodeintegration-and-websecurity)
  - [HAKU-0005: Replace electron.remote](#15-haku-0005-replace-electronremote-with-contextbridge)
  - [HAKU-0006: Fix Blind Certificate Acceptance](#16-haku-0006-fix-blind-certificate-acceptance)
  - [HAKU-0007: Patch Electron](#17-haku-0007-patch-electron-834--855)
  - [HAKU-0027: Modernize CI Workflows](#18-haku-0027-modernize-ci-workflows)
  - [Phase 1 Verification Plan](#phase-1-verification-plan)
  - [Phase 1 Dependency Notes](#phase-1-dependency-notes)
- [Phase 2: Modernize Core Infrastructure](#phase-2-modernize-core-infrastructure)
  - [HAKU-0029: Connector Smoke Tests](#21-haku-0029-connector-smoke-test-script)
  - [HAKU-0030: Automated Connector Generation](#22-haku-0030-automated-connector-generation-pipeline)
  - [HAKU-0031: Dead Link Scanner](#23-haku-0031-dead-link-scanner)
  - [HAKU-0008: Incremental Electron Upgrade](#24-haku-0008-incremental-electron-upgrade-85512233)
  - [HAKU-0012: IPC Abstraction Layer](#25-haku-0012-add-runtime-agnostic-ipc-abstraction-layer)
  - [HAKU-0032: Migrate Renderer Node.js Requires to IPC](#26-haku-0032-migrate-renderer-nodejs-requires-to-ipc)
  - [HAKU-0009: Replace polymer-build with Vite](#27-haku-0009-replace-polymer-build-with-vite)
  - [HAKU-0010: Replace Vendored JS](#27-haku-0010-replace-vendored-js-with-npm-packages)
  - [HAKU-0011: Add TypeScript](#28-haku-0011-add-typescript-incrementally-ts-file-renames)
  - [Phase 2 Verification Plan](#phase-2-verification-plan)
  - [Phase 2 Dependency Notes](#phase-2-dependency-notes)
- [Phase 3: UI Migration — Polymer to Lit](#phase-3-ui-migration--polymer-to-lit)
  - [HAKU-0014: Consolidate Themes](#31-haku-0014-consolidate-duplicate-themes)
  - [HAKU-0013: Migrate to Lit](#32-haku-0013-migrate-polymer-components-to-lit)
  - [HAKU-0015: Virtual Scrolling](#33-haku-0015-add-virtual-scrolling)
  - [Phase 3 Dependency Notes](#phase-3-dependency-notes)
  - [Phase 3 Verification Plan](#phase-3-verification-plan)
- [Phase 4: Architecture Improvements](#phase-4-architecture-improvements)
  - [HAKU-0020: Event-Driven Download Queue](#45-haku-0020-replace-polling-with-event-driven-download-queue)
  - [HAKU-0019: Extract IConnector Interface](#44-haku-0019-extract-iconnector-interface-and-remove-deprecated-methods)
  - [HAKU-0016: Lazy-Load Connectors](#41-haku-0016-lazy-load-connectors)
  - [HAKU-0018: Decompose Request.mjs](#43-haku-0018-decompose-requestmjs-554-lines--3-modules)
  - [HAKU-0028: Move Scraping to Main Process](#47-haku-0028-move-scraping-to-main-process)
  - [HAKU-0017: Decompose Storage.mjs](#42-haku-0017-decompose-storagemjs-951-lines--5-modules)
  - [HAKU-0021: Replace Global State](#46-haku-0021-replace-global-state-windowengine)
  - [Phase 4 Dependency Notes](#phase-4-dependency-notes)
  - [Phase 4 Verification Plan](#phase-4-verification-plan)
- [Phase 5: Polish & Future-Proofing](#phase-5-polish--future-proofing)
  - [HAKU-0025: Comprehensive Test Suite](#haku-0025-comprehensive-test-suite)
  - [HAKU-0026: Replace Deprecated Dependencies](#haku-0026-replace-deprecated-dependencies)
  - [HAKU-0022: Add ARIA Attributes](#haku-0022-add-aria-attributes)
  - [HAKU-0023: Keyboard Navigation](#haku-0023-keyboard-navigation-and-focus-management)
  - [HAKU-0024: Responsive Layout](#haku-0024-responsive-layout)
  - [Phase 5 Dependency Notes](#phase-5-dependency-notes)
  - [Phase 5 Verification Plan](#phase-5-verification-plan)
- [Dependency Modernization Table](#dependency-modernization-table)
- [Risk Register](#risk-register)
  - [Phase 1 Risks](#phase-1-risks)
  - [Phase 2 Risks](#phase-2-risks)
  - [Phase 3 Risks](#phase-3-risks)
  - [Phase 4 Risks](#phase-4-risks)
  - [Phase 5 Risks](#phase-5-risks)
- [Critical Files Quick Reference](#critical-files-quick-reference)

---

[Back to top](#top)

## Executive Summary

HakuNeko is a mature cross-platform manga/anime downloader with **1,334 website connectors**, a custom download engine, and dual-theme Polymer UI. After 8+ years of development, core infrastructure has fallen critically behind:

- **Electron 8.3.4** (released March 2020) — 25+ major versions behind, missing 6 years of Chromium security patches
- **Polymer 2.0** — abandoned framework, succeeded by Lit
- **All dependencies pinned to `latest`** — builds are non-reproducible
- **`package-lock.json` is gitignored** — dependency resolution changes silently between installs
- ~~**CI is disabled**~~ — CI re-enabled and modernized (HAKU-0003, HAKU-0027 ✅)
- **Critical security misconfigurations** — `nodeIntegration: true`, `webSecurity: false`, blind certificate acceptance

**Strategy:** Five incremental phases, each leaving the app in a working state. No big-bang rewrites. Each phase builds on the previous one and can be shipped independently.

| Phase | Focus | Timeline Estimate |
|-------|-------|-------------------|
| 1 | Stabilize & Secure | 2-4 weeks |
| 2 | Modernize Core Infrastructure | 6-10 weeks |
| 3 | UI Migration (Polymer → Lit) | 8-12 weeks |
| 4 | Architecture Improvements | 6-8 weeks |
| 5 | Polish & Future-Proofing | 4-6 weeks |

---

[Back to top](#top)

## Task Tracker

All tasks are tracked in ClickUp (**Product Master Backlog** list). Each task has a branch-ready ID for git workflows.

| ID | Task | Phase | Priority |
|----|------|-------|----------|
| `HAKU-0001` | Pin All Dependencies to Exact Versions | phase-1 | urgent |
| `HAKU-0002` | Commit package-lock.json | phase-1 | urgent |
| `HAKU-0003` | Re-enable CI on master branch | phase-1 | urgent |
| `HAKU-0004` | Fix nodeIntegration and webSecurity (partial: webSecurity + contextIsolation done) | phase-1 | urgent |
| `HAKU-0005` | Replace electron.remote with contextBridge | phase-1 | urgent |
| `HAKU-0006` | Fix blind certificate acceptance | phase-1 | high |
| `HAKU-0007` | Patch Electron 8.3.4 to 8.5.5 | phase-1 | high |
| `HAKU-0008` | Incremental Electron upgrade (8→12→22→33+) | phase-2 | high |
| `HAKU-0009` | Replace polymer-build with Vite | phase-2 | normal |
| `HAKU-0010` | Replace vendored JS with npm packages | phase-2 | normal |
| `HAKU-0011` | Add TypeScript incrementally | phase-2 | normal |
| `HAKU-0012` | Add proper IPC abstraction layer | phase-2 | normal |
| `HAKU-0013` | Migrate Polymer components to Lit | phase-3 | high |
| `HAKU-0014` | Consolidate duplicate light/dark themes | phase-3 | normal |
| `HAKU-0015` | Add virtual scrolling for large lists | phase-3 | normal |
| `HAKU-0016` | Lazy-load connectors on demand | phase-4 | high |
| `HAKU-0017` | Decompose Storage.mjs into focused modules | phase-4 | high |
| `HAKU-0018` | Decompose Request.mjs into focused modules | phase-4 | normal |
| `HAKU-0019` | Extract IConnector interface | phase-4 | normal |
| `HAKU-0020` | Replace polling with event-driven download queue | phase-4 | normal |
| `HAKU-0021` | Replace window.Engine global with DI | phase-4 | normal |
| `HAKU-0022` | Add ARIA attributes to all UI components | phase-5 | normal |
| `HAKU-0023` | Add keyboard navigation and focus management | phase-5 | normal |
| `HAKU-0024` | Implement responsive layout | phase-5 | low |
| `HAKU-0025` | Build comprehensive test suite | phase-5 | high |
| `HAKU-0026` | Replace deprecated dependencies | phase-5 | low |
| `HAKU-0027` | ~~Modernize CI Workflows~~ ✅ | phase-1 | normal |
| `HAKU-0028` | Move Scraping to Main Process | phase-4 | normal |
| `HAKU-0029` | Connector Smoke Test Script | phase-2 | high |
| `HAKU-0030` | Automated Connector Generation Pipeline | phase-2 | high |
| `HAKU-0031` | Dead Link Scanner | phase-2 | normal |
| `HAKU-0032` | Migrate renderer Node.js requires to IPC (enable nodeIntegration: false) | phase-2 | high |

---

[Back to top](#top)

## Current Architecture Audit

### Component Assessment

| Component | File(s) | Lines | Risk Level | Issues |
|-----------|---------|-------|------------|--------|
| Electron Bootstrap | `src/app/ElectronBootstrap.js` | 411 | **CRITICAL** | `nodeIntegration: true` (line 260), `webSecurity: false` (line 261), blind cert acceptance (lines 125-128) |
| Storage Engine | `src/web/mjs/engine/Storage.mjs` | 951 | **HIGH** | God class — config, downloads, media conversion, ebook building, bookmark storage all in one |
| HTTP/Scraping Layer | `src/web/mjs/engine/Request.mjs` | 554 | **HIGH** | `electron.remote` usage (lines 9-10, 13, 23, 64), mixes HTTP client + browser scraping + anti-detection |
| Connector Base | `src/web/mjs/engine/Connector.mjs` | 748 | **MEDIUM** | No interface/type contract, deprecated callback-based methods alongside Promise-based |
| Download Manager | `src/web/mjs/engine/DownloadManager.mjs` | 55 | **MEDIUM** | 250ms `setInterval` polling (line 12) instead of event-driven queue |
| Settings | `src/web/mjs/engine/Settings.mjs` | 430 | **HIGH** | `electron.remote` (line 40), hardcoded encryption key `'HakuNeko!'` (lines 386, 398) |
| UI (Polymer) | `src/web/lib/hakuneko/frontend@classic-*/` | 4,090×2 | **HIGH** | Polymer 2.0 (abandoned), duplicated across light/dark themes (26 files total), HTML Imports (deprecated) |
| Entry Point | `src/web/index.html` | 174 | **HIGH** | `electron.remote` (lines 18, 94), 9 vendored minified JS files, global `window.Engine` |
| Vendored JS | `src/web/js/*.js` | 9 files | **MEDIUM** | Unversioned minified libraries — no audit trail, no update path |
| Package Config | `package.json` | 50 | **CRITICAL** | 12 of 17 deps use `latest`, lock file gitignored |
| CI/CD | `.github/workflows/` | 4 files | **OK** | CI modernized: actions v4, caching, concurrency, timeouts, audit, coverage, Claude PR review (HAKU-0027 ✅) |
| Tests | `src/app/__tests__/`, `src/web/__tests__/` | 14 files | **HIGH** | 10 app tests, 2 web tests, 1 e2e test — near-zero coverage for 1,334 connectors |
| Connectors | `src/web/mjs/connectors/` | 1,334 files | **LOW** | Well-structured, inherit from base classes — low individual risk, high collective maintenance burden |

### Dependency Audit

| Package | Current | Issue |
|---------|---------|-------|
| `electron` | `8.3.4` | Pinned to 2020 release; Chromium 80 |
| `polymer-build` | `latest` | Abandoned build tool for abandoned framework |
| `@hakuneko/ffmpeg-binaries` | `latest` | Unpinned native binary |
| `@hakuneko/imagemagick-binaries` | `latest` | Unpinned native binary |
| `@hakuneko/kindlegen-binaries` | `latest` | Unpinned native binary; KindleGen itself is discontinued |
| `@logtrine/logtrine` | `latest` | Unpinned |
| `discord-rpc` | `latest` | Deprecated package |
| `fs-extra` | `latest` | Unpinned |
| `puppeteer-core` | `latest` | Unpinned; major API changes between versions |
| `jszip` | `latest` | Unpinned |
| `jest` | `latest` | Unpinned |
| `asar` | `latest` | Unpinned |
| `eslint` | `^8.57.0` | Only properly versioned dev dependency |

---

[Back to top](#top)

## Phase 1: Stabilize & Secure

> **Goal:** Fix critical security issues and make builds reproducible. No architecture changes.
>
> **Prerequisite:** None — this is the starting phase.

### Phase 1 Execution Order

| Order | Task | Priority | Description |
|-------|------|----------|-------------|
| 1 | HAKU-0001 | **URGENT** | Pin All Dependencies to Exact Versions |
| 2 | HAKU-0002 | **URGENT** | Commit Lock File |
| 3 | HAKU-0003 | **URGENT** | Re-enable CI on Master Branch |
| 4 | HAKU-0007 | **HIGH** | Patch Electron 8.3.4 → 8.5.5 |
| 5 | HAKU-0005 | **URGENT** | Replace electron.remote with contextBridge |
| 6 | HAKU-0006 | **HIGH** | Fix Blind Certificate Acceptance |
| 7 | HAKU-0004 | **URGENT** | Fix nodeIntegration and webSecurity |
| 8 | HAKU-0027 | NORMAL | ~~Modernize CI Workflows~~ ✅ |

---

### 1.1 HAKU-0001: Pin All Dependencies to Exact Versions
**Priority:** URGENT | **Effort:** S | **Risk:** LOW
**Dependencies:** None
**Status:** [x] Complete

Replace all `latest` with exact versions in `package.json` (lines 13-29) **and** `src/app/package.json` (lines 13-16). `latest` means every `npm install` can produce different results — a breaking change in any dependency silently breaks the build.

**Scope gap found:** `src/app/package.json` also has 3 `latest` deps — original scope only covered root.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0001a | Resolve exact versions from `bun.lock` for all 15 root `package.json` dependencies using `latest` | S | Low | — |
| 0001b | Resolve exact versions for 3 `src/app/package.json` dependencies using `latest` | S | Low | — |
| 0001c | Update both `package.json` files and verify `npm install` produces identical output | S | Low | 0001a, 0001b |

**Key files:**
- `package.json` (root — 15 deps pinned)
- `src/app/package.json` (3 deps pinned)
- `bun.lock` (source of resolved versions)

---

### 1.2 HAKU-0002: Commit Lock File
**Priority:** URGENT | **Effort:** S | **Risk:** LOW
**Dependencies:** None
**Status:** [x] Complete

Remove `package-lock.json` and `yarn.lock` from `.gitignore` and commit both `package-lock.json` and `bun.lock`. Without a lock file, dependency resolution varies between machines and CI environments. This is the single highest-impact change for build reproducibility.

Both Bun (local) and npm (upstream compatibility) lock files committed.

**Key files:**
- `.gitignore` (remove lock file exclusions)
- `package-lock.json` (newly committed)
- `bun.lock` (newly committed)

---

### 1.3 HAKU-0003: Re-enable CI on Master Branch
**Priority:** URGENT | **Effort:** S | **Risk:** LOW
**Dependencies:** None
**Status:** [x] Complete

Change `continuous-integration.yml` line 9 from `DISABLED` to `master`, and fix missing `DISPLAY` env var on test step. No automated testing means regressions ship silently.

**Bug found:** `DISPLAY` env var was set on Xvfb step but NOT on the test step (unlike `ci-pr.yml` which has it correct).

**Key files:**
- `.github/workflows/continuous-integration.yml` (branch trigger fix + `DISPLAY` env var)
- `.github/workflows/ci-pr.yml` (reference for correct `DISPLAY` usage)

---

### 1.4 HAKU-0004: Fix nodeIntegration and webSecurity
**Priority:** URGENT | **Effort:** M | **Risk:** MEDIUM
**Status:** PARTIAL — `webSecurity: true`, `contextIsolation: true`, and `hakuneko-local://` protocol are done. `nodeIntegration: false` deferred to **HAKU-0032**.
**Dependencies:** **Blocked by HAKU-0005** (complete). `nodeIntegration: false` additionally blocked by renderer `require()` calls — see HAKU-0032.

Set `nodeIntegration: false` and `webSecurity: true` in `ElectronBootstrap.js:258-262`, add `contextIsolation: true` and a `preload` script. `nodeIntegration: true` gives the renderer process full Node.js access — any XSS in loaded web content becomes full RCE. `webSecurity: false` disables same-origin policy.

| Sub | Description | Effort | Risk | Status |
|-----|-------------|--------|------|--------|
| 0004a | Enable `contextIsolation: true` in webPreferences | S | Low | **Done** |
| 0004b | Register `hakuneko-local://` protocol to serve downloaded content without `file://` | M | Low | **Done** |
| 0004c | Replace `file://` URL generation in `Storage.mjs` with `hakuneko-local://` | S | Low | **Done** |
| 0004d | Flip `webSecurity: true` | S | Low | **Done** |
| 0004e | Flip `nodeIntegration: false` | S | High | **Deferred → HAKU-0032** |

**Why nodeIntegration: false is deferred:** `Storage.mjs`, `Settings.mjs`, and `DiscordPresence.mjs` use `require('fs')`, `require('path')`, `require('os')`, and `require('discord-rpc')` directly in the renderer. Flipping nodeIntegration off breaks all file I/O. These must be migrated to IPC handlers first (HAKU-0032).

**Key files:**
- `src/app/ElectronBootstrap.js:313-318` (BrowserWindow webPreferences)
- `src/app/ElectronBootstrap.js:120-155` (`hakuneko-local://` protocol handler)
- `src/web/mjs/engine/Storage.mjs:414-418` (`_makeValidFileURL`)

---

### 1.5 HAKU-0005: Replace electron.remote with contextBridge
**Priority:** URGENT | **Effort:** L | **Risk:** MEDIUM
**Dependencies:** None — but **blocks HAKU-0004**.

Create a `preload.js` that exposes required APIs via `contextBridge`, then update all renderer-side `electron.remote` usage. `electron.remote` is deprecated (removed in Electron 14+) and creates a massive attack surface by proxying the entire main process to the renderer.

**Scope gap:** Original roadmap listed 5 files. Actual count is **9 files** — 3 connector files were missed.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0005a | Create `src/app/preload.js` exposing scoped APIs via `contextBridge.exposeInMainWorld('hakunekoAPI', {...})` | M | Med | — |
| 0005b | Add IPC handlers in main process for dialog, window, shell, app, and exec operations | M | Med | 0005a |
| 0005c | Migrate `src/web/index.html` (2 usages: `electron.remote.dialog`, `electron.remote.getCurrentWindow()`) | S | Low | 0005a |
| 0005d | Migrate `src/web/mjs/engine/Settings.mjs:40` (`electron.remote.app`) | S | Low | 0005a |
| 0005e | Migrate `src/web/mjs/engine/Storage.mjs:25-28` (dialog, process, shell, child_process) | M | Med | 0005a |
| 0005f | Migrate `src/web/mjs/engine/Request.mjs:9-10` (`electron.remote.BrowserWindow`) | S | Med | 0005a |
| 0005g | Migrate `src/web/mjs/engine/InterProcessCommunication.mjs:4` (`ipcRenderer`) | S | Low | 0005a |
| 0005h | Migrate 3 missed connector files: `MangaHub.mjs:4`, `BilibiliManhua.mjs:125-126`, `ClipboardConnector.mjs:18` | S | Med | 0005a |

**Key files:**
- NEW: `src/app/preload.js` (contextBridge API surface)
- `src/web/index.html:18,94`
- `src/web/mjs/engine/Settings.mjs:40`
- `src/web/mjs/engine/Storage.mjs:25-28`
- `src/web/mjs/engine/Request.mjs:9-10`
- `src/web/mjs/engine/InterProcessCommunication.mjs:4`
- `src/web/mjs/connectors/MangaHub.mjs:4`
- `src/web/mjs/connectors/BilibiliManhua.mjs:125-126`
- `src/web/mjs/connectors/ClipboardConnector.mjs:18`

---

### 1.6 HAKU-0006: Fix Blind Certificate Acceptance
**Priority:** HIGH | **Effort:** S | **Risk:** MEDIUM
**Dependencies:** None

Remove the blanket `callback(true)` in `_certificateErrorHandler` (`ElectronBootstrap.js:125-128`). Instead, only bypass for known connector domains or prompt the user. Accepting all certificate errors enables MITM attacks on every HTTPS connection the app makes.

Some connectors may rely on broken certs — test thoroughly.

**Key files:**
- `src/app/ElectronBootstrap.js:125-128` (`_certificateErrorHandler`)

---

### 1.7 HAKU-0007: Patch Electron 8.3.4 → 8.5.5
**Priority:** HIGH | **Effort:** S | **Risk:** LOW
**Dependencies:** HAKU-0001 (pinned dependencies)

Update `electron` from `8.3.4` to `8.5.5` (last 8.x patch). Safe patch-level update that includes security fixes without breaking API changes.

**Key files:**
- `package.json` (`"electron"` version)

---

### 1.8 HAKU-0027: Modernize CI Workflows
**Priority:** NORMAL | **Effort:** M | **Risk:** LOW
**Dependencies:** HAKU-0003 (CI re-enabled)
**Status:** [x] Complete

Update all 3 GitHub Actions workflow files to current best practices. Current workflows use deprecated GH Actions versions (v1/v2) which will stop working. Missing caching wastes CI minutes.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0027a | Update `actions/checkout` v2 → v4 and `actions/setup-node` v1 → v4 across all 3 workflow files | S | Low | — |
| 0027b | Add npm/bun caching to CI workflows | S | Low | 0027a |
| 0027c | Add concurrency groups (cancel in-progress on same branch) | S | Low | 0027a |
| 0027d | Add step-level timeouts to all workflow steps | S | Low | 0027a |
| 0027e | Add `npm audit` security check step | S | Low | 0027a |
| 0027f | Add code coverage reporting | S | Low | 0027a |
| 0027g | Add Claude PR reviewer (auto on PR + manual dispatch) | S | Low | 0027a |

**Note:** Windows and macOS removed from PR CI matrix — Electron 8.5.5 has no arm64 macOS build (macos-13 retired) and Windows npm install hangs. Tracked as 0008l in Phase 2.

**Key files:**
- `.github/workflows/continuous-integration.yml`
- `.github/workflows/ci-pr.yml`
- `.github/workflows/continuous-deployment.yml`
- `.github/workflows/claude-review.yml` (new)

---

### Phase 1 Verification Plan

| Check | Command / Method | Pass Criteria |
|-------|-----------------|---------------|
| Dependencies pinned | `grep '"latest"' package.json src/app/package.json` | Zero matches |
| Lock files committed | `git ls-files package-lock.json bun.lock` | Both files tracked |
| CI active | GitHub Actions → `continuous-integration.yml` runs on push to `master` | Workflow triggers and passes |
| Security flags | Inspect `ElectronBootstrap.js` webPreferences | `nodeIntegration: false`, `contextIsolation: true`, `webSecurity: true` |
| No electron.remote | `grep -r "electron.remote" src/` | Zero matches in renderer code |
| Certificate handling | Launch app, navigate to bad-cert site | Prompts user or rejects (no silent accept) |
| Electron version | `npx electron --version` | `v8.5.5` |
| CI modernized | Inspect all 4 workflow files | `actions/checkout@v4`, caching enabled, concurrency groups present, `claude-review.yml` exists |

### Phase 1 Dependency Notes

- **HAKU-0004 ↔ HAKU-0005:** HAKU-0005 (preload bridge) MUST be completed before HAKU-0004 (flip security flags). Setting `nodeIntegration: false` immediately breaks 9 files that use `require('electron').remote`.
- **HAKU-0005 scope gap:** Original roadmap listed 5 files. Actual count is **9 files** — 3 connector files were missed: `MangaHub.mjs`, `BilibiliManhua.mjs`, `ClipboardConnector.mjs`.
- **HAKU-0001 scope gap:** `src/app/package.json` also has 3 `latest` deps (`@logtrine/logtrine`, `fs-extra`, `jszip`) — original roadmap only covered root `package.json`.

---

[Back to top](#top)

## Phase 2: Modernize Core Infrastructure

> **Goal:** Upgrade Electron, replace the build system, modernize vendored dependencies, add TypeScript, modernize IPC, and establish connector testing.
>
> **Prerequisite:** All Phase 1 tasks complete (HAKU-0005 done = no `electron.remote` in renderer).

### Phase 2 Execution Order

| Order | Task | Priority | Description |
|-------|------|----------|-------------|
| 1 | HAKU-0029 | **HIGH** | Connector Smoke Tests — foundation for validating all other changes |
| 2 | HAKU-0030 | **HIGH** | Automated Connector Generation — fingerprinting, code gen, GitHub bot, CLI |
| 3 | HAKU-0031 | NORMAL | Dead Link Scanner — weekly cron reports broken connector URLs |
| 4 | HAKU-0008 | **HIGH** | Incremental Electron Upgrade (8.5.5→12→22→33+) |
| 5 | HAKU-0012 | NORMAL | IPC Abstraction Layer — modernize before deeper Electron upgrades |
| 6 | HAKU-0009 | NORMAL | Replace polymer-build with Vite (with Polymer HTML Import compat) |
| 7 | HAKU-0010 | NORMAL | Replace Vendored JS with npm packages (global wrappers) |
| 8 | HAKU-0011 | NORMAL | Add TypeScript Incrementally |

---

### 2.1 HAKU-0029: Connector Smoke Test Script
**Priority:** HIGH | **Effort:** M | **Risk:** LOW
**Dependencies:** None — start immediately. Critical for HAKU-0008 validation.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0029a | Define smoke test criteria per tier: Tier 1 = HTTP HEAD on base URL, Tier 2 = `_getMangas()` returns results, Tier 3 = manga→chapters→page URLs | S | Low | — |
| 0029b | Create test harness to instantiate connectors outside Electron (mock `window.Engine`, stub Electron APIs) | M | Med | — |
| 0029c | Build Tier 1: URL validation for all 1,334 connectors (HTTP HEAD, expect 2xx/3xx) | S | Low | 0029b |
| 0029d | Curate "top 50" connector list for Tier 2 testing (by complexity + site popularity) | S | Low | — |
| 0029e | Build Tier 2: Manga list smoke test for top 50 connectors | M | Med | 0029b, 0029d |
| 0029f | Curate "top 10" connector list for Tier 3 (full pipeline) testing | S | Low | 0029d |
| 0029g | Build Tier 3: Full pipeline test (manga→chapter→pages) for top 10 connectors | M | Med | 0029b, 0029f |
| 0029h | Create test report output (JUnit XML for CI, JSON summary with pass/fail + response times) | S | Low | 0029c |
| 0029i | Add to CI: Tier 1 on every push, Tier 2 weekly cron, Tier 3 weekly cron (separate schedule) | S | Low | 0029c, 0029e, 0029g |

**Key files:**
- `src/web/mjs/engine/Connectors.mjs` (connector loading)
- `src/web/mjs/engine/Connector.mjs` (base class with `_getMangas()`, `_getChapters()`, `_getPages()`)
- `src/web/__tests__/` (existing test location)

---

### 2.2 HAKU-0030: Automated Connector Generation Pipeline
**Priority:** HIGH | **Effort:** L | **Risk:** MEDIUM
**Dependencies:** HAKU-0029 (smoke test harness reused by validator), HAKU-0003 (CI re-enabled), HAKU-0027 (modernized CI workflows for bot PR triggers)

Three components sharing a core engine: CMS fingerprinting, connector code generation, and GitHub automation. Covers ~55% of template-based connectors (top 5 templates: WordPressMadara 444, WordPressMangastream 194, FoolSlide 60, SinMH 18, MadTheme 7). Remaining ~45% with custom logic always require manual development.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0030a | Create `tools/connector-gen/` package with `package.json` (`node-html-parser`, `mustache`, Node.js native fetch). Set up directory structure: `lib/`, `test/`, code templates | S | Low | — |
| 0030b | Implement `url-prober.mjs`: HTTP GET/HEAD with realistic UA, redirect following (up to 5), CloudFlare detection (503 + CF headers), configurable timeout (15s default). Returns `{ status, headers, body, finalUrl, isCloudFlare }` | S | Low | 0030a |
| 0030c | Build `fingerprints.json` for top 5 templates by usage. Each entry has weighted signals: `html-content` (string/regex in HTML), `html-selector` (CSS selector matches elements), `url-probe` (HTTP HEAD to path), `script-var` (JS variable in `<script>` tags). Extract signals from existing template files' CSS selectors and CMS markers | M | Med | 0030a |
| 0030d | Implement `fingerprinter.mjs`: fetch homepage via url-prober, evaluate all signals per template, sum weights to confidence score (0-100), probe known paths for `this.path` detection. Return ranked `[{ template, confidence, detectedPath }]` | M | Med | 0030b, 0030c |
| 0030e | Create `.mjs.tpl` code generation templates for each supported CMS. Must produce output identical in style to existing connectors (4-space indent, semicolons, `super.id`/`super.label` pattern). One template per CMS | S | Low | 0030c |
| 0030f | Implement `generator.mjs`: takes fingerprint result + user metadata (siteName, url, languages) → generates `.mjs` source. Derives className (PascalCase), id (lowercase), tags from languages. Checks for naming conflicts against existing `src/web/mjs/connectors/` | S | Low | 0030e |
| 0030g | Implement `validator.mjs`: HTTP-level smoke test — GET base URL (expect 200), GET manga list path (verify expected CSS selectors match >= 1 element), report `{ valid, errors[], warnings[] }`. Reuse HAKU-0029 test harness where possible | M | Med | 0030b, 0030f, HAKU-0029 |
| 0030h | Implement `cli.mjs` with commands: `generate <url>` (fingerprint + generate + validate), `fingerprint <url>` (diagnostic), `validate <file.mjs>` (smoke test existing connector). Support `--name`, `--lang`, `--output`, `--plugin-dir` flags | S | Low | 0030d, 0030f, 0030g |
| 0030i | Test fingerprinter + generator against 10+ known sites of varying templates. Verify generated files pass `npm run lint:web`. Target >= 90% correct template identification for top 5 templates | M | Low | 0030h |
| 0030j | Implement `issue-parser.mjs`: parse GitHub issue body (`### Field\n\nValue` markdown format) into structured data. Map issue fields to generator input: websiteName→label, websiteUrl→url, websiteMangaList→path hint, languages→tags | S | Low | 0030a |
| 0030k | Create `connector-bot.yml` GitHub Actions workflow: trigger on issue opened/labeled with "Website Suggestion". Parse issue → fingerprint → generate → validate → create branch `auto/connector-{id}` → commit → create PR (references `Closes #N`) → auto-merge if CI passes and confidence >= 60. Comment on issue if no match or validation fails, label `needs-manual-review` | M | Med | 0030h, 0030j, HAKU-0027 |
| 0030l | Update `.github/ISSUE_TEMPLATE/2-suggest-a-new-connector-website.yml` to add note that submissions may be auto-processed by the connector bot | S | Low | 0030k |
| 0030m | Expand `fingerprints.json` to remaining templates: HeanCms, NineManga, Genkan, MangaReaderCMS, CoreView, Guya, FlatManga, etc. (ongoing — each template addition is independent) | M | Low | 0030d |

**Key fingerprint signals by template:**

| Template | Key Signals |
|----------|-------------|
| WordPressMadara | `madara_load_more` in HTML, `div.post-title h3 a` selector, `/wp-admin/admin-ajax.php` probe (200/400), `wp-manga` post type |
| WordPressMangastream | `ts_reader` JS variable, `div.soralist` selector, `div#readerarea`, Themesia meta/footer |
| FoolSlide | `comic_page` class, `pages = JSON.parse(atob(` in source, `/directory/` path |
| SinMH | `window.SinMH` JS variable, Chinese comic site patterns, specific chapter JS eval |
| MadTheme | `/api/manga/` endpoint, `div.book-detailed-item`, `chapImages` JS variable |

**Key files:**
- `src/web/mjs/connectors/templates/WordPressMadara.mjs` (most-used template, 444 connectors — its selectors become fingerprint signals)
- `src/web/mjs/connectors/templates/WordPressMangastream.mjs` (194 connectors)
- `src/web/mjs/connectors/templates/FoolSlide.mjs` (60 connectors)
- `src/web/mjs/connectors/AceScans.mjs` (canonical example of simplest output — 10 lines)
- `.github/ISSUE_TEMPLATE/2-suggest-a-new-connector-website.yml` (issue fields the parser must extract)
- NEW: `tools/connector-gen/` (entire package)
- NEW: `.github/workflows/connector-bot.yml`

**Test plan:**

| Test | Coverage |
|------|----------|
| `url-prober.test.mjs` | Redirect chains, CloudFlare detection, timeout, ENOTFOUND |
| `fingerprinter.test.mjs` | Signal evaluation against saved HTML fixtures, template ranking, edge cases (empty pages, login redirects) |
| `generator.test.mjs` | Snapshot tests against real connectors, PascalCase/id derivation, naming conflict detection |
| `issue-parser.test.mjs` | Well-formed/malformed issue parsing, missing optional fields |
| `validator.test.mjs` | Alive/dead/CF-protected classification, selector matching |
| CLI E2E | `generate <known-site>` → valid `.mjs` → passes lint → validator returns valid |
| GitHub bot E2E | Test issue on fork → PR created → CI passes → auto-merges |

---

### 2.3 HAKU-0031: Dead Link Scanner
**Priority:** NORMAL | **Effort:** S | **Risk:** LOW
**Dependencies:** HAKU-0030b (url-prober), HAKU-0003 (CI re-enabled)

Weekly automated scan of all 1,334 connector base URLs. Reports broken links as a GitHub issue — does not auto-modify code.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0031a | Implement `dead-link-scanner.mjs`: regex-extract `this.url = '...'` from all connector `.mjs` files (excluding `templates/` and `system/`), HTTP HEAD each URL (concurrency: 10, timeout: 15s), classify as alive (2xx), redirected (3xx to different domain), dead (4xx/5xx/timeout/ENOTFOUND), CloudFlare-protected (503 + CF headers) | S | Low | HAKU-0030b |
| 0031b | Create `dead-link-scanner.yml` GitHub Actions workflow: weekly cron (Monday 3am UTC) + manual dispatch. Creates/updates single issue "Dead Link Report - {date}" with markdown table of problematic connectors only. Labels: `dead-links`, `automated`. Closes previous report issue | S | Low | 0031a |
| 0031c | Test scanner locally against full connector set. Verify completes within 30 minutes. Verify no false positives on CloudFlare-protected sites | S | Low | 0031a |

**Key files:**
- `src/web/mjs/connectors/*.mjs` (1,334 files — scanned for URL extraction)
- NEW: `tools/connector-gen/lib/dead-link-scanner.mjs`
- NEW: `.github/workflows/dead-link-scanner.yml`

---

### 2.4 HAKU-0008: Incremental Electron Upgrade (8.5.5→12→22→33+)
**Priority:** HIGH | **Effort:** XL | **Risk:** HIGH
**Dependencies:** All Phase 1 complete (HAKU-0005 done = no `electron.remote` in renderer). HAKU-0029 for regression testing.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0008a | Audit all Electron API usage and create breaking-change checklist per version range | M | Low | — |
| 0008b | Upgrade 8.5.5 → 12.x: `contextIsolation` defaults change, verify preload script works | M | Med | 0029c (smoke tests available) |
| 0008c | At 12.x: Update `webRequest` API usage in ElectronBootstrap.js:375,393 if deprecated | S | Med | 0008b |
| 0008d | Upgrade 12.x → 22.x: `nativeWindowOpen` removed, session API changes, cookie API changes | M | Med | 0008c |
| 0008e | At 22.x: Test and fix cookie handling (BilibiliManhua.mjs uses `session.defaultSession.cookies`) | S | Med | 0008d |
| 0008f | Run Tier 2 smoke tests at 22.x checkpoint (top 50 manga list) | S | Low | 0008d, 0029e |
| 0008g | Upgrade 22.x → 28.x: V8/Chromium engine updates, ESM support changes | M | Med | 0008f |
| 0008h | Upgrade 28.x → 33+ (latest stable): Final target | M | Med | 0008g |
| 0008i | Run Tier 3 smoke tests at final version (full pipeline top 10) | S | Low | 0008h, 0029g |
| 0008j | Update `build-app.js` and `build-app.config` for new Electron version | S | Low | 0008h |
| 0008k | Update CI electron-builder / packaging configuration | S | Low | 0008j |
| 0008l | Restore Windows + macOS to PR CI matrix (removed in HAKU-0027: no arm64 macOS build for Electron 8, Windows npm install hangs) | S | Low | 0008h |

**Key files:**
- `src/app/ElectronBootstrap.js` (411 lines — main process, window creation, IPC, webRequest)
- `build-app.js` (907 lines — packaging)
- `build-app.config` (30 lines — platform configs)
- `package.json` (Electron version pin)

---

### 2.5 HAKU-0012: Add Runtime-Agnostic IPC Abstraction Layer
**Priority:** NORMAL | **Effort:** M | **Risk:** MEDIUM
**Dependencies:** HAKU-0005 (preload script, done in Phase 1). Benefits from HAKU-0008b (Electron 12+).

**Design goal:** Abstract IPC behind a runtime-agnostic interface so the renderer code doesn't know whether it's running in Electron or (future) Tauri. The main-process side has runtime-specific implementations.

**Current IPC channels in use:**
1. `quit` — renderer→main (ElectronBootstrap.js:276)
2. `close` — main→renderer (ElectronBootstrap.js:303)
3. `on-connector-protocol-handler` — main↔renderer via `_ipcSend` (ElectronBootstrap.js:115)
4. `on-before-send-headers` — main↔renderer via `_ipcSend` (ElectronBootstrap.js:377)
5. `on-headers-received` — main↔renderer via `_ipcSend` (ElectronBootstrap.js:395)

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0012a | Document all IPC channels: name, direction, payload shape, response shape | S | Low | — |
| 0012b | Define runtime-agnostic `IIPCBridge` interface (TypeScript or JSDoc): `invoke(channel, payload)`, `send(channel, payload)`, `on(channel, handler)` | M | Low | 0012a |
| 0012c | Implement `ElectronIPCBridge` (main-process side): wraps `ipcMain.handle()` behind `IIPCBridge` | M | Med | 0012b |
| 0012d | Implement `ElectronIPCClient` (renderer/preload side): wraps `ipcRenderer.invoke()` behind `IIPCBridge` | S | Med | 0012b |
| 0012e | Migrate `on-before-send-headers` / `on-headers-received` to new bridge | M | Med | 0012c, 0012d |
| 0012f | Migrate `on-connector-protocol-handler` to new bridge | S | Low | 0012c, 0012d |
| 0012g | Migrate `quit` / `close` events to new bridge | S | Low | 0012c, 0012d |
| 0012h | Update renderer code to use `IIPCBridge` interface (not Electron-specific imports) | M | Med | 0012e, 0012f, 0012g |
| 0012i | Remove old `_ipcSend` method from ElectronBootstrap.js and `InterProcessCommunication.mjs` | S | Low | 0012h |
| 0012j | Add TypeScript types to IPC channel contract (if HAKU-0011 is in progress) | S | Low | 0012b, HAKU-0011a |

**Architecture:**
```
Renderer code → IIPCBridge (interface) → ElectronIPCClient (implementation)
                                        └─ (future) TauriIPCClient
Main process  → IIPCBridge (interface) → ElectronIPCBridge (implementation)
                                        └─ (future) TauriIPCBridge
```

**Key files:**
- `src/app/ElectronBootstrap.js:352-371` (`_ipcSend` to remove)
- `src/web/mjs/engine/InterProcessCommunication.mjs` (18 lines — to replace)
- `src/web/mjs/engine/Request.mjs:14-15` (IPC listeners to migrate)
- `src/app/preload.js` (from Phase 1 HAKU-0005 — to extend)
- NEW: `src/web/mjs/engine/ipc/IIPCBridge.ts` (interface)
- NEW: `src/app/ipc/ElectronIPCBridge.ts` (main-process impl)
- NEW: `src/app/ipc/ElectronIPCClient.ts` (renderer impl)

---

### 2.6 HAKU-0032: Migrate Renderer Node.js Requires to IPC
**Priority:** HIGH | **Effort:** L | **Risk:** MEDIUM
**Dependencies:** HAKU-0012 (IPC abstraction layer). Completes what HAKU-0004 started — enables `nodeIntegration: false`.

**Problem:** Three renderer files still use `require()` to access Node.js modules directly. With `nodeIntegration: true`, any XSS becomes full RCE. HAKU-0004 flipped `webSecurity: true` and `contextIsolation: true`, but `nodeIntegration` remains on because these files would break.

**Files requiring migration:**

| File | Requires | Usage |
|------|----------|-------|
| `src/web/mjs/engine/Storage.mjs:26-30` | `fs`, `path`, `os` | All file I/O: read/write files, create directories, stat, readdir, tmpdir |
| `src/web/mjs/engine/Settings.mjs:40` | `path` | `path.join()` for constructing default directory paths |
| `src/web/mjs/engine/DiscordPresence.mjs:2` | `discord-rpc` | Discord Rich Presence integration |

**Strategy:** Move file operations behind scoped IPC handlers in the main process. Do NOT expose raw `fs`/`path` via preload — that's equivalent to `nodeIntegration: true`.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0032a | Add IPC handlers for file operations: `readFile`, `writeFile`, `readdir`, `stat`, `existsSync`, `mkdirSync`, `openSync`, `appendFileSync`, `unlinkSync`, `createWriteStream` | L | Med | HAKU-0012 |
| 0032b | Add IPC handlers for path operations: `join`, `resolve`, `dirname`, `basename`, `extname`, `parse`, `sep` | M | Low | HAKU-0012 |
| 0032c | Add IPC handler for `os.tmpdir()` | S | Low | HAKU-0012 |
| 0032d | Migrate `Storage.mjs` to use IPC-based file/path operations | L | High | 0032a, 0032b, 0032c |
| 0032e | Migrate `Settings.mjs` to use IPC-based path operations (or inline the single `path.join` call) | S | Low | 0032b |
| 0032f | Migrate or remove `DiscordPresence.mjs` `require('discord-rpc')` (move to main process or optional preload) | M | Med | — |
| 0032g | Flip `nodeIntegration: false` in `ElectronBootstrap.js` | S | Low | 0032d, 0032e, 0032f |
| 0032h | Verify all file operations: download chapter, view chapter, CBZ/EPUB/PDF export, video muxing, bookmarks | M | Med | 0032g |

**Key files:**
- `src/web/mjs/engine/Storage.mjs` (heaviest migration — ~40 `this.fs.*` and ~30 `this.path.*` calls)
- `src/web/mjs/engine/Settings.mjs:40` (single `require('path')`)
- `src/web/mjs/engine/DiscordPresence.mjs:2` (single `require('discord-rpc')`)
- `src/app/ElectronBootstrap.js` (new IPC handlers + flip nodeIntegration)
- `src/app/preload.js` (expose new IPC channels)

**Note:** HAKU-0017 (Decompose Storage.mjs) would make 0032d easier by breaking the god class into smaller modules first. Consider ordering accordingly.

---

### 2.7 HAKU-0009: Replace polymer-build with Vite
**Priority:** NORMAL | **Effort:** M | **Risk:** MEDIUM
**Dependencies:** HAKU-0008 (Electron upgrade — Vite needs modern Node). Runs **before** Phase 3 Lit migration.

Since Vite runs before Lit migration, we need Polymer HTML Import compatibility.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0009a | Research Vite plugins for Polymer HTML Imports (`<link rel="import">`) — evaluate `vite-plugin-polymer` or custom transform | S | Med | — |
| 0009b | Create `vite.config.js` with `src/web/index.html` as entry point | S | Low | 0009a |
| 0009c | Configure HTML Import handling (plugin or custom Vite plugin to transform `<link rel="import">` to JS imports) | M | Med | 0009a, 0009b |
| 0009d | Configure Vite for dynamic `.mjs` imports (1,334 connectors via `await import(file)`) | S | Low | 0009b |
| 0009e | Set up Vite dev server with Electron integration (evaluate `electron-vite` vs custom) | M | Med | 0009b |
| 0009f | Migrate `build-web.js` pipeline: replace PolymerProject streams with Vite build | M | Med | 0009b, 0009c, 0009d |
| 0009g | Update `build-app.js` to consume Vite build output instead of polymer-build output | S | Low | 0009f |
| 0009h | Verify: `npm run build:web` produces equivalent output, `npm run start:dev` works with HMR | S | Low | 0009f, 0009g |
| 0009i | Update CI workflows for Vite build commands | S | Low | 0009h |
| 0009j | Remove `polymer-build` dependency and old `build-web.js` | S | Low | 0009i |

**Key files:**
- `build-web.js` (94 lines — to replace)
- `build-web.config` (23 lines — polymer config, to replace with vite.config.js)
- `build-app.js` (907 lines — update source paths)
- `src/web/index.html` (174 lines — Vite entry point)
- `src/web/lib/hakuneko/frontend@classic-light/*.html` (13 Polymer components)
- `src/web/lib/hakuneko/frontend@classic-dark/*.html` (13 Polymer components, duplicate)

---

### 2.7 HAKU-0010: Replace Vendored JS with npm Packages
**Priority:** NORMAL | **Effort:** M | **Risk:** LOW
**Dependencies:** Ideally after HAKU-0009 (Vite handles npm imports natively). Uses **global wrapper** approach — zero connector changes.

**Approach:** For each library: `npm install <package>`, import in entry point, assign to `window.<Global>`. Remove vendored file and `<script>` tag.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0010a | Replace `crypto-js.min.js`: `npm i crypto-js`, `window.CryptoJS = ...` in entry | S | Low | — |
| 0010b | Replace `jszip.min.js`: already an npm dep, just remove vendored copy and add global wrapper | S | Low | — |
| 0010c | Replace `protobufjs.min.js`: `npm i protobufjs`, `window.protobuf = ...` in entry | S | Med | — |
| 0010d | Replace `pdfkit.standalone.js`: `npm i pdfkit`, `window.PDFDocument = ...` in entry | S | Low | — |
| 0010e | Replace `hls.light.min.js`: `npm i hls.js`, `window.Hls = ...` in entry | S | Low | — |
| 0010f | Replace `oauth-1.0a.min.js`: `npm i oauth-1.0a`, `window.OAuth = ...` in entry | S | Low | — |
| 0010g | Replace `ass.min.js`: `npm i assjs`, `window.ASS = ...` in entry | S | Low | — |
| 0010h | Replace `sql.min.js`: `npm i sql.js`, `window.SQL = ...` in entry | S | Low | — |
| 0010i | Replace `exif-js.min.js`: `npm i exif-js`, `window.EXIF = ...` in entry | S | Low | — |
| 0010j | Remove all `<script>` tags from `index.html` (lines 8-16) and delete `src/web/js/` directory | S | Low | 0010a through 0010i |
| 0010k | Verify: run connectors that use each library (Batoto→CryptoJS, ComicFuz→protobuf+CryptoJS, video connectors→Hls) | M | Low | 0010j |

**Key files:**
- `src/web/index.html:8-16` (script tags to remove)
- `src/web/js/` (9 vendored files to delete)
- Entry point / global setup file (new — where `window.CryptoJS = ...` goes)

---

### 2.8 HAKU-0011: Add TypeScript Incrementally (`.ts` file renames)
**Priority:** NORMAL | **Effort:** L (ongoing) | **Risk:** LOW
**Dependencies:** **Hard dependency on HAKU-0009** (Vite must be configured to handle `.ts` files before any renames).

**Approach:** Rename engine `.mjs` files to `.ts` one at a time, starting with data models (least complex) and working up to engine core. Connectors stay as `.mjs` — the typed base class provides the contract.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0011a | Add `tsconfig.json` with `allowJs: true`, `strict: false` initially | S | Low | **HAKU-0009** (Vite configured) |
| 0011b | Configure Vite to compile `.ts` files alongside `.mjs` (should work out of the box) | S | Low | HAKU-0009, 0011a |
| 0011c | Rename + type `Manga.mjs` → `Manga.ts` (213 lines) | S | Low | 0011b |
| 0011d | Rename + type `Chapter.mjs` → `Chapter.ts` (129 lines) | S | Low | 0011b |
| 0011e | Rename + type `DownloadJob.mjs` → `DownloadJob.ts`, `DownloadManager.mjs` → `DownloadManager.ts` (55 lines) | S | Low | 0011b |
| 0011f | Extract `IConnector` interface as `IConnector.ts` from Connector.mjs:626-649 | M | Low | 0011c, 0011d |
| 0011g | Rename + type `Connector.mjs` → `Connector.ts` (748 lines): `fetchDOM()`, `fetchJSON()`, `fetchPROTO()`, etc. | M | Med | 0011f |
| 0011h | Rename + type `Settings.mjs` → `Settings.ts` (430 lines) | S | Low | 0011b |
| 0011i | Rename + type `Storage.mjs` → `Storage.ts` (951 lines) | M | Med | 0011b |
| 0011j | Rename + type `Request.mjs` → `Request.ts` (554 lines) | M | Med | 0011b |
| 0011k | Update all import paths in connectors and other files that reference renamed engine files | M | Med | 0011c through 0011j |
| 0011l | Configure CI to run `tsc --noEmit` type checking | S | Low | 0011a |
| 0011m | Progressively enable stricter tsconfig options (`noImplicitAny`, etc.) as types improve | S | Low | 0011l |

**Note:** 1,334 connectors remain as `.mjs`. They inherit from typed `Connector.ts` — TypeScript validates their usage via the base class contract without requiring connector file renames.

**Key files:**
- `src/web/mjs/engine/Connector.mjs` → `.ts` (748 lines)
- `src/web/mjs/engine/Manga.mjs` → `.ts` (213 lines)
- `src/web/mjs/engine/Chapter.mjs` → `.ts` (129 lines)
- `src/web/mjs/engine/DownloadManager.mjs` → `.ts` (55 lines)
- `src/web/mjs/engine/Storage.mjs` → `.ts` (951 lines)
- `src/web/mjs/engine/Request.mjs` → `.ts` (554 lines)
- `src/web/mjs/engine/Settings.mjs` → `.ts` (430 lines)

---

### Phase 2 Verification Plan

- **HAKU-0029:** Each tier produces JUnit XML, runnable via `npm run test:smoke:tier1/2/3`
- **HAKU-0030:** Fingerprinter identifies correct template for >= 90% of 20 test sites. Generated `.mjs` files pass `npm run lint:web`. CLI `generate` produces working connector for each supported template. GitHub bot creates well-formed PR from test issue. Auto-merge fires only when confidence >= 60 AND validator passes AND CI green. All unit tests pass: `cd tools/connector-gen && npm test`
- **HAKU-0031:** Dead link scan completes within 30 minutes. Report issue created with correct markdown table of problematic connectors. No false positives on CloudFlare-protected sites.
- **HAKU-0008:** Run Tier 2 smoke tests at each Electron checkpoint. Full Tier 3 at final version.
- **HAKU-0012:** All existing functionality works: downloads, settings save/load, connector protocol handling
- **HAKU-0009:** `npm run build:web` produces equivalent output, `npm run start:dev` works with HMR
- **HAKU-0010:** Run connectors that use each replaced library (Batoto, ComicFuz, video connectors)
- **HAKU-0011:** `tsc --noEmit` passes in CI with zero errors

### Phase 2 Dependency Notes

- **HAKU-0029 first:** Smoke tests must exist before HAKU-0008 upgrades begin — they are the regression safety net for every Electron checkpoint.
- **HAKU-0030 after HAKU-0029:** The connector generator's validator (0030g) reuses HAKU-0029's Electron-free test harness. HAKU-0030 also depends on HAKU-0027 (modernized CI) for the GitHub Actions bot workflow.
- **HAKU-0031 reuses HAKU-0030b:** The dead link scanner uses the same url-prober module. HAKU-0031 can start as soon as 0030b is implemented.
- **HAKU-0030/0031 are independent of HAKU-0008–0011:** The connector generation pipeline runs in Node.js outside of Electron. It can proceed in parallel with the Electron upgrade and build system migration.
- **HAKU-0008 → HAKU-0009:** Vite requires a modern Node.js version; Electron 12+ ships with Node 14+, so the Electron upgrade unblocks Vite migration.
- **HAKU-0009 → HAKU-0011:** TypeScript has a **hard dependency** on HAKU-0009 — Vite must be configured to handle `.ts` files before any engine files are renamed from `.mjs`.
- **HAKU-0009 → HAKU-0010:** Vite handles npm imports natively, making the vendored JS replacement cleaner. Can start earlier but global wrappers simplify it regardless.
- **HAKU-0012 ↔ HAKU-0008:** IPC abstraction benefits from Electron 12+ (`ipcMain.handle()` pattern), but is not strictly blocked. Can begin design (0012a, 0012b) in parallel with HAKU-0008.
- **HAKU-0011 ↔ HAKU-0012:** The IPC TypeScript types (0012j) are optional and only apply if HAKU-0011 is already in progress.
- **HAKU-0032 depends on HAKU-0012:** The Node.js require migration needs the IPC abstraction layer in place first. HAKU-0017 (Decompose Storage.mjs) is not a hard dependency but would make the migration significantly easier.
- **HAKU-0032 completes HAKU-0004:** Flipping `nodeIntegration: false` is the last step of the Phase 1 security hardening, but requires Phase 2 infrastructure.
- **No `@electron/remote` shim needed:** Phase 1 fully removes `electron.remote` (HAKU-0005), so HAKU-0008 can skip the 8→12 compatibility shim entirely.

---

[Back to top](#top)

## Phase 3: UI Migration — Polymer to Lit

> **Goal:** Replace Polymer 2.0 with Lit (~5KB). Same Web Components standard, same team (Google).
>
> **Prerequisite:** HAKU-0009 (Vite) complete — Lit uses ES module imports which require a modern bundler. Polymer HTML Import compatibility (HAKU-0009c) needed during incremental migration.

### Why Lit?

| Criteria | Polymer 2.0 | Lit 3.x |
|----------|------------|---------|
| Status | Abandoned (2018) | Actively maintained |
| Size | ~50KB | ~5KB |
| Standard | Web Components v0/v1 | Web Components v1 |
| Template | HTML Imports (deprecated) | Tagged template literals |
| Data binding | Two-way, custom syntax | Reactive properties |
| XSS safety | `[[]]` does not auto-escape | Tagged templates auto-escape |
| Migration path | — | Official Polymer → Lit guide |

### Phase 3 Execution Order

| Order | Task | Priority | Description |
|-------|------|----------|-------------|
| 1 | HAKU-0014 | **HIGH** | Consolidate duplicate themes — eliminates ~4,114 lines of duplication before migration |
| 2 | HAKU-0013 | **HIGH** | Migrate 13 Polymer components to Lit (leaves-first, root last) |
| 3 | HAKU-0015 | NORMAL | Add virtual scrolling for large lists (mangas, chapters, connectors) |

---

### 3.1 HAKU-0014: Consolidate Duplicate Themes
**Priority:** HIGH | **Effort:** M | **Risk:** Low
**Dependencies:** HAKU-0009 (Vite configured for ES module imports)

**Rationale:** `frontend@classic-light/` (4,090 lines, 13 files) and `frontend@classic-dark/` (4,114 lines, 13 files) are 99%+ identical. Only `theme.html` differs — 52 CSS custom properties with different color values (light: `#f8f8f8`, `#404040`, `#2080e0`; dark: `#202225`, `#dcddde`, `#7289da`). All 12 non-theme components are exact duplicates. Consolidating before Lit migration means migrating 13 files instead of 26.

**Decision:** Consolidate themes in Polymer first → migrate single set to Lit. Halves migration scope from 26 files to 13.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0014a | Diff all 13 component files between `frontend@classic-light/` and `frontend@classic-dark/` to confirm only `theme.html` differs; document any non-CSS differences found | S | Low | — |
| 0014b | Create unified `theme.ts` module exporting light and dark CSS custom property sets (52 variables each), extracted from `frontend@classic-light/theme.html:1-258` and `frontend@classic-dark/theme.html:1-282` | S | Low | 0014a |
| 0014c | Add theme-switching mechanism: toggle CSS class on `:root` to swap variable sets, persist choice via `Engine.Settings.frontend.value`, wire to existing frontend selector in `menu.html` settings panel | M | Low | 0014b |
| 0014d | Update `src/web/index.html:60,75` to load from single `frontend@classic/` directory instead of branching on `Engine.Settings.frontend.value` between `frontend@classic-light` and `frontend@classic-dark` | S | Low | 0014c |
| 0014e | Copy one theme directory to `frontend@classic/`, integrate `theme.ts` import, verify all 52 CSS custom properties resolve correctly in both modes | M | Low | 0014d |
| 0014f | Visual verification: screenshot all 13 components in both themes, compare to pre-consolidation screenshots | S | Low | 0014e |
| 0014g | Remove `frontend@classic-light/` and `frontend@classic-dark/` directories (26 files, ~8,204 lines total) | S | Low | 0014f |

**Key files:**
- `src/web/lib/hakuneko/frontend@classic-light/theme.html` (258 lines — 52 light CSS variables)
- `src/web/lib/hakuneko/frontend@classic-dark/theme.html` (282 lines — 52 dark CSS variables)
- `src/web/lib/hakuneko/frontend@classic-light/*.html` (13 components, 4,090 lines)
- `src/web/lib/hakuneko/frontend@classic-dark/*.html` (13 components, 4,114 lines)
- `src/web/index.html:60,75` (frontend selection logic)
- `src/web/mjs/engine/Settings.mjs` (frontend setting definition)

---

### 3.2 HAKU-0013: Migrate Polymer Components to Lit
**Priority:** HIGH | **Effort:** XL | **Risk:** Medium
**Dependencies:** HAKU-0014 (themes consolidated), HAKU-0009 (Vite configured for ES modules), HAKU-0011a/B (tsconfig + Vite .ts support)

Migration order: leaves first, root last. Each component converts from Polymer's `dom-module` / HTML Import pattern to Lit's `LitElement` / tagged template literal pattern.

**Decision:** Migrated components use `.ts` files (HAKU-0011 TypeScript migration assumed in progress). Requires `tsconfig.json` from HAKU-0011a.

**Migration pattern per component:**
1. Replace `<link rel="import">` with ES `import` statements
2. Replace `class X extends Polymer.Element` with `class X extends LitElement`
3. Replace `<template>` / `<dom-module>` wrapper with `render()` method returning `` html`...` ``
4. Replace `static get properties()` with `static properties = {}`
5. Replace `[[prop]]` one-way bindings with `${this.prop}`
6. Replace `{{prop}}` two-way bindings (40 occurrences across 12 files) with one-way binding + explicit event handlers
7. Replace `<template is="dom-repeat">` with `.map()` in template literal
8. Replace `<template is="dom-if">` with ternary/conditional in template literal
9. Replace `on-click="method"` with `@click=${this.method}`
10. Replace `notify: true` properties (16 occurrences in 8 components) with explicit `CustomEvent` dispatching

**Component complexity reference:**

| Component | Lines | Complexity | Key challenges |
|-----------|-------|------------|----------------|
| quotes.html | 508 | Trivial | Data-only, no bindings |
| start.html | 112 | Low | Static, minimal bindings |
| status.html | 111 | Low | Single `notify: true` property |
| bookmarks.html | 133 | Low | `Engine.BookmarkManager` listener, star toggle |
| jobs.html | 247 | Low | `dom-repeat` for job list, status bars |
| input.html | 163 | Medium | 7 `dom-if` variants for input types, two-way `{{item.value::change}}` bindings |
| menu.html | 315 | Medium | Settings dialog, nested `input` components, accordion |
| app.html | 212 | Medium | Root component, imports all children, layout/routing |
| connectors.html | 444 | High | Complex dialog, tag filtering, `dom-repeat` + `dom-if`, depends on `input` |
| mangas.html | 347 | High | `filterMangas()` filter, two-way `selectedManga`, depends on connectors + bookmarks + status |
| chapters.html | 604 | **Highest** | `dom-repeat` with `filter`, `sort`, `initial-count="500"`, `target-framerate="5"`, language dropdown, chaptermarks |
| pages.html | 636 | High | 3 view modes (thumbnail/page/video), keyboard nav, 3 `dom-repeat` blocks, `on-dblclick`/`on-keydown` |

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0013a | Install `lit` package (`npm i lit`), verify Vite resolves Lit imports correctly | S | Low | HAKU-0009, HAKU-0014 |
| 0013b | Create shared `themeStyles` export from consolidated `theme.ts` using Lit's `css` tagged template, usable via `static styles = [themeStyles, ...]` | S | Low | 0013a, HAKU-0014b |
| 0013c | Migrate `quotes.html` → `quotes.ts` (508 lines — data-only component, simplest; validates Lit toolchain end-to-end) | S | Low | 0013b |
| 0013d | Migrate `start.html` → `start.ts` (112 lines — static welcome screen, minimal bindings) | S | Low | 0013b |
| 0013e | Migrate `status.html` → `status.ts` (111 lines — status display with `notify: true` → convert to `CustomEvent` dispatch) | S | Low | 0013b |
| 0013f | Migrate `bookmarks.html` → `bookmarks.ts` (133 lines — star toggle, `Engine.BookmarkManager.addEventListener('changed', ...)` listener) | S | Low | 0013b |
| 0013g | Migrate `input.html` → `input.ts` (163 lines — 7 `dom-if` conditional blocks for input types, two-way `{{item.value::change}}` bindings → `@change` event handlers) | M | Med | 0013b |
| 0013h | Migrate `jobs.html` → `jobs.ts` (247 lines — download queue display, `dom-repeat` → `.map()`) | S | Low | 0013b |
| 0013i | Migrate `connectors.html` → `connectors.ts` (444 lines — complex dialog with tag filtering, `dom-repeat` + `dom-if`, depends on migrated `input.ts`) | M | Med | 0013g |
| 0013j | Migrate `mangas.html` → `mangas.ts` (347 lines — `filterMangas()` filter function, two-way `selectedManga`/`selectedConnector` binding with `notify: true` → event dispatch, depends on connectors + bookmarks + status) | M | Med | 0013e, 0013f, 0013i |
| 0013k | Migrate `chapters.html` → `chapters.ts` (604 lines — **highest complexity**: `dom-repeat` `filter`/`sort`/`initial-count="500"`/`target-framerate="5"` have no Lit equivalent; reimplement as `.filter().sort().slice()` + `requestAnimationFrame` batching; language dropdown; chaptermark integration via `Engine.ChaptermarkManager`) | M | High | 0013e |
| 0013l | Migrate `pages.html` → `pages.ts` (636 lines — 3 view modes via `dom-if` → conditional rendering; 3 `dom-repeat` blocks for thumbnails/images/subtitles → `.map()`; keyboard nav via `on-keydown`; double-click zoom via `on-dblclick`) | M | Med | 0013b |
| 0013m | Migrate `menu.html` → `menu.ts` (315 lines — settings dialog with nested `input.ts` components rendered via `dom-repeat`, accordion UI) | M | Med | 0013g |
| 0013n | Migrate `app.html` → `app.ts` (212 lines — root component, imports all 12 children, layout/routing, media selection; must be migrated last) | M | Med | 0013c through 0013m |
| 0013o | Update `src/web/index.html` to load `app.ts` via ES `import` instead of `<link rel="import" href="app.html">`; remove HTML Import loading logic at line 75 | S | Low | 0013n |
| 0013p | Remove Polymer dependency: delete `src/web/lib/polymer/` directory and `polymer-build` npm dependency | S | Low | 0013o |
| 0013q | Remove webcomponentsjs polyfill: delete `src/web/lib/webcomponentsjs/` directory and `<script>` loader tag from `index.html:71` (all target Electron versions have native Web Components support) | S | Low | 0013o |

**Decision for 0013k:** Replace Polymer's `initial-count="500"` / `target-framerate="5"` with `requestAnimationFrame` batch rendering — render in chunks of 50, yielding between frames. Closely matches Polymer's original behavior, keeps 0013k independent of HAKU-0015, and gets replaced by proper virtual scrolling when HAKU-0015 is completed.

**Key files:**
- `src/web/lib/hakuneko/frontend@classic/*.html` (13 components post-consolidation)
- `src/web/index.html:71,75` (polyfill loader, component import)
- `src/web/lib/polymer/` (Polymer library — to remove)
- `src/web/lib/webcomponentsjs/` (polyfill — to remove)
- `src/web/mjs/engine/Connector.mjs` (referenced by event listeners in components)
- `src/web/mjs/engine/Settings.mjs` (referenced by `Engine.Settings.addEventListener('saved', ...)` in app.html, chapters.html)

---

### 3.3 HAKU-0015: Add Virtual Scrolling
**Priority:** NORMAL | **Effort:** M | **Risk:** Medium
**Dependencies:** HAKU-0013 (Lit migration complete — `@lit-labs/virtualizer` requires Lit)

**Current state:**
- `mangas.html` renders **all** filtered items via `dom-repeat` — no pagination, no virtualization. Some connectors return 10,000+ mangas.
- `chapters.html` has partial optimization: `initial-count="500"` + `target-framerate="5"`, but still stamps all items into DOM eventually.
- `connectors.html` renders all 1,334 connectors via `dom-repeat`.
- Iron-list was attempted for manga list but disabled due to bug (commented out at `mangas.html:4,144-150`, references `iron-list#536`).

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0015a | Install `@lit-labs/virtualizer` package, verify compatibility with project's Lit version | S | Low | HAKU-0013 |
| 0015b | Add virtual scrolling to `mangas.ts`: replace `.map()` render with `<lit-virtualizer>` for manga list (highest impact — currently renders all items with no limit) | M | Med | 0015a |
| 0015c | Add virtual scrolling to `chapters.ts`: replace `.map()` render with `<lit-virtualizer>`, preserve existing filter/sort logic reimplemented in 0013k (replaces `requestAnimationFrame` batching workaround) | M | Med | 0015a |
| 0015d | Add virtual scrolling to `connectors.ts`: replace `.map()` render with `<lit-virtualizer>` for 1,334-item connector list | M | Med | 0015a |
| 0015e | Verify selection state, text filtering, and keyboard navigation work correctly with virtualized lists in all 3 components | S | Med | 0015b, 0015c, 0015d |
| 0015f | Add fallback: skip virtualization when item count < 100 (simpler DOM, avoids virtualizer edge cases for small lists) | S | Low | 0015e |

**Key files:**
- `src/web/lib/hakuneko/frontend@classic/mangas.ts` (post-Lit migration)
- `src/web/lib/hakuneko/frontend@classic/chapters.ts` (post-Lit migration)
- `src/web/lib/hakuneko/frontend@classic/connectors.ts` (post-Lit migration)

---

### Phase 3 Dependency Notes

- **HAKU-0014 before HAKU-0013:** Consolidating themes first reduces Lit migration from 26 files to 13. Verified: all 12 non-theme components are byte-identical between light and dark directories — only `theme.html` CSS variables differ.
- **HAKU-0009 (Phase 2) → HAKU-0014/0013:** Vite must be configured before theme consolidation and Lit migration begin. Lit uses ES module imports, and Polymer's HTML Imports need the Vite compatibility plugin (HAKU-0009c) during the incremental migration period.
- **Polymer/Lit coexistence during migration:** Both Polymer and Lit produce standard `customElements.define()` Web Components. They interoperate natively — a Lit child can live inside a Polymer parent and vice versa. No shim needed during incremental migration.
- **HAKU-0013 → HAKU-0015:** `@lit-labs/virtualizer` is a Lit-specific library. Virtual scrolling must wait for Lit migration to complete.
- **HAKU-0013k (chapters.ts) is highest risk:** Polymer's `dom-repeat` attributes `filter`, `sort`, `initial-count`, and `target-framerate` have no direct Lit equivalent. Filter/sort must be reimplemented as JavaScript `.filter().sort()` before `.map()`. The `initial-count` progressive rendering will be replaced with `requestAnimationFrame` batch rendering (chunks of 50, yielding between frames), then superseded by `@lit-labs/virtualizer` in HAKU-0015c.
- **Two-way binding replacement:** Polymer's `{{prop}}` two-way bindings (40 occurrences across 12 files) have no Lit equivalent. Each must be converted to one-way `${this.prop}` + explicit `@change`/`@input` event handler. Most are on form inputs (`::input`, `::change` events) and are mechanical to convert.
- **HAKU-0011 dependency:** Phase 3 uses `.ts` files, requiring HAKU-0011a (`tsconfig.json`) to be in place. HAKU-0011b (Vite `.ts` compilation) must also be configured.
- **No Phase 4 conflicts:** Phase 4's `window.Engine` replacement (HAKU-0021) touches Engine references in components. Lit-migrated components will reference `Engine.*` the same way — no conflict, but Phase 4 will need to update the Lit files rather than Polymer HTML files.

### Phase 3 Verification Plan

- **HAKU-0014:** Both light and dark themes render identically to pre-consolidation screenshots. Theme switching works without page reload. `Engine.Settings` persists theme choice across sessions.
- **HAKU-0013 (per component):** Each migrated component renders identically to its Polymer version. All event communication works: `Engine.Settings.addEventListener('saved', ...)`, `Engine.BookmarkManager.addEventListener('changed', ...)`, `document.dispatchEvent(new CustomEvent(EventListener.onSelectManga, ...))`, `window.addEventListener('chapterUp'/'chapterDown', ...)`.
- **HAKU-0013 (data flow):** Two-way data flow chain preserved end-to-end: connector selection → manga list update → chapter list update → page viewer update.
- **HAKU-0013k:** Chapter filtering by text pattern and language dropdown still works. Sort order toggles correctly. Performance with 500+ chapters has no visible lag (matching Polymer's `initial-count="500"` behavior).
- **HAKU-0013l:** All three view modes (thumbnail, page, video) render correctly. Keyboard navigation (arrow keys, page up/down) works. Double-click zoom works.
- **HAKU-0013p/q:** Application loads and functions without Polymer library or webcomponentsjs polyfill. Confirm `src/web/lib/polymer/` and `src/web/lib/webcomponentsjs/` are fully removed. Bundle size decreased.
- **HAKU-0015:** Manga list with 10,000+ items scrolls at 60fps. Chapter list with 500+ chapters scrolls smoothly. Connector list with 1,334 items scrolls smoothly. Selection state, text filtering, and keyboard navigation all function correctly with virtualized lists.

---

[Back to top](#top)

## Phase 4: Architecture Improvements

> **Goal:** Decompose god classes, eliminate global state, optimize performance.
>
> **Prerequisite:** All Phase 1-3 tasks complete. Specifically: HAKU-0005 (no `electron.remote`), HAKU-0011 (TypeScript available), HAKU-0012 (IPC abstraction layer), HAKU-0009 (Vite bundling).

### Phase 4 Execution Order

| Order | Task | Priority | Description |
|-------|------|----------|-------------|
| 1 | HAKU-0020 | NORMAL | Event-driven download queue — standalone, zero cross-dependencies |
| 2 | HAKU-0019 | NORMAL | Extract IConnector interface + remove 96 deprecated callback overrides |
| 3 | HAKU-0016 | **HIGH** | Lazy-load connectors — depends on HAKU-0019 for metadata type |
| 4 | HAKU-0018 | NORMAL | Decompose Request.mjs — prerequisite for HAKU-0028 |
| 5 | HAKU-0028 | NORMAL | Move scraping to main process — depends on decomposed BrowserScraper |
| 6 | HAKU-0017 | **HIGH** | Decompose Storage.mjs — large but self-contained refactor |
| 7 | HAKU-0021 | NORMAL | Replace global state — touches 311 refs across 184 files, do last |

---

### 4.5 HAKU-0020: Replace Polling with Event-Driven Download Queue
**Priority:** NORMAL | **Effort:** S | **Risk:** Low
**Dependencies:** None — self-contained within `DownloadManager.mjs` (55 lines).

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0020a | Add `_processConnectorQueue(connectorID)` method that extracts the per-connector processing logic from the `processQueue()` loop body: check queue length, activeCount, and `isLocked` before processing next job | S | Low | — |
| 0020b | In `addDownload()` (line 31), call `this._processConnectorQueue(connector.id)` after pushing the job to the queue, triggering immediate processing instead of waiting up to 250ms | S | Low | 0020a |
| 0020c | In the `downloadPages` callback inside `_processConnectorQueue`, decrement `activeCount` and recursively call `_processConnectorQueue(connectorID)` to chain the next job | S | Low | 0020a |
| 0020d | Remove `setInterval(this.processQueue.bind(this), 250)` from the constructor (line 12) and delete the `processQueue()` method (lines 42-54) | S | Low | 0020b, 0020c |
| 0020e | Add a safety-net `setInterval` at 5000ms (not 250ms) that logs when it fires, so missed jobs can be detected and the interval can be removed after validation | S | Low | 0020d |
| 0020f | Verify: queue items for different connectors process concurrently; queue items for the same connector wait; connector lock blocks processing; job completion triggers next job | S | Low | 0020d |

**Key files:**
- `src/web/mjs/engine/DownloadManager.mjs` (55 lines — the only file modified)
- `src/web/mjs/engine/DownloadJob.mjs` (397 lines — callback interface unchanged, reference for understanding)

---

### 4.4 HAKU-0019: Extract IConnector Interface and Remove Deprecated Methods
**Priority:** NORMAL | **Effort:** M | **Risk:** Low
**Dependencies:** HAKU-0011f (TypeScript `IConnector.ts` type extraction done in Phase 2). This task extends that work.

**Scope discovery:** 96 connector files still override deprecated callback methods (`_getMangaList`, `_getChapterList`, `_getPageList`), including 15 templates and 3 system connectors. These must be migrated to Promise-based methods before the deprecated wrappers can be removed.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0019a | Audit all 96 connector files that override deprecated methods (`_getMangaList`, `_getChapterList`, `_getPageList`) — categorize as: (a) simple delegation that can be mechanically converted, (b) complex logic requiring manual review | S | Low | — |
| 0019b | Migrate category (a) connectors: change `_getMangaList(callback)` overrides to `async _getMangas()` (return array instead of calling callback). Includes templates `ReaderFront`, `FoolSlide`, `Genkan`, `MangaEden`, `ComiCake`, etc. (~80 connectors) | M | Med | 0019a |
| 0019c | Migrate category (b) connectors requiring manual review: `Tsumino` (5 refs), `SpeedBinb`, `VRV`, `LineWebtoon`, system connectors (`FolderConnector`, `BookmarkConnector`, `ClipboardConnector`) | M | Med | 0019a |
| 0019d | Remove the 3 deprecated wrapper methods from `Connector.mjs` (lines 572-621, ~50 lines): `_getMangaList`, `_getChapterList`, `_getPageList`. Update `updateMangas()` (line 92) to call `_getMangas()` directly with try/catch instead of the callback wrapper | S | Low | 0019b, 0019c |
| 0019e | Split `Connector.mjs` into `IConnector.ts` (interface: id, label, tags, url, icon, canHandleURI, getMangaFromURI, _getMangas, _getChapters, _getPages) and `ConnectorBase.ts` (shared implementation: fetchDOM, fetchJSON, createDOM, lock/unlock, helper methods). ConnectorBase implements IConnector. | M | Low | 0019d, HAKU-0011f |
| 0019f | Define `ConnectorMetadata` type (subset of IConnector for UI display without loading module): `{ id: string, label: string, tags: string[], url: string, icon: string }` — used by HAKU-0016 manifest generator | S | Low | 0019e |
| 0019g | Verify: `tsc --noEmit` passes. All 1,334 connectors compile. Tier 2 smoke tests pass for top 50 connectors | S | Low | 0019d |

**Key files:**
- `src/web/mjs/engine/Connector.mjs` (748 lines — split into `IConnector.ts` + `ConnectorBase.ts`)
- `src/web/mjs/connectors/` (96 files with deprecated method overrides)
- `src/web/mjs/connectors/templates/` (15 template files with deprecated overrides)
- `src/web/mjs/connectors/system/` (3 system connectors with deprecated overrides)

---

### 4.1 HAKU-0016: Lazy-Load Connectors
**Priority:** HIGH | **Effort:** L | **Risk:** Medium
**Dependencies:** HAKU-0019f (ConnectorMetadata type), HAKU-0009 (Vite for build tooling)

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0016a | Create build-time script `scripts/generate-connector-manifest.js` that scans all connector `.mjs` files, extracts `id`, `label`, `tags`, `url` from constructor assignments, and generates `connector-manifest.json` | M | Med | — |
| 0016b | Handle edge cases in manifest generator: connectors inheriting from templates (`src/web/mjs/connectors/templates/`), connectors with dynamic `id` (using `Symbol()`), connectors with `url` set via `super()` call chain | S | Med | 0016a |
| 0016c | Create `ConnectorRegistry` class to replace `Connectors.mjs` (69 lines): holds `Map<id, { metadata: ConnectorMetadata, loader: () => import(path), instance: Connector|null }>`. Exposes `getMetadataList()` (all metadata without loading modules) and `async getConnector(id)` (loads and instantiates on demand) | M | Med | 0016a, HAKU-0019f |
| 0016d | Update `ConnectorRegistry.initialize()` to load `connector-manifest.json` for internal plugins, while still eagerly loading system plugins (3 files) and user plugins (`hakuneko://plugins/`) since they are few | S | Low | 0016c |
| 0016e | Update UI connector list component to use metadata from `getMetadataList()` instead of accessing connector instances — the list only needs id, label, tags, icon for display and filtering | M | Med | 0016c |
| 0016f | Update code paths that access a connector by ID: DownloadManager queue keyed by `connector.id`, `BookmarkConnector.mjs`, `ClipboardConnector.mjs`, protocol handler `_onConnectorProtocolHandler` — use `await getConnector(id)` | M | Med | 0016c |
| 0016g | Update `canHandleURI()` flow: currently iterates all connector instances. With lazy loading, check metadata `url` field first, then load only matching connectors for full URI validation | S | Med | 0016c |
| 0016h | Add manifest generation to Vite build pipeline: run `generate-connector-manifest.js` as pre-build step; add npm script `build:manifest` | S | Low | 0016a, HAKU-0009 |
| 0016i | Verify: measure startup time before/after (target >50% reduction). Verify connector filtering works. Verify download pipeline works end-to-end with lazy-loaded connector. User plugins from `hakuneko://plugins/` still load correctly | S | Low | 0016f, 0016g |

**Key files:**
- `src/web/mjs/engine/Connectors.mjs` (69 lines — replaced by ConnectorRegistry)
- `src/web/mjs/HakuNeko.mjs` (103 lines — wires ConnectorRegistry)
- `src/web/mjs/connectors/` (1,334 files — scanned by manifest generator)
- NEW: `scripts/generate-connector-manifest.js`
- NEW: `src/web/mjs/engine/ConnectorRegistry.ts`

---

### 4.3 HAKU-0018: Decompose Request.mjs (554 lines → 3 modules)
**Priority:** NORMAL | **Effort:** M | **Risk:** Medium
**Dependencies:** HAKU-0005 (electron.remote removed), HAKU-0012 (IPC abstraction in place)

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0018a | Extract `HttpClient.ts`: `onBeforeSendHeadersHandler` (lines 422-516), `onHeadersReceivedHandler` (lines 522-552), `_extractRequestOptions` (lines 188-204), `_loginHandler` (lines 75-84), `_initializeProxy` (lines 58-65), `userAgent` property. Constructor takes IPC and Settings references | M | Med | — |
| 0018b | Extract `AntiDetection.ts`: `_scrapingCheckScript` getter (lines 101-166, includes obfuscated Crunchyscan reCAPTCHA detection), `_domPreparationScript` getter (lines 89-98), `_checkScrapingRedirection` (lines 169-182), `_initializeHCaptchaUUID` (lines 22-56) | S | Low | — |
| 0018c | Extract `BrowserScraper.ts`: `fetchUI` (lines 342-397), `fetchBrowser` (lines 277-335), `fetchJapscan` (lines 206-274), `_fetchUICleanup` (lines 403-416). Depends on AntiDetection (for check scripts) and HttpClient (for request options). Constructor takes `BrowserWindow` reference | M | Med | 0018a, 0018b |
| 0018d | Create facade `Request.ts` that composes HttpClient, BrowserScraper, AntiDetection and exposes the same public API as current `Request.mjs` — preserves backward compatibility with all `Engine.Request.fetchUI` calls in connectors | S | Low | 0018c |
| 0018e | Update `HakuNeko.mjs` to instantiate the three modules and compose them into the Request facade | S | Low | 0018d |
| 0018f | Verify: test connectors using `Engine.Request.fetchUI` (173 call sites), `fetchBrowser` (SpeedBinb, Lezhin templates), `fetchJapscan`. Verify header manipulation and proxy settings still apply | S | Low | 0018e |

**Key files:**
- `src/web/mjs/engine/Request.mjs` (554 lines — decomposed)
- `src/web/mjs/HakuNeko.mjs` (103 lines — updated composition)
- NEW: `src/web/mjs/engine/HttpClient.ts`
- NEW: `src/web/mjs/engine/BrowserScraper.ts`
- NEW: `src/web/mjs/engine/AntiDetection.ts`

---

### 4.7 HAKU-0028: Move Scraping to Main Process
**Priority:** NORMAL | **Effort:** M | **Risk:** Medium
**Dependencies:** HAKU-0018c (BrowserScraper extracted as separate module), HAKU-0012 (IPC abstraction layer)

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0028a | Define IPC contract for scraping operations: `scrape:fetchUI(url, script, timeout, images) → result`, `scrape:fetchBrowser(url, preloadScript, runtimeScript, preferences, timeout) → result`, `scrape:fetchJapscan(...)` with same pattern | S | Low | HAKU-0012b |
| 0028b | Port `BrowserScraper.ts` to main process as `src/app/scraper/MainProcessScraper.ts`: move BrowserWindow creation, AntiDetection scripts, and cleanup logic. This code already uses Electron main-process APIs (BrowserWindow), so it naturally belongs there | M | Med | 0028a, HAKU-0018c |
| 0028c | Handle `fetchJapscan`'s `action` callback parameter: currently a function passed by the connector that runs in renderer. Design IPC protocol where main sends intermediate results and renderer sends back action results | M | Med | 0028b |
| 0028d | Create renderer-side `BrowserScraperClient.ts` that implements the same interface as BrowserScraper but delegates to main process via IPC — drop-in replacement | S | Low | 0028b |
| 0028e | Remove `Engine.Storage.saveTempFile` dependency from BrowserScraper: currently `fetchBrowser` (line 282) and `fetchJapscan` (line 211) call it for preload scripts. In main process, use `fs.writeFileSync` to tmp directly | S | Low | 0028b |
| 0028f | Update Request facade to use `BrowserScraperClient` (renderer IPC) instead of direct `BrowserScraper` | S | Low | 0028d |
| 0028g | Verify: test connectors using each scraping method. Verify BrowserWindow created/destroyed in main process. Verify timeout handling works across IPC boundary. Anti-detection (CloudFlare, DDoS Guard) still works | S | Low | 0028f |

**Key files:**
- `src/web/mjs/engine/BrowserScraper.ts` (from HAKU-0018c — replaced with client)
- `src/app/ElectronBootstrap.js` (411 lines — register IPC handlers for scraping)
- NEW: `src/app/scraper/MainProcessScraper.ts`
- NEW: `src/web/mjs/engine/BrowserScraperClient.ts`

---

### 4.2 HAKU-0017: Decompose Storage.mjs (951 lines → 5 modules)
**Priority:** HIGH | **Effort:** L | **Risk:** Medium
**Dependencies:** HAKU-0005 (electron.remote removed from Storage constructor). Completing this before HAKU-0021 reduces Engine.Storage reference count.

**Decomposition (5 modules):**

| New Module | Lines | Responsibility | Methods Extracted |
|------------|-------|----------------|-------------------|
| `ConfigStore` | ~90 | Config + bookmark persistence | `saveConfig`, `loadConfig`, `saveMangaList`, `loadMangaList`, `saveBookmarks`, `loadBookmarks`, `_bookmarkOutputPath` |
| `PathResolver` | ~100 | Path generation + sanitization | `_connectorOutputPath`, `_mangaOutputPath`, `_chapterOutputPath`, `_makeValidFileURL`, `sanatizePath` |
| `ChapterStore` | ~350 | Chapter save/load dispatch, file I/O, directory management | `saveChapterPages`, `loadChapterPages`, `_saveChapterPagesFolder`, `_loadChapterPagesFolder`, `_loadChapterPagesCBZ`, `_loadChapterPagesEPUB`, `_loadChapterPagesPDF`, `_openZipArchive`, `_extractZipEntry`, `_runPostChapterDownloadCommand`, `showFolderContent`, `folderBrowser`, `directoryExist`, `mangaDirectoryExist`, `getExistingMangaTitles`, `getExistingChapterTitles`, `_createDirectoryChain`, `_readDirectoryEntries`, `_writeFile`, `saveTempFile` |
| `MediaConverter` | ~200 | Image/format handling, PDF/EPUB/CBZ generation | `_correctBlobMime`, `_blobToBytes`, `_pageFileName`, `_pageFileMime`, `_pdfImageType`, `_addImageToPDF`, `_saveChapterPagesPDF`, `_saveChapterPagesCBZ`, `_saveChapterPagesEPUB` |
| `VideoStore` | ~150 | Video chunk/stream handling, ffmpeg muxing | `saveVideoChunkTemp`, `concatVideoChunks`, `saveChapterFileM3U8`, `muxPlaylistM3U8`, `_loadEpisodeM3U8`, `_loadEpisodeMKV`, `_loadEpisodeMP4` |

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0017a | Extract `ConfigStore.ts`: `saveConfig`, `loadConfig`, `saveMangaList`, `loadMangaList`, `saveBookmarks`, `loadBookmarks`, `_bookmarkOutputPath` (lines 58-101, 726-728, 921-949). Constructor takes `configPath` and `bookmarkPath` (currently derived from `electron.remote.app.getPath('userData')`) | S | Low | — |
| 0017b | Extract `PathResolver.ts`: `_connectorOutputPath` (lines 733-744), `_mangaOutputPath` (lines 749-753), `_chapterOutputPath` (lines 758-781), `_makeValidFileURL` (lines 417-421), `sanatizePath` (lines 797-814). Constructor takes Settings reference (for `baseDirectory`, `useSubdirectory`, `chapterFormat`) | M | Low | — |
| 0017c | Extract `MediaConverter.ts`: `_correctBlobMime` (lines 876-902), `_blobToBytes` (lines 619-632), `_pageFileName` (lines 819-840), `_pageFileMime` (lines 845-869), `_pdfImageType` (lines 908-916), `_addImageToPDF` (lines 519-561), `_saveChapterPagesPDF` (lines 507-514), `_saveChapterPagesCBZ` (lines 567-580), `_saveChapterPagesEPUB` (lines 475-501). Depends on `EbookGenerator.mjs` (already external), `JSZip`, `PDFDocument` | M | Med | — |
| 0017d | Extract `VideoStore.ts`: `saveVideoChunkTemp` (line 658-660), `concatVideoChunks` (lines 665-684), `saveChapterFileM3U8` (lines 689-699), `muxPlaylistM3U8` (lines 706-721), `_loadEpisodeM3U8` (lines 250-277), `_loadEpisodeMKV` (lines 282-289), `_loadEpisodeMP4` (lines 294-301). Uses `fs` (sync ops for concat), `child_process.exec` (ffmpeg), PathResolver for output paths | M | Med | 0017b |
| 0017e | Extract `ChapterStore.ts`: `saveChapterPages` (lines 431-469, the dispatch hub), `loadChapterPages` (lines 221-245), `_saveChapterPagesFolder` (lines 586-594), `_loadChapterPagesFolder` (lines 398-412), `_loadChapterPagesCBZ`/`_loadChapterPagesEPUB`/`_loadChapterPagesPDF`, `_openZipArchive`, `_extractZipEntry`, `_runPostChapterDownloadCommand`, `showFolderContent`, `folderBrowser`, directory utilities. Composes PathResolver and MediaConverter | M | Med | 0017b, 0017c |
| 0017f | Create `Storage.ts` facade that composes all 5 modules and exposes the same public API as current `Storage.mjs` — preserves backward compatibility with all `Engine.Storage.*` call sites | S | Low | 0017a, 0017b, 0017c, 0017d, 0017e |
| 0017g | Update `DownloadJob.mjs` references: 12 `Engine.Storage.*` calls (`saveChapterPages`, `saveChapterFileM3U8`, `saveVideoChunkTemp`, `concatVideoChunks`, `muxPlaylistM3U8`) — verify all route correctly through facade | S | Low | 0017f |
| 0017h | Update `Connector.mjs` references: `Engine.Storage.loadMangaList`, `Engine.Storage.saveMangaList`, `Engine.Storage.getExistingMangaTitles`, `Engine.Storage.saveTempFile` — verify routing | S | Low | 0017f |
| 0017i | Verify: download chapter in each format (img folder, CBZ, PDF, EPUB). Download video episode (HLS, MP4 stream). Verify bookmarks save/load. Verify config save/load. Verify post-download command executes | S | Low | 0017g, 0017h |

**Justification for L effort:** While individual extractions are M, the total involves creating 5 new files, a facade, and updating 43+ reference sites across engine, connectors, and UI.

**Key files:**
- `src/web/mjs/engine/Storage.mjs` (951 lines — decomposed)
- `src/web/mjs/engine/DownloadJob.mjs` (397 lines — 12 `Engine.Storage` refs)
- `src/web/mjs/engine/Connector.mjs` (748 lines — 6 `Engine.Storage` refs)
- `src/web/mjs/engine/EbookGenerator.mjs` (dependency of MediaConverter)
- NEW: `ConfigStore.ts`, `PathResolver.ts`, `ChapterStore.ts`, `MediaConverter.ts`, `VideoStore.ts`

---

### 4.6 HAKU-0021: Replace Global State (window.Engine)
**Priority:** NORMAL | **Effort:** XL | **Risk:** High
**Dependencies:** HAKU-0017 (Storage decomposed), HAKU-0018 (Request decomposed). Should be the **final** Phase 4 task.

**Scope inventory:**
- Engine files: 61 occurrences across 11 files
- Connectors: ~241 occurrences across 165 files (`Engine.Request.fetchUI`: 173, `Engine.Settings`: 79, `Engine.Storage`: 8)
- Videostreams: 9 occurrences across 8 files
- UI components: ~80 occurrences across 18 files
- `index.html`: 5 occurrences
- **Total: ~396 occurrences across ~184 files**

**Strategy:** Install a Proxy wrapper first (non-breaking), then migrate files incrementally to explicit imports, then remove the proxy.

| Sub | Description | Effort | Risk | Deps |
|-----|-------------|--------|------|------|
| 0021a | Create `EngineProxy.ts`: a `Proxy`-wrapped object that delegates to real module instances and logs deprecation warnings with file/line info. `window.Engine = new EngineProxy(realModules)`. All existing code continues to work unchanged | M | Low | — |
| 0021b | Create module exports `engine/services.ts` exporting `getStorage()`, `getRequest()`, `getSettings()`, `getConnectors()`, `getBlacklist()`, `getDownloadManager()`, `getBookmarkManager()`, `getChaptermarkManager()`, `getComicInfoGenerator()` — explicit import targets | M | Low | — |
| 0021c | Install EngineProxy as `window.Engine` in `HakuNeko.mjs` constructor (replacing direct assignment at `index.html:47-49`). Verify all existing functionality works identically — transparent swap | S | Low | 0021a |
| 0021d | Migrate engine files — low-ref-count (6 files, 19 refs): `DiscordPresence` (1), `HistoryWorker` (3), `ChaptermarkManager` (3), `BookmarkManager` (4), `Chapter` (4), `Manga` (4). Replace `Engine.*` with constructor-injected dependencies | M | Med | 0021b, 0021c |
| 0021e | Migrate engine files — high-ref-count (4 files, 42 refs): `Connector.mjs` (6), `Settings.mjs` (7), `Request.mjs` (5), `DownloadJob.mjs` (12). Inject Storage, Request, Settings via constructor parameters | M | Med | 0021d |
| 0021f | Migrate connectors — `Engine.Request.fetchUI` (173 refs across 165 files): add `this.request` property to `ConnectorBase` set during construction. Bulk replace `Engine.Request.fetchUI(...)` with `this.request.fetchUI(...)` — consistent mechanical pattern | M | Med | 0021e |
| 0021g | Migrate connectors — `Engine.Settings` refs (79 refs): add `this.settings` to `ConnectorBase`. Replace `Engine.Settings.chapterFormat.value` etc. with `this.settings.chapterFormat.value` | M | Low | 0021f |
| 0021h | Migrate connectors — remaining `Engine` refs (`Engine.Storage`: 8, `Engine.Connectors`: 3, `Engine.Blacklist`: 1, `Engine.BookmarkManager`: 1): handle individually since these are sparse | S | Low | 0021g |
| 0021i | Migrate videostreams (9 refs across 8 files): same pattern as 0021f — these inherit from Connector or use `Engine.Request.fetchUI` | S | Low | 0021f |
| 0021j | Migrate UI components (80 refs across 18 files): pass engine services as properties to Lit components (after Phase 3). If still Polymer, use `this.engine = window.Engine` shim in each component constructor | M | Med | 0021c |
| 0021k | Remove `window.EventListener` and `window.Connector` globals from `HakuNeko.mjs` `_initializeGlobals()` (lines 46-54). Replace references with explicit imports | S | Low | 0021j |
| 0021l | Remove EngineProxy: delete proxy wrapper, remove `window.Engine` and `window.HakuNeko` assignments from `index.html` (lines 47-49). Verify no code still accesses the global | S | Low | 0021f, 0021g, 0021h, 0021i, 0021j, 0021k |
| 0021m | Verify: full application smoke test. All download formats work. Settings persist. Bookmarks work. Connector filtering works. All Tier 2 smoke tests pass. EngineProxy deprecation log shows zero calls | S | Low | 0021l |

**Key files:**
- `src/web/mjs/HakuNeko.mjs` (103 lines — remove global assignments)
- `src/web/index.html` (174 lines — lines 47-49 global setup)
- `src/web/mjs/engine/Connector.mjs` (748 lines — add injected deps)
- `src/web/mjs/engine/DownloadJob.mjs` (397 lines — 12 refs to migrate)
- `src/web/mjs/connectors/` (165 files with `Engine.*` refs)
- `src/web/mjs/videostreams/` (8 files with `Engine.*` refs)
- NEW: `src/web/mjs/engine/EngineProxy.ts`
- NEW: `src/web/mjs/engine/services.ts`

---

### Phase 4 Dependency Notes

- **HAKU-0020 is independent.** It touches only `DownloadManager.mjs` and can start immediately, in parallel with everything else.
- **HAKU-0019 enables HAKU-0016.** The `ConnectorMetadata` type defined in 0019f is used by the manifest generator in 0016a and the `ConnectorRegistry` in 0016c. Without it, the lazy-loading system has no schema for what metadata to extract.
- **HAKU-0019 vs HAKU-0011f (Phase 2):** HAKU-0011f creates the TypeScript `IConnector.ts` type. HAKU-0019 builds on that by removing 96 deprecated callback overrides, splitting `Connector.mjs` into interface + base class, and defining `ConnectorMetadata`. No overlap — they are layered.
- **HAKU-0018 enables HAKU-0028.** BrowserScraper must be extracted as a separate module before it can be moved to the main process. The decomposition creates the clean boundary required for process migration.
- **HAKU-0028's `fetchJapscan` challenge:** The `action` parameter is a function that runs in the renderer. Moving scraping to main process requires a request-response IPC protocol where main sends intermediate results and renderer returns action results. This is the highest-risk subtask in HAKU-0028 (0028c).
- **HAKU-0017 and HAKU-0018 reduce HAKU-0021 scope.** After Storage and Request are decomposed into modules with explicit constructors, the replacement pattern (constructor injection) is already established, making the `Engine.*` migration more mechanical.
- **HAKU-0021 must be last.** It touches 184+ files and depends on all other decompositions being stable. The EngineProxy (0021a-0021c) can be installed early as a non-breaking change, but actual migration (0021d-0021l) should wait until Storage, Request, and Connector refactors are settled.
- **No circular dependencies.** The dependency graph is: `0020` (standalone) | `0019 → 0016` | `0018 → 0028` | `0017` (standalone, helps 0021) | `0021` (last, benefits from 0017+0018).

### Phase 4 Verification Plan

- **HAKU-0020:** Queue downloads for 3 different connectors simultaneously — all three process concurrently. Queue 2 downloads for same connector — second waits. Kill download mid-progress — next in queue starts automatically. Monitor CPU: no 250ms polling spikes.
- **HAKU-0019:** `tsc --noEmit` passes. All 96 migrated connectors use Promise-based methods. Deprecated wrappers removed from `Connector.mjs`. Tier 2 smoke tests pass.
- **HAKU-0016:** Startup time before/after (target >50% reduction). Memory usage before/after. Connector list in UI shows all 1,334 entries. Filtering/searching works. Selecting a connector loads it on demand. Full download pipeline works. User plugins load correctly.
- **HAKU-0018:** All 173 `Engine.Request.fetchUI` call sites work. `fetchBrowser` works (SpeedBinb/Lezhin). `fetchJapscan` works. Header manipulation applies. Proxy settings apply.
- **HAKU-0028:** BrowserWindow instances created in main process (verify via logging). Timeout works across IPC. Anti-detection (CloudFlare, DDoS Guard) works. `fetchJapscan` action callback protocol works across process boundary.
- **HAKU-0017:** Download chapter as img/CBZ/PDF/EPUB. Download HLS video (MKV output). Download MP4 stream (concatenation). Config save/load. Bookmarks save/load. Post-download command executes. Path sanitization handles Win/Linux/macOS.
- **HAKU-0021:** Full Tier 2 smoke tests pass. All `// TODO: use dependency injection` comments resolved. EngineProxy deprecation log shows zero calls. `window.Engine` is `undefined` after 0021l. All UI renders correctly. Settings/bookmarks/downloads work.

---

[Back to top](#top)

## Phase 5: Polish & Future-Proofing

> **Goal:** Accessibility, testing, responsive layout, dependency cleanup. Vitest for unit/integration tests, Playwright for Electron E2E. Drop MOBI output entirely. CSS container queries for responsive layout.

### Phase 5 Execution Order

| Order | Task | Priority | Description |
|-------|------|----------|-------------|
| 1 | HAKU-0025 | HIGH | Test suite (Vitest + Playwright) — validation foundation |
| 2 | HAKU-0026 | LOW | Replace deprecated deps (discord-rpc, drop kindlegen) |
| 3 | HAKU-0022 | NORMAL | Add ARIA attributes to all 13 Lit components |
| 4 | HAKU-0023 | NORMAL | Add keyboard navigation and focus management |
| 5 | HAKU-0024 | LOW | Responsive layout with container queries |

---

### HAKU-0025: Comprehensive Test Suite

- **Priority:** HIGH | **Effort:** L | **Risk:** Medium | **Deps:** Phase 2 complete (Vite build), Phase 3 complete (Lit components for E2E)

| ID | Subtask | Effort | Details |
|----|---------|--------|---------|
| 0025a | Install and configure Vitest | S | Add `vitest` + `@vitest/coverage-v8` to devDeps. Create `vitest.config.ts` extending Vite config. Configure `test.include` for `src/app/__tests__/**` and `src/web/__tests__/**`. Add `test` and `test:coverage` scripts to `package.json`. |
| 0025b | Migrate existing Jest tests to Vitest | S | Migrate 9 tests in `src/app/__tests__/` and 2 in `src/web/__tests__/` (11 total, 1,569 lines). Replace `jest` globals with `vitest` imports (`describe`, `it`, `expect`, `vi`). Replace `jest.fn()` → `vi.fn()`, `jest.mock()` → `vi.mock()`. Remove Jest config from `package.json`. Verify all 11 tests pass. |
| 0025c | Install and configure Playwright for Electron E2E | S | Add `@playwright/test` and `electron` to devDeps. Create `playwright.config.ts` with Electron launch config pointing to `src/app/ElectronBootstrap.js`. Configure screenshot-on-failure. Add `test:e2e` script to `package.json`. |
| 0025d | Unit tests: Storage modules | M | Write tests for `ConfigStore`, `PathResolver`, `ChapterStore`, `MediaConverter`, `VideoStore` (post-HAKU-0017 decomposition). Cover: config save/load, path sanitization (Win/Linux/macOS special chars), chapter file writing (img/CBZ/PDF/EPUB), MIME detection, HLS/MP4 stream handling. |
| 0025e | Unit tests: Request modules | M | Write tests for `HttpClient`, `AntiDetection`, `BrowserScraper` (post-HAKU-0018 decomposition). Cover: header manipulation, cookie handling, CloudFlare/DDoS Guard detection, retry logic, timeout behavior. Mock `fetch` and `BrowserWindow`. |
| 0025f | Unit tests: ConnectorBase and ConnectorRegistry | S | Test `ConnectorBase` methods: `fetchManga()`, `fetchChapters()`, `fetchPages()`, URL resolution, language filtering. Test `ConnectorRegistry`: manifest loading, lazy connector instantiation, filtering, search. |
| 0025g | Unit tests: DownloadManager | S | Test event-driven queue (post-HAKU-0020): enqueue, dequeue, per-connector locking, concurrent downloads across connectors, sequential downloads within same connector, cancellation, error recovery. |
| 0025h | Unit tests: Settings and IPC bridge | S | Test `Settings.mjs`: default values, persistence, type coercion, migration from old formats. Test IPC bridge (post-HAKU-0012): message serialization, channel routing, error propagation across process boundary. |
| 0025i | Integration tests: download pipeline | M | End-to-end download flow using a mock HTTP server: connector fetches manga list → selects manga → fetches chapters → downloads pages → saves to disk in all output formats (img, CBZ, PDF, EPUB). Verify file integrity. |
| 0025j | Integration tests: settings + bookmarks | S | Test settings save/load cycle, bookmarks add/remove/persist, theme switching, output format changes. Verify `userData` directory handling. |
| 0025k | E2E tests with Playwright | M | Electron app launch and window creation. Connector list renders and is searchable. Manga browsing loads content. Chapter selection and download initiation. Settings panel opens and persists changes. Verify no console errors during typical workflow. |
| 0025l | Add coverage reporting to CI | S | Configure `@vitest/coverage-v8` with thresholds: 60% statements, 50% branches (initial). Add coverage report upload to CI workflow. Add coverage badge to README. Fail CI if coverage drops below threshold. |
| 0025m | Integrate HAKU-0029 smoke tests into Vitest | S | Import smoke test runner from HAKU-0029 as a Vitest test suite. Configure with extended timeout (30s per connector). Run as separate CI job (`test:smoke`) to avoid blocking unit tests. |

**Key files:**
- NEW: `vitest.config.ts`
- NEW: `playwright.config.ts`
- `package.json` (scripts + devDeps)
- `src/app/__tests__/*.test.js` (migrate to Vitest)
- `src/web/__tests__/*.test.js` (migrate to Vitest)
- `.github/workflows/continuous-integration.yml` (add test + coverage jobs)

---

### HAKU-0026: Replace Deprecated Dependencies

- **Priority:** LOW | **Effort:** S | **Risk:** Low | **Deps:** None (can start anytime)

| ID | Subtask | Effort | Details |
|----|---------|--------|---------|
| 0026a | Replace `discord-rpc` with `@xhayper/discord-rpc` | S | Update `package.json`: remove `discord-rpc`, add `@xhayper/discord-rpc`. Update import in `DiscordPresence.mjs`. |
| 0026b | Update DiscordPresence.mjs API calls | S | Adapt `DiscordPresence.mjs` to new library API. The `@xhayper/discord-rpc` package has a similar but not identical API — update `Client` constructor, `login()`, `setActivity()`, and `destroy()` calls. Update error handling for new error types. |
| 0026c | Remove `@hakuneko/kindlegen-binaries` | S | Remove from `package.json` dependencies. Remove kindlegen binary bundling from `build-app.js` (line ~170). Remove any kindlegen extraction/path logic from `Storage.mjs` / `MediaConverter`. |
| 0026d | Remove MOBI output option | S | Remove MOBI from `Settings.mjs` output format enum. Remove MOBI generation code from `EbookGenerator.mjs` / `MediaConverter`. Remove MOBI option from settings UI component. |
| 0026e | Add migration notice for MOBI users | S | On settings load, if saved output format is MOBI, auto-migrate to EPUB and show one-time notification: "MOBI output has been removed. Your output format has been changed to EPUB." Log migration event. |
| 0026f | Verify Discord + ebook outputs | S | Manual verification: Discord Rich Presence connects and shows activity. EPUB output generates valid file (validate with `epubcheck`). PDF output works. CBZ output works. No regression in image-only download. |

**Key files:**
- `src/web/mjs/engine/DiscordPresence.mjs` (171 lines)
- `src/web/mjs/engine/Storage.mjs` / `MediaConverter` (post-HAKU-0017)
- `src/web/mjs/engine/EbookGenerator.mjs`
- `src/web/mjs/engine/Settings.mjs` (430 lines)
- `build-app.js` (907 lines — kindlegen bundling at ~line 170)
- `package.json`

---

### HAKU-0022: Add ARIA Attributes

- **Priority:** NORMAL | **Effort:** M | **Risk:** Low | **Deps:** HAKU-0013 (Lit migration complete — ARIA goes on Lit components, not Polymer)

| ID | Subtask | Effort | Details |
|----|---------|--------|---------|
| 0022a | Add landmark roles to app.ts | S | Add `role="main"` to content area, `role="navigation"` to sidebar, `role="complementary"` to secondary panels. Add `aria-label` to each landmark for screen reader identification. |
| 0022b | Add toolbar roles to menu.ts + window controls | S | Add `role="toolbar"` to menu bar. Add `role="button"` and `aria-label` to each menu item. Add `role="button"` and `aria-label` to window control buttons in `index.html` (minimize, maximize, close at lines 164-166). |
| 0022c | Add listbox roles to connectors.ts | S | Add `role="listbox"` to connector list container. Add `role="option"` to each connector entry. Add `aria-label="Connector list"`. Add `aria-activedescendant` to track current selection. |
| 0022d | Add listbox roles to mangas.ts | S | Add `role="listbox"` and `aria-label="Manga list"` to manga container. Add `role="option"` and `aria-selected` to each manga entry. Update selection logic to sync `aria-selected`. |
| 0022e | Add listbox roles to chapters.ts | S | Add `role="listbox"` and `aria-label="Chapter list"` to chapter container. Add `role="option"` and `aria-selected` to each chapter entry. Support multi-select with `aria-multiselectable="true"`. |
| 0022f | Add alt text and roles to pages.ts | S | Add `alt` text to page images (format: "Page N of Chapter X"). Add `role="region"` and `aria-label` to viewer container. Handle both thumbnail grid and full-page viewer modes. |
| 0022g | Add aria-live regions to status.ts and jobs.ts | S | Add `aria-live="polite"` to status bar for download progress updates. Add `aria-live="assertive"` to error notifications. Add `role="log"` to jobs list. Add `aria-busy` during active downloads. |
| 0022h | Add form labels to input.ts | S | Add `aria-label` to all input fields. Add `aria-required="true"` where applicable. Add `aria-invalid` state for validation errors. Associate labels with inputs via `for`/`id` or `aria-labelledby`. |
| 0022i | Add button role to bookmarks.ts | S | Add `role="button"` to bookmark star toggle. Add `aria-pressed` to reflect bookmark state. Add `aria-label` ("Add bookmark" / "Remove bookmark") that updates with state. |
| 0022j | Run axe-core audit and fix violations | S | Install `axe-core` as devDep. Create automated audit script that loads each component and runs `axe.run()`. Fix all critical and serious violations. Add audit to CI as optional check. |

**Key files:**
- `src/web/lib/hakuneko/frontend@classic-light/*.ts` (13 components, post-Phase 3)
- `src/web/index.html` (window controls at lines 164-166)

---

### HAKU-0023: Keyboard Navigation and Focus Management

- **Priority:** NORMAL | **Effort:** M | **Risk:** Low | **Deps:** HAKU-0022 (ARIA roles must exist before keyboard nav references them)

| ID | Subtask | Effort | Details |
|----|---------|--------|---------|
| 0023a | Define global tab order | S | Establish logical tab sequence: menu → connectors → mangas → chapters → pages/jobs. Set `tabindex` values on component root elements. Document tab order in component JSDoc. |
| 0023b | Arrow key navigation in connectors.ts | S | Add `keydown` handler for ArrowUp/ArrowDown to move through connector list. Enter to select connector. Escape to close connector dialog. Maintain `aria-activedescendant` sync. Scroll selected item into view. |
| 0023c | Arrow key navigation in mangas.ts | S | Add ArrowUp/ArrowDown for list navigation. Add type-ahead search: typing characters filters/jumps to matching manga name. Enter to select. Home/End to jump to first/last item. |
| 0023d | Arrow key navigation in chapters.ts | S | Add ArrowUp/ArrowDown for list navigation. Shift+Arrow for range selection. Enter to start download of selected chapters. Space to toggle individual selection. Ctrl+A to select all. |
| 0023e | Fix focus trap in pages.ts | S | Remove the current `onblur="this.focus()"` pattern (hard focus trap). Replace with proper focus management: trap focus within viewer when open, release on Escape. Use `focusin`/`focusout` events instead of `blur`. |
| 0023f | Add global keyboard shortcuts | S | Ctrl+F: focus search/filter input. Ctrl+D: download selected chapters. Escape: navigate back / close dialog. Register shortcuts via `keydown` on `document`. Avoid conflicts with browser/Electron defaults. |
| 0023g | Add visible focus indicators | S | Add CSS `:focus-visible` outlines to all interactive elements across all 13 components. Use high-contrast outline (2px solid) that works on both light and dark themes. Remove any `outline: none` rules. |
| 0023h | Add skip-to-content link | S | Add visually-hidden skip link as first focusable element in `app.ts`. On activation, move focus to main content area. Make visible on focus for sighted keyboard users. |
| 0023i | Make window controls keyboard-accessible | S | Add `tabindex="0"` to minimize, maximize, close buttons in `index.html`. Add `keydown` handler for Enter and Space to trigger click. Add visual focus indicator matching title bar style. |

**Key files:**
- `src/web/lib/hakuneko/frontend@classic-light/*.ts` (13 components, post-Phase 3)
- `src/web/index.html` (window controls)

---

### HAKU-0024: Responsive Layout

- **Priority:** LOW | **Effort:** M | **Risk:** Low | **Deps:** HAKU-0013 (Lit migration — container queries require modern CSS scoping)

| ID | Subtask | Effort | Details |
|----|---------|--------|---------|
| 0024a | Add minWidth/minHeight to BrowserWindow | S | Set `minWidth: 640` and `minHeight: 480` in `ElectronBootstrap.js` BrowserWindow config (lines 251-263). Prevents window from being resized to unusable dimensions. |
| 0024b | Persist window bounds | S | On window `close` event, save `{ x, y, width, height, isMaximized }` to `userData/window-bounds.json`. On launch, restore saved bounds. Validate bounds are within current display bounds (handle monitor changes). Default to `1120x680` centered if no saved bounds. |
| 0024c | Container query breakpoints in app.ts | M | Add `container-type: inline-size` to app root. Below 800px: switch from row layout (sidebar + content) to column layout (stacked). Below 600px: collapse sidebar to hamburger menu. Use `@container` queries instead of `@media` for component-level responsiveness. |
| 0024d | Make connector dialog responsive | S | Change connector dialog from fixed `width: 30em` to fluid `width: min(30em, 90vw)` with `max-width`. Adjust connector grid columns based on container width. Ensure dialog is centered and scrollable on small windows. |
| 0024e | Make page thumbnails fluid grid | S | Replace fixed `16em` thumbnail width with responsive CSS grid: `grid-template-columns: repeat(auto-fill, minmax(10em, 1fr))`. Thumbnails scale between 10em and available space. Maintain aspect ratio with `aspect-ratio: 2/3`. |
| 0024f | High-DPI scaling support | S | Respect `devicePixelRatio` for canvas rendering (page viewer). Use CSS `image-rendering` for crisp thumbnails. Set `zoomFactor` on `webContents` if needed. Test at 1x, 1.5x, 2x scaling. |
| 0024g | Cross-platform verification | S | Test window behavior on Windows (with title bar), macOS (with traffic lights), Linux (various WMs). Verify frameless window controls remain accessible at all sizes. Test min-size enforcement. Test bounds persistence across sessions. |

**Key files:**
- `src/app/ElectronBootstrap.js` (411 lines — BrowserWindow config at lines 251-263)
- `src/web/lib/hakuneko/frontend@classic-light/app.ts` (post-Phase 3)
- `src/web/lib/hakuneko/frontend@classic-light/connectors.ts`
- `src/web/lib/hakuneko/frontend@classic-light/pages.ts`

---

### Phase 5 Dependency Notes

- **HAKU-0025 first.** The test suite is the validation foundation for all other Phase 5 work. Vitest config (0025a) and Jest migration (0025b) have no external deps and can start immediately after Phase 2 (Vite build). E2E tests (0025c, 0025k) require Phase 3 (Lit components). Storage/Request unit tests (0025d, 0025e) require Phase 4 decomposition (HAKU-0017, HAKU-0018).
- **HAKU-0026 is independent.** Discord-rpc replacement and MOBI removal can happen at any time. No dependency on other Phase 5 tasks or on Phases 2-4 (though MOBI removal is cleaner after HAKU-0017 decomposes Storage.mjs).
- **HAKU-0022 requires HAKU-0013.** ARIA attributes target the Lit components (post-Phase 3). Adding ARIA to Polymer HTML that will be rewritten is wasted effort.
- **HAKU-0023 requires HAKU-0022.** Keyboard navigation references ARIA roles (`aria-activedescendant`, `aria-selected`) that must exist first.
- **HAKU-0024 requires HAKU-0013.** Container queries need `container-type` set in Lit component styles. The Polymer HTML import system doesn't support `@container` rules.
- **Cross-phase deps:** 0025d depends on HAKU-0017 (Storage decomposition). 0025e depends on HAKU-0018 (Request decomposition). 0025f depends on HAKU-0019 (ConnectorBase extraction). 0025g depends on HAKU-0020 (event-driven queue). 0025k depends on HAKU-0013 (Lit UI to test against).

### Phase 5 Verification Plan

- **HAKU-0025:** All 11 migrated tests pass under Vitest. `vitest run` exits 0 in CI. Coverage report generates and meets 60%/50% thresholds. Playwright E2E launches Electron, completes full browse-and-download flow. Smoke tests run as separate CI job.
- **HAKU-0026:** `npm ls discord-rpc` returns empty. `npm ls @hakuneko/kindlegen-binaries` returns empty. Discord Rich Presence shows manga title during download. EPUB/PDF/CBZ outputs generate valid files. Settings UI shows no MOBI option. Users with MOBI saved see migration notice exactly once.
- **HAKU-0022:** axe-core audit reports zero critical/serious violations. Screen reader (NVDA/VoiceOver) can identify all 13 components by role and label. Dynamic content changes (download progress, status) are announced via `aria-live`.
- **HAKU-0023:** Full app workflow completable with keyboard only (no mouse). Tab order follows defined sequence. Arrow keys navigate all three list components. Type-ahead search works in manga list. Focus indicators visible in both themes. No focus traps (Escape always releases).
- **HAKU-0024:** Window resizable from 640x480 to fullscreen with no layout breakage. Bounds persist across app restart. Layout switches to column mode below 800px. Thumbnails reflow correctly. No overlapping elements at any size. Frameless controls accessible on all platforms.

---

[Back to top](#top)

## Dependency Modernization Table

| Current Package | Version | Replacement | Target Version | Phase | Notes |
|----------------|---------|-------------|----------------|-------|-------|
| `electron` | `8.3.4` | `electron` | `33+` | 2 | Incremental: 8→12→22→33 |
| `polymer-build` | `latest` | `vite` | `6.x` | 2 | Build system replacement |
| `discord-rpc` | `latest` | `@xhayper/discord-rpc` | `1.x` | 1 | Maintained fork |
| `@hakuneko/kindlegen-binaries` | `latest` | Remove / `calibre` CLI | — | 5 | KindleGen discontinued |
| `asar` | `latest` | `@electron/asar` | `3.x` | 2 | Scoped package |
| `rcedit` | `latest` | `@electron/rcedit` | `2.x` | 2 | Scoped package |
| `innosetup-compiler` | `latest` | `electron-builder` | `25.x` | 2 | Better cross-platform builds |
| Vendored `crypto-js.min.js` | Unknown | `crypto-js` (npm) | `4.x` | 2 | |
| Vendored `jszip.min.js` | Unknown | `jszip` (npm, already a dep) | `3.x` | 2 | |
| Vendored `protobufjs.min.js` | Unknown | `protobufjs` (npm) | `7.x` | 2 | |
| Vendored `pdfkit.standalone.js` | Unknown | `pdfkit` (npm) | `0.15.x` | 2 | |
| Vendored `hls.light.min.js` | Unknown | `hls.js` (npm) | `1.x` | 2 | |
| Vendored `oauth-1.0a.min.js` | Unknown | `oauth-1.0a` (npm) | `2.x` | 2 | |
| Vendored `ass.min.js` | Unknown | `assjs` (npm) | `0.x` | 2 | |
| Vendored `sql.min.js` | Unknown | `sql.js` (npm) | `1.x` | 2 | |
| Vendored `exif-js.min.js` | Unknown | `exif-js` (npm) | `2.x` | 2 | |
| Polymer 2.0 (HTML Imports) | Unknown | `lit` | `3.x` | 3 | |
| `webcomponentsjs` | Unknown | Remove (native support) | — | 3 | All modern browsers support Web Components |

---

[Back to top](#top)

## Risk Register

### Phase 1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pinning deps reveals version conflicts | Medium | Low | Run `npm ls` to find current versions; resolve conflicts before pinning |
| Removing `electron.remote` breaks renderer code | High | High | Create compatibility shim first; migrate callers incrementally |
| Re-enabling CI reveals existing test failures | Medium | Low | Fix tests or mark as `skip` before re-enabling |
| Certificate fix breaks connectors with self-signed certs | Medium | Medium | Maintain allowlist of connector domains that need cert bypass |

### Phase 2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Electron upgrade breaks connector scraping (Chromium changes) | High | High | Test top 50 most-used connectors at each checkpoint |
| Vite migration breaks Polymer HTML imports | Medium | Medium | Keep polymer-build as fallback until Phase 3 completes |
| TypeScript migration causes connector regressions | Low | Medium | Use `allowJs`, only type engine files initially |
| Fingerprinter misidentifies CMS template for a site | Medium | Low | Confidence threshold (>= 60) gates auto-merge; low-confidence matches flagged for manual review. Expand fingerprint signals iteratively based on false positive/negative data |
| Auto-generated connector causes runtime errors | Low | Medium | Validator smoke-tests before PR creation; CI lint + build must pass; HAKU-0029 Tier 2 harness validates `_getMangas()` output. Auto-merge only for template-based connectors |
| CloudFlare-protected sites cannot be fingerprinted | High | Low | Fingerprinter detects CF challenge pages and reports as warning. These are flagged `needs-manual-review` — not a failure, just outside automation scope |
| GitHub bot creates duplicate connectors for existing sites | Low | Medium | Generator checks for naming conflicts against existing `src/web/mjs/connectors/` directory. Issue parser checks for duplicate issue labels |
| Dead link scanner false positives (temporary outages) | Medium | Low | Scanner runs weekly — transient failures are reported but require multiple consecutive failures before action. Report is informational only (no auto-disable) |

### Phase 3 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Lit migration introduces UI regressions | Medium | Medium | Migrate one component at a time; visual regression testing |
| Theme consolidation loses dark theme customizations | Low | Low | Diff both theme directories thoroughly before merging |
| Virtual scrolling breaks manga/chapter selection | Medium | Medium | Keep non-virtualized fallback for small lists |

### Phase 4 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Build-time manifest generator fails to extract metadata from template-inheriting connectors | Medium | High | Handle edge cases explicitly (0016b); validate manifest against runtime connector count |
| 96 deprecated callback connector migrations introduce regressions | Medium | High | Categorize by complexity (0019a); migrate templates first (wider impact), then individual connectors |
| Storage decomposition breaks save/load flow across 5 modules | Medium | High | Facade pattern (0017f) preserves backward compatibility; verify all 4 output formats + video |
| `fetchJapscan` action callback cannot cross IPC boundary cleanly | Medium | Medium | Design request-response protocol (0028c); keep renderer-side fallback during transition |
| EngineProxy migration misses `Engine.*` references (396 refs across 184 files) | Low | High | Proxy logs deprecation warnings with file/line info (0021a); run until zero warnings before removal |
| Event-driven download queue misses edge cases (lock/unlock timing) | Low | Medium | Keep 5s safety-net interval (0020e) during validation; monitor with logging |

### Phase 5 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vitest migration breaks existing test assertions (Jest API differences) | Low | Low | Vitest has Jest-compat layer; only `jest.*` → `vi.*` changes needed. Run tests after each file migration. |
| Playwright Electron support has version-specific issues | Medium | Medium | Pin Playwright version tested with target Electron version. Use `electronApplication.firstWindow()` pattern from official docs. |
| MOBI removal breaks user workflows without notice | Low | Medium | Auto-migrate saved format to EPUB with one-time notification (0026e). Document removal in release notes. |
| Container queries unsupported in older Electron Chromium | Low | High | Container queries require Chromium 105+. Phase 2 targets Electron 33+ (Chromium 130+), so this is safe. Add `@supports` fallback for safety. |
| ARIA changes conflict with Lit migration | Low | Low | ARIA goes on Lit components (post-Phase 3), not Polymer. Execution order enforces this dependency. |
| Responsive layout breaks frameless window controls | Medium | Low | Test across all three platforms (Win, Mac, Linux). Add minWidth/minHeight to prevent extreme sizes. |
| `@xhayper/discord-rpc` API incompatibility | Low | Low | Library is maintained fork with similar API. Test Rich Presence manually after migration (0026f). |
| axe-core audit surfaces many violations requiring extensive fixes | Medium | Medium | Prioritize critical/serious only. Minor violations tracked as follow-up. Budget extra time for 0022j. |

---

[Back to top](#top)

## Critical Files Quick Reference

| File | Lines | Phase | Primary Changes |
|------|-------|-------|-----------------|
| `package.json` | 50 | 1 | Pin versions, add new deps |
| `.gitignore:3` | — | 1 | Remove `package-lock.json` |
| `.github/workflows/continuous-integration.yml` | — | 1 | `DISABLED` → `master` (HAKU-0003), modernized actions/cache/concurrency/timeouts (HAKU-0027) |
| `.github/workflows/ci-pr.yml` | — | 1 | Modernized, matrix reduced to Ubuntu-only pending Electron upgrade (HAKU-0027) |
| `.github/workflows/continuous-deployment.yml` | — | 1 | Modernized actions/cache/concurrency/timeouts (HAKU-0027) |
| `.github/workflows/claude-review.yml` (new) | — | 1 | Claude AI PR review (HAKU-0027) |
| `src/app/ElectronBootstrap.js:258-262` | 411 | 1 | Security: `nodeIntegration`, `webSecurity`, `contextIsolation` |
| `src/app/ElectronBootstrap.js:125-128` | — | 1 | Certificate error handling |
| `src/web/index.html:18,94` | 174 | 1 | Remove `electron.remote` |
| `src/web/mjs/engine/Settings.mjs:40` | 430 | 1 | Remove `electron.remote` |
| `src/web/mjs/engine/Storage.mjs:25-28` | 951 | 1,4 | Remove `electron.remote`, then decompose |
| `src/web/mjs/engine/Request.mjs:9-10` | 554 | 1,4 | Remove `electron.remote`, then decompose |
| `src/web/mjs/engine/Connector.mjs` | 748 | 4 | Extract IConnector + ConnectorBase, remove 96 deprecated overrides |
| `src/web/mjs/engine/DownloadManager.mjs:12` | 55 | 4 | Polling → event-driven queue |
| `src/web/mjs/engine/Connectors.mjs` | 69 | 4 | Replace with ConnectorRegistry + build-time manifest |
| `src/web/mjs/engine/DownloadJob.mjs` | 397 | 4 | 12 `Engine.*` refs to migrate (HAKU-0017, HAKU-0021) |
| `src/web/mjs/HakuNeko.mjs` | 103 | 4 | Composition root — updated by every Phase 4 task |
| `src/web/index.html:47-49` | 174 | 4 | Remove `window.Engine` / `window.HakuNeko` globals |
| `src/app/ElectronBootstrap.js` | 411 | 4 | Register IPC handlers for main-process scraping (HAKU-0028) |
| `tools/connector-gen/` (new package) | — | 2 | Fingerprinting engine, code generator, CLI, GitHub bot (HAKU-0030) |
| `.github/workflows/connector-bot.yml` (new) | — | 2 | Auto-generate connectors from issue submissions (HAKU-0030) |
| `.github/workflows/dead-link-scanner.yml` (new) | — | 2 | Weekly dead link report (HAKU-0031) |
| `.github/ISSUE_TEMPLATE/2-suggest-a-new-connector-website.yml` | 74 | 2 | Add auto-processing note (HAKU-0030) |
| `src/web/mjs/connectors/templates/WordPressMadara.mjs` | — | 2 | Fingerprint signal source — most-used template, 444 connectors (HAKU-0030) |
| `src/web/mjs/connectors/templates/WordPressMangastream.mjs` | — | 2 | Fingerprint signal source — 194 connectors (HAKU-0030) |
| `src/web/js/*.js` (9 files) | — | 2 | Replace with npm packages |
| `src/web/lib/hakuneko/frontend@classic-light/*.html` (13 files) | 4,090 | 3 | Polymer → Lit |
| `src/web/lib/hakuneko/frontend@classic-dark/*.html` (13 files) | ~4,090 | 3 | Merge into single themed set |
| `src/web/mjs/connectors/*.mjs` (1,334 files) | — | 4 | Lazy loading, 96 deprecated method migrations, 165 `Engine.*` ref migrations |
