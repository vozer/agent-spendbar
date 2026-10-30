# Agent Spendbar Desktop

Electron shell for Agent Spendbar. The Electron and VS Code surfaces keep CodeBurn's usage analytics and show monthly percentages for Codex, Claude Code, and Cursor.

## Development

```sh
npm --prefix app install
npm --prefix app run dev
```

Validation:

```sh
npm --prefix app run test
npm --prefix app run typecheck
```

## CLI Dependency

Packaged builds ship their own version-matched copy of the `codeburn` CLI and require nothing installed — the app spawns the bundled CLI with Electron's own binary as Node (`ELECTRON_RUN_AS_NODE`). In development (Vite dev server) the app uses the repo's freshly-built CLI, and either can be overridden with `CODEBURN_BIN` or a persisted path file. See `DISTRIBUTION.md` for the bundling and resolution details. Electron resolves and spawns the CLI from the main process, then sends decoded JSON through the secure preload bridge into the renderer.

This follows the menubar pattern:

- `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Renderer code calls `window.codeburn` only through `app/renderer/lib/ipc.ts`.
- Main process handlers return JSON envelopes so structured CLI errors survive IPC.
- Missing CLI, bad JSON, timeout, and nonzero exits are surfaced as honest UI states.
- The renderer never imports CodeBurn engine code from `src/`; the data contract is spawn CLI, decode JSON, poll.

## Usage dashboard

The dashboard keeps sessions, models, plans, plugins, pull request activity, and token and call details. It shows no currency amounts. Local cost data stays in the CLI payload for monthly percentage calculations.

The monthly overview requests all providers for the calendar month. It refreshes every five minutes and offers a manual refresh. A tilde marks estimated or partial data.

## Packaging

`npm run package` produces a macOS `.dmg`/`.zip` (arm64 and x64) via `electron-builder`. Release builds are signed with a Developer ID Application certificate and notarized by Apple (ad-hoc signing is only a fallback when no signing identity is configured). Packaging rebuilds the root CLI and bundles it into the app (`Resources/cli`), so installs need nothing on the target machine. See `DISTRIBUTION.md` for build instructions, the bundled-CLI mechanism, artifact locations, and the notarization process.
