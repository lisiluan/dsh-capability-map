# dsh-capability-map

[English](./README.md) | [简体中文](./README.zh-CN.md)

A [DeepSeek Harness (DSH)](https://github.com/deepseek-ai) plugin that adds a native right-sidebar tab: a **capability map** of the current session.

It shows a card grid of every skill, tool and MCP tool the session has actually invoked — with category filters and per-capability call counts — so you can see at a glance which capabilities are really being used. A "Show all" toggle also previews every locally available skill (unused ones show 0 calls); by default only the current session is shown.

## Features

- **Card grid** — icon, name and a provenance badge per capability (内置 / 市场 / Git / 本地 / 项目 / 用户 / 其他, or the MCP server name); hovering shows the tool or skill description. Cards sort by badge priority by default, with a toggle for call-count order.
  `内置` means "proven to come from the DSH installation itself"; anything whose origin cannot be located reads `其他` instead.
- **Category filters** — All / Skills / Tools / MCP, with count badges.
- **Search** — header search narrows skills, tools and MCP tools by name, by badge text (e.g. `其他`), or by MCP server.
- **Show all** — previews every capability the session can call, not only the invoked ones (unused show 0 calls).
- **Auto refresh** — every 5 seconds, plus a manual refresh button.
- **Native tab** — registered via the standard `sidebarRightTabs` channel; compatible with Better Sidebar.

## How it works

- **Host side** (`index.js`): serves `GET /usage/api/summary?sessionId=…`, folding the session's event stream (`tool/call` / `tool/result`) into a capability summary (skills and tools aggregated by name, MCP tools grouped by the `mcp__<server>__<tool>` prefix), listing the skills **as the session's preset composition sees them** (the same per-session catalog the `/` picker lists, so preset-injected `customSkillDirs` are included), and returning tool descriptions for hover text.
- **Browser side** (`client.js`): registers the "Capability map" tab type plus a Guide card (with icon) through `ctx.sidebarRightTabs`, and renders the card panel in the body slot.

### Provenance badges

Every card carries exactly one badge. Skills and tools use the seven origin
kinds below; MCP tools show their server name instead. The host resolves a
skill's kind and, for tools, sends the declared `origins` and the installation's
official tool names; the browser matches wire names and renders the result.

| Badge | Kind | Rule |
|---|---|---|
| 内置 | `official` | the skill/tool ships with the DSH installation: the owning package name matches an `officialPackages` prefix (default `@deepseek-ai/`), the path is inside the installation tree, or the tool name is an official one |
| 市场 | `market` | the owning package is a registry dependency of the profile — every specifier that is neither a local link nor a git address (what a plugin-market install writes) |
| Git | `git` | the owning package's specifier is `git+…` / `git://…` / `git@…` / `ssh://…` / `github:` / `gitlab:` / `bitbucket:` |
| 本地 | `local` | the owning package's specifier is `link:` / `file:` / `workspace:` / `portal:`, or a `custom` skill root outside any package directory |
| 项目 | `project` | a project skill root (`.dsh/skills`, `.agents/skills`) |
| 用户 | `user` | a user skill root (`$DSH_HOME/skills`, `~/.agents/skills`) |
| 其他 | `other` | nothing could be located |

**Skills** — first hit wins:

1. an explicit root decides first: `project-dsh` / `project-agents` → 项目, `user-dsh` / `user-agents` → 用户 (a project skill inside a JS repository would otherwise be attributed to the repository's own `package.json`);
2. the instruction file's `path` walked up to the nearest `package.json`: an `officialPackages` name is `official`; any other name is classified from the profile's dependency specifier (`market` / `git` / `local`); a manifest the profile does not declare falls through instead of settling on 其他;
3. a `bundled` skill whose registry path was rewritten has no manifest above it, so the name is looked up in an index built by scanning the `skills/` and `assets/` directories of every package the profile declares and every package the installation ships;
4. a path inside the installation tree is `official`;
5. otherwise the registry `source` decides: `custom` → 本地, and anything left over — including a bare `bundled` — is 其他. Content that sits under a package's `node_modules` while the profile does not declare that package stays 其他 rather than claiming 本地.

`bundled` alone is **not** official evidence: an installed third-party bundle ships its skills under `node_modules/<pkg>/skills/…` and reports the same source. A skill this session called that no longer exists in the catalog also falls back to `其他`.

**Tools** carry no owning package in their definition, so:

1. a declared `origins` entry wins — the exact wire name first, then a `*` wildcard such as `blender_rt_*` — and classifies the tool by that package's install kind;
2. otherwise the installation's own tool names earn 内置: the shipped `OFFICIAL_TOOL_NAMES`, every name discovered by scanning the installed `@deepseek-ai/dsh-tool-*` packages, and every name the shipped `docs/tool-catalog.md` lists for an official package this installation contains — so bundle tools such as `exit_plan_mode` and `plugin_market` count, and a DSH upgrade needs no plugin release;
3. every other tool stays 其他.

**MCP tools** always show their orange server-name badge; an `origins` entry does not apply to them.

**Card order** — the 标签 / 次数 toggle at the right edge of the filter row
picks the primary key; it applies to every tab and to the search results:

- **标签** (default) — badge priority `内置` → `项目` → `用户` → `本地` → `Git` → `市场` → `其他`, then by capability name;
- **次数** — this session's call count descending, then badge priority, then name.

MCP cards have no origin kind: they sort by server name and then by tool name
(count first in 次数 mode). The 全部 tab keeps its 技能 / 工具 / MCP blocks and
sorts each block this way.

The profile's dependency map and the installation root are read from the
running profile context (falling back to `DSH_PROFILE_DIR` / `DSH_INSTALL_DIR`),
so a link-installed plugin classifies exactly what the shell resolves.
`config.officialPackages` replaces the default `@deepseek-ai/` prefix list (an
empty list falls back to the default). A third-party tool needs a declaration,
and a `*` wildcard covers a plugin's whole tool family:

```yaml
- insert:
    - id: dsh-capability-map
      name: dsh-capability-map
      config:
        extraOfficialTools: [new_official_tool]        # appended to the shipped + scanned + catalog names
        # officialTools: [...]                         # replaces the shipped + scanned + catalog names
        # origins: { blender_rt_*: dsh-blender-plugin } # wire tool name (wildcard ok) → owning package
        # officialPackages: ['@deepseek-ai/']          # replaces the default prefix list (empty = default)
```

A declared package is classified from its profile specifier, so `origins` plus a `link:` / `git:` / registry install yields 本地 / Git / 市场 respectively.

See [docs/DETAIL.md](./docs/DETAIL.md) for details and limitations (resident sessions only; subagent calls are not counted).

## Installation

This package follows the DSH bundle/plugin convention:

```json
{
  "dependencies": {
    "dsh-capability-map": "^1.4.0"
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
