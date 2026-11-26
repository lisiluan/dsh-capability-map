# dsh-capability-map

[English](./README.md) | [简体中文](./README.zh-CN.md)

一个 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai) 插件：在右侧栏新增一个原生标签页——当前会话的**能力地图**。

以卡片网格汇总当前会话实际调用过的技能、工具与 MCP 工具（类别筛选 + 每卡调用次数），一眼看清本会话哪些能力真正生效被用过；顶栏「显示全部」可预览全部本地可用技能（未调用的显示 0 次 / 未运行），默认只显示本会话。

## 功能特性

- **卡片网格** —— 每张卡片：能力图标 + 名称（MCP 卡片附服务器名），仍在运行的调用带呼吸圆点；
- **类别筛选** —— 全部 / 技能 / 工具 / MCP（带数量角标）；
- **顶栏统计** —— 总调用次数 / 技能 / 工具 / MCP 种类；
- **自动刷新** —— 每 5 秒自动刷新，也可手动刷新；
- **原生标签页** —— 走原生 `sidebarRightTabs` 通道注册，与 Better Sidebar 兼容。

## 工作原理

- **宿主半**（`index.js`）：提供 `GET /usage/api/summary?sessionId=…`，把会话事件流（`tool/call` / `tool/result`）折叠为能力汇总（技能按名聚合、工具按名聚合、MCP 按 `mcp__<server>__<tool>` 前缀归类），并经 `ctx.skills.list()` 返回全部可用技能清单。
- **浏览器半**（`client.js`）：经 `ctx.sidebarRightTabs` 注册「能力地图」标签类型 + Guide 卡片（带图标），body 槽位渲染卡片面板。

详见 [docs/DETAIL.md](./docs/DETAIL.md)（含限制说明：仅统计驻留中的会话；子代理调用不参与统计）。

## 安装

本包遵循 DSH bundle/plugin 规范：

```json
{
  "dependencies": {
    "dsh-capability-map": "^1.1.0"
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
