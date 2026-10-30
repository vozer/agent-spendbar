# Agent Spendbar Manual

Agent Spendbar is a macOS menu bar app and usage dashboard. It shows monthly budget use for Codex, Claude Code, and Cursor.

## What you see

The menu bar keeps All, Codex, Claude, and Cursor tabs visible. A tab stays visible when its provider has no usage today.

The monthly overview shows budget percentages, sessions, calls, tokens, and top models. Other screens show sessions, projects, models, plans, pull requests, and tools.

App screens show no currency amounts. Percentages can exceed 100%. A `~` marks estimated, stale, or partial data.

## Monthly percentages

- **Codex** uses the saved Codex Spendbar budget. The default is 7,800 credits. This is a personal comparison value, not an OpenAI limit.
- **Claude Code** uses a $100 monthly cap. Its percentage comes from a local usage estimate.
- **Cursor** uses a $100 monthly cap. It uses account usage when available and estimates local usage otherwise.

The app counts usage from the first day of the calendar month through today. Missing local data appears as unavailable.

## Install the macOS build

Download the [prebuilt Agent Spendbar app for macOS](https://raw.githubusercontent.com/vozer/agent-spendbar/main/downloads/AgentSpendbar-macos.zip). The ZIP contains `AgentSpendbar.app`. You do not need Node.js or a source build.

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

The app is ad-hoc signed in CI. macOS may ask for local data access again after an update.

## Developer setup: build from source

Install Node.js 22.13 or newer and Swift 6. Build the local CLI before starting the app.

```sh
git clone https://github.com/vozer/agent-spendbar.git
cd agent-spendbar
npm ci
npm run build:cli
cd mac
CODEBURN_ALLOW_DEV_BIN=1 CODEBURN_BIN="node $(pwd)/../dist/cli.js" swift run AgentSpendbarMenubar --keep-both
```

The `--keep-both` flag lets this app run beside CodeBurn. The CLI keeps the name `codeburn` for compatibility.

## Data and privacy

The app reads supported providers' local session files and databases. It does not upload prompts, source code, project names, or file names.

Optional anonymous telemetry shares provider and model mix, task success, performance, errors, and bucketed counts for model, tool, skill, and MCP names. You can leave telemetry off during onboarding.

Cursor account sync uses the Cursor app and its login on this Mac. Provider access remains controlled by each provider's installation.

## Project lineage

Agent Spendbar has its own public repository: [vozer/agent-spendbar](https://github.com/vozer/agent-spendbar). GitHub records [CodeBurn](https://github.com/getagentseal/codeburn) as its fork parent.

CodeBurn supplies the provider readers and analytics under the MIT License. [Codex Spendbar](https://github.com/vozer/codex-spendbar) supplies the reference budget preference and Codex credit tracking. It remains a separate repository.

Agent Spendbar maintains its app identity, monthly percentage views, packaging, and this manual. See the [CodeBurn manual](https://github.com/getagentseal/codeburn/blob/main/README.md) for inherited CLI commands and provider data details.
