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

## Install the macOS app

[Download Agent Spendbar for macOS](https://raw.githubusercontent.com/vozer/agent-spendbar/main/downloads/AgentSpendbar-macos.zip). The ZIP contains a ready-to-run `AgentSpendbar.app`. You do not need Node.js or a source build.

1. Download and open the ZIP.
2. Move `AgentSpendbar.app` to `/Applications` or `~/Applications`.
3. Open Agent Spendbar from that folder.

### If macOS blocks the first launch

macOS marks browser downloads with quarantine. This build is ad-hoc signed and not notarized, so macOS may block its first launch.

1. Try opening the app once.
2. Open Apple menu > System Settings > Privacy & Security.
3. Scroll to Security and choose **Open Anyway** beside Agent Spendbar.
4. Choose **Open** in the warning.

Apple keeps **Open Anyway** available for about one hour after you try launching the app. macOS saves your approval for future launches. Only approve a copy downloaded from this repository. See [Apple's instructions for opening blocked apps](https://support.apple.com/en-us/102445).

## Run from source (development)

Install Node.js 22.13 or newer and Swift 6. Then run:

```bash
npm ci
npm run build:cli
cd mac
CODEBURN_ALLOW_DEV_BIN=1 CODEBURN_BIN="node $(pwd)/../dist/cli.js" swift run AgentSpendbarMenubar --keep-both
```

The `--keep-both` flag lets Agent Spendbar run beside the original CodeBurn menu bar app. See the [user manual](docs/MANUAL.md) for setup, data sources, and limits.

## Upstream documentation

The CLI and provider documentation remains based on CodeBurn. Start with the [CodeBurn manual](https://github.com/getagentseal/codeburn/blob/main/README.md) for CLI commands and provider data details.
