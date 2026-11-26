# dsh-capability-map

[English](./README.md) | [简体中文](./README.zh-CN.md)

一个 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai) 插件：在右侧栏新增一个原生标签页——当前会话的**能力地图**。

以卡片网格汇总当前会话实际调用过的技能、工具与 MCP 工具（类别筛选 + 每卡调用次数），一眼看清本会话哪些能力真正生效被用过；顶栏「显示全部」可预览全部本地可用技能（未调用的显示 0 次），默认只显示本会话。

## 功能特性

- **卡片网格** —— 每张卡片：能力图标 + 名称（MCP 卡片附服务器名），仍在运行的调用带呼吸圆点；卡片默认按徽标优先级排序，可切换为按调用次数排序；
- **来源徽标** —— 每张卡一个来源徽标：`内置`、`市场`、`Git`、`本地`、`项目`、`用户`、`其他`；MCP 卡片显示服务器名。技能按文件路径回溯归属包自动判定；工具定义不带归属，需在配置 `origins` 里声明包名后才能分类（未声明的第三方工具一律显示 `其他`）；判定规则见下方「来源徽标规则」；
- **类别筛选** —— 全部 / 技能 / 工具 / MCP（带数量角标）；
- **搜索** —— 顶栏搜索按名称、标签（如 `其他`）或 MCP 服务器名过滤；
- **顶栏统计** —— 总调用次数 / 技能 / 工具 / MCP 种类；
- **自动刷新** —— 每 5 秒自动刷新，也可手动刷新；
- **原生标签页** —— 走原生 `sidebarRightTabs` 通道注册，与 Better Sidebar 兼容。

## 工作原理

- **宿主半**（`index.js`）：提供 `GET /usage/api/summary?sessionId=…`，把会话事件流（`tool/call` / `tool/result`）折叠为能力汇总（技能按名聚合、工具按名聚合、MCP 按 `mcp__<server>__<tool>` 前缀归类），并经 `ctx.skills.list()` 返回全部可用技能清单。
- **浏览器半**（`client.js`）：经 `ctx.sidebarRightTabs` 注册「能力地图」标签类型 + Guide 卡片（带图标），body 槽位渲染卡片面板。

详见 [docs/DETAIL.md](./docs/DETAIL.md)（含限制说明：仅统计驻留中的会话；子代理调用不参与统计）。

## 来源徽标规则

每张卡只有一个徽标。技能与工具用下面 7 种来源，MCP 工具改为显示服务器名；技能 kind 由宿主判定，工具则由宿主下发 `origins` 与官方工具名集合、浏览器按线上名匹配后渲染。

| 徽标 | 判定 |
|---|---|
| `内置` | 随 DSH 安装自带：归属包命中 `officialPackages` 前缀（默认 `@deepseek-ai/`）、路径在安装树内，或工具名属于官方工具名集合 |
| `市场` | 归属包在 profile 里是 registry 依赖——规格既不是本地链接也不是 Git 地址（插件市场安装也是这种） |
| `Git` | 归属包规格是 `git+…` / `git://…` / `git@…` / `ssh://…` / `github:` / `gitlab:` / `bitbucket:` |
| `本地` | 归属包规格是 `link:` / `file:` / `workspace:` / `portal:`，或无归属包、位于包目录之外的自定义技能根 |
| `项目` | 项目技能根（`.dsh/skills`、`.agents/skills`） |
| `用户` | 用户技能根（`$DSH_HOME/skills`、`~/.agents/skills`） |
| `其他` | 什么都没定位到 |

**技能**按下列顺序，第一个命中即定：

1. 先看显式技能根：`project-dsh`/`project-agents` → `项目`，`user-dsh`/`user-agents` → `用户`（JS 仓库里的项目技能否则会被归到仓库自己的 `package.json` 上）；
2. 技能文件 `path` 向上找到最近的 `package.json`：包名命中 `officialPackages` 前缀 → `内置`；否则按该包在 profile 里的安装规格归到 `市场`/`Git`/`本地`；profile 没声明的包**继续往下判定**，不再直接算 `其他`；
3. `bundled` 技能的 `path` 被注册表改写、回溯不到包时，查**名字索引**（扫描 profile 声明的包与安装自带的包的 `skills/`、`assets/` 目录）找归属包；
4. 路径在安装树内 → `内置`；
5. 否则由注册表 `source` 决定：`custom` → `本地`，剩下的（包括单独的 `bundled`）→ `其他`。若技能位于某个包的 `node_modules` 内、而 profile 并未声明该包，则保持 `其他`，不冒充 `本地`。

`source: bundled` 本身**不代表**官方：第三方 bundle 的技能同样报 `bundled`。本会话调用过、但已不在技能目录里的技能也回落为 `其他`。

**工具**定义里没有归属包字段，因此：

1. 配置 `origins` 里声明过的优先——先精确匹配线上名，再匹配 `*` 通配（如 `blender_rt_*`）——按该包的安装规格归类；
2. 否则命中安装自带工具名 → `内置`：静态清单 `OFFICIAL_TOOL_NAMES`、扫描已装 `@deepseek-ai/dsh-tool-*` 包得到的新名字，以及安装内 `docs/tool-catalog.md` 为「本安装确实存在的官方包」列出的名字（因此 `exit_plan_mode`、`plugin_market` 这类 bundle 工具也算内置；DSH 升级不必等插件发版）；
3. 其余工具一律 `其他`。

**MCP 工具**始终显示服务器名（橙色徽标），`origins` 对它不生效。

**卡片排序** —— 筛选行最右侧的「标签 / 次数」切换决定主导键，对所有标签页与搜索结果生效：

- **标签**（默认）：按徽标优先级 `内置` → `项目` → `用户` → `本地` → `Git` → `市场` → `其他`，同级按名称；
- **次数**：按本会话调用次数降序，次数相同再按徽标、名称。

MCP 卡片没有来源 kind：先按服务器名、再按工具名（次数模式下先比次数）。「全部」标签保持 技能 / 工具 / MCP 三块，块内各自按上述规则排序。

profile 的依赖表与安装根目录取自运行时 profile 上下文（兜底读 `DSH_PROFILE_DIR` / `DSH_INSTALL_DIR`），所以 link 安装的插件与 shell 看到的来源一致。`config.officialPackages` 会**取代**默认的 `@deepseek-ai/` 前缀表（传空数组则回落到默认值）。第三方工具必须声明，`*` 通配可覆盖整个工具族：

```yaml
- insert:
    - id: dsh-capability-map
      name: dsh-capability-map
      config:
        extraOfficialTools: [new_official_tool]        # 追加到「清单 + 扫描 + 目录」
        # officialTools: [...]                         # 取代「清单 + 扫描 + 目录」
        # origins: { blender_rt_*: dsh-blender-plugin } # 线上工具名（支持通配）→ 归属包
        # officialPackages: ['@deepseek-ai/']          # 取代默认前缀表（空数组 = 默认）
```

声明的包按 profile 里的安装规格归类，所以 `origins` 配 `link:` / `git:` / registry 安装分别得到 `本地` / `Git` / `市场`。

## 安装

本包遵循 DSH bundle/plugin 规范：

```json
{
  "dependencies": {
    "dsh-capability-map": "^1.4.0"
  }
}
```

`cordis.patch.yml` 中的 `dsh.bundle.patch` 负责插入插件，`dsh.client` 声明 web 客户端注入（`immediately: true`，注入 `@deepseek-ai/dsh-client-ui-sidebar-right`）。

## 使用

1. 打开一个会话，点右侧栏标签条上的 **「+」**；
2. 在 Guide 卡片网格中点击 **「能力地图」** 卡片；
3. 面板每 5 秒自动刷新；顶栏「显示全部」可预览全部本地可用技能。

## 许可证

[MIT](./LICENSE)
