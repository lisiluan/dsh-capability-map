/**
 * dsh-capability-map — Client half.
 *
 * Registers a native right-Sidebar tab type ("Capability map" / 能力地图) via
 * ctx.sidebarRightTabs, whose guide entry (with icon) shows one card in the
 * "+" add panel; the body slot renders a filterable card grid of the
 * skills / tools / MCP tools the session has called, fetched from the Host
 * route /usage/api/summary. A header toggle previews every locally
 * available skill (uncalled ones show 0 calls, 未运行).
 */
window.__ModuleLoader__.load({
  id: 'dsh-capability-map',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const KIND = 'dsh-capability-map'

    // Component-local stylesheet: rendered as a React element, so unmounting
    // the panel removes it. Colors go through theme tokens with neutral
    // chain tails so the panel follows light/dark themes.
    const STYLE = `
.cmap-root{height:100%;display:flex;flex-direction:column;font-size:12.5px;color:var(--dsw-alias-label-primary,#1c1c1e);overflow:hidden}
.cmap-head{display:flex;align-items:center;gap:8px;padding:12px 14px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));flex:none}
.cmap-head .cmap-title{font-size:13px;font-weight:650;letter-spacing:.2px}
.cmap-head .cmap-sub{font-size:11px;color:var(--dsw-alias-label-secondary,#8a8a8e)}
.cmap-refresh{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#8a8a8e);cursor:pointer;flex:none}
.cmap-refresh:hover{color:var(--dsw-alias-brand-primary,#4a8fd6);border-color:var(--dsw-alias-brand-primary,#4a8fd6)}
.cmap-refresh:disabled{opacity:.45;cursor:default}
.cmap-toggle{margin-left:auto;display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.28));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#8a8a8e);font-size:11.5px;font-weight:500;cursor:pointer;flex:none;transition:background .12s ease}
.cmap-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.07))}
.cmap-toggle.active{color:var(--dsw-alias-brand-primary,#4a8fd6);border-color:var(--dsw-alias-brand-primary,#4a8fd6);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4a8fd6) 12%,transparent);font-weight:650}
.cmap-scroll{flex:1;overflow-y:auto;padding:10px 14px 18px;box-sizing:border-box}
.cmap-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.cmap-tab{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500;padding:4px 12px;border-radius:999px;cursor:pointer;border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.28));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#8a8a8e);transition:background .12s ease}
.cmap-tab:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.07))}
.cmap-tab.active{color:var(--dsw-alias-brand-primary,#4a8fd6);border-color:var(--dsw-alias-brand-primary,#4a8fd6);background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4a8fd6) 12%,transparent);font-weight:650}.cmap-tab .cmap-tab-count{font-size:11px;font-weight:600;padding:0 6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.14));color:inherit}
.cmap-tab.active .cmap-tab-count{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4a8fd6) 22%,transparent)}
.cmap-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.cmap-card{position:relative;display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:var(--dsw-radius-xl,16px);border:.5px solid var(--dsw-alias-border-l3,rgba(127,127,127,.28));background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.04));transition:background .12s ease;min-height:74px}
.cmap-card:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.08))}
.cmap-card-top{display:flex;align-items:flex-start;gap:8px;min-width:0}
.cmap-glyph{width:26px;height:26px;border-radius:8px;flex:none;display:flex;align-items:center;justify-content:center}
.cmap-glyph svg{width:14px;height:14px}
.cmap-glyph-skill{color:var(--dsw-alias-state-warn-primary,#c78a2e)}
.cmap-glyph-tool{color:var(--dsw-alias-brand-primary,#4a8fd6)}
.cmap-glyph-mcp{color:var(--dsw-alias-state-success-primary,#3d9a63)}
.cmap-card-name{font-weight:500;font-size:13px;line-height:1.4;color:var(--dsw-alias-label-primary,#1c1c1e);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-all}
.cmap-card-server{font-size:11px;color:var(--dsw-alias-label-tertiary,#a0a0a6);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cmap-badge{margin-left:auto;flex:none;font-size:10px;font-weight:500;line-height:1;padding:3px 7px;border-radius:999px;white-space:nowrap;max-width:72px;overflow:hidden;text-overflow:ellipsis}
.cmap-badge-blue{color:#3b76c4;background:rgba(59,118,196,.12)}
.cmap-badge-green{color:#3d9a63;background:rgba(61,154,99,.13)}
.cmap-badge-purple{color:#8a63c9;background:rgba(138,99,201,.13)}
.cmap-badge-teal{color:#2e8f96;background:rgba(46,143,150,.13)}
.cmap-badge-orange{color:#c07a2e;background:rgba(192,122,46,.14)}
.cmap-badge-gray{color:#8a8a8e;background:rgba(127,127,127,.12)}
.cmap-card-foot{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:6px}
.cmap-card-time{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#a0a0a6);white-space:nowrap}
.cmap-count{display:inline-flex;align-items:baseline;gap:3px;flex:none}
.cmap-count .cmap-count-num{font-size:16px;font-weight:750;line-height:1;color:var(--dsw-alias-brand-primary,#4a8fd6)}
.cmap-count .cmap-count-unit{font-size:10px;color:var(--dsw-alias-label-tertiary,#a0a0a6)}
.cmap-chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;padding:1px 8px;border-radius:999px;white-space:nowrap;flex:none;color:var(--dsw-alias-state-warn-primary,#c78a2e);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#c78a2e) 13%,transparent)}
.cmap-chip .cmap-dot{width:6px;height:6px;border-radius:999px;background:currentColor;animation:cmap-pulse 1.1s ease-in-out infinite}
.cmap-chip-idle{color:var(--dsw-alias-label-tertiary,#a0a0a6);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1))}
@keyframes cmap-pulse{0%,100%{opacity:1}50%{opacity:.25}}
.cmap-search{flex:1;display:flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#8a8a8e);min-width:0;transition:border-color .12s ease}
.cmap-search:focus-within{border-color:var(--dsw-alias-brand-primary,#4a8fd6);color:var(--dsw-alias-label-primary,#1c1c1e)}
.cmap-search svg{flex:none;opacity:.55}
.cmap-search input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:inherit;font-size:12.5px;padding:0}
.cmap-search input::placeholder{color:var(--dsw-alias-label-tertiary,#a0a0a6)}
.cmap-search-clear{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;border:none;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.14));color:var(--dsw-alias-label-secondary,#8a8a8e);cursor:pointer;flex:none;font-size:12px;line-height:1;padding:0}
.cmap-search-clear:hover{color:var(--dsw-alias-label-primary,#1c1c1e)}
.cmap-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:40px 20px;text-align:center;color:var(--dsw-alias-label-secondary,#8a8a8e);font-size:12.5px;line-height:1.8}
.cmap-state .cmap-state-icon{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.07));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.18))}
.cmap-state svg{width:22px;height:22px;opacity:.6}
.cmap-error{color:var(--dsw-alias-state-error-primary,#d05a5a)}
`

    // Every icon carries explicit width/height so no SVG ever sizes to its
    // container (the giant-star bug).
    const ICON_SPARK = h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('path', { d: 'M8 1.5 9.7 6l4.5 1.7-4.5 1.7L8 14l-1.7-4.6L1.8 7.7 6.3 6 8 1.5Z' }))

    const ICON_TOOL = h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('path', { d: 'M9.6 2.8a3.4 3.4 0 0 1 4.6 4.4l-8 8-3.4-3.4 8-8-1.2-1Z' }),
      h('path', { d: 'm5 11 1.4 1.4' }))

    const ICON_PLUG = h('svg', { viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('path', { d: 'M5.5 1.5v3M10.5 1.5v3' }),
      h('path', { d: 'M4 4.5h8v2.6a4 4 0 0 1-4 4 4 4 0 0 1-4-4V4.5Z' }),
      h('path', { d: 'M8 11.2v3.3' }))

    const ICON_REFRESH = h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('path', { d: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9' }),
      h('path', { d: 'M13.7 1.8v2.7H11' }))

    const ICON_SEARCH = h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', 'aria-hidden': true },
      h('circle', { cx: 7, cy: 7, r: 4.5 }),
      h('path', { d: 'm10.5 10.5 3 3' }))

    const ICON_MAP = h('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
      h('circle', { cx: 12, cy: 12, r: 3 }),
      h('circle', { cx: 5, cy: 6, r: 2 }),
      h('circle', { cx: 19, cy: 7, r: 2 }),
      h('circle', { cx: 15, cy: 19, r: 2 }),
      h('path', { d: 'M6.6 7.3 10 10.4M13.9 10.6l3.4-2.4M13.4 14.6l1.1 2.7' }))

    /** The Guide card glyph; `size` comes from the host guide renderer. */
    function guideIcon(props) {
      const size = (props && typeof props.size === 'number' ? props.size : 16)
      return h('svg', {
        viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      },
        h('circle', { cx: 12, cy: 12, r: 3 }),
        h('circle', { cx: 5, cy: 6, r: 2 }),
        h('circle', { cx: 19, cy: 7, r: 2 }),
        h('circle', { cx: 15, cy: 19, r: 2 }),
        h('path', { d: 'M6.6 7.3 10 10.4M13.9 10.6l3.4-2.4M13.4 14.6l1.1 2.7' }))
    }

    function formatTime(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms)) return ''
      try { return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return '' }
    }

    function State(props) {
      return h('div', { className: `cmap-state ${props.error ? 'cmap-error' : ''}` },
        h('div', { className: 'cmap-state-icon' }, props.error ? ICON_TOOL : ICON_MAP),
        h('div', null, props.text))
    }

    /** Skill source → badge label + tint class; unknown sources fall back to the raw string. */
    const SOURCE_BADGES = {
      bundled: { label: '内置', cls: 'cmap-badge-blue' },
      custom: { label: '本地', cls: 'cmap-badge-green' },
      'project-dsh': { label: '项目', cls: 'cmap-badge-purple' },
      'project-agents': { label: '项目', cls: 'cmap-badge-purple' },
      'user-dsh': { label: '用户', cls: 'cmap-badge-teal' },
      'user-agents': { label: '用户', cls: 'cmap-badge-teal' },
    }

    function badgeOf(entry) {
      if (entry.kind === 'skill') {
        if (!entry.source) return null
        const known = SOURCE_BADGES[entry.source]
        return known ?? { label: entry.source, cls: 'cmap-badge-gray' }
      }
      if (entry.kind === 'mcp') return entry.server ? { label: entry.server, cls: 'cmap-badge-orange' } : null
      return { label: '内置', cls: 'cmap-badge-blue' }
    }

    function CapabilityCard(props) {
      const entry = props.entry
      const glyphClass = entry.kind === 'skill' ? 'cmap-glyph-skill' : entry.kind === 'mcp' ? 'cmap-glyph-mcp' : 'cmap-glyph-tool'
      const glyph = entry.kind === 'skill' ? ICON_SPARK : entry.kind === 'mcp' ? ICON_PLUG : ICON_TOOL
      const idle = entry.count === 0
      const badge = badgeOf(entry)
      const rawDescription = props.description
      const description = typeof rawDescription === 'string' && rawDescription.length > 400
        ? `${rawDescription.slice(0, 400).trimEnd()}…`
        : rawDescription
      return h('div', { className: 'cmap-card', title: description || null },
        h('div', { className: 'cmap-card-top' },
          h('span', { className: `cmap-glyph ${glyphClass}` }, glyph),
          h('div', { style: { minWidth: 0 } },
            h('div', { className: 'cmap-card-name' }, entry.name),
            entry.kind === 'mcp' && entry.server
              ? h('div', { className: 'cmap-card-server' }, `MCP · ${entry.server}`)
              : null),
          badge
            ? h('span', { className: `cmap-badge ${badge.cls}` }, badge.label)
            : null),
        h('div', { className: 'cmap-card-foot' },
          h('span', { className: 'cmap-card-time' }, idle ? '' : formatTime(entry.lastTime)),
          idle
            ? h('span', { className: 'cmap-chip cmap-chip-idle' }, '未运行')
            : entry.running > 0
              ? h('span', { className: 'cmap-chip' }, h('span', { className: 'cmap-dot' }), '运行中')
              : null,
          h('span', { className: 'cmap-count' },
            h('span', { className: 'cmap-count-num' }, String(entry.count)),
            h('span', { className: 'cmap-count-unit' }, '次')))
      )
    }

    const TABS = [
      { id: 'all', label: '全部' },
      { id: 'skill', label: '技能' },
      { id: 'tool', label: '工具' },
      { id: 'mcp', label: 'MCP' },
    ]

    function UsagePanel(props) {
      const sessionId = props.sessionId
      const [data, setData] = React.useState(undefined)
      const [error, setError] = React.useState(undefined)
      const [busy, setBusy] = React.useState(false)
      const [tab, setTab] = React.useState('all')
      const [showAll, setShowAll] = React.useState(false)
      const [query, setQuery] = React.useState('')

      const refresh = React.useCallback(async () => {
        if (!sessionId) return
        setBusy(true)
        try {
          const response = await fetch(`/usage/api/summary?sessionId=${encodeURIComponent(sessionId)}`, {
            credentials: 'same-origin', cache: 'no-store',
          })
          const body = await response.json()
          if (!response.ok || body?.ok !== true) throw new Error(body?.error?.message || `HTTP ${response.status}`)
          setData(body)
          setError(undefined)
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }, [sessionId])

      React.useEffect(() => {
        void refresh()
        const timer = setInterval(() => { void refresh() }, 5000)
        return () => clearInterval(timer)
      }, [refresh])

      const byKind = {
        skill: [...(data?.skills ?? [])].sort((a, b) => b.count - a.count),
        tool: [...(data?.tools ?? [])].sort((a, b) => b.count - a.count),
        mcp: [...(data?.mcp ?? [])].sort((a, b) => b.count - a.count),
      }
      // Preview of every locally available skill: uncalled ones join the grid
      // with count 0 and an idle chip when "show all" is on.
      const availableSkills = Array.isArray(data?.availableSkills) ? data.availableSkills : []
      const skillCatalog = new Map(availableSkills.map(s => [s.name, s]))
      const toolInfoMap = data?.toolInfo && typeof data.toolInfo === 'object' ? data.toolInfo : {}
      // Hover text and badge data: called entries carry only names/counts, so
      // skills merge from the session catalog and tools/MCP from the wire-name
      // description map the host builds from its tool registry.
      const describe = e => e.description
        ?? (e.kind === 'skill' ? skillCatalog.get(e.name)?.description : undefined)
        ?? (e.kind === 'tool' ? toolInfoMap[e.name] : undefined)
        ?? (e.kind === 'mcp' ? toolInfoMap[`mcp__${e.server}__${e.name}`] : undefined)
      const sourceOf = e => e.source ?? (e.kind === 'skill' ? skillCatalog.get(e.name)?.source : undefined)
      const usedSkillNames = new Set(byKind.skill.map(e => e.name))
      const skillEntries = showAll
        ? [...byKind.skill, ...availableSkills
            .filter(s => !usedSkillNames.has(s.name))
            .map(s => ({ kind: 'skill', name: s.name, count: 0, running: 0, lastTime: undefined, source: s.source, description: s.description }))]
        : byKind.skill
      const shownAll = tab === 'all' ? [...skillEntries, ...byKind.tool, ...byKind.mcp] : tab === 'skill' ? skillEntries : byKind[tab]
      // The header search narrows what every category shows; MCP cards also
      // match on their server name.
      const q = query.trim().toLowerCase()
      const shown = q
        ? shownAll.filter(e => e.name.toLowerCase().includes(q) || (e.server || '').toLowerCase().includes(q))
        : shownAll

      let body
      if (error !== undefined) {
        body = h(State, { error: true, text: `加载失败：${error}\n请稍后点右上角刷新重试。` })
      } else if (data === undefined) {
        body = h(State, { text: '加载中…' })
      } else if (data.available === false) {
        body = h(State, { text: '该会话当前未驻留，\n暂不统计历史（冷）会话的调用记录。' })
      } else {
        // The filter tabs always stay visible, so an empty category (say MCP)
        // is just a blank grid — never a dead end that hides the tab bar.
        body = h(React.Fragment, null,
          h('div', { className: 'cmap-tabs' },
            TABS.map(t => {
              // The badge mirrors what the grid actually shows: card count
              // per category, including uncalled previews when "show all".
              const count = t.id === 'all' ? skillEntries.length + byKind.tool.length + byKind.mcp.length : t.id === 'skill' ? skillEntries.length : byKind[t.id].length
              return h('button', {
                key: t.id,
                className: `cmap-tab ${tab === t.id ? 'active' : ''}`,
                onClick: () => setTab(t.id),
              }, t.label, h('span', { className: 'cmap-tab-count' }, String(count)))
            })),
          shown.length > 0
            ? h('div', { className: 'cmap-grid' },
                shown.map(entry => h(CapabilityCard, {
                  key: `${entry.kind}:${entry.kind === 'mcp' ? `${entry.server}__${entry.name}` : entry.name}`,
                  entry: { ...entry, source: sourceOf(entry) },
                  description: describe(entry),
                })))
            : null,
        )
      }

      return h('div', { className: 'cmap-root' },
        h('style', null, STYLE),
        h('div', { className: 'cmap-head' },
          h('div', { className: 'cmap-search' },
            ICON_SEARCH,
            h('input', {
              value: query,
              placeholder: '搜索能力…',
              spellCheck: false,
              onChange: e => setQuery(e.target.value),
            }),
            query
              ? h('button', { className: 'cmap-search-clear', title: '清空搜索', onClick: () => setQuery('') }, '×')
              : null),
          h('button', {
            className: `cmap-toggle ${showAll ? 'active' : ''}`,
            title: showAll ? '只显示本会话调用过的能力' : '显示本会话可用的全部技能（未调用的计 0 次）',
            onClick: () => setShowAll(v => !v),
          }, showAll ? '仅本会话' : '显示全部'),
          h('button', {
            className: 'cmap-refresh',
            title: '立即刷新',
            onClick: () => { void refresh() },
            disabled: busy,
          }, ICON_REFRESH)),
        h('div', { className: 'cmap-scroll' }, body))
    }

    return {
      inject: ['slots', 'sidebarRightTabs'],
      apply(ctx) {
        ctx.effect(() => ctx.inject(['sidebarRightTabs'], (bag) => {
          const tabs = bag.get('sidebarRightTabs')
          if (tabs === undefined || typeof tabs.register !== 'function') return undefined
          const disposers = []
          // 1. The tab TYPE: a page tab (no patterns) opened by kind, with one
          //    guide entry (icon + description) that draws the card in the
          //    "+" add panel.
          disposers.push(tabs.register({
            id: KIND,
            kind: KIND,
            keepMounted: true,
            title: () => '能力地图',
            guide: [{
              id: 'capability-map',
              order: 120,
              title: () => '能力地图',
              description: () => '会话调用的技能与工具汇总，可预览全部本地可用技能',
              icon: guideIcon,
            }],
          }))
          // 2. The body slot under the same key.
          disposers.push(ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
            name: 'sidebar.right.pane.tab',
            key: KIND,
            inject: (sessionId) => ({ sessionId }),
          }, UsagePanel)))
          // 3. The title chip: the map glyph before the label, the same seat the
          //    built-in 文件/Git tabs draw their icons through. The seat supplies
          //    the useTabInfo hook; reading it can throw before the tab record is
          //    committed, so the label falls back to the static title.
          disposers.push(ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register(
            { name: 'sidebar.right.pane.tab.title', key: KIND },
            function MapTitle(props) {
              let label = '能力地图'
              try {
                const info = typeof props?.useTabInfo === 'function' ? props.useTabInfo() : undefined
                if (typeof info?.tab?.title === 'string' && info.tab.title) label = info.tab.title
              } catch { /* tab record not committed yet */ }
              return h(React.Fragment, null, guideIcon({ size: 13 }), label)
            })))
          return () => {
            for (const dispose of disposers) {
              try { dispose() } catch { /* releasing a partial registration */ }
            }
          }
        }), 'dsh-capability-map: capability-map tab registration')
      },
    }
  },
})
