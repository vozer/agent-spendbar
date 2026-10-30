# Agent Spendbar

Agent Spendbar is a public fork of [CodeBurn](https://github.com/getagentseal/codeburn). Its menu bar shows monthly usage percentages for Codex, Claude Code, and Cursor.

The dashboards keep CodeBurn's usage analytics for sessions, models, plans, projects, devices, tokens, calls, and tools. The frontends show no currency amounts. They use local cost data only to calculate budget percentages.

## What the menu bar shows

Each provider icon is followed by the percentage of its current calendar month's budget used. Values above 100% remain visible.

- **Codex** uses published credit rates from local CodeBurn history and the monthly credit budget saved by [Codex Spend](https://github.com/vozer/codex-spendbar). The local default is 7,800 credits. It is not an OpenAI account limit. Partial pricing shows the known amount with `~`.
- **Claude** compares CodeBurn's local session cost estimate with a $100 budget. It always shows `~` because this is not Claude's billed total.
- **Cursor** combines Cursor and Cursor Agent usage against a $100 budget. Cursor's usage export supplies billed cost when available. Included or local-only usage uses model-price estimates and shows `~`.

An unavailable label means local usage data is missing. Stale or partial data shows `~` before the percentage. Cursor data comes from the Cursor installation and login on this Mac. CodeBurn reads local provider data and does not upload prompts or source files.

## Run from source

Install Node.js 22.13 or newer and Swift 6. Then run:

```bash
npm ci
npm run build:cli
cd mac
CODEBURN_ALLOW_DEV_BIN=1 CODEBURN_BIN="node $(pwd)/../dist/cli.js" swift run AgentSpendbarMenubar --keep-both
```

`--keep-both` lets Agent Spendbar run beside the original CodeBurn menu bar app. The app reads Codex Spend's existing monthly budget preference.

## Upstream project

Agent Spendbar keeps CodeBurn's MIT license and provider readers. See the [CodeBurn documentation](https://github.com/getagentseal/codeburn/blob/main/README.md) for CLI setup and provider data details. Build and release signing for this fork are not configured yet.
