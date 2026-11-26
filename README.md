# dsh-capability-map

[English](./README.md) | [简体中文](./README.zh-CN.md)

A [DeepSeek Harness (DSH)](https://github.com/deepseek-ai) plugin that adds a native right-sidebar tab: a **capability map** of the current session.

It shows a card grid of every skill, tool and MCP tool the session has actually invoked — with category filters and per-capability call counts — so you can see at a glance which capabilities are really being used. A "Show all" toggle also previews every locally available skill (unused ones show 0 calls / not run); by default only the current session is shown.

## Features

- **Card grid** — icon, name and a source badge per capability (built-in / local / project / user / MCP server); hovering shows the tool or skill description.
- **Category filters** — All / Skills / Tools / MCP, with count badges.
- **Search** — header search narrows skills, tools and MCP tools by name (MCP also by server).
- **Show all** — previews every capability the session can call, not only the invoked ones (unused show 0 calls / not run).
- **Auto refresh** — every 5 seconds, plus a manual refresh button.
- **Native tab** — registered via the standard `sidebarRightTabs` channel; compatible with Better Sidebar.

## How it works

- **Host side** (`index.js`): serves `GET /usage/api/summary?sessionId=…`, folding the session's event stream (`tool/call` / `tool/result`) into a capability summary (skills and tools aggregated by name, MCP tools grouped by the `mcp__<server>__<tool>` prefix), listing the skills **as the session's preset composition sees them** (the same per-session catalog the `/` picker lists, so preset-injected `customSkillDirs` are included), and returning tool descriptions for hover text.
- **Browser side** (`client.js`): registers the "Capability map" tab type plus a Guide card (with icon) through `ctx.sidebarRightTabs`, and renders the card panel in the body slot.

See [docs/DETAIL.md](./docs/DETAIL.md) for details and limitations (resident sessions only; subagent calls are not counted).

## Installation

This package follows the DSH bundle/plugin convention:

```json
{
  "dependencies": {
    "dsh-capability-map": "^1.1.0"
  }
}
```

The `dsh.bundle.patch` in `cordis.patch.yml` inserts the plugin, and the `dsh.client` section declares the web client injection (`immediately: true`, injecting `@deepseek-ai/dsh-client-ui-sidebar-right`).

## Usage

1. Open a session and click **“+”** on the right-sidebar tab strip.
2. Click the **Capability map** card in the Guide grid.
3. The panel auto-refreshes every 5 s; use "Show all" to preview all locally available skills.

## License

[MIT](./LICENSE)
