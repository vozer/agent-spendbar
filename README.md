# Agent Spendbar

Agent Spendbar is a fork of CodeBurn with monthly budget tracking adapted from Codex Spendbar. It shows percentage usage for Codex, Claude Code, and Cursor.

This project keeps sessions, models, plans, projects, devices, tokens, calls, and tool analytics. Its app screens show no currency amounts. Local cost data only supports percentage calculations.

## Project lineage

This project has its own public repository: [vozer/agent-spendbar](https://github.com/vozer/agent-spendbar). GitHub records CodeBurn as its fork parent.

Codex's monthly budget preference and credit tracking are adapted from [Codex Spendbar](https://github.com/vozer/codex-spendbar). Codex Spendbar remains a separate repository.

CodeBurn supplies the provider readers and usage analytics under its MIT license. Codex Spendbar supplies the reference budget preference and Codex credit tracking. Agent Spendbar maintains its app identity, monthly percentages, and [user manual](docs/MANUAL.md).

## Monthly percentages

The menu bar keeps All, Codex, Claude, and Cursor tabs visible, including providers with no current-period activity. Percentages use the current calendar month and remain visible above 100%.

- **Codex** uses published credit rates and the budget saved by [Codex Spendbar](https://github.com/vozer/codex-spendbar). The local default is 7,800 credits. This is a personal comparison value, not an OpenAI account limit.
- **Claude Code** uses local session data against a $100 monthly cap. Its percentage is estimated, not Claude's billed total.
- **Cursor** combines Cursor and Cursor Agent data against a $100 monthly cap. It uses account usage data when available and marks local estimates with `~`.

The app marks estimates or partial data with `~`. An unavailable value means local usage data is missing. CodeBurn reads local provider data and does not upload prompts or source files.

## Run from source

Install Node.js 22.13 or newer and Swift 6. Then run:

```bash
npm ci
npm run build:cli
cd mac
CODEBURN_ALLOW_DEV_BIN=1 CODEBURN_BIN="node $(pwd)/../dist/cli.js" swift run AgentSpendbarMenubar --keep-both
```

The `--keep-both` flag lets Agent Spendbar run beside the original CodeBurn menu bar app. See the [user manual](docs/MANUAL.md) for setup, data sources, and limits.

## Upstream documentation

The CLI and provider documentation remains based on CodeBurn. Start with the [CodeBurn manual](https://github.com/getagentseal/codeburn/blob/main/README.md) for CLI commands and provider data details. Signed public releases are not configured yet; the macOS CI workflow provides a short-lived build artifact.
