# Agent Spendbar for macOS

Agent Spendbar is the menu bar app in this CodeBurn fork. It shows monthly budget use for Codex, Claude Code, and Cursor.

## Requirements

- macOS 14 or newer
- Swift 6 with Xcode or a compatible Swift toolchain
- Node.js 22.13 or newer
- The CodeBurn CLI built from this checkout

## Run from source

From the repository root, build the local CLI and launch the menu bar app beside any installed CodeBurn app:

```bash
npm ci
npm run build:cli
cd mac
CODEBURN_ALLOW_DEV_BIN=1 CODEBURN_BIN="node $(pwd)/../dist/cli.js" swift run AgentSpendbarMenubar --keep-both
```

`--keep-both` keeps the original CodeBurn app open. The fork uses its own app bundle ID, status-item placement, and preferences.

The app reads Codex Spend's saved monthly credit budget. Claude's local session costs are estimates. Cursor uses its usage export for metered amounts and marks estimated amounts with `~`.

See the [repository README](../README.md) for budget details and [CodeBurn's documentation](https://github.com/getagentseal/codeburn/blob/main/README.md) for provider data sources.
